// Test doubles for the Worker (plain Vitest, no workerd): a Map-backed KV
// that records TTLs, a fake Workers AI that replays a recorded fixture, and a
// fake fetch that serves fixtures by URL.
import { vi } from 'vitest';
import type { KvLike } from './cache';
import type { FetchFn } from './fetch';
import arxivHtml from './fixtures/arxiv-1706.03762.html?raw';
import atom1706 from './fixtures/atom-1706.03762.xml?raw';
import bloomHtml from './fixtures/bloom-tutorial.html?raw';
import navHeavyHtml from './fixtures/nav-heavy-blog.html?raw';
import tinyHtml from './fixtures/tiny-page.html?raw';

export function fakeKv() {
  const store = new Map<string, { value: string; ttl: number }>();
  const kv = {
    store,
    get: vi.fn<(key: string, type: 'json') => Promise<unknown>>(async (key) => {
      const hit = store.get(key);
      return hit ? JSON.parse(hit.value) : null;
    }),
    put: vi.fn<KvLike['put']>(async (key, value, { expirationTtl }) => {
      store.set(key, { value, ttl: expirationTtl });
    }),
  };
  return kv satisfies KvLike;
}

/** A recorded `env.AI.run` result (`{ response }`), or `{ error }` to make the call throw. */
export function fakeAi(fixture: unknown) {
  return {
    run: vi.fn<(model: string, input: Record<string, unknown>) => Promise<unknown>>(async () => {
      const error = (fixture as { error?: string }).error;
      if (error) throw new Error(error);
      return structuredClone(fixture);
    }),
  };
}

const ATOM = 'application/atom+xml; charset=utf-8';
const HTML = 'text/html; charset=utf-8';
export const URLS = {
  attention: 'https://arxiv.org/abs/1706.03762',
  bloom: 'https://llimllib.github.io/bloomfilter-tutorial/',
  rope: 'https://notes.example.org/ropes',
  tiny: 'https://notes.example.org/tiny',
};
const ROUTES: Record<string, [string, string]> = {
  'https://export.arxiv.org/api/query?id_list=1706.03762': [ATOM, atom1706],
  'https://arxiv.org/html/1706.03762': [HTML, arxivHtml],
  [URLS.bloom]: [HTML, bloomHtml],
  [URLS.rope]: [HTML, navHeavyHtml],
  [URLS.tiny]: [HTML, tinyHtml],
};

/** A fake fetch serving the fixtures above; anything else is a 404. */
export const serveFixtures = (extra: Record<string, [string, string]> = {}): FetchFn =>
  vi.fn<FetchFn>(async (url) => {
    const hit = extra[url] ?? ROUTES[url];
    return hit ? new Response(hit[1], { headers: { 'content-type': hit[0] } }) : new Response('missing', { status: 404 });
  });
