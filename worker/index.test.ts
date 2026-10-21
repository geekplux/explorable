import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

const env = (vars: Partial<Env> = {}) =>
  ({
    ASSETS: { fetch: vi.fn<() => Promise<Response>>(async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })) },
    EXPLORABLE_CACHE: {},
    EXPLORABLE_DEBUG: '1',
    ...vars,
  }) as unknown as Env;
const call = (path: string, e = env()) =>
  worker.fetch(new Request(`http://localhost${path}`) as Parameters<typeof worker.fetch>[0], e, { waitUntil: () => {} } as unknown as ExecutionContext);

afterEach(() => vi.unstubAllGlobals());

describe('worker router', () => {
  it('answers /api/health without AI', async () => {
    const res = await call('/api/health');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ ok: true, ai: false, kv: true });
  });

  it('serves /api/extract only when EXPLORABLE_DEBUG is "1"', async () => {
    const off = await call('/api/extract?url=https://example.com/', env({ EXPLORABLE_DEBUG: '0' }));
    expect(off.status).toBe(404);
    expect(await off.json()).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    const blocked = await call(`/api/extract?url=${encodeURIComponent('http://127.0.0.1/')}`);
    expect(blocked.status).toBe(400);
    expect(await blocked.json()).toEqual({
      ok: false,
      error: { code: 'BLOCKED_URL', message: 'Private or local addresses are not allowed.', hint: expect.any(String) },
    });
  });

  it('returns the extraction for a page', async () => {
    const page = `<title>T</title><article><h1>Heading</h1><p>${'A sentence about the idea. '.repeat(40)}</p></article>`;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(page, { headers: { 'content-type': 'text/html' } })));
    const body = (await (await call('/api/extract?url=example.com/post')).json()) as { ok: boolean; extracted: { title: string } };
    expect(body.ok).toBe(true);
    expect(body.extracted.title).toBe('Heading');
  });

  it('hands non-API paths to the assets binding', async () => {
    const e = env();
    await call('/s/attention', e);
    expect(e.ASSETS.fetch).toHaveBeenCalledOnce();
  });
});
