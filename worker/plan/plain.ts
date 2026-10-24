// Plain words, deterministically (docs/redesign/DESIGN.md §9). The model is asked to keep formulas and citations
// out of the body; this post-process makes sure of it with no second call: formulas left in a paragraph, the
// takeaway or the dek move into math notes, citations of the source become one source note built from the
// article's metadata, and markers that point nowhere are removed. `assemblePlan` validates the result.
import { findFormula } from '../../skills/explorable/kit/src/doc/formula.ts';
import { NOTE_MARK, authorLine, noteRefs, surname } from '../../skills/explorable/kit/src/doc/notes.ts';
import type { DocSource, MathNote, Note, SourceNote } from '../../skills/explorable/kit/src/doc/schema.ts';
import type { PlanNote } from './schema';

export const MAX_NOTES = 12;
export const SOURCE_ID = 'source';
/** The gloss of a math note made from a formula the model left in the text without one (DECISIONS 2026-10-24). */
export const FALLBACK_GLOSS = 'The formula this sentence refers to.';

export interface PlainText {
  dek: string;
  /** Paragraphs per section. */
  paragraphs: string[][];
  takeaway: string;
}

/** What the post-process changed, for the log line (counts only, never text). */
export interface PlainReport {
  /** Formulas moved from the text into a math note. */
  moved: number;
  /** Formulas cut or dropped with no note (the paragraph had its math note, or there was no room). */
  dropped: number;
  /** Formulas left in the text: they could not be cut without breaking the sentence. */
  kept: number;
  /** Markers removed: unknown, a second math marker in a paragraph, or a note used twice. */
  removed: number;
  /** Citations of the source rewritten as the source note. */
  cited: number;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Collapse the gaps a removal leaves, including before punctuation. */
const tidy = (s: string) => s.replace(/\s+([.,;:!?)\]])/g, '$1').replace(/([([])\s+/g, '$1').replace(/\s{2,}/g, ' ').trim();
/** A sentence ends at its closing punctuation, quotes and brackets, and the note markers that follow it. */
const END = String.raw`[.!?…]+["”’)\]]*(?:\[\[[^[\]\n]{1,40}\]\])*`;
const AFTER_END = new RegExp(`${END}\\s+$`);
const END_AHEAD = new RegExp(`${END}(?=\\s|$)`);
const ENDS = new RegExp(`${END}\\s+`, 'g');
const startsSentence = (s: string, at: number) => at === 0 || AFTER_END.test(s.slice(0, at));
const capitalise = (s: string, at: number) => (startsSentence(s, at) ? s.slice(0, at) + s.charAt(at).toUpperCase() + s.slice(at + 1) : s);
/** Formulas compare without spaces, code ticks or emphasis. */
const norm = (f: string) => f.replace(/[\s`*]/g, '');
/** The end of the sentence at `from`, or the end of the text. */
const sentenceEnd = (s: string, from: number) => {
  const m = END_AHEAD.exec(s.slice(from));
  return m ? from + m.index + m[0].length : s.length;
};
const sentenceStart = (s: string, at: number) => {
  let start = 0;
  for (const m of s.slice(0, at).matchAll(ENDS)) start = m.index + m[0].length;
  return start;
};

/** The source note's label: the byline's author form, or the title. */
export function sourceLabel(src: DocSource): string {
  const authors = authorLine(src.authors);
  if (authors && authors.length <= 60) return authors;
  const title = src.title.length <= 60 ? src.title : `${src.title.slice(0, 59).replace(/\s+\S*$/, '')}…`;
  return title;
}

/** The source note, built from metadata only: never from model prose. */
export function sourceNote(src: DocSource): SourceNote {
  const authors = src.authors ?? [];
  const names = authors.length > 3 ? `${authors.slice(0, 3).map(surname).join(', ')} and ${authors.length - 3} others` : authors.map(surname).join(', ').replace(/, ([^,]*)$/, ' and $1');
  const detail = [names, src.year ? String(src.year) : ''].filter(Boolean).join(', ').slice(0, 120);
  return {
    id: SOURCE_ID,
    kind: 'source',
    label: sourceLabel(src),
    title: src.title.slice(0, 200),
    ...(detail && { detail }),
    ...(src.url && /^https:\/\//i.test(src.url) && { url: src.url }),
  };
}

/**
 * Rewrite citations of the source as `[[source]]`: "Vaswani et al. (2017)", "(Vaswani et al., 2017)", a full author
 * name, and the title in quotes or italics (as "the paper by [[source]]" when the authors are known). A bare surname
 * counts only with "et al.", a co-author or a year, so "Bloom filters" stays text. `marks: false` (the dek, which
 * cannot hold a marker) only removes parenthetical citations.
 */
export function markCitations(text: string, src: DocSource, marks = true): { text: string; cited: number } {
  let cited = 0;
  const authors = src.authors ?? [];
  const rules: [RegExp, string][] = [];
  const mark = `[[${SOURCE_ID}]]`;
  if (authors.length) {
    const any = (name: string) => `(?:${[...new Set([name, surname(name)])].map(esc).join('|')})`;
    const first = `(?<![\\p{L}\\p{N}])${any(authors[0]!)}`;
    const tail = `(?:\\s+et\\s+al\\.?${authors.length === 2 ? `|\\s+(?:and|&)\\s+${any(authors[1]!)}` : ''})`;
    const year = `(?:${src.year ?? '\\d{4}'}[a-z]?)`;
    rules.push([new RegExp(`\\(\\s*${first}${tail}?,?\\s*${year}?\\s*\\)`, 'gu'), marks ? `(${mark})` : '']);
    if (marks) {
      rules.push([new RegExp(`${first}(?:${tail}(?:\\s*\\(${year}\\))?|\\s*\\(${year}\\))`, 'gu'), mark]);
      if (/\s/.test(authors[0]!.trim())) rules.push([new RegExp(`(?<![\\p{L}\\p{N}])${esc(authors[0]!.trim())}(?![\\p{L}\\p{N}])`, 'gu'), mark]);
    }
  }
  if (marks) {
    const title = esc(src.title.trim());
    const by = authors.length ? `the ${src.kind === 'arxiv' ? 'paper' : 'post'} by ${mark}` : mark;
    rules.push([new RegExp(`[“"‘']${title}[”"’']|\\*${title}\\*`, 'giu'), by]);
    if (src.title.trim().split(/\s+/).length >= 3) rules.push([new RegExp(`(?<![\\p{L}\\p{N}])${title}(?![\\p{L}\\p{N}])`, 'gu'), by]);
  }
  let out = text;
  for (const [re, to] of rules) {
    out = out.replace(re, (_m, offset: number, whole: string) => {
      cited++;
      // "the paper by …" at the start of a sentence is capitalised.
      return to.startsWith('the ') && startsSentence(whole, offset) ? `T${to.slice(1)}` : to;
    });
  }
  // A label that ends in "et al." already closes the sentence.
  if (sourceLabel(src).endsWith('.')) out = out.replaceAll(`${mark}.`, mark);
  return { text: out === text ? text : tidy(out), cited };
}

/** A space-separated chunk that continues a formula: a math character, and no word of three letters or more. */
const MATH_CHAR = /[\d=≈≤≥<>≠∝+−×·/^÷±()[\]√∑Σ∂∫∏∇_\p{Lm}\p{No}\p{Script=Greek}]/u;
const FN_NAMES = /exp|log|ln|sin|cos|tan|max|min|softmax|sigmoid|Var|var/g;
const mathy = (chunk: string) => MATH_CHAR.test(chunk) && !chunk.includes('[[') && !/[a-z]{3,}/.test(chunk.replace(FN_NAMES, ''));
/**
 * The formula `findFormula` found, widened to whole chunks: its tokenizer can stop inside one (at an index after Σ,
 * say), which would cut a formula in half. Prose only; a code span is already whole.
 */
function widen(s: string, at: number, f: string): [number, string] {
  if (f.startsWith('`')) return [at, f];
  // A run can end on an opening bracket that starts the words after it: "σ = √d_k · 1 (see …".
  let [start, end] = [at, at + f.replace(/[\s([]+$/, '').length];
  for (;;) {
    // Finish the chunk, short of its closing punctuation; go on while the next chunk is math.
    end += /^\S*?(?=[,.;:!?]*(?:\s|$))/.exec(s.slice(end))![0].length;
    const next = /^\s+(\S+)/.exec(s.slice(end));
    if (!next || !mathy(next[1]!)) break;
    end += next[0].length - next[1]!.length;
  }
  start -= /\S*$/.exec(s.slice(0, start))![0].length;
  for (let m; (m = /(\S+)\s+$/.exec(s.slice(0, start))) && mathy(m[1]!) && !/[,.;:!?]$/.test(m[1]!); ) start = m.index;
  return [start, s.slice(start, end).replace(/[,.;:!?]+$/, '')];
}
/** "(…)" whose first bracket closes at the end. */
const wrapped = (f: string) => {
  if (!f.startsWith('(') || !f.endsWith(')')) return false;
  let depth = 0;
  for (const [i, c] of [...f].entries()) {
    depth += c === '(' ? 1 : c === ')' ? -1 : 0;
    if (depth === 0 && i < [...f].length - 1) return false;
  }
  return true;
};

/**
 * Cut `f` (at `at`) out of a sentence so the words still read: a parenthesis, or a formula after a colon, comma,
 * semicolon or dash, goes with its punctuation. Returns null when the formula is part of the sentence's grammar.
 */
function cleanCut(s: string, at: number, f: string): string | null {
  const before = s.slice(0, at);
  const after = s.slice(at + f.length);
  if (wrapped(f)) return tidy(before + after);
  if (before.endsWith('(') && after.startsWith(')')) return tidy(before.replace(/\s*\($/, '') + after.slice(1));
  const sep = /\s*([:,;—–]|\s-)\s*$/.exec(before);
  if (!sep) return null;
  const rest = sep[1] === ',' && /^\s*,/.test(after) ? after.replace(/^\s*,/, '') : after;
  return tidy(before.slice(0, sep.index) + rest);
}

/** Drop the sentence that holds position `at`, unless it is the only one or holds a marker. */
function dropSentence(s: string, at: number): string | null {
  const start = sentenceStart(s, at);
  const end = sentenceEnd(s, at);
  const sentence = s.slice(start, end);
  if (start === 0 && end >= s.trimEnd().length) return null;
  if (noteRefs(sentence).length) return null;
  return tidy(s.slice(0, start) + s.slice(end));
}

interface Gloss {
  formula: string;
  plain: string;
  used: boolean;
}

/** Make the text plain: see the module comment. Pure; the caller validates the doc it builds from the result. */
export function plainWords(input: PlainText, planNotes: readonly PlanNote[], src: DocSource): PlainText & { notes: Note[]; report: PlainReport } {
  const report: PlainReport = { moved: 0, dropped: 0, kept: 0, removed: 0, cited: 0 };
  const glosses = new Map<string, Gloss>();
  for (const n of planNotes) {
    const formula = n.formula.replace(/`/g, '').trim();
    if (formula && !glosses.has(n.id.trim())) glosses.set(n.id.trim(), { formula, plain: n.plain || FALLBACK_GLOSS, used: false });
  }
  const surnames = new Set((src.authors ?? []).map((a) => surname(a).toLowerCase()));
  const isSource = (id: string) => id === SOURCE_ID || (!glosses.has(id) && surnames.has(id.toLowerCase()));
  const cite = (t: string) => {
    const r = markCitations(t, src);
    report.cited += r.cited;
    return r.text.replace(NOTE_MARK, (m, id: string) => (isSource(id.trim()) ? `[[${SOURCE_ID}]]` : m));
  };
  const cited = { paragraphs: input.paragraphs.map((ps) => ps.map(cite)), takeaway: cite(input.takeaway) };
  const usesSource = [...cited.paragraphs.flat(), cited.takeaway].some((t) => t.includes(`[[${SOURCE_ID}]]`));
  const budget = MAX_NOTES - (usesSource ? 1 : 0);
  const math: MathNote[] = [];

  /** Markers, then formulas, in one paragraph or the takeaway (`body`) or the dek (no markers allowed). */
  const fix = (text: string, body: boolean): string => {
    let own: MathNote | undefined;
    let s = text.replace(NOTE_MARK, (m, raw: string) => {
      const id = raw.trim();
      if (body && id === SOURCE_ID) return m;
      const g = glosses.get(id);
      if (!body || !g || g.used || own || math.length >= budget) {
        report.removed++;
        return ' ';
      }
      g.used = true;
      own = { id: `m${math.length + 1}`, kind: 'math', formula: g.formula, plain: g.plain };
      math.push(own);
      return `[[${own.id}]]`;
    });
    s = tidy(s);
    const kept: string[] = [];
    for (let guard = 0; guard < 20; guard++) {
      const found = findFormula(s);
      const i = found === null ? -1 : s.indexOf(found);
      if (found === null || i < 0) break;
      const [at, f] = widen(s, i, found);
      const formula = (wrapped(f) ? f.slice(1, -1) : f).replace(/[`*]/g, '').trim();
      const same = own && norm(own.formula) === norm(formula);
      const room = body && !own && math.length < budget && formula.length <= 160;
      if (same || room) {
        // The formula goes; the words around it stay. Where it was part of the grammar, "a formula" takes its place.
        const cut = cleanCut(s, at, f) ?? capitalise(s.slice(0, at) + 'a formula' + s.slice(at + f.length), at);
        if (same) {
          s = cut;
          report.dropped++;
          continue;
        }
        const g = [...glosses.values()].find((x) => !x.used && norm(x.formula) === norm(formula));
        if (g) g.used = true;
        own = { id: `m${math.length + 1}`, kind: 'math', formula, plain: g?.plain ?? FALLBACK_GLOSS };
        math.push(own);
        const end = sentenceEnd(cut, sentenceStart(s, at));
        s = `${cut.slice(0, end)}[[${own.id}]]${cut.slice(end)}`;
        report.moved++;
        continue;
      }
      const out = cleanCut(s, at, f) ?? dropSentence(s, at);
      if (out !== null) {
        s = out;
        report.dropped++;
      } else {
        // Leave it, masked so the search moves on; a private-use character never reads as math.
        s = s.slice(0, at) + String.fromCharCode(0xe000 + kept.push(f) - 1) + s.slice(at + f.length);
        report.kept++;
      }
    }
    return s.replace(/[\ue000-\ue0ff]/g, (c) => kept[c.charCodeAt(0) - 0xe000] ?? '');
  };

  const dekCited = markCitations(input.dek, src, false);
  report.cited += dekCited.cited;
  const paragraphs = cited.paragraphs.map((ps) => ps.map((p) => fix(p, true)));
  const takeaway = fix(cited.takeaway, true);
  const dek = fix(dekCited.text, false);
  const stillCites = [...paragraphs.flat(), takeaway].some((t) => t.includes(`[[${SOURCE_ID}]]`));
  return { dek, paragraphs, takeaway, notes: [...math, ...(stillCites ? [sourceNote(src)] : [])], report };
}
