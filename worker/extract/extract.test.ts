import { describe, expect, it } from 'vitest';
import { ApiError } from '../errors';
import type { FetchFn } from '../fetch';
import arxivHtml from '../fixtures/arxiv-1706.03762.html?raw';
import atom1706 from '../fixtures/atom-1706.03762.xml?raw';
import atom2006 from '../fixtures/atom-2006.11239.xml?raw';
import bloomHtml from '../fixtures/bloom-tutorial.html?raw';
import navHeavyHtml from '../fixtures/nav-heavy-blog.html?raw';
import tinyHtml from '../fixtures/tiny-page.html?raw';
import { normaliseUrl } from '../url';
import { extractArxiv, parseArxivHtml, parseAtom } from './arxiv';
import { extractBlog } from './blog';
import { extract } from './index';
import { MAX_TEXT, cap } from './text';

const ATOM = 'application/atom+xml; charset=utf-8';
const HTML = 'text/html; charset=utf-8';

/** A fake fetch serving `routes` (url → [content-type, body]); anything else is a 404. */
const serve = (routes: Record<string, [string, string]>): FetchFn => async (url) => {
  const hit = routes[url];
  return hit ? new Response(hit[1], { headers: { 'content-type': hit[0] } }) : new Response('missing', { status: 404 });
};
const atomUrl = (id: string) => `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`;

async function failure(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('arXiv', () => {
  it('parses the Atom entry: title, 8 authors, year, abstract', () => {
    const entry = parseAtom(atom1706);
    expect(entry?.title).toBe('Attention Is All You Need');
    expect(entry?.authors).toHaveLength(8);
    expect(entry?.authors[0]).toBe('Ashish Vaswani');
    expect(entry?.authors[7]).toBe('Illia Polosukhin');
    expect(entry?.year).toBe(2017);
    expect(entry?.abstract).toMatch(/^The dominant sequence transduction models/);
    expect(parseAtom(atom2006)).toMatchObject({ title: 'Denoising Diffusion Probabilistic Models', year: 2020 });
  });

  it('returns null for an unknown id', () => {
    expect(parseAtom('<feed xmlns="http://www.w3.org/2005/Atom"><title>arXiv Query</title></feed>')).toBeNull();
    const error = '<feed><entry><id>http://arxiv.org/api/errors#incorrect_id_format</id><title>Error</title></entry></feed>';
    expect(parseAtom(error)).toBeNull();
  });

  it('reads section headings and paragraphs, skipping chrome, authors, abstract and references', () => {
    const { headings, text } = parseArxivHtml(arxivHtml);
    expect(headings).toEqual(['Introduction', 'Background', 'Model Architecture']);
    expect(text).toMatch(/^Introduction\n\nRecurrent neural networks, long short-term memory and gated recurrent/);
    expect(text).toContain('queries and keys of dimension d_{k}');
    expect(text).not.toMatch(/Report an issue|Ashish Vaswani|The dominant sequence|Jimmy Lei Ba|build logs|\[13\]/);
  });

  it('extracts a paper from the Atom API and the HTML rendering', async () => {
    const fetchFn = serve({
      [atomUrl('1706.03762')]: [ATOM, atom1706],
      'https://arxiv.org/html/1706.03762': [HTML, arxivHtml],
    });
    const doc = await extractArxiv('1706.03762', fetchFn);
    expect(doc).toMatchObject({ kind: 'arxiv', url: 'https://arxiv.org/abs/1706.03762', title: 'Attention Is All You Need', year: 2017 });
    expect(doc.authors).toHaveLength(8);
    expect(doc.abstract).toMatch(/Transformer/);
    expect(doc.headings).toContain('Model Architecture');
    expect(doc.text.startsWith(doc.abstract)).toBe(true);
    expect(doc.text).toContain('Scaled Dot-Product Attention');
    expect(doc.text.length).toBeLessThanOrEqual(MAX_TEXT);
  });

  it('caps long papers at 12,000 characters and falls back to the abstract without HTML', async () => {
    const long = `<article>${'<p>Attention weights are a softmax over scaled dot products of queries and keys.</p>'.repeat(400)}</article>`;
    const capped = await extractArxiv('1706.03762', serve({ [atomUrl('1706.03762')]: [ATOM, atom1706], 'https://arxiv.org/html/1706.03762': [HTML, long] }));
    expect(capped.text.length).toBeLessThanOrEqual(12_000);
    expect(capped.text.length).toBeGreaterThan(11_000);
    const abstractOnly = await extractArxiv('2006.11239', serve({ [atomUrl('2006.11239')]: [ATOM, atom2006] }));
    expect(abstractOnly.text).toBe(abstractOnly.abstract);
    expect(abstractOnly.headings).toEqual([]);
  });

  it('reports an unknown paper as INVALID_URL', async () => {
    const fetchFn = serve({ [atomUrl('2999.99999')]: [ATOM, '<feed xmlns="http://www.w3.org/2005/Atom"></feed>'] });
    expect((await failure(extractArxiv('2999.99999', fetchFn))).code).toBe('INVALID_URL');
  });
});

describe('blog', () => {
  it("gets the Bloom tutorial's title and body, without scripts, styles or widgets", () => {
    const doc = extractBlog(bloomHtml, 'https://llimllib.github.io/bloomfilter-tutorial/');
    expect(doc.title).toBe('Bloom Filters by Example');
    expect(doc.headings).toEqual(expect.arrayContaining(['Bloom Filters by Example', 'Advanced Topics', 'How many hash functions should I use?']));
    expect(doc.text).toMatch(/whether an element is present in a set/);
    expect(doc.text).toMatch(/\(1-e-kn\/m\)k/);
    expect(doc.text).not.toMatch(/seed1|#content|View source on GitHub|简体中文/);
    expect(doc.text.length).toBeGreaterThan(600);
  });

  it('drops nav, header chrome, asides, comments, share widgets, footer and link-only items', () => {
    const doc = extractBlog(navHeavyHtml, 'https://notes.example.com/ropes');
    expect(doc).toMatchObject({ title: 'Why ropes beat strings for big edits', authors: ['Ada Example'], year: 2024 });
    expect(doc.abstract).toMatch(/^A rope stores text/);
    expect(doc.headings).toEqual(['Why ropes beat strings for big edits', 'The idea', 'When it pays off']);
    expect(doc.text).toMatch(/balanced binary tree/);
    expect(doc.text).toMatch(/O\(log n\)/);
    expect(doc.text).not.toMatch(/Archive of every post|cookies|Share this post|Gap buffers|Great post|All rights reserved|analytics|\btrees\b/);
  });

  it('returns TOO_LITTLE_TEXT under 600 characters', () => {
    expect(() => extractBlog(tinyHtml, 'https://example.com/')).toThrowError(expect.objectContaining({ code: 'TOO_LITTLE_TEXT' }));
  });
});

describe('extract', () => {
  it('rejects a non-arXiv PDF as UNSUPPORTED_CONTENT, by extension or by content type', async () => {
    expect((await failure(extract(normaliseUrl('https://example.com/paper.pdf'), serve({})))).code).toBe('UNSUPPORTED_CONTENT');
    const fetchFn = serve({ 'https://example.com/paper': ['application/pdf', '%PDF-1.7'] });
    expect((await failure(extract(normaliseUrl('https://example.com/paper'), fetchFn))).code).toBe('UNSUPPORTED_CONTENT');
  });

  it('routes arXiv PDFs to the arXiv extractor and blogs to the blog extractor', async () => {
    const fetchFn = serve({
      [atomUrl('1706.03762')]: [ATOM, atom1706],
      'https://llimllib.github.io/bloomfilter-tutorial/': [HTML, bloomHtml],
    });
    expect((await extract(normaliseUrl('http://arxiv.org/pdf/1706.03762.pdf'), fetchFn)).kind).toBe('arxiv');
    expect((await extract(normaliseUrl('https://llimllib.github.io/bloomfilter-tutorial/?utm_source=hn'), fetchFn)).title).toBe('Bloom Filters by Example');
  });

  it('cap cuts at a word boundary', () => {
    expect(cap('alpha beta gamma', 12)).toBe('alpha beta');
    expect(cap('short', 12)).toBe('short');
  });
});
