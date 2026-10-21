import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseDoc } from '../../skills/explorable/kit/src/doc/schema.ts';
import { ERROR_TTL, cacheKeys } from '../cache';
import invalidJson from '../fixtures/ai/invalid-json.json';
import jsonModeError from '../fixtures/ai/json-mode-error.json';
import maliciousExpr from '../fixtures/ai/malicious-expr.json';
import schemaViolation from '../fixtures/ai/schema-violation.json';
import valid from '../fixtures/ai/valid.json';
import worker from '../index';
import { MAX_SOURCE_CHARS } from '../plan/prompt';
import { URLS, fakeAi, fakeKv, serveFixtures } from '../testing';
import { type ExplainEnv, explain, unavailable } from './explain';

type Body = { ok: boolean; cache?: string; mode?: string; doc?: any; error?: { code: string; message: string; hint: string } };

function setup(init: Partial<ExplainEnv> = {}) {
  const kv = fakeKv();
  const env: ExplainEnv = { EXPLORABLE_CACHE: kv, ...init };
  const fetchFn = serveFixtures({ 'https://notes.example.org/paper.pdf': ['application/pdf', '%PDF-1.7'] });
  const call = async (url: string) => {
    const res = await explain(new Request(`http://localhost/api/explain?url=${encodeURIComponent(url)}`), env, fetchFn);
    return { res, status: res.status, cache: res.headers.get('x-explorable-cache'), body: (await res.json()) as Body };
  };
  return { kv, env, fetchFn, call };
}

afterEach(() => vi.unstubAllGlobals());

describe('/api/explain with a model', () => {
  it('makes one AI call, returns a valid doc, then serves the cache', async () => {
    const ai = fakeAi(valid);
    const { kv, call } = setup({ AI: ai });
    const first = await call(URLS.attention);
    expect(first.body).toMatchObject({ ok: true, mode: 'ai', cache: 'miss' });
    expect(first.cache).toBe('miss');
    expect(parseDoc(first.body.doc).ok).toBe(true);
    expect(first.body.doc.provenance.model).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    const second = await call('https://arxiv.org/abs/1706.03762v7');
    expect(second.body).toMatchObject({ ok: true, mode: 'ai', cache: 'hit' });
    expect(second.cache).toBe('hit');
    expect(second.body.doc).toEqual(first.body.doc);
    expect(ai.run).toHaveBeenCalledOnce();
    expect([...kv.store.values()][0]?.ttl).toBe(30 * 24 * 60 * 60);
  });

  it('accepts a response that arrives as a JSON string', async () => {
    const { call } = setup({ AI: fakeAi({ response: JSON.stringify(valid.response) }) });
    expect((await call(URLS.attention)).body).toMatchObject({ ok: true, mode: 'ai' });
  });

  it('sends one JSON-Mode request with capped source text (request shape)', async () => {
    const ai = fakeAi(valid);
    const { call } = setup({ AI: ai, AI_MODEL: '@cf/test/model' });
    await call(URLS.attention);
    const [model, input] = ai.run.mock.calls[0]!;
    const req = input as { messages: { role: string; content: string }[]; response_format: { type: string; json_schema: any }; max_tokens: number; temperature: number };
    const user = req.messages[1]!.content;
    const article = user.slice(user.indexOf('<<<ARTICLE\n') + 11, user.lastIndexOf('\nARTICLE>>>'));
    expect(article.length).toBeLessThanOrEqual(MAX_SOURCE_CHARS);
    expect(req.max_tokens).toBeLessThanOrEqual(1800);
    expect({
      model,
      keys: Object.keys(req).toSorted(),
      roles: req.messages.map((m) => m.role),
      response_format: { type: req.response_format.type, schemaType: req.response_format.json_schema.type, required: req.response_format.json_schema.required },
      max_tokens: req.max_tokens,
      temperature: req.temperature,
      userHead: user.split('\n').slice(0, 3),
    }).toMatchSnapshot();
  });

  it.each([
    ['invalid JSON', invalidJson],
    ['the JSON Mode error', jsonModeError],
    ['a schema violation', schemaViolation],
  ])('caches PLAN_INVALID for 600 s after %s, with no retry', async (_, fixture) => {
    const ai = fakeAi(fixture);
    const { kv, call } = setup({ AI: ai });
    const first = await call(URLS.attention);
    expect([first.status, first.body.error?.code, first.cache]).toEqual([502, 'PLAN_INVALID', 'miss']);
    const keys = await cacheKeys('arxiv:1706.03762');
    expect(kv.store.get(keys.error)?.ttl).toBe(ERROR_TTL);
    expect(kv.store.has(keys.doc)).toBe(false);
    const second = await call(URLS.attention);
    expect([second.body.error, second.cache]).toEqual([first.body.error, 'hit']);
    expect(ai.run).toHaveBeenCalledOnce();
  });

  it('returns NO_FIGURE when every figure is dropped', async () => {
    const bad = maliciousExpr.response.figures[1]!;
    const { call } = setup({ AI: fakeAi({ response: { ...maliciousExpr.response, figures: [bad, { ...bad, section: 0 }] } }) });
    expect((await call(URLS.attention)).body.error?.code).toBe('NO_FIGURE');
  });

  it('makes no model call for a cached URL (lean AI)', async () => {
    const { env, call } = setup();
    expect((await call(URLS.attention)).body.mode).toBe('match'); // fills the cache
    const ai = fakeAi(valid);
    env.AI = ai;
    expect((await call(URLS.attention)).body).toMatchObject({ ok: true, cache: 'hit', mode: 'match' });
    expect(ai.run).not.toHaveBeenCalled();
  });
});

describe('/api/explain without a model', () => {
  it('uses match mode for the attention paper: the template with the real source, 0 AI calls', async () => {
    const { call, fetchFn } = setup();
    const { body, cache } = await call(URLS.attention);
    expect(body).toMatchObject({ ok: true, mode: 'match', cache: 'miss' });
    expect(cache).toBe('miss');
    expect(body.doc.title).toBe('Why attention divides by √d');
    expect(body.doc.provenance.mode).toBe('match');
    expect(body.doc.source).toMatchObject({ kind: 'arxiv', url: URLS.attention, title: 'Attention Is All You Need', year: 2017 });
    expect(body.doc.source.authors).toEqual(expect.arrayContaining(['Ashish Vaswani', 'Illia Polosukhin']));
    expect(parseDoc(body.doc).ok).toBe(true);
    const calls = vi.mocked(fetchFn).mock.calls.length;
    expect((await call(URLS.attention)).cache).toBe('hit');
    expect(vi.mocked(fetchFn).mock.calls.length).toBe(calls);
  });

  it('returns AI_UNAVAILABLE for an unrelated post, naming its title', async () => {
    const { body, status } = await setup().call(URLS.rope);
    expect(status).toBe(503);
    expect(body.error?.code).toBe('AI_UNAVAILABLE');
    expect(body.error?.hint).toContain('Why ropes beat strings for big edits');
  });
});

describe('AI_UNAVAILABLE hint', () => {
  it('ends sentences with a period, cleans the title and skips an excerpt that repeats it', () => {
    expect(unavailable({ title: 'A\u0007 rope\n post', abstract: 'Ropes split text into a tree' }).hint).toBe(
      'Found “A rope post”. Ropes split text into a tree. The built-in samples still work.',
    );
    expect(unavailable({ title: 'Ropes', abstract: 'Ropes' }).hint).toBe('Found “Ropes”. The built-in samples still work.');
  });
});

const limiter = (result: boolean | Error) => ({
  limit: vi.fn<() => Promise<{ success: boolean }>>(async () => {
    if (result instanceof Error) throw result;
    return { success: result };
  }),
});

describe('error codes (docs/PLAN.md §5.6)', () => {
  const cases: Array<[string, string, Partial<ExplainEnv>?]> = [
    ['INVALID_URL', ''],
    ['BLOCKED_URL', 'http://127.0.0.1/admin'],
    ['FETCH_FAILED', 'https://notes.example.org/missing'],
    ['UNSUPPORTED_CONTENT', 'https://notes.example.org/paper.pdf'],
    ['TOO_LITTLE_TEXT', URLS.tiny],
    ['AI_UNAVAILABLE', URLS.rope],
    ['PLAN_INVALID', URLS.attention, { AI: fakeAi(invalidJson) }],
    ['NO_FIGURE', URLS.attention, { AI: fakeAi({ response: { ...maliciousExpr.response, figures: [maliciousExpr.response.figures[1]!, maliciousExpr.response.figures[1]!] } }) }],
    ['RATE_LIMITED', URLS.attention, { EXPLAIN_LIMITER: limiter(false) }],
    ['INTERNAL', URLS.attention, { EXPLAIN_LIMITER: limiter(new TypeError('boom')) }],
  ];

  it.each(cases)('%s has a stable { code, message, hint }', async (code, url, env) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { status, body } = await setup(env).call(url);
    expect(body.ok).toBe(false);
    expect(Object.keys(body.error!)).toEqual(['code', 'message', 'hint']);
    expect(body.error?.code).toBe(code);
    expect({ status, error: body.error }).toMatchSnapshot();
  });
});

describe('router', () => {
  it('routes /api/explain through the Worker entry', async () => {
    vi.stubGlobal('fetch', vi.fn<() => Promise<Response>>(async () => new Response('missing', { status: 404 })));
    const env = { ASSETS: { fetch: vi.fn<() => Promise<Response>>() }, EXPLORABLE_CACHE: fakeKv(), EXPLORABLE_DEBUG: '0' } as unknown as Env;
    const res = await worker.fetch(new Request('http://localhost/api/explain?url=https%3A%2F%2Fnotes.example.org%2Fx') as Parameters<typeof worker.fetch>[0], env);
    expect(res.headers.get('x-explorable-cache')).toBe('miss');
    expect(((await res.json()) as Body).error?.code).toBe('FETCH_FAILED');
  });
});
