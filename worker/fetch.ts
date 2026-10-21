// Guarded fetch for source pages (docs/PLAN.md §5.3 step 3): 10 s timeout for
// the whole exchange, at most 3 redirects (each re-checked by the URL guard),
// a 3 MB body cap and a content-type allow-list.
import { ApiError } from './errors';
import { guardUrl } from './url';

export const USER_AGENT = 'explorable/0.x (+https://github.com/geekplux/explorable)';
export const LIMITS = { timeoutMs: 10_000, maxBytes: 3 * 1024 * 1024, maxRedirects: 3 };
export const HTML_TYPES = ['text/html', 'application/xhtml+xml'] as const;
export const ATOM_TYPES = ['application/atom+xml', 'application/xml', 'text/xml'] as const;

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;
export interface Fetched {
  url: string;
  type: string;
  body: string;
}

const tooLarge = () => new ApiError('UNSUPPORTED_CONTENT', 'The page is larger than 3 MB.');

async function readCapped(res: Response, maxBytes: number, charset: string): Promise<string> {
  if (Number(res.headers.get('content-length')) > maxBytes) throw tooLarge();
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(charset || 'utf-8');
  } catch {
    decoder = new TextDecoder('utf-8');
  }
  if (!res.body) return '';
  const reader = res.body.getReader();
  let size = 0;
  let text = '';
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    size += chunk.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw tooLarge();
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

export async function fetchText(
  input: string,
  accept: readonly string[],
  fetchFn: FetchFn = fetch,
  limits = LIMITS,
): Promise<Fetched> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  const init: RequestInit = {
    redirect: 'manual',
    signal: controller.signal,
    headers: { 'user-agent': USER_AGENT, accept: `${accept.join(', ')};q=0.9, */*;q=0.1` },
  };
  try {
    let url = guardUrl(input);
    for (let hops = 0; ; hops++) {
      const res = await fetchFn(url.href, init);
      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel();
        if (hops >= limits.maxRedirects) throw new ApiError('FETCH_FAILED', 'The page redirected too many times.');
        url = guardUrl(new URL(location, url).href);
        continue;
      }
      if (!res.ok) throw new ApiError('FETCH_FAILED', `The page answered HTTP ${res.status}.`);
      const [type = '', ...params] = (res.headers.get('content-type') ?? '').toLowerCase().split(';');
      if (!accept.includes(type.trim())) {
        await res.body?.cancel();
        const what = type.trim() === 'application/pdf' ? 'PDFs are only supported on arXiv.' : `Unsupported content type "${type.trim() || 'none'}".`;
        throw new ApiError('UNSUPPORTED_CONTENT', what);
      }
      const charset = params.map((p) => p.trim()).find((p) => p.startsWith('charset='))?.slice(8) ?? '';
      return { url: url.href, type: type.trim(), body: await readCapped(res, limits.maxBytes, charset) };
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const timedOut = controller.signal.aborted;
    throw new ApiError('FETCH_FAILED', timedOut ? `The page took longer than ${limits.timeoutMs / 1000} s.` : 'The page could not be fetched.');
  } finally {
    clearTimeout(timer);
  }
}
