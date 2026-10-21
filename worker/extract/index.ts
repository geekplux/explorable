// Fetch + extract for a normalised source (docs/PLAN.md §5.3 step 3).
import { ApiError } from '../errors';
import { type FetchFn, HTML_TYPES, fetchText } from '../fetch';
import type { Source } from '../url';
import { extractArxiv } from './arxiv';
import { extractBlog } from './blog';
import type { Extracted } from './text';

export type { Extracted } from './text';

export async function extract(source: Source, fetchFn?: FetchFn): Promise<Extracted> {
  if (source.kind === 'arxiv') return extractArxiv(source.id, fetchFn);
  if (/\.pdf$/i.test(new URL(source.url).pathname)) {
    throw new ApiError('UNSUPPORTED_CONTENT', 'PDFs are only supported on arXiv.');
  }
  const page = await fetchText(source.url, HTML_TYPES, fetchFn);
  return extractBlog(page.body, page.url);
}
