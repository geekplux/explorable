// GET /api/explain?url=: normalise → cache → extract →
// match → at most one model call → assemble → cache. Returns
// { ok, doc, cache, mode } or { ok: false, error }, with x-explorable-cache.
//
// A client that sends `Accept: application/x-ndjson` gets a cache miss as a
// stream instead: `{"type":"stage","stage":…}` lines as the work moves through
// fetching → reading → planning → composing, a `{"type":"tick"}` every few
// seconds while the model writes, then one `{"type":"result", …}` line with the
// same body the JSON answer has. Cache hits and request errors stay plain JSON.
import { dailyCap, takeBudget } from '../budget';
import { type KvLike, cacheKeys, readCache, writeDoc, writeError } from '../cache';
import { API_HEADERS, ApiError, errorResponse, json } from '../errors';
import { type Extracted, extract } from '../extract';
import type { FetchFn } from '../fetch';
import { type AiBinding, DEFAULT_AI_MODEL, requestPlan } from '../plan/ai';
import { assemblePlan, clean, matchDoc } from '../plan/assemble';
import { bestMatch, matchModels } from '../plan/match';
import { readingLevel } from '../plan/reading';
import { MODELS } from '../plan/schema';
import { normaliseUrl } from '../url';
import type { ExplorableDoc } from '../../skills/explorable/kit/src/doc/schema.ts';

/** Bindings /api/explain uses. AI and the limiter exist only in production. */
export interface ExplainEnv {
  EXPLORABLE_CACHE?: KvLike;
  AI?: AiBinding;
  AI_MODEL?: string;
  /** Model calls per UTC day for the whole site (worker/budget.ts); unset means the default. */
  DAILY_AI_CAP?: string;
  EXPLAIN_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

/** Where a cache miss is: fetching the page, reading its text, the model call, assembling figures. */
export const STAGES = ['fetching', 'reading', 'planning', 'composing'] as const;
export type Stage = (typeof STAGES)[number];
/** Seconds between keep-alive ticks while a stream waits (mostly on the model). */
export const TICK_MS = 5_000;
export const NDJSON = 'application/x-ndjson';

const CACHE_HEADER = 'x-explorable-cache';

/** End a sentence with a period unless it already has closing punctuation. */
const sentence = (s: string) => (s && !/[.!?…]$/.test(s) ? `${s}.` : s);

export function unavailable(ex: Pick<Extracted, 'title' | 'abstract'>): ApiError {
  const title = clean(ex.title);
  const abstract = clean(ex.abstract);
  const excerpt = abstract.length > 200 ? `${abstract.slice(0, 200).trimEnd()}…` : abstract;
  return new ApiError(
    'AI_UNAVAILABLE',
    'No model is configured here, and this page matches no built-in explorable.',
    [title && `Found “${title}”.`, excerpt !== title && sentence(excerpt), 'The built-in samples still work.'].filter(Boolean).join(' '),
  );
}

export function budgetSpent(): ApiError {
  return new ApiError(
    'AI_BUDGET',
    'Today’s live AI budget is used up, and this page matches no built-in explorable.',
    'Live explains reset at midnight UTC. The built-in samples still work.',
  );
}

/** `cache: false` marks a match-mode stand-in served only because the AI budget ran out. */
type Built = { doc: ExplorableDoc; mode: 'ai' | 'match'; cache: boolean };
type OnStage = (stage: Stage) => void;

async function build(ex: Extracted, env: ExplainEnv, onStage: OnStage): Promise<Built> {
  const matches = matchModels(ex);
  // Past the daily cap, fall back to match mode; that answer is not cached, so the
  // link can still get a real model plan once the budget resets.
  const capped = Boolean(env.AI) && !(await takeBudget(env.EXPLORABLE_CACHE, dailyCap(env.DAILY_AI_CAP)));
  if (env.AI && !capped) {
    const model = env.AI_MODEL || DEFAULT_AI_MODEL;
    onStage('planning');
    const plan = await requestPlan(env.AI, model, ex, matches.map((m) => m.id));
    onStage('composing');
    let report = {};
    const doc = assemblePlan(plan, ex, { model, onReport: (r) => (report = r) });
    logPlain(doc, report);
    return { doc, mode: 'ai', cache: true };
  }
  const best = bestMatch(matches);
  const template = best && MODELS.find((m) => m.id === best.id)?.template;
  if (!template) throw capped ? budgetSpent() : unavailable(ex);
  onStage('composing');
  return { doc: matchDoc(template, ex), mode: 'match', cache: !capped };
}

/**
 * One cache miss in flight per URL in this isolate: a second request for the same
 * link joins the first (and hears its stages) instead of paying for another model call.
 */
interface Job {
  done: Promise<Built>;
  stage: Stage;
  listeners: Set<OnStage>;
}
const inflight = new Map<string, Job>();

/** In-flight jobs (tests). */
export const inflightCount = () => inflight.size;

function startJob(key: string, run: (onStage: OnStage) => Promise<Built>): Job {
  const job: Job = { done: Promise.resolve() as unknown as Promise<Built>, stage: 'fetching', listeners: new Set() };
  const onStage: OnStage = (stage) => {
    if (STAGES.indexOf(stage) <= STAGES.indexOf(job.stage)) return; // stages only move forward, once each
    job.stage = stage;
    for (const l of job.listeners) l(stage);
  };
  job.done = run(onStage).finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

/** A Response that streams NDJSON lines written by `run`; ticks keep the connection alive. */
function ndjsonStream(run: (send: (line: object) => void) => Promise<void>, headers: Record<string, string>): { response: Response; done: Promise<void> } {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  // A gone client makes writes fail; the job still finishes and fills the cache.
  const send = (line: object) => void writer.write(encoder.encode(`${JSON.stringify(line)}\n`)).catch(() => {});
  const tick = setInterval(() => send({ type: 'tick' }), TICK_MS);
  const done = run(send).finally(() => {
    clearInterval(tick);
    return writer.close().catch(() => {});
  });
  const response = new Response(readable, { headers: { ...API_HEADERS, 'content-type': `${NDJSON}; charset=utf-8`, ...headers } });
  return { response, done };
}

const errorBody = (error: unknown) => {
  const e = error instanceof ApiError ? error : new ApiError('INTERNAL', 'Unexpected error');
  return { ok: false, error: { code: e.code, message: e.message, hint: e.hint } };
};

/** Monitoring for the plain-words voice (DESIGN §9): the reading grade and what the post-process changed. Counts only. */
function logPlain(doc: ExplorableDoc, report: object) {
  const { grade, words, sentences } = readingLevel(doc);
  console.log('explain: plain words', { grade, words, sentences, notes: doc.notes?.length ?? 0, ...report });
}

/** Log the code only: never article text or model output. */
function logInternal(error: unknown) {
  if (!(error instanceof ApiError)) console.error('explain: internal error', (error as Error)?.name);
}

export async function explain(request: Request, env: ExplainEnv, fetchFn?: FetchFn, ctx?: Pick<ExecutionContext, 'waitUntil'>): Promise<Response> {
  const miss = { [CACHE_HEADER]: 'miss' };
  try {
    const source = normaliseUrl(new URL(request.url).searchParams.get('url') ?? '');
    const keys = await cacheKeys(source.canonical);
    const cached = await readCache(env.EXPLORABLE_CACHE, keys);
    if (cached) {
      const hit = { [CACHE_HEADER]: 'hit' };
      if ('error' in cached) return errorResponse(cached.error, hit);
      return json({ ok: true, doc: cached.doc, cache: 'hit', mode: cached.doc.provenance.mode }, 200, hit);
    }
    let job = inflight.get(keys.doc);
    if (!job) {
      // Joining a job already in flight costs nothing, so only a new job meets the limiter.
      const ip = request.headers.get('cf-connecting-ip') ?? 'local';
      if (env.EXPLAIN_LIMITER && !(await env.EXPLAIN_LIMITER.limit({ key: ip })).success) {
        throw new ApiError('RATE_LIMITED', 'Too many new links from this address in the last minute.');
      }
      const doFetch: FetchFn = fetchFn ?? ((url, init) => fetch(url, init));
      job = startJob(keys.doc, async (onStage) => {
        try {
          // The job starts at 'fetching'; the first response headers mean the page answered, and what is left is reading its text.
          const reading: FetchFn = async (url, init) => {
            const res = await doFetch(url, init);
            onStage('reading');
            return res;
          };
          const built = await build(await extract(source, reading), env, onStage);
          if (built.cache) await writeDoc(env.EXPLORABLE_CACHE, keys, built.doc);
          return built;
        } catch (error) {
          await writeError(env.EXPLORABLE_CACHE, keys, error);
          throw error;
        }
      });
    }
    const current = job;
    if (!(request.headers.get('accept') ?? '').includes(NDJSON)) {
      const { doc, mode } = await current.done;
      return json({ ok: true, doc, cache: 'miss', mode }, 200, miss);
    }
    const { response, done } = ndjsonStream(async (send) => {
      const onStage: OnStage = (stage) => send({ type: 'stage', stage });
      onStage(current.stage);
      current.listeners.add(onStage);
      try {
        const { doc, mode } = await current.done;
        send({ type: 'result', ok: true, doc, cache: 'miss', mode });
      } catch (error) {
        logInternal(error);
        send({ type: 'result', ...errorBody(error) });
      } finally {
        current.listeners.delete(onStage);
      }
    }, miss);
    ctx?.waitUntil(done);
    return response;
  } catch (error) {
    logInternal(error);
    return errorResponse(error, miss);
  }
}
