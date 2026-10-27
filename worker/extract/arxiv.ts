// arXiv extraction: metadata from the Atom API, section text from the
// LaTeXML HTML at arxiv.org/html/<id> when it exists (older papers fall back
// to the abstract alone).
import { Parser } from 'htmlparser2';
import { ApiError } from '../errors';
import { ATOM_TYPES, type FetchFn, HTML_TYPES, fetchText } from '../fetch';
import { type Attrs, type Extracted, cap, collectBlocks, headingsOf, requireText, squash, yearOf } from './text';

export interface AtomEntry {
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
}

export function parseAtom(xml: string): AtomEntry | null {
  const entry = { id: '', title: '', authors: [] as string[], published: '', summary: '' };
  const path: string[] = [];
  let entries = 0;
  let text = '';
  const parser = new Parser(
    {
      onopentag(tag) {
        if (tag === 'entry') entries++;
        path.push(tag);
        text = '';
      },
      ontext(chunk) {
        text += chunk;
      },
      onclosetag(tag) {
        const inFirstEntry = entries === 1 && path.includes('entry');
        path.pop();
        if (!inFirstEntry) return;
        const value = squash(text);
        if (tag === 'name' && path.at(-1) === 'author') entry.authors.push(value);
        else if (path.at(-1) === 'entry' && (tag === 'id' || tag === 'title' || tag === 'published' || tag === 'summary')) entry[tag] = value;
        text = '';
      },
    },
    { xmlMode: true, decodeEntities: true },
  );
  parser.end(xml);
  // An unknown id yields no entry, or an entry whose id points at /api/errors.
  if (!entry.title || entry.id.includes('/api/errors')) return null;
  return { title: entry.title, authors: entry.authors, year: yearOf(entry.published), abstract: entry.summary };
}

const SKIP_CLASS = /\bltx_(authors|abstract|bibliography|note|TOC|page_navbar|pagination|tag|equation|equationgroup)\b/;
const SKIP_TAGS = new Set(['script', 'style', 'nav', 'header', 'footer', 'figure', 'cite', 'button', 'svg', 'table']);

/** Section headings and paragraph text of an arXiv HTML paper. */
export function parseArxivHtml(html: string): { headings: string[]; text: string } {
  const { blocks } = collectBlocks(html, {
    skip: (tag: string, attrs: Attrs) => SKIP_TAGS.has(tag) || SKIP_CLASS.test(attrs.class ?? ''),
    isRoot: (tag) => tag === 'article',
  });
  const body = blocks.filter((b) => b.root > 0 && b.tag !== 'h1');
  return { headings: headingsOf(body), text: body.map((b) => b.text).join('\n\n') };
}

export async function extractArxiv(id: string, fetchFn?: FetchFn): Promise<Extracted> {
  const atom = await fetchText(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`, ATOM_TYPES, fetchFn);
  const entry = parseAtom(atom.body);
  if (!entry) throw new ApiError('INVALID_URL', `arXiv has no paper with id ${id}.`, 'Check the arXiv id in the link.');
  let body = { headings: [] as string[], text: '' };
  try {
    body = parseArxivHtml((await fetchText(`https://arxiv.org/html/${id}`, HTML_TYPES, fetchFn)).body);
  } catch {
    // No HTML rendering (older or LaTeX-only papers): the abstract carries the idea.
  }
  return {
    kind: 'arxiv',
    url: `https://arxiv.org/abs/${id}`,
    ...entry,
    headings: body.headings,
    text: requireText(cap([entry.abstract, body.text].filter(Boolean).join('\n\n'))),
  };
}
