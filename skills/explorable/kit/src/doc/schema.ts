/**
 * ExplorableDoc v1: the contract shared by built-in samples, the Worker output
 * and skill specs (docs/PLAN.md §5.2), as a valibot schema. Types are inferred
 * from the schema; `parseDoc` returns path-specific error messages.
 */
import * as v from 'valibot';

export const FIGURE_KINDS = ['bars', 'bits', 'histogram', 'curve'] as const;

const slug = (what: string) =>
  v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9-]*$/, `${what} must be lowercase letters, digits and dashes`));
const text = (max: number, min = 1) =>
  v.pipe(
    v.string(),
    v.minLength(min, min === 1 ? 'must not be empty' : `must be at least ${min} characters`),
    v.maxLength(max, `must be at most ${max} characters`),
  );
const list = <T extends v.GenericSchema>(item: T, min: number, max: number) =>
  v.pipe(v.array(item), v.minLength(min, `needs ${min} to ${max} items`), v.maxLength(max, `needs ${min} to ${max} items`));
const range = <T extends { min: number; max: number }>(input: T) => input.min < input.max;

const ExprParamSchema = v.pipe(
  v.object({
    name: v.pipe(v.string(), v.regex(/^[A-Za-z_]\w*$/, 'must be an identifier')),
    label: text(60),
    min: v.number(),
    max: v.number(),
    default: v.number(),
    step: v.optional(v.pipe(v.number(), v.minValue(0, 'must be positive'))),
  }),
  v.check((p) => range(p) && p.default >= p.min && p.default <= p.max, 'needs min < max and min ≤ default ≤ max'),
);

const ExprCurveModelSchema = v.object({
  id: v.literal('expr-curve'),
  expr: text(200),
  x: v.pipe(
    v.object({
      name: v.literal('x', 'must be "x"'),
      label: text(60),
      min: v.number(),
      max: v.number(),
      scale: v.optional(v.picklist(['linear', 'log'])),
    }),
    v.check(range, 'needs min < max'),
  ),
  y: v.object({ label: text(60), min: v.optional(v.number()), max: v.optional(v.number()) }),
  params: v.pipe(v.array(ExprParamSchema), v.maxLength(6, 'at most 6 params')),
});

const RegistryModelSchema = v.object({
  id: slug('model id'),
  params: v.record(v.string(), v.number()),
});

/** Kind-specific options; see docs/figures/samples.md §3 for the known keys. */
const OptionValue = v.union([v.string(), v.number(), v.boolean(), v.array(v.string())]);

const FigureSchema = v.pipe(
  v.object({
    id: slug('figure id'),
    kind: v.picklist(FIGURE_KINDS, `must be one of ${FIGURE_KINDS.join(', ')}`),
    title: text(120),
    caption: text(400),
    alt: text(600, 40),
    model: v.lazy((input) =>
      (input as { id?: unknown } | null)?.id === 'expr-curve' ? ExprCurveModelSchema : RegistryModelSchema,
    ),
    controls: list(v.string(), 1, 3),
    readouts: list(v.string(), 1, 3),
    options: v.optional(v.record(v.string(), OptionValue)),
  }),
  v.forward(
    v.check(({ model, controls }) => {
      const names = 'expr' in model ? ['x', ...model.params.map((p) => p.name)] : Object.keys(model.params);
      return controls.every((c) => names.includes(c));
    }, 'every control must name a model param (or "x" for expr-curve)'),
    ['controls'],
  ),
);

const SectionSchema = v.object({
  id: slug('section id'),
  heading: text(90),
  paragraphs: list(text(700), 1, 4),
  figure: v.optional(FigureSchema),
});

/** The valibot schema for ExplorableDoc v1. */
export const ExplorableDocSchema = v.pipe(
  v.object({
    schema: v.literal(1, 'must be 1 (ExplorableDoc v1)'),
    id: slug('doc id'),
    title: text(90),
    dek: text(220),
    source: v.object({
      kind: v.picklist(['arxiv', 'blog', 'concept']),
      url: v.optional(v.pipe(v.string(), v.url('must be a URL'))),
      title: text(300),
      authors: v.optional(v.array(text(120))),
      year: v.optional(v.pipe(v.number(), v.integer())),
    }),
    provenance: v.object({
      mode: v.picklist(['curated', 'ai', 'match']),
      model: v.optional(v.string()),
      generatedAt: v.pipe(v.string(), v.isoTimestamp('must be an ISO 8601 timestamp')),
    }),
    sections: list(SectionSchema, 2, 6),
    takeaway: text(300),
  }),
  v.forward(
    v.check((doc) => {
      const ids = doc.sections.flatMap((s) => (s.figure ? [s.id, s.figure.id] : [s.id]));
      return new Set(ids).size === ids.length;
    }, 'section and figure ids must be unique'),
    ['sections'],
  ),
);

export type ExplorableDoc = v.InferOutput<typeof ExplorableDocSchema>;
export type DocSource = ExplorableDoc['source'];
export type Provenance = ExplorableDoc['provenance'];
export type DocSection = v.InferOutput<typeof SectionSchema>;
export type FigureSpec = v.InferOutput<typeof FigureSchema>;
export type FigureKind = FigureSpec['kind'];
export type ExprCurveModel = v.InferOutput<typeof ExprCurveModelSchema>;
export type ExprParam = v.InferOutput<typeof ExprParamSchema>;
export type RegistryModelRef = v.InferOutput<typeof RegistryModelSchema>;

export type ParseResult = { ok: true; doc: ExplorableDoc } | { ok: false; errors: string[] };

/** "sections[1].figure.alt" for an issue, or "(doc)" at the root. */
function issuePath(issue: v.BaseIssue<unknown>): string {
  const keys = issue.path?.map((item) => item.key) ?? [];
  return keys.map((k, i) => (typeof k === 'number' ? `[${k}]` : `${i ? '.' : ''}${String(k)}`)).join('') || '(doc)';
}

/** Validate unknown input as an ExplorableDoc v1. Errors read "path: problem". */
export function parseDoc(input: unknown): ParseResult {
  const result = v.safeParse(ExplorableDocSchema, input);
  if (result.success) return { ok: true, doc: result.output };
  return {
    ok: false,
    errors: result.issues.map((issue) => {
      const missing = issue.kind === 'schema' && issue.input === undefined;
      return `${issuePath(issue)}: ${missing ? 'is required' : issue.message}`;
    }),
  };
}
