// Reading level (docs/redesign/DESIGN.md §9): the Flesch–Kincaid grade of an essay's body text, logged for
// monitoring and never shown. Deterministic: a vowel-group syllable heuristic, no dictionary.
import { NOTE_MARK } from '../../skills/explorable/kit/src/doc/notes.ts';
import type { ExplorableDoc } from '../../skills/explorable/kit/src/doc/schema.ts';

/** Syllables in one word: vowel groups, minus a silent final "e", "es" or "ed"; numbers and symbols count 1. */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 0);
}

export interface Reading {
  grade: number;
  words: number;
  sentences: number;
}

/** Flesch–Kincaid grade of passages: 0.39 × words per sentence + 11.8 × syllables per word − 15.59. */
export function fleschKincaid(texts: readonly string[]): Reading {
  let [words, sentences, syl] = [0, 0, 0];
  for (const text of texts) {
    // A number ("0.25", "1,000") is one word.
    const ws = text.match(/\d+(?:[.,]\d+)*|[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
    if (!ws.length) continue;
    words += ws.length;
    syl += ws.reduce((n, w) => n + syllables(w), 0);
    // Words after the last closing punctuation make one more sentence.
    const ends = [...text.matchAll(/[.!?…]+["”’)\]]*(?=\s|$)/g)];
    const tail = ends.length ? text.slice(ends.at(-1)!.index + ends.at(-1)![0].length) : text;
    sentences += ends.length + (/[\p{L}\p{N}]/u.test(tail) ? 1 : 0);
  }
  if (!words) return { grade: 0, words, sentences };
  const grade = 0.39 * (words / sentences) + 11.8 * (syl / words) - 15.59;
  return { grade: Math.round(grade * 10) / 10, words, sentences };
}

/** The grade of a doc's paragraphs and takeaway as a reader sees them: source markers read as their label. */
export function readingLevel(doc: ExplorableDoc): Reading {
  const labels = new Map((doc.notes ?? []).flatMap((n) => (n.kind === 'source' ? [[n.id, n.label]] : [])));
  // "et al." before a lowercase word does not end a sentence.
  const shown = (t: string) =>
    t.replace(NOTE_MARK, (_m, id: string) => ` ${labels.get(id.trim()) ?? ''} `).replace(/[`*]/g, '').replace(/\bal\.(?=\s+\p{Ll})/gu, 'al');
  return fleschKincaid([...doc.sections.flatMap((s) => s.paragraphs), doc.takeaway].map(shown));
}
