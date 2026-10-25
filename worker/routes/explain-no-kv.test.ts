// PR Previews run without EXPLORABLE_CACHE (wrangler.jsonc env.production.previews):
// /api/explain must still answer, treating every request as a cache miss. With no KV
// to count the daily AI budget in, it never calls the model (worker/budget.ts).
import { describe, expect, it } from 'vitest';
import valid from '../fixtures/ai/valid.json';
import { URLS, fakeAi, serveFixtures } from '../testing';
import { type ExplainEnv, explain } from './explain';

describe('/api/explain without a KV binding', () => {
  it('answers every request as a miss in match mode, never calling the model', async () => {
    const ai = fakeAi(valid);
    const env: ExplainEnv = { AI: ai };
    const fetchFn = serveFixtures({});
    for (let i = 0; i < 2; i++) {
      const res = await explain(new Request(`http://localhost/api/explain?url=${encodeURIComponent(URLS.attention)}`), env, fetchFn);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-explorable-cache')).toBe('miss');
      expect(await res.json()).toMatchObject({ ok: true, mode: 'match', cache: 'miss' });
    }
    expect(ai.run).not.toHaveBeenCalled();
  });
});
