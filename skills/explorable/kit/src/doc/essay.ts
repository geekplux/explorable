import { docVars, escapeHtml, formatInline, mathHtml, safeHttpUrl } from './inline.ts';
import { NOTE_MARK } from './notes.ts';
import { mountFigure, type MountOptions } from '../runtime/mount.ts';
import { hydrateNotes } from '../runtime/notes.ts';
import type { ExplorableDoc, FigureSpec, MathNote, Note, SourceNote } from './schema.ts';

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

/**
 * The letters this essay uses as variables (see `docVars`): set in italics everywhere in it, so "Drag T down" reads
 * like "At T = 1". The app's contents and essay index use the same set, so their titles match the essay's.
 */
export function essayVars(doc: ExplorableDoc): Set<string> {
  return docVars(
    [
      doc.title,
      doc.dek,
      doc.takeaway,
      ...doc.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.figure ? [s.figure.title, s.figure.caption] : [])]),
    ].map((t) => t.replace(NOTE_MARK, ' ')),
  );
}

/** The Σ-like glyph of a math marker (14px, drawn in currentColor). */
const SIGMA =
  '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M10.5 2.5H3.5L7.5 7L3.5 11.5H10.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/** Operator names set upright inside an italic formula. */
const OPERATORS = /\b(exp|log|ln|lg|sin|cos|tan|tanh|max|min|softmax|sigmoid|argmax|argmin)\b/g;
/** Private-use characters stand in for markers while the text goes through the inline formatter. */
const SLOT = 0xe100;
const SLOTS = /[\ue100-\ue1ff]/g;

/** "Open the paper on arXiv" for an arXiv link, otherwise "Open the source". */
function openLabel(url: string): string {
  return /^https:\/\/(?:www\.)?arxiv\.org\//i.test(url) ? 'Open the paper on arXiv' : 'Open the source';
}

/** An exponent: `^(…)` (one level of nested brackets) or `^x`. */
const POWER = /\^(\((?:[^()]|\([^()]*\))*\)|[\p{L}\p{N}]+)/u;

/** A formula as HTML: italic variables, upright operator names, and `^(…)` as a superscript without its brackets. */
function formulaHtml(text: string): string {
  const m = POWER.exec(text);
  if (!m) {
    // Abbreviations (FPR, SNR) are upright; mathRuns would read them as products of italic variables.
    return text
      .split(/(?<![\p{L}\p{N}])(\p{Lu}{2,})(?![\p{L}\p{N}])/u)
      .map((part, i) => (i % 2 ? `<span class="xnote-op">${escapeHtml(part)}</span>` : mathHtml(part, { code: true }).replace(OPERATORS, '<span class="xnote-op">$1</span>')))
      .join('');
  }
  const power = m[1]!.startsWith('(') ? m[1]!.slice(1, -1) : m[1]!;
  return `${formulaHtml(text.slice(0, m.index))}<sup>${formulaHtml(power)}</sup>${formulaHtml(text.slice(m.index + m[0].length))}`;
}

function mathPanel(note: MathNote, vars: ReadonlySet<string>): string {
  const formula = formulaHtml(note.formula);
  return (
    `<div class="xnote" id="note-${escapeHtml(note.id)}" hidden>` +
    `<p class="xnote-f">${formula}</p><p class="xnote-g" id="note-${escapeHtml(note.id)}-g">${formatInline(note.plain, vars)}</p></div>`
  );
}

function sourceCite(note: SourceNote, id: string): string {
  const href = note.url ? safeHttpUrl(note.url) : null;
  const link = href ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${openLabel(href)}</a>` : '';
  const detail = note.detail ? `<span class="xnote-card-detail">${escapeHtml(note.detail)}</span>` : '';
  return (
    `<span class="xnote-cite"><button class="xnote-src" type="button" aria-expanded="false" aria-controls="${id}">${escapeHtml(note.label)}</button>` +
    `<span class="xnote-card" id="${id}" hidden><span class="xnote-card-title">${escapeHtml(note.title)}</span>${detail}${link}</span></span>`
  );
}

/**
 * A paragraph (or the takeaway) with its note markers: a math marker where `[[id]]` sits and its panel after the
 * paragraph; a source note as its label with a card. `cites` counts source references, so each card id is unique.
 */
function bodyHtml(text: string, vars: ReadonlySet<string>, notes: ReadonlyMap<string, Note>, cites: Map<string, number>): string {
  const refs: string[] = [];
  const slotted = text.replace(SLOTS, '').replace(NOTE_MARK, (_, id: string) => String.fromCharCode(SLOT + refs.push(id.trim()) - 1));
  const panels: string[] = [];
  const html = formatInline(slotted, vars).replace(SLOTS, (ch) => {
    const note = notes.get(refs[ch.charCodeAt(0) - SLOT] ?? '');
    if (!note) return '';
    const id = escapeHtml(note.id);
    if (note.kind === 'math') {
      panels.push(mathPanel(note, vars));
      return `<button class="xnote-mk" type="button" aria-expanded="false" aria-controls="note-${id}" aria-describedby="note-${id}-g" aria-label="Show the math">${SIGMA}</button>`;
    }
    const n = (cites.get(note.id) ?? 0) + 1;
    cites.set(note.id, n);
    return sourceCite(note, n === 1 ? `note-${id}` : `note-${id}-${n}`);
  });
  return `<p>${html}</p>${panels.join('')}`;
}

function figureShell(fig: FigureSpec, vars: ReadonlySet<string>): string {
  const id = escapeHtml(fig.id);
  return (
    `<figure class="xfig" id="${id}" data-kind="${escapeHtml(fig.kind)}" ` +
    `data-model="${escapeHtml(fig.model.id)}" aria-labelledby="${id}-title">` +
    `<p class="xfig-title" id="${id}-title">${formatInline(fig.title, vars)}</p>` +
    `<div class="xfig-stage" data-figure-stage><p class="xfig-alt">${escapeHtml(fig.alt)}</p></div>` +
    `<figcaption>${formatInline(fig.caption, vars)}</figcaption>` +
    `</figure>`
  );
}

const ORIGINAL: Record<ExplorableDoc['source']['kind'], string> = {
  arxiv: 'Read the original paper',
  blog: 'Read the original post',
  concept: 'Read the original',
};

/**
 * Static, fully escaped HTML for a doc: title block, sections (numbered by CSS), figure
 * shells and the takeaway. Figure shells carry their title, caption and `alt`
 * text so the essay reads well before (or without) live figures. The byline row
 * ends in an empty `.essay-byline-end` slot for page actions. Notes (v2) render as
 * closed markers and panels; `hydrateNotes` makes them open.
 */
export function essayHtml(doc: ExplorableDoc): string {
  const href = safeHttpUrl(doc.source.url);
  const vars = essayVars(doc);
  const notes = new Map((doc.notes ?? []).map((n) => [n.id, n] as const));
  const cites = new Map<string, number>();
  const body = (text: string) => bodyHtml(text, vars, notes, cites);
  const hero =
    `<header class="essay-hero">` +
    `<h1 tabindex="-1">${formatInline(doc.title, vars)}</h1>` +
    `<p class="essay-dek">${formatInline(doc.dek, vars)}</p>` +
    `<div class="essay-byline"><p>${byline(doc)}</p><span class="essay-byline-end"></span></div>` +
    `</header>`;
  const sections = doc.sections
    .map((section) => {
      const id = escapeHtml(section.id);
      const paragraphs = section.paragraphs.map(body).join('');
      const figure = section.figure ? figureShell(section.figure, vars) : '';
      return `<section class="essay-section" aria-labelledby="${id}"><h2 id="${id}">${formatInline(section.heading, vars)}</h2>${paragraphs}${figure}</section>`;
    })
    .join('');
  const original = href
    ? `<p class="essay-original"><a href="${escapeHtml(href)}" rel="noopener noreferrer">${ORIGINAL[doc.source.kind]}</a></p>`
    : '';
  const takeaway =
    `<section class="essay-takeaway" aria-labelledby="essay-takeaway"><h2 id="essay-takeaway">Takeaway</h2>` +
    `${body(doc.takeaway)}${original}</section>`;
  return `<article class="essay" data-doc="${escapeHtml(doc.id)}">${hero}${sections}${takeaway}</article>`;
}

/**
 * Mount live figures into the shells that `essayHtml` rendered inside `root`, and wire the notes
 * (`hydrateNotes`). Figures whose kind or model is not available keep their static shell.
 */
export function hydrateFigures(root: ParentNode, doc: ExplorableDoc, opts: MountOptions = {}): { destroy(): void } {
  const notes = hydrateNotes(root, opts);
  const mounted = doc.sections.flatMap((section) => {
    const fig = section.figure;
    const stage = fig && [...root.querySelectorAll<HTMLElement>('figure.xfig')].find((f) => f.id === fig.id)?.querySelector<HTMLElement>('[data-figure-stage]');
    const live = fig && stage ? mountFigure(stage, fig, opts) : undefined;
    if (live) stage?.closest('figure')?.setAttribute('data-live', '');
    return live ? [{ live, stage }] : [];
  });
  return {
    destroy() {
      notes.destroy();
      for (const { live, stage } of mounted) {
        live.destroy();
        stage?.closest('figure')?.removeAttribute('data-live');
      }
    },
  };
}
