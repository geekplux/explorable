// The explorable Worker (D2): static assets serve the SPA; only /api/* runs
// here (wrangler.jsonc `run_worker_first`). No AI in this phase.
import { ApiError, errorResponse, json } from './errors';
import { extract } from './extract';
import { normaliseUrl } from './url';

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname, searchParams } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (pathname === '/api/health') {
        return json({ ok: true, ai: 'AI' in env && Boolean(env.AI), kv: Boolean(env.EXPLORABLE_CACHE) });
      }
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
