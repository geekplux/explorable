/**
 * ExplorableDoc v1 and v2: the contract shared by built-in samples, the Worker output
 * and skill specs (docs/PLAN.md §5.2), as a valibot schema. Types are inferred
 * from the schema; `parseDoc` returns path-specific error messages. v2 adds doc-level
 * `notes` (formulas and sources behind a marker, docs/redesign/DESIGN.md §9) that
 * paragraphs and the takeaway reference with `[[id]]`; see `notes.ts`.
 */
import * as v from 'valibot';
import { NOTE_ID as NOTE_ID_RE, noteIssues } from './notes.ts';

export const FIGURE_KINDS = ['bars', 'bits', 'histogram', 'curve'] as const;

const slug = (what: string) =>
  v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9-]*$/, `${what} must be lowercase letters, digits and dashes`));
/**
 * Whitespace, invisible format characters (zero-width space, joiners, bidi marks) and combining marks
 * (a lone U+0301 shows nothing on its own): never counted as text.
 */
const INVISIBLE = /[\p{Cf}\p{M}\s]/gu;
/** A string with at least `min` visible characters (padding, zero-width characters and marks never count) and at most `max` in all. */
const text = (max: number, min = 1) =>
  v.pipe(
    v.string(),
    v.check((s) => s.replace(INVISIBLE, '').length >= min, min === 1 ? 'must not be empty' : `must be at least ${min} characters`),
    v.maxLength(max, `must be at most ${max} characters`),
  );
/** A label a figure shows (a control or an axis): it must say something, so it needs a letter or digit, not only "-" or "—". */
const SAYS = /[\p{L}\p{N}]/u;
const label = (max: number) =>
  v.pipe(
    text(max),
    v.check((s) => SAYS.test(s.replace(INVISIBLE, '')), 'must have a letter or digit; a label must say what it marks'),
  );
const list = <T extends v.GenericSchema>(item: T, min: number, max: number) =>
  v.pipe(v.array(item), v.minLength(min, `needs ${min} to ${max} items`), v.maxLength(max, `needs ${min} to ${max} items`));
const range = <T extends { min: number; max: number }>(input: T) => input.min < input.max;

const ExprParamSchema = v.pipe(
  v.strictObject({
    name: v.pipe(v.string(), v.regex(/^[A-Za-z_]\w*$/, 'must be an identifier')),
    label: label(60),
    min: v.number(),
    max: v.number(),
    default: v.number(),
    step: v.optional(v.pipe(v.number(), v.gtValue(0, 'must be greater than 0'))),
  }),
  v.check((p) => range(p) && p.default >= p.min && p.default <= p.max, 'needs min < max and min ≤ default ≤ max'),
);

const ExprCurveModelSchema = v.strictObject({
  id: v.literal('expr-curve'),
  expr: text(200),
  x: v.pipe(
    v.strictObject({
      name: v.literal('x', 'must be "x"'),
      label: label(60),
      min: v.number(),
      max: v.number(),
      scale: v.optional(v.picklist(['linear', 'log'])),
    }),
    v.check(range, 'needs min < max'),
  ),
  y: v.strictObject({ label: label(60), min: v.optional(v.number()), max: v.optional(v.number()) }),
  params: v.pipe(v.array(ExprParamSchema), v.maxLength(6, 'at most 6 params')),
});

const RegistryModelSchema = v.strictObject({
  id: slug('model id'),
  params: v.record(v.string(), v.number()),
});

/** Kind-specific options; see docs/figures/samples.md §3 for the known keys. */
const OptionValue = v.union([v.string(), v.number(), v.boolean(), v.array(v.string())]);

const FigureSchema = v.pipe(
  v.strictObject({
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

const SectionSchema = v.strictObject({
  id: slug('section id'),
  heading: text(90),
  paragraphs: list(text(700), 1, 4),
  figure: v.optional(FigureSchema),
});

const NOTE_ID = v.pipe(v.string(), v.regex(NOTE_ID_RE, 'must be a lowercase letter, then up to 23 lowercase letters, digits or dashes'));
const MathNoteSchema = v.strictObject({ id: NOTE_ID, kind: v.literal('math'), formula: text(160), plain: text(240) });
const SourceNoteSchema = v.strictObject({
  id: NOTE_ID,
  kind: v.literal('source'),
  label: label(60),
  title: text(200),
  detail: v.optional(text(120)),
  url: v.optional(v.pipe(v.string(), v.url('must be a URL'), v.regex(/^https:\/\//i, 'must be an https URL'))),
});
const NoteSchema = v.variant('kind', [MathNoteSchema, SourceNoteSchema], 'must be "math" or "source"');

/** The valibot schema for ExplorableDoc v1 and v2. */
export const ExplorableDocSchema = v.pipe(
  v.strictObject({
    schema: v.picklist([1, 2], 'must be 1 or 2 (ExplorableDoc v1 or v2)'),
    id: slug('doc id'),
    title: text(90),
    dek: text(220),
    source: v.strictObject({
      kind: v.picklist(['arxiv', 'blog', 'concept']),
      url: v.optional(v.pipe(v.string(), v.url('must be a URL'), v.regex(/^https?:\/\//i, 'must be an http(s) URL'))),
      title: text(300),
      authors: v.optional(v.array(text(120))),
      year: v.optional(v.pipe(v.number(), v.integer())),
    }),
    provenance: v.strictObject({
      mode: v.picklist(['curated', 'ai', 'match']),
      model: v.optional(v.string()),
      generatedAt: v.pipe(v.string(), v.isoTimestamp('must be an ISO 8601 timestamp')),
    }),
    sections: list(SectionSchema, 2, 6),
    takeaway: text(300),
    notes: v.optional(v.pipe(v.array(NoteSchema), v.maxLength(12, 'at most 12 notes'))),
  }),
  v.forward(
    v.check((doc) => {
      const ids = doc.sections.flatMap((s) => (s.figure ? [s.id, s.figure.id] : [s.id]));
      return new Set(ids).size === ids.length;
    }, 'section and figure ids must be unique'),
    ['sections'],
  ),
  v.rawCheck(({ dataset, addIssue }) => {
    if (!dataset.typed) return;
    for (const { path, message } of noteIssues(dataset.value)) {
      const items = path.map((key) => ({ type: 'object', origin: 'value', input: dataset.value, key, value: undefined }));
      addIssue({ message, path: items as unknown as [v.IssuePathItem, ...v.IssuePathItem[]] });
    }
  }),
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
export type Note = v.InferOutput<typeof NoteSchema>;
export type MathNote = v.InferOutput<typeof MathNoteSchema>;
export type SourceNote = v.InferOutput<typeof SourceNoteSchema>;

export type ParseResult = { ok: true; doc: ExplorableDoc } | { ok: false; errors: string[] };

/** strictObject reports an unknown key with `expected: "never"`. */
const isUnknownKey = (issue: v.BaseIssue<unknown>) => issue.type === 'strict_object' && issue.expected === 'never';

/** "sections[1].figure.alt" for an issue, or "(doc)" at the root. Unknown keys point at their parent. */
function issuePath(issue: v.BaseIssue<unknown>): string {
  const keys = issue.path?.map((item) => item.key) ?? [];
  if (isUnknownKey(issue)) keys.pop();
  return keys.map((k, i) => (typeof k === 'number' ? `[${k}]` : `${i ? '.' : ''}${String(k)}`)).join('') || '(doc)';
}

/** Validate unknown input as an ExplorableDoc (v1 or v2). Errors read "path: problem". */
export function parseDoc(input: unknown): ParseResult {
  const result = v.safeParse(ExplorableDocSchema, input);
  if (result.success) return { ok: true, doc: result.output };
  return {
    ok: false,
    errors: result.issues.map((issue) => {
      const missing = issue.kind === 'schema' && issue.input === undefined;
      const message = isUnknownKey(issue) ? `unknown key ${issue.received}` : missing ? 'is required' : issue.message;
      return `${issuePath(issue)}: ${message}`;
    }),
  };
}
