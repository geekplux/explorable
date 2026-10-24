// Plain words: a deterministic safety net after the one model call (docs/redesign/DESIGN.md §9). The prompt is the
// main defence; this never rewrites inside a sentence. It removes markers that point nowhere, moves a formula into
// the model's own note only when the formula is its whole sentence, turns citations of the source into one source
// note built from the article's metadata, and counts what it leaves. `assemblePlan` validates the result.
import { findFormula, hasLatex } from '../../skills/explorable/kit/src/doc/formula.ts';
import { NOTE_MARK, authorLine, authorList, noteRefs, surname } from '../../skills/explorable/kit/src/doc/notes.ts';
import type { DocSource, MathNote, Note, SourceNote } from '../../skills/explorable/kit/src/doc/schema.ts';
import type { PlanNote } from './schema';

export const MAX_NOTES = 12;
export const SOURCE_ID = 'source';
const MARK = `[[${SOURCE_ID}]]`;

export interface PlainText {
  dek: string;
  /** Paragraphs per section. */
  paragraphs: string[][];
  takeaway: string;
}

/** What the post-process changed, for the log line (counts only, never text). */
export interface PlainReport {
  /** Formula-only sentences dropped, their formula kept in the model's note for it. */
  moved: number;
  /** Formulas left in the text (the audit warns; the doc still validates). */
  kept: number;
  /** Markers removed: unknown, LaTeX, a second math marker in a paragraph, a note used twice, or in the dek. */
  removed: number;
  /** Citations of the source rewritten as the source note. */
  cited: number;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A pattern that is not part of a longer word. */
const free = (re: string) => `(?<![\\p{L}\\p{N}])${re}(?![\\p{L}\\p{N}])`;
/** Collapse the gaps a removal leaves, including before punctuation. */
const tidy = (s: string) => s.replace(/\s+([.,;:!?)\]])/g, '$1').replace(/([([])\s+/g, '$1').replace(/\s{2,}/g, ' ').trim();
/** A sentence ends at its closing punctuation, quotes and brackets, and the note markers that follow it. */
// A source marker whose label ends in "et al." has no full stop of its own: a capital after it starts a sentence.
const END = String.raw`(?:[.!?…]+["”’)\]]*|\[\[source\]\](?=\s+\p{Lu}))(?:\[\[[^[\]\n]{1,40}\]\])*`;
const AFTER_END = new RegExp(`${END}\\s+$`, 'u');
const END_AHEAD = new RegExp(`${END}(?=\\s|$)`, 'u');
const ENDS = new RegExp(`${END}\\s+`, 'gu');
const startsSentence = (s: string, at: number) => at === 0 || AFTER_END.test(s.slice(0, at));
const sentenceEnd = (s: string, from: number) => {
  const m = END_AHEAD.exec(s.slice(from));
  return m ? from + m.index + m[0].length : s.length;
};
const sentenceStart = (s: string, at: number) => {
  let start = 0;
  for (const m of s.slice(0, at).matchAll(ENDS)) start = m.index + m[0].length;
  return start;
};
/** Formulas compare without spaces, code ticks or emphasis. */
const norm = (f: string) => f.replace(/[\s`*]/g, '');
const words = (s: string) => (s.replace(NOTE_MARK, ' ').match(/[\p{L}\p{N}]+/gu) ?? []).length;
/** A sentence that is essentially only `formula`: it holds it, with at most 3 other words ("In symbols:"). */
const onlyFormula = (sentence: string, formula: string) => norm(sentence).includes(norm(formula)) && words(sentence) - words(formula) <= 3;

/** The source note's label: the byline's author form, or the title. */
export function sourceLabel(src: { title: string; authors?: readonly string[] }): string {
  const authors = authorLine(src.authors);
  if (authors && authors.length <= 60) return authors;
  return src.title.length <= 60 ? src.title : `${src.title.slice(0, 59).replace(/\s+\S*$/, '')}…`;
}

/** The source note, built from metadata only: never from model prose. */
export function sourceNote(src: DocSource): SourceNote {
  const detail = [authorList(src.authors), src.year ? String(src.year) : ''].filter(Boolean).join(', ').slice(0, 120);
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
 * Rewrite citations of the source as `[[source]]`: "Vaswani et al. (2017)", "Vaswani et al., 2017",
 * "(Vaswani et al., 2017)", "Ho, Jain and Abbeel", "Vaswani and colleagues", a full author name, "the authors of
 * <title>", and the title in quotes or italics (as "the paper by [[source]]" when the authors are known). A bare
 * surname counts only with one of these or a year, so "Bloom filters" stays text. `marks: false` (the dek, which
 * cannot hold a marker) only removes parenthetical citations.
 */
export function markCitations(text: string, src: DocSource, marks = true): { text: string; cited: number } {
  let cited = 0;
  const authors = src.authors ?? [];
  const rules: [RegExp, string][] = [];
  if (authors.length) {
    const any = (name: string) => `(?:${[...new Set([name, surname(name)])].map(esc).join('|')})`;
    const first = `(?<![\\p{L}\\p{N}])${any(authors[0]!)}`;
    const and = '\\s+(?:and|&)\\s+';
    const rest = authors.slice(1).map(surname).map(esc);
    const tails = [
      '\\s+et\\s+al\\.?',
      '\\s+and\\s+(?:colleagues|co-?authors|co-?workers)',
      ...(authors.length === 2 ? [`${and}${any(authors[1]!)}`] : []),
      ...(authors.length >= 3 && authors.length <= 4 ? [`${rest.slice(0, -1).map((r) => `,\\s*${r}`).join('')},?${and}${rest.at(-1)}`] : []),
    ];
    const tail = `(?:${tails.join('|')})`;
    // Without a known year, only a bracketed 19xx/20xx counts, never ", 1024".
    const year = `(?:${src.year ?? '(?:19|20)\\d{2}'}[a-z]?(?!\\d))`;
    const comma = src.year ? `|,\\s*${year}` : '';
    rules.push([new RegExp(`\\(\\s*${first}${tail}?,?\\s*${year}?\\s*\\)`, 'gu'), marks ? `(${MARK})` : '']);
    if (marks) {
      rules.push([new RegExp(`${first}(?:${tail}(?:\\s*\\(${year}\\)${comma})?|\\s*\\(${year}\\)${comma})`, 'gu'), MARK]);
      if (/\s/.test(authors[0]!.trim())) rules.push([new RegExp(free(esc(authors[0]!.trim())), 'gu'), MARK]);
    }
  }
  if (marks) {
    const title = esc(src.title.trim());
    const quoted = `[“"‘']${title}[”"’']|\\*${title}\\*`;
    const by = authors.length ? `the ${src.kind === 'arxiv' ? 'paper' : 'post'} by ${MARK}` : MARK;
    rules.push([new RegExp(`the\\s+authors\\s+of\\s+(?:the\\s+(?:paper|post)\\s+)?(?:${quoted}|${title})`, 'giu'), MARK]);
    rules.push([new RegExp(quoted, 'giu'), by]);
    if (src.title.trim().split(/\s+/).length >= 3) rules.push([new RegExp(free(title), 'gu'), by]);
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
  if (sourceLabel(src).endsWith('.')) out = out.replaceAll(`${MARK}.`, MARK);
  return { text: out === text ? text : tidy(out), cited };
}

interface Gloss {
  formula: string;
  plain: string;
  used: boolean;
}

/** Make the text plain: see the module comment. Pure; the caller validates the doc it builds from the result. */
export function plainWords(input: PlainText, planNotes: readonly PlanNote[], src: DocSource): PlainText & { notes: Note[]; report: PlainReport } {
  const report: PlainReport = { moved: 0, kept: 0, removed: 0, cited: 0 };
  // The model's notes; a LaTeX formula would show as code, so that note goes (and its markers with it).
  const glosses = new Map<string, Gloss>();
  for (const n of planNotes) {
    const formula = n.formula.replace(/`/g, '').trim();
    if (formula && n.plain && !hasLatex(formula) && !glosses.has(n.id.trim())) glosses.set(n.id.trim(), { formula, plain: n.plain, used: false });
  }
  const surnames = new Set((src.authors ?? []).map((a) => surname(a).toLowerCase()));
  const isSource = (id: string) => id === SOURCE_ID || (!glosses.has(id) && surnames.has(id.toLowerCase()));
  const cite = (t: string) => {
    const r = markCitations(t, src);
    report.cited += r.cited;
    return r.text.replace(NOTE_MARK, (m, id: string) => (isSource(id.trim()) ? MARK : m));
  };
  const cited = { paragraphs: input.paragraphs.map((ps) => ps.map(cite)), takeaway: cite(input.takeaway) };
  const budget = MAX_NOTES - ([...cited.paragraphs.flat(), cited.takeaway].some((t) => t.includes(MARK)) ? 1 : 0);
  const math: MathNote[] = [];
  const add = (g: Gloss) => {
    g.used = true;
    const note: MathNote = { id: `m${math.length + 1}`, kind: 'math', formula: g.formula, plain: g.plain };
    math.push(note);
    return note;
  };

  /** Markers, then formulas, in one paragraph or the takeaway (`body`), or in the dek (no markers allowed). */
  const fix = (text: string, body: boolean): string => {
    let own: MathNote | undefined;
    let s = tidy(text.replace(NOTE_MARK, (m, raw: string) => {
      const id = raw.trim();
      if (body && id === SOURCE_ID) return m;
      const g = glosses.get(id);
      if (!body || !g || g.used || own || math.length >= budget) {
        report.removed++;
        return ' ';
      }
      own = add(g);
      return `[[${own.id}]]`;
    }));
    const kept: string[] = [];
    for (let guard = 0; guard < 20; guard++) {
      const f = findFormula(s);
      const at = f === null ? -1 : s.indexOf(f);
      if (f === null || at < 0) break;
      const [start, end] = [sentenceStart(s, at), sentenceEnd(s, at)];
      const sentence = s.slice(start, end);
      const [before, after] = [s.slice(0, start).trimEnd(), s.slice(end).trimStart()];
      const g = body && !own && math.length < budget && (before || after) && !noteRefs(sentence).length
        ? [...glosses.values()].find((x) => !x.used && onlyFormula(sentence, x.formula))
        : undefined;
      if (g) {
        // Drop the formula's sentence; the marker follows the sentence before it, or the next one if it came first.
        own = add(g);
        const mark = `[[${own.id}]]`;
        const next = sentenceEnd(after, 0);
        s = before ? `${before}${mark}${after ? ` ${after}` : ''}` : `${after.slice(0, next)}${mark}${after.slice(next)}`;
        report.moved++;
        continue;
      }
      // Anything else stays as written, masked so the search moves on (a private-use character never reads as math).
      s = s.slice(0, at) + String.fromCharCode(0xe000 + kept.push(f) - 1) + s.slice(at + f.length);
      report.kept++;
    }
    return s.replace(/[-]/g, (c) => kept[c.charCodeAt(0) - 0xe000] ?? '');
  };

  const dekCited = markCitations(input.dek, src, false);
  report.cited += dekCited.cited;
  const paragraphs = cited.paragraphs.map((ps) => ps.map((p) => fix(p, true)));
  const takeaway = fix(cited.takeaway, true);
  const dek = fix(dekCited.text, false);
  const stillCites = [...paragraphs.flat(), takeaway].some((t) => t.includes(MARK));
  return { dek, paragraphs, takeaway, notes: [...math, ...(stillCites ? [sourceNote(src)] : [])], report };
}
