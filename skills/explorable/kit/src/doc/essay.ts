import { escapeHtml, formatInline, safeHttpUrl } from './inline.ts';
import { mountFigure, type MountOptions } from '../runtime/mount.ts';
import type { ExplorableDoc, FigureSpec } from './schema.ts';

/** "Bill Mill", "A and B", or "Vaswani et al." */
export function authorLine(authors: string[] | undefined): string {
  if (!authors || authors.length === 0) return '';
  if (authors.length === 1) return authors[0] ?? '';
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
  const surname = (authors[0] ?? '').trim().split(/\s+/).pop() ?? '';
  return `${surname} et al.`;
}

/** "Based on <title>, Vaswani et al., 2017", plus one sentence for an AI-written essay (DESIGN §6). */
function byline(doc: ExplorableDoc): string {
  const { source } = doc;
  const href = safeHttpUrl(source.url);
  const cite = `<cite>${escapeHtml(source.title)}</cite>`;
  const titled = href ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${cite}</a>` : cite;
  const meta = [authorLine(source.authors), source.year ? String(source.year) : '']
    .filter(Boolean)
    .map(escapeHtml)
    .join(', ');
  const ai = doc.provenance.mode === 'ai' ? '. Written by AI from the source.' : '';
  return `Based on ${titled}${meta ? `, ${meta}` : ''}${ai}`;
}

function figureShell(fig: FigureSpec): string {
  const id = escapeHtml(fig.id);
  return (
    `<figure class="xfig" id="${id}" data-kind="${escapeHtml(fig.kind)}" ` +
    `data-model="${escapeHtml(fig.model.id)}" aria-labelledby="${id}-title">` +
    `<p class="xfig-title" id="${id}-title">${formatInline(fig.title)}</p>` +
    `<div class="xfig-stage" data-figure-stage><p class="xfig-alt">${escapeHtml(fig.alt)}</p></div>` +
    `<figcaption>${formatInline(fig.caption)}</figcaption>` +
    `</figure>`
  );
}

/**
 * Static, fully escaped HTML for a doc: title block, sections (numbered by CSS), figure
 * shells and the takeaway. Figure shells carry their title, caption and `alt`
 * text so the essay reads well before (or without) live figures. The byline row
 * ends in an empty `.essay-byline-end` slot for page actions.
 */
export function essayHtml(doc: ExplorableDoc): string {
  const href = safeHttpUrl(doc.source.url);
  const hero =
    `<header class="essay-hero">` +
    `<h1 tabindex="-1">${formatInline(doc.title)}</h1>` +
    `<p class="essay-dek">${formatInline(doc.dek)}</p>` +
    `<div class="essay-byline"><p>${byline(doc)}</p><span class="essay-byline-end"></span></div>` +
    `</header>`;
  const sections = doc.sections
    .map((section) => {
      const id = escapeHtml(section.id);
      const body = section.paragraphs.map((p) => `<p>${formatInline(p)}</p>`).join('');
      const figure = section.figure ? figureShell(section.figure) : '';
      return `<section class="essay-section" aria-labelledby="${id}"><h2 id="${id}">${formatInline(section.heading)}</h2>${body}${figure}</section>`;
    })
    .join('');
  const original = href
    ? `<p class="essay-original"><a href="${escapeHtml(href)}" rel="noopener noreferrer">Read the original ${doc.source.kind === 'arxiv' ? 'paper' : 'post'}</a></p>`
    : '';
  const takeaway =
    `<section class="essay-takeaway" aria-labelledby="essay-takeaway"><h2 id="essay-takeaway">Takeaway</h2>` +
    `<p>${formatInline(doc.takeaway)}</p>${original}</section>`;
  return `<article class="essay" data-doc="${escapeHtml(doc.id)}">${hero}${sections}${takeaway}</article>`;
}

/**
 * Mount live figures into the shells that `essayHtml` rendered inside `root`.
 * Figures whose kind or model is not available keep their static shell.
 */
export function hydrateFigures(root: ParentNode, doc: ExplorableDoc, opts: MountOptions = {}): { destroy(): void } {
  const mounted = doc.sections.flatMap((section) => {
    const fig = section.figure;
    const stage = fig && [...root.querySelectorAll<HTMLElement>('figure.xfig')].find((f) => f.id === fig.id)?.querySelector<HTMLElement>('[data-figure-stage]');
    const live = fig && stage ? mountFigure(stage, fig, opts) : undefined;
    if (live) stage?.closest('figure')?.setAttribute('data-live', '');
    return live ? [{ live, stage }] : [];
  });
  return {
    destroy() {
      for (const { live, stage } of mounted) {
        live.destroy();
        stage?.closest('figure')?.removeAttribute('data-live');
      }
    },
  };
}
