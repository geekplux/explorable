// The explorable Worker: static assets serve the SPA; only /api/* runs
// here (wrangler.jsonc `run_worker_first`). Workers AI is bound only in production.
import { ApiError, errorResponse, json } from './errors';
import { extract } from './extract';
import { type ExplainEnv, explain } from './routes/explain';
import { normaliseUrl } from './url';

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname, searchParams } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (pathname === '/api/health') {
        return json({ ok: true, ai: 'AI' in env && Boolean(env.AI), kv: Boolean(env.EXPLORABLE_CACHE) });
      }
      if (pathname === '/api/explain') return explain(request, env as unknown as ExplainEnv, undefined, ctx);
      // Debug-only: raw extraction for a URL, enabled by EXPLORABLE_DEBUG=1 (local dev).
      if (pathname === '/api/extract' && env.EXPLORABLE_DEBUG === '1') {
        return json({ ok: true, extracted: await extract(normaliseUrl(searchParams.get('url') ?? '')) });
      }
      throw new ApiError('NOT_FOUND', `No API route at ${pathname}.`);
    } catch (error) {
      return errorResponse(error);
    }
  },
} satisfies ExportedHandler<Env>;
