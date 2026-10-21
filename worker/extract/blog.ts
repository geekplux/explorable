// "Readability-lite" for blog posts (D8): keep the paragraphs, headings and
// list items of the main content root, drop chrome (nav, aside, footer,
// scripts, forms, noisy class names) and link-heavy blocks.
import { type Attrs, type Extracted, cap, collectBlocks, headingsOf, requireText, yearOf } from './text';

const SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'object',
  'nav', 'aside', 'footer', 'form', 'button', 'select', 'textarea', 'dialog',
]);
const SKIP_ROLES = new Set(['navigation', 'contentinfo', 'banner', 'complementary', 'search', 'dialog']);
const NOISE = /\b(nav|navbar|menu|footer|sidebar|comments?|share|social|breadcrumbs?|newsletter|subscribe|related|promo|cookie|banner|advert|ads?)\b/i;
const NEVER_NOISE = new Set(['html', 'body', 'main', 'article']);
const MIN_BLOCK = 25;
const MAX_LINK_DENSITY = 0.5;

function skip(tag: string, attrs: Attrs, inRoot: boolean): boolean {
  if (SKIP_TAGS.has(tag) || (tag === 'header' && !inRoot)) return true;
  if ('hidden' in attrs || attrs['aria-hidden'] === 'true' || SKIP_ROLES.has(attrs.role ?? '')) return true;
  return !NEVER_NOISE.has(tag) && NOISE.test(`${attrs.class ?? ''} ${attrs.id ?? ''}`);
}

const isRoot = (tag: string, attrs: Attrs) => tag === 'article' || tag === 'main' || attrs.role === 'main';

export function extractBlog(html: string, url: string): Extracted {
  const { blocks, title, meta } = collectBlocks(html, { skip, isRoot });
  // Keep the content root with the most text; pages without one keep everything.
  const size = new Map<number, number>();
  for (const b of blocks) if (b.root) size.set(b.root, (size.get(b.root) ?? 0) + b.text.length);
  const best = [...size].toSorted((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const kept = blocks.filter(
    (b) => (!best || b.root === best) && (/^h\d$/.test(b.tag) || (b.text.length >= MIN_BLOCK && b.links / b.text.length <= MAX_LINK_DENSITY)),
  );
  const h1 = kept.find((b) => b.tag === 'h1')?.text;
  const text = requireText(cap(kept.map((b) => b.text).join('\n\n')));
  const author = meta.get('author') ?? meta.get('article:author');
  return {
    kind: 'web',
    url,
    title: meta.get('og:title') || h1 || title || new URL(url).hostname,
    authors: author && !/^https?:/.test(author) ? [author] : [],
    year: yearOf(meta.get('article:published_time') ?? meta.get('citation_publication_date') ?? meta.get('date')),
    abstract: meta.get('description') ?? meta.get('og:description') ?? kept.find((b) => b.tag === 'p')?.text ?? '',
    headings: headingsOf(kept),
    text,
  };
}
