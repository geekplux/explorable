// KV cache for /api/explain (docs/PLAN.md §5.7). Keys hash the canonical URL
// and carry the doc schema version and PROMPT_VERSION, so a prompt change
// invalidates old entries. Docs live 30 days, failures 10 minutes, and a failed
// model call (AI_UNAVAILABLE, usually transient) only 1 minute.
import type { ExplorableDoc } from '../skills/explorable/kit/src/doc/schema.ts';
import { ApiError, type ErrorCode, isErrorCode } from './errors';
import { PROMPT_VERSION } from './plan/prompt';

export const DOC_TTL = 30 * 24 * 60 * 60;
export const ERROR_TTL = 600;
export const TRANSIENT_ERROR_TTL = 60;
/** Failures cached only briefly: the next minute may well succeed. */
const TRANSIENT: ReadonlySet<ErrorCode> = new Set(['AI_UNAVAILABLE']);
/** Failures that are not cached: transient or per-client. */
const UNCACHED: ReadonlySet<ErrorCode> = new Set(['INTERNAL', 'RATE_LIMITED', 'AI_BUDGET']);

/** The slice of a KV namespace the cache uses (a Map-backed fake in tests). */
export interface KvLike {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
}

export interface CacheKeys {
  doc: string;
  error: string;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function cacheKeys(canonical: string, version = PROMPT_VERSION): Promise<CacheKeys> {
  const hash = await sha256Hex(canonical);
  return { doc: `doc:v1:${version}:${hash}`, error: `err:v1:${version}:${hash}` };
}

export type Cached = { doc: ExplorableDoc } | { error: ApiError };

/** A cached doc or failure. KV errors count as a miss: the cache must never break a request. */
export async function readCache(kv: KvLike | undefined, keys: CacheKeys): Promise<Cached | undefined> {
  if (!kv) return undefined;
  try {
    const [doc, error] = await Promise.all([kv.get(keys.doc, 'json'), kv.get(keys.error, 'json')]);
    if (doc && typeof doc === 'object') return { doc: doc as ExplorableDoc };
    const e = error as { code?: unknown; message?: unknown; hint?: unknown } | null;
    if (e && isErrorCode(e.code) && typeof e.message === 'string') {
      return { error: new ApiError(e.code, e.message, typeof e.hint === 'string' ? e.hint : undefined) };
    }
  } catch {
    // fall through to a miss
  }
  return undefined;
}

export async function writeDoc(kv: KvLike | undefined, keys: CacheKeys, doc: ExplorableDoc): Promise<void> {
  await kv?.put(keys.doc, JSON.stringify(doc), { expirationTtl: DOC_TTL }).catch(() => {});
}

export async function writeError(kv: KvLike | undefined, keys: CacheKeys, error: unknown): Promise<void> {
  if (!(error instanceof ApiError) || UNCACHED.has(error.code)) return;
  const body = JSON.stringify({ code: error.code, message: error.message, hint: error.hint });
  const expirationTtl = TRANSIENT.has(error.code) ? TRANSIENT_ERROR_TTL : ERROR_TTL;
  await kv?.put(keys.error, body, { expirationTtl }).catch(() => {});
}
