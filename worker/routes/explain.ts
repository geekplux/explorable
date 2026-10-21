// GET /api/explain?url= (docs/PLAN.md §5.3, §5.6): normalise → cache → extract →
// match → at most one model call → assemble → cache. Returns
// { ok, doc, cache, mode } or { ok: false, error }, with x-explorable-cache.
import { type KvLike, cacheKeys, readCache, writeDoc, writeError } from '../cache';
import { ApiError, errorResponse, json } from '../errors';
import { type Extracted, extract } from '../extract';
import type { FetchFn } from '../fetch';
import { type AiBinding, DEFAULT_AI_MODEL, requestPlan } from '../plan/ai';
import { assemblePlan, matchDoc } from '../plan/assemble';
import { bestMatch, matchModels } from '../plan/match';
import { MODELS } from '../plan/schema';
import { normaliseUrl } from '../url';

/** Bindings /api/explain uses. AI and the limiter exist only in production (D4, P15). */
export interface ExplainEnv {
  EXPLORABLE_CACHE?: KvLike;
  AI?: AiBinding;
  AI_MODEL?: string;
  EXPLAIN_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

const CACHE_HEADER = 'x-explorable-cache';

function unavailable(ex: Extracted): ApiError {
  const excerpt = ex.abstract.length > 200 ? `${ex.abstract.slice(0, 200).trimEnd()}…` : ex.abstract;
  return new ApiError(
    'AI_UNAVAILABLE',
    'No model is configured here, and this page matches no built-in explorable.',
    [`Found “${ex.title}”.`, excerpt, 'The built-in samples still work.'].filter(Boolean).join(' '),
  );
}

async function build(ex: Extracted, env: ExplainEnv) {
  const matches = matchModels(ex);
  if (env.AI) {
    const model = env.AI_MODEL || DEFAULT_AI_MODEL;
    const plan = await requestPlan(env.AI, model, ex, matches.map((m) => m.id));
    return { doc: assemblePlan(plan, ex, { model }), mode: 'ai' as const };
  }
  const best = bestMatch(matches);
  const template = best && MODELS.find((m) => m.id === best.id)?.template;
  if (!template) throw unavailable(ex);
  return { doc: matchDoc(template, ex), mode: 'match' as const };
}

export async function explain(request: Request, env: ExplainEnv, fetchFn?: FetchFn): Promise<Response> {
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
    const ip = request.headers.get('cf-connecting-ip') ?? 'local';
    if (env.EXPLAIN_LIMITER && !(await env.EXPLAIN_LIMITER.limit({ key: ip })).success) {
      throw new ApiError('RATE_LIMITED', 'Too many new links from this address in the last minute.');
    }
    try {
      const { doc, mode } = await build(await extract(source, fetchFn), env);
      await writeDoc(env.EXPLORABLE_CACHE, keys, doc);
      return json({ ok: true, doc, cache: 'miss', mode }, 200, miss);
    } catch (error) {
      await writeError(env.EXPLORABLE_CACHE, keys, error);
      throw error;
    }
  } catch (error) {
    // Log the code only: never article text or model output.
    if (!(error instanceof ApiError)) console.error('explain: internal error', (error as Error)?.name);
    return errorResponse(error, miss);
  }
}
