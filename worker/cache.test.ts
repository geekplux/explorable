import { describe, expect, it } from 'vitest';
import { DOC_TTL, ERROR_TTL, TRANSIENT_ERROR_TTL, cacheKeys, readCache, sha256Hex, writeDoc, writeError } from './cache';
import { ApiError } from './errors';
import { PROMPT_VERSION } from './plan/prompt';
import { fakeKv } from './testing';

describe('cache', () => {
  it('hashes with sha256 and keys by schema and prompt version', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const keys = await cacheKeys('arxiv:1706.03762');
    const hash = await sha256Hex('arxiv:1706.03762');
    expect(keys).toEqual({ doc: `doc:v1:${PROMPT_VERSION}:${hash}`, error: `err:v1:${PROMPT_VERSION}:${hash}` });
  });

  it('changes the key when PROMPT_VERSION changes', async () => {
    const [a, b] = await Promise.all([cacheKeys('arxiv:1706.03762', 'p1'), cacheKeys('arxiv:1706.03762', 'p2')]);
    expect(a.doc).not.toBe(b.doc);
    expect(a.error).not.toBe(b.error);
  });

  it('stores docs for 30 days and failures for 10 minutes, but not INTERNAL or RATE_LIMITED', async () => {
    const kv = fakeKv();
    const keys = await cacheKeys('x');
    await writeDoc(kv, keys, { id: 'd' } as never);
    await writeError(kv, keys, new ApiError('NO_FIGURE', 'none'));
    expect(kv.store.get(keys.doc)?.ttl).toBe(DOC_TTL);
    expect(kv.store.get(keys.error)).toEqual({ value: expect.stringContaining('"code":"NO_FIGURE"'), ttl: ERROR_TTL });
    expect([DOC_TTL, ERROR_TTL]).toEqual([2_592_000, 600]);
    const other = fakeKv();
    await writeError(other, keys, new ApiError('RATE_LIMITED', 'slow down'));
    await writeError(other, keys, new TypeError('bug'));
    expect(other.store.size).toBe(0);
  });

  it('keeps a failed model call (AI_UNAVAILABLE) for only a minute', async () => {
    const kv = fakeKv();
    const keys = await cacheKeys('x');
    await writeError(kv, keys, new ApiError('AI_UNAVAILABLE', 'model down'));
    expect(kv.store.get(keys.error)?.ttl).toBe(TRANSIENT_ERROR_TTL);
    expect(TRANSIENT_ERROR_TTL).toBe(60);
  });

  it('reads a cached failure back as an ApiError, and treats KV errors or junk as a miss', async () => {
    const kv = fakeKv();
    const keys = await cacheKeys('x');
    await writeError(kv, keys, new ApiError('PLAN_INVALID', 'bad plan'));
    const hit = await readCache(kv, keys);
    expect(hit && 'error' in hit && [hit.error.code, hit.error.message]).toEqual(['PLAN_INVALID', 'bad plan']);
    kv.store.set(keys.error, { value: '{"code":"NOPE","message":"x"}', ttl: 1 });
    expect(await readCache(kv, keys)).toBeUndefined();
    kv.get.mockRejectedValueOnce(new Error('KV down'));
    expect(await readCache(kv, keys)).toBeUndefined();
    expect(await readCache(undefined, keys)).toBeUndefined();
  });
});
