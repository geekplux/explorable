import type { ExplorableDoc } from '@kit/doc/schema.ts';

/** Server codes (docs/PLAN.md §5.6) plus the ones only the browser can see. */
export type ErrorCode =
  | 'INVALID_URL' | 'BLOCKED_URL' | 'FETCH_FAILED' | 'UNSUPPORTED_CONTENT' | 'TOO_LITTLE_TEXT'
  | 'AI_UNAVAILABLE' | 'PLAN_INVALID' | 'NO_FIGURE' | 'RATE_LIMITED' | 'INTERNAL'
  | 'TIMEOUT' | 'NETWORK' | 'OFFLINE';

export type ExplainError = { code: ErrorCode; message: string; hint: string };
export type ExplainResult =
  | { ok: true; doc: ExplorableDoc; mode: 'ai' | 'match'; cache: 'hit' | 'miss' }
  | { ok: false; error: ExplainError };

const CODES = new Set<string>(['INVALID_URL', 'BLOCKED_URL', 'FETCH_FAILED', 'UNSUPPORTED_CONTENT', 'TOO_LITTLE_TEXT', 'AI_UNAVAILABLE', 'PLAN_INVALID', 'NO_FIGURE', 'RATE_LIMITED', 'INTERNAL']);

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

/** Honest, time-driven stages (PLAN §4.6): no percentages, only what is likely happening. */
export const STAGES = ['Fetching the article…', 'Finding the core idea…', 'Assembling live figures…'] as const;
export const STAGE_AT_MS = [0, 1500, 6000] as const;
export const TIMEOUT_MS = 30_000;

/** Index of the stage to show `ms` after the request started. */
export const stageAt = (ms: number): number => STAGE_AT_MS.findLastIndex((t) => ms >= t);
