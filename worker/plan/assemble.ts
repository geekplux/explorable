// Plan → ExplorableDoc v2 (docs/PLAN.md §5.3 step 6). Deterministic and strict:
// params are clamped to their ranges, expressions are validated by the kit,
// a figure that fails is dropped, the text goes through the plain-words
// post-process (plain.ts), and the result must pass `parseDoc`.
import attention from '../../src/samples/attention.json';
import bloomFilter from '../../src/samples/bloom-filter.json';
import diffusion from '../../src/samples/diffusion.json';
import { NOTE_MARK } from '../../skills/explorable/kit/src/doc/notes.ts';
import { type DocSource, type ExplorableDoc, type FigureSpec, parseDoc } from '../../skills/explorable/kit/src/doc/schema.ts';
import { exprCurveModel } from '../../skills/explorable/kit/src/models/expr-curve.ts';
import { getModel, type ModelDef, type ParamDef } from '../../skills/explorable/kit/src/registry.ts';
import { snap } from '../../skills/explorable/kit/src/runtime/values.ts';
import { ApiError } from '../errors';
import type { Extracted } from '../extract';
import { type PlainReport, SOURCE_ID, plainWords, sourceLabel } from './plain';
import { EXPR_CURVE, type Plan, type PlanFigure } from './schema';

/** Curated samples double as match-mode templates and as the source of kind options. */
export const TEMPLATES: Record<string, ExplorableDoc> = Object.fromEntries(
  ([attention, bloomFilter, diffusion] as ExplorableDoc[]).map((d) => [d.id, d]),
);
/** Template options that describe the sample's own content, not the figure kind. */
const CONTENT_KEYS = new Set(['labels', 'query', 'describe']);

/** Plain text: no control or bidi-override characters, single spaces. Escaping happens in essayHtml. */
export const clean = (s: string): string =>
  // oxlint-disable-next-line no-control-regex -- stripping control characters is the point
  s.replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Characters of scripts the essay is never written in (Han, kana, Hangul, CJK and
 * full-width punctuation). The prompt asks for English only; this catches a stray
 * one anyway, as in "false positive 率".
 */
const FOREIGN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff00-\uffef]+/gu;

/** Model-written prose: `clean`, minus stray CJK characters (and the gap they leave before punctuation). */
export const prose = (s: string): string => {
  const out = clean(s);
  if (!FOREIGN.test(out)) return out;
  FOREIGN.lastIndex = 0;
  return clean(out.replace(FOREIGN, ' ')).replace(/\s+([.,;:!?)\]])/g, '$1').replace(/([([])\s+/g, '$1');
};

/** Model prose where a note marker cannot go (title, headings, figure text): `prose`, with markers removed. */
const bare = (s: string): string => prose(s.replace(NOTE_MARK, ' ')).replace(/\s+([.,;:!?)\]])/g, '$1');

export function slugify(s: string, fallback: string): string {
  const slug = s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').slice(0, 48).replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
  used.add(id);
  return id;
}

export function sourceOf(ex: Extracted): DocSource {
  const authors = ex.authors.map((a) => clean(a).slice(0, 120)).filter(Boolean).slice(0, 20);
  return {
    kind: ex.kind === 'arxiv' ? 'arxiv' : 'blog',
    url: ex.url,
    title: clean(ex.title).slice(0, 300) || ex.url.slice(0, 300),
    ...(authors.length > 0 && { authors }),
    ...(ex.year !== null && { year: ex.year }),
  };
}

/** Match mode: the curated template for `slug`, with the real source swapped in. */
export function matchDoc(slug: string, ex: Extracted, now = new Date()): ExplorableDoc {
  const doc = structuredClone(TEMPLATES[slug]!);
  return { ...doc, source: sourceOf(ex), provenance: { mode: 'match', generatedAt: now.toISOString() } };
}

/** Kind options from the model's template figure, minus content-specific keys. */
function kindOptions(m: ModelDef, kind: string, controls: string[]): NonNullable<FigureSpec['options']> {
  const figure = TEMPLATES[m.template ?? '']?.sections.find((s) => s.figure?.model.id === m.id && s.figure.kind === kind)?.figure;
  const options = Object.fromEntries(Object.entries(figure?.options ?? {}).filter(([k]) => !CONTENT_KEYS.has(k)));
  if (typeof options.handle === 'string' && !controls.includes(options.handle)) {
    options.handle = controls[0]!;
    delete options.ticks; // ticks belong to the template's handle
  }
  return options;
}

const pick = (wanted: string[], allowed: string[], fallback: string[]) => {
  const ok = [...new Set(wanted.filter((w) => allowed.includes(w)))];
  return ok.length > 0 ? ok : fallback;
};

function registryFigure(f: PlanFigure, m: ModelDef, base: Omit<FigureSpec, 'kind' | 'model' | 'controls' | 'readouts'>): FigureSpec {
  const defs = m.params as Record<string, ParamDef>;
  const given = new Map(f.params.map((p) => [p.name, p.value]));
  const params = Object.fromEntries(Object.entries(defs).map(([n, d]) => {
    const value = given.get(n);
    return [n, snap(d, Number.isFinite(value) ? value! : d.default)];
  }));
  const adjustable = Object.keys(defs).filter((n) => n !== 'seed' && defs[n]!.min < defs[n]!.max);
  const controls = pick(f.controls, adjustable, adjustable.slice(0, 1));
  const outputs = Object.keys(m.outputs);
  const kind = m.kinds[0]!;
  const options = kindOptions(m, kind, controls);
  if (kind === 'bars' && f.labels) options.labels = f.labels.map(prose);
  return { ...base, kind, model: { id: m.id, params }, controls, readouts: pick(f.readouts, outputs, outputs.slice(0, 1)), options };
}

function curveFigure(f: PlanFigure, base: Omit<FigureSpec, 'kind' | 'model' | 'controls' | 'readouts'>): FigureSpec | undefined {
  const c = f.curve;
  // A finite span is required too: [-1e308, 1e308] passes min < max but overflows the step.
  if (!c || ![c.x, ...c.vars].every((r) => r.min < r.max && Number.isFinite(r.max - r.min))) return undefined;
  const given = new Map(f.params.map((p) => [p.name, p.value]));
  const start = (name: string, min: number, max: number) => Math.min(max, Math.max(min, given.get(name) ?? (min + max) / 2));
  const names = ['x', ...c.vars.map((v) => v.name)];
  const spec: FigureSpec = {
    ...base,
    kind: 'curve',
    model: {
      id: EXPR_CURVE,
      expr: c.expr,
      x: { name: 'x', label: prose(c.x.label), min: c.x.min, max: c.x.max, ...(c.x.scale && { scale: c.x.scale }) },
      y: { label: prose(c.y.label), ...(c.y.min !== undefined && { min: c.y.min }), ...(c.y.max !== undefined && { max: c.y.max }) },
      params: c.vars.map((v) => ({ name: v.name, label: prose(v.label), min: v.min, max: v.max, default: start(v.name, v.min, v.max) })),
    },
    controls: pick(f.controls, names, ['x']),
    readouts: pick(f.readouts, ['x', 'y'], ['x', 'y']),
    options: { x0: start('x', c.x.min, c.x.max) },
  };
  try {
    exprCurveModel(spec); // parses, checks names and finiteness; throws on a bad expression
    return spec;
  } catch {
    return undefined;
  }
}

export interface AssembleOptions {
  model: string;
  now?: Date;
  /** Hears what the plain-words post-process changed, and whether its result had to be dropped (for the log line). */
  onReport?: (report: PlainReport & { fallback: boolean }) => void;
}

/** Build the doc. Throws NO_FIGURE when every figure is dropped, PLAN_INVALID when the doc is invalid. */
export function assemblePlan(plan: Plan, ex: Extracted, { model, now = new Date(), onReport }: AssembleOptions): ExplorableDoc {
  const used = new Set<string>();
  const sections: ExplorableDoc['sections'] = plan.sections.map((s, i) => ({
    id: uniqueId(slugify(bare(s.heading), `section-${i + 1}`), used),
    heading: bare(s.heading),
    paragraphs: s.paragraphs.map(prose),
  }));
  let figures = 0;
  for (const f of plan.figures) {
    const m = f.model === EXPR_CURVE ? undefined : getModel(f.model);
    const base = { id: '', title: bare(f.title), caption: bare(f.caption), alt: bare(f.alt) };
    const spec = m ? registryFigure(f, m, base) : curveFigure(f, base);
    // One figure per section: the asked-for one, else the next free one, else any free one.
    const at = Math.min(f.section, sections.length - 1);
    const home = [...sections.slice(at), ...sections.slice(0, at)].find((s) => !s.figure);
    if (!spec || !home) continue;
    home.figure = { ...spec, id: uniqueId(`figure-${++figures}`, used) };
  }
  if (figures === 0) throw new ApiError('NO_FIGURE', 'None of the planned figures could be built from the kit.');
  const source = sourceOf(ex);
  const text = { dek: prose(plan.dek), paragraphs: sections.map((s) => s.paragraphs), takeaway: prose(plan.takeaway) };
  const notes = (plan.notes ?? []).map((n) => ({ id: n.id, formula: prose(n.formula), plain: prose(n.plain) }));
  const plain = plainWords(text, notes, source);
  const doc = (t: typeof text, extra: Pick<ExplorableDoc, 'notes'>) =>
    parseDoc({
      schema: 2,
      id: slugify(bare(plan.title), 'explorable'),
      title: bare(plan.title),
      dek: t.dek,
      source,
      provenance: { mode: 'ai', model, generatedAt: now.toISOString() },
      sections: sections.map((s, i) => ({ ...s, paragraphs: t.paragraphs[i]! })),
      takeaway: t.takeaway,
      ...extra,
    });
  let result = doc(plain, plain.notes.length ? { notes: plain.notes } : {});
  // A repair that does not validate (a paragraph pushed past its length, say) falls back to the text without notes,
  // the source marker written out as its label.
  const fallback = !result.ok;
  const flat = (s: string) => bare(s.replaceAll(`[[${SOURCE_ID}]]`, sourceLabel(source)));
  if (fallback) result = doc({ dek: flat(text.dek), paragraphs: text.paragraphs.map((ps) => ps.map(flat)), takeaway: flat(text.takeaway) }, {});
  onReport?.({ ...plain.report, fallback });
  if (!result.ok) throw new ApiError('PLAN_INVALID', 'The assembled essay did not pass validation.');
  return result.doc;
}
