import type { ExplorableDoc } from '@kit/doc/schema.ts';

/** Server codes (worker/errors.ts) plus the ones only the browser can see. */
export type ErrorCode =
  | 'INVALID_URL' | 'BLOCKED_URL' | 'FETCH_FAILED' | 'UNSUPPORTED_CONTENT' | 'TOO_LITTLE_TEXT'
  | 'AI_UNAVAILABLE' | 'AI_BUDGET' | 'PLAN_INVALID' | 'NO_FIGURE' | 'RATE_LIMITED' | 'INTERNAL'
  | 'TIMEOUT' | 'NETWORK' | 'OFFLINE';

export type ExplainError = { code: ErrorCode; message: string; hint: string };
export type ExplainResult =
  | { ok: true; doc: ExplorableDoc; mode: 'ai' | 'match'; cache: 'hit' | 'miss' }
  | { ok: false; error: ExplainError };

const CODES = new Set<string>(['INVALID_URL', 'BLOCKED_URL', 'FETCH_FAILED', 'UNSUPPORTED_CONTENT', 'TOO_LITTLE_TEXT', 'AI_UNAVAILABLE', 'AI_BUDGET', 'PLAN_INVALID', 'NO_FIGURE', 'RATE_LIMITED', 'INTERNAL']);

export const fail = (code: ErrorCode, message = '', hint = ''): ExplainResult => ({ ok: false, error: { code, message, hint } });

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Read an /api/explain body defensively: anything malformed becomes INTERNAL. */
export function readExplain(body: unknown): ExplainResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const doc = b.doc as ExplorableDoc | undefined;
  if (b.ok === true && doc && typeof doc.title === 'string' && Array.isArray(doc.sections) && doc.source && doc.provenance) {
    return { ok: true, doc, mode: b.mode === 'ai' ? 'ai' : 'match', cache: b.cache === 'hit' ? 'hit' : 'miss' };
  }
  const e = (b.error ?? {}) as Record<string, unknown>;
  return fail(CODES.has(str(e.code)) ? (e.code as ErrorCode) : 'INTERNAL', str(e.message), str(e.hint));
}

/**
 * The steps of a new link, in the order the Worker streams them
 * (worker/routes/explain.ts). No percentages: only the step it is on.
 */
export const STAGES = [
  { id: 'fetching', label: 'Fetching the article' },
  { id: 'reading', label: 'Reading the text' },
  { id: 'planning', label: 'Finding the core idea and writing the essay' },
  { id: 'composing', label: 'Assembling the live figures' },
] as const;
export type StageId = (typeof STAGES)[number]['id'];
export const stageIndex = (id: unknown): number => STAGES.findIndex((s) => s.id === id);

/**
 * Fallback when the server streams no stages (an older Worker, or a proxy that
 * buffers): honest elapsed-time guesses for the first three steps, never "composing".
 */
export const STAGE_AT_MS = [0, 1500, 3000] as const;
/** Index of the fallback stage to show `ms` after the request started. */
export const stageAt = (ms: number): number => STAGE_AT_MS.findLastIndex((t) => ms >= t);

/** What to expect, said up front: a new link costs one model call (measured 25–28 s in production). */
export const EXPECT_COPY = 'New links usually take 15–30 seconds. Links someone has opened before are instant.';
/** Past this, the loading view says it is taking longer than usual (it keeps waiting). */
export const SLOW_MS = 35_000;
/** Give up after this long in total… */
export const TIMEOUT_MS = 90_000;
/** …or after this long with no line from a streaming Worker (it sends a tick every 5 s). */
export const IDLE_MS = 30_000;

/** The lines of a UTF-8 NDJSON body; a line may span chunks. */
export async function* ndjsonLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let rest = '';
  try {
    for (let r = await reader.read(); !r.done; r = await reader.read()) {
      const parts = (rest + decoder.decode(r.value, { stream: true })).split('\n');
      rest = parts.pop()!;
      for (const p of parts) if (p.trim()) yield p;
    }
    rest += decoder.decode();
    if (rest.trim()) yield rest;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
