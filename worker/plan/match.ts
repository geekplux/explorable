// Deterministic match mode: score registry keywords against the title,
// headings and abstract. No model call; also gives the AI call its hints.
import type { ModelDef } from '../../skills/explorable/kit/src/registry.ts';
import type { Extracted } from '../extract';
import { MODELS } from './schema';

/** A keyword counts once per field, weighted by where it appears. */
export const FIELD_WEIGHTS = { title: 3, headings: 2, abstract: 1 } as const;
/**
 * Match mode needs a score of at least MATCH_THRESHOLD (a title hit plus
 * support elsewhere) from at least MIN_KEYWORDS distinct keywords, so one
 * shared word ("attention economy", "probabilistic") never picks a template.
 */
export const MATCH_THRESHOLD = 5;
export const MIN_KEYWORDS = 2;

export interface Match {
  id: string;
  score: number;
  /** Distinct keywords found. */
  hits: number;
}

const words = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
const has = (field: string, kw: string) => field.includes(` ${kw} `) || field.includes(` ${kw}s `);

export function scoreModel(m: ModelDef, ex: Pick<Extracted, 'title' | 'headings' | 'abstract'>): Match {
  const fields = { title: words(ex.title), headings: words(ex.headings.join(' ')), abstract: words(ex.abstract) };
  let [score, hits] = [0, 0];
  for (const kw of new Set(m.keywords.map((k) => words(k).trim()))) {
    const before = score;
    for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
      if (has(fields[field as keyof typeof fields], kw)) score += weight;
    }
    if (score > before) hits++;
  }
  return { id: m.id, score, hits };
}

/** Models with any keyword hit, best first (ties by id). */
export function matchModels(ex: Pick<Extracted, 'title' | 'headings' | 'abstract'>): Match[] {
  return MODELS.map((m) => scoreModel(m, ex))
    .filter((r) => r.score > 0)
    .toSorted((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/** The best match that clears the threshold, if any. */
export const bestMatch = (matches: readonly Match[]): Match | undefined =>
  matches.find((m) => m.score >= MATCH_THRESHOLD && m.hits >= MIN_KEYWORDS);
