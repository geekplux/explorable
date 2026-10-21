import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { type FetchFn, HTML_TYPES, USER_AGENT, fetchText } from './fetch';

const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });
const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

/** Never answers; rejects when the request is aborted, like the real fetch. */
const hang: FetchFn = (_url, init) =>
  new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))));

async function failure(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('fetchText', () => {
  it('sends the User-Agent, never follows redirects itself, and decodes the body', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => html('<p>héllo</p>'));
    const page = await fetchText('https://example.com/a', HTML_TYPES, fetchFn);
    expect(page).toEqual({ url: 'https://example.com/a', type: 'text/html', body: '<p>héllo</p>' });
    const init = fetchFn.mock.calls[0]?.[1];
    expect(init?.redirect).toBe('manual');
    expect(new Headers(init?.headers).get('user-agent')).toBe(USER_AGENT);
  });

  it('follows up to 3 redirects, re-checking each target', async () => {
    const hops = ['https://b.example.com/', '/c', 'https://d.example.com/'];
    const fetchFn = vi.fn<FetchFn>(async () => (hops.length ? redirect(hops.shift()!) : html('ok')));
    expect((await fetchText('https://a.example.com/', HTML_TYPES, fetchFn)).url).toBe('https://d.example.com/');
    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual([
      'https://a.example.com/', 'https://b.example.com/', 'https://b.example.com/c', 'https://d.example.com/',
    ]);
  });

  it('fails after more than 3 redirects', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => redirect('https://example.com/again'));
    const error = await failure(fetchText('https://example.com/', HTML_TYPES, fetchFn));
    expect(error.code).toBe('FETCH_FAILED');
    expect(error.message).toMatch(/redirected too many times/);
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('blocks a redirect to a private address without fetching it', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => redirect('http://169.254.169.254/latest/meta-data'));
    expect((await failure(fetchText('https://example.com/', HTML_TYPES, fetchFn))).code).toBe('BLOCKED_URL');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('blocks a redirect to a trailing-dots loopback address', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => redirect('http://127.0.0.1../'));
    expect((await failure(fetchText('https://example.com/', HTML_TYPES, fetchFn))).code).toBe('BLOCKED_URL');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('times out a hanging request', async () => {
    const limits = { timeoutMs: 20, maxBytes: 1000, maxRedirects: 3 };
    const error = await failure(fetchText('https://example.com/', HTML_TYPES, hang, limits));
    expect(error.code).toBe('FETCH_FAILED');
    expect(error.message).toMatch(/longer than/);
  });

  it('enforces the 3 MB cap from content-length and while streaming', async () => {
    const big = 'x'.repeat(3 * 1024 * 1024 + 1);
    const declared = await failure(fetchText('https://example.com/', HTML_TYPES, async () => html('', { 'content-length': String(big.length) })));
    expect(declared.message).toMatch(/3 MB/);
    const streamed = await failure(fetchText('https://example.com/', HTML_TYPES, async () => html(big)));
    expect(streamed.code).toBe('UNSUPPORTED_CONTENT');
    expect(streamed.message).toMatch(/3 MB/);
  });

  it('rejects other content types, PDFs with a specific message', async () => {
    const pdf = await failure(
      fetchText('https://example.com/p', HTML_TYPES, async () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } })),
    );
    expect([pdf.code, pdf.message]).toEqual(['UNSUPPORTED_CONTENT', 'PDFs are only supported on arXiv.']);
    const png = await failure(fetchText('https://example.com/i', HTML_TYPES, async () => new Response('x', { headers: { 'content-type': 'image/png' } })));
    expect(png.code).toBe('UNSUPPORTED_CONTENT');
  });

  it('maps HTTP errors and network errors to FETCH_FAILED', async () => {
    expect((await failure(fetchText('https://example.com/', HTML_TYPES, async () => new Response('', { status: 404 })))).message).toMatch(/404/);
    expect((await failure(fetchText('https://example.com/', HTML_TYPES, async () => Promise.reject(new TypeError('dns'))))).code).toBe('FETCH_FAILED');
  });
});
