import { escapeHtml, formatInline, safeHttpUrl } from './inline.ts';
import type { DocSource, ExplorableDoc, FigureSpec, Provenance } from './types.ts';

const KICKERS: Record<DocSource['kind'], string> = {
  arxiv: 'arXiv paper',
  blog: 'Blog post',
  concept: 'Concept',
};

const PROVENANCE: Record<Provenance['mode'], string> = {
  curated: 'Curated',
  ai: 'Generated with AI from the source: check the original',
  match: 'Matched to a built-in explainer',
};

/** "Bill Mill", "A and B", or "Vaswani et al." */
export function authorLine(authors: string[] | undefined): string {
  if (!authors || authors.length === 0) return '';
  if (authors.length === 1) return authors[0] ?? '';
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
  const surname = (authors[0] ?? '').trim().split(/\s+/).pop() ?? '';
  return `${surname} et al.`;
}

function sourceLine(source: DocSource): string {
  const href = safeHttpUrl(source.url);
  const cite = `<cite>${escapeHtml(source.title)}</cite>`;
  const titled = href
    ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${cite}<span aria-hidden="true"> ↗</span></a>`
    : cite;
  const meta = [authorLine(source.authors), source.year ? String(source.year) : '']
    .filter(Boolean)
    .map(escapeHtml)
    .join(', ');
  return `Based on ${titled}${meta ? `, ${meta}` : ''}`;
}

function figureShell(fig: FigureSpec, n: number): string {
  const id = escapeHtml(fig.id);
  return (
    `<figure class="xfig" id="${id}" data-kind="${escapeHtml(fig.kind)}" ` +
    `data-model="${escapeHtml(fig.model.id)}" aria-labelledby="${id}-title">` +
    `<div class="xfig-head"><span class="xfig-num">Fig. ${n}</span> ` +
    `<span class="xfig-title" id="${id}-title">${escapeHtml(fig.title)}</span></div>` +
    `<div class="xfig-stage" data-figure-stage><p class="xfig-alt">${escapeHtml(fig.alt)}</p></div>` +
    `<figcaption>${formatInline(fig.caption)}</figcaption>` +
    `</figure>`
  );
}

/**
 * Static, fully escaped HTML for a doc: hero, sections, figure shells and the
 * takeaway. Figure shells carry their title, caption and `alt` text so the
 * essay reads well before (or without) live figures.
 */
export function essayHtml(doc: ExplorableDoc): string {
  let figureCount = 0;
  const href = safeHttpUrl(doc.source.url);
  const hero =
    `<header class="essay-hero">` +
    `<p class="essay-kicker">${KICKERS[doc.source.kind]}</p>` +
    `<h1 tabindex="-1">${escapeHtml(doc.title)}</h1>` +
    `<p class="essay-dek">${formatInline(doc.dek)}</p>` +
    `<p class="essay-source">${sourceLine(doc.source)}</p>` +
    `<p class="essay-provenance">${PROVENANCE[doc.provenance.mode]}</p>` +
    `</header>`;
  const sections = doc.sections
    .map((section) => {
      const id = escapeHtml(section.id);
      const body = section.paragraphs.map((p) => `<p>${formatInline(p)}</p>`).join('');
      const figure = section.figure ? figureShell(section.figure, ++figureCount) : '';
      return `<section class="essay-section" aria-labelledby="${id}"><h2 id="${id}">${escapeHtml(section.heading)}</h2>${body}${figure}</section>`;
    })
    .join('');
  const original = href
    ? `<p class="essay-original"><a href="${escapeHtml(href)}" rel="noopener noreferrer">Read the original<span aria-hidden="true"> ↗</span></a></p>`
    : '';
  const takeaway =
    `<section class="essay-takeaway" aria-labelledby="essay-takeaway"><h2 id="essay-takeaway">Takeaway</h2>` +
    `<p>${formatInline(doc.takeaway)}</p>${original}</section>`;
  return `<article class="essay" data-doc="${escapeHtml(doc.id)}">${hero}${sections}${takeaway}</article>`;
}
