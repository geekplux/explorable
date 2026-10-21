// Plan → ExplorableDoc (docs/PLAN.md §5.3 step 6). Deterministic and strict:
// params are clamped to their ranges, expressions are validated by the kit,
// a figure that fails is dropped, and the result must pass `parseDoc`.
import attention from '../../src/samples/attention.json';
import bloomFilter from '../../src/samples/bloom-filter.json';
import diffusion from '../../src/samples/diffusion.json';
import { type DocSource, type ExplorableDoc, type FigureSpec, parseDoc } from '../../skills/explorable/kit/src/doc/schema.ts';
import { exprCurveModel } from '../../skills/explorable/kit/src/models/expr-curve.ts';
import { getModel, type ModelDef, type ParamDef } from '../../skills/explorable/kit/src/registry.ts';
import { snap } from '../../skills/explorable/kit/src/runtime/values.ts';
import { ApiError } from '../errors';
import type { Extracted } from '../extract';
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
  if (kind === 'bars' && f.labels) options.labels = f.labels.map(clean);
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
      x: { name: 'x', label: clean(c.x.label), min: c.x.min, max: c.x.max, ...(c.x.scale && { scale: c.x.scale }) },
      y: { label: clean(c.y.label), ...(c.y.min !== undefined && { min: c.y.min }), ...(c.y.max !== undefined && { max: c.y.max }) },
      params: c.vars.map((v) => ({ name: v.name, label: clean(v.label), min: v.min, max: v.max, default: start(v.name, v.min, v.max) })),
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
}

/** Build the doc. Throws NO_FIGURE when every figure is dropped, PLAN_INVALID when the doc is invalid. */
export function assemblePlan(plan: Plan, ex: Extracted, { model, now = new Date() }: AssembleOptions): ExplorableDoc {
  const used = new Set<string>();
  const sections: ExplorableDoc['sections'] = plan.sections.map((s, i) => ({
    id: uniqueId(slugify(s.heading, `section-${i + 1}`), used),
    heading: clean(s.heading),
    paragraphs: s.paragraphs.map(clean),
  }));
  let figures = 0;
  for (const f of plan.figures) {
    const m = f.model === EXPR_CURVE ? undefined : getModel(f.model);
    const base = { id: '', title: clean(f.title), caption: clean(f.caption), alt: clean(f.alt) };
    const spec = m ? registryFigure(f, m, base) : curveFigure(f, base);
    // One figure per section: the asked-for one, else the next free one, else any free one.
    const at = Math.min(f.section, sections.length - 1);
    const home = [...sections.slice(at), ...sections.slice(0, at)].find((s) => !s.figure);
    if (!spec || !home) continue;
    home.figure = { ...spec, id: uniqueId(`figure-${++figures}`, used) };
  }
  if (figures === 0) throw new ApiError('NO_FIGURE', 'None of the planned figures could be built from the kit.');
  const result = parseDoc({
    schema: 1,
    id: slugify(plan.title, 'explorable'),
    title: clean(plan.title),
    dek: clean(plan.dek),
    source: sourceOf(ex),
    provenance: { mode: 'ai', model, generatedAt: now.toISOString() },
    sections,
    takeaway: clean(plan.takeaway),
  });
  if (!result.ok) throw new ApiError('PLAN_INVALID', 'The assembled essay did not pass validation.');
  return result.doc;
}
