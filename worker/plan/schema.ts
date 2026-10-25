// The Plan: what the one Workers AI call returns (docs/design/prompt.md, D7).
// Flat on purpose: a 70B model follows a shallow schema far more reliably.
// `notes` are math notes only: the source note is built from the article's metadata (plain.ts).
// One valibot schema gives both the validator and the JSON Schema for JSON Mode.
import { toJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { attentionScaling } from '../../skills/explorable/kit/src/models/attention-scaling.ts';
import { bloomFilter } from '../../skills/explorable/kit/src/models/bloom-filter.ts';
import { diffusionForward } from '../../skills/explorable/kit/src/models/diffusion-forward.ts';
import { softmaxTemperature } from '../../skills/explorable/kit/src/models/softmax-temperature.ts';
import type { ModelDef } from '../../skills/explorable/kit/src/registry.ts';

/** Registry models the planner may pick (importing them registers them). */
export const MODELS = [softmaxTemperature, attentionScaling, bloomFilter, diffusionForward] as unknown as readonly ModelDef[];
export const EXPR_CURVE = 'expr-curve';
const MODEL_IDS = [...MODELS.map((m) => m.id), EXPR_CURVE];

const str = (max: number, min = 1) => v.pipe(v.string(), v.minLength(min), v.maxLength(max));
const list = <T extends v.GenericSchema>(item: T, min: number, max: number) => v.pipe(v.array(item), v.minLength(min), v.maxLength(max));
const name = v.pipe(v.string(), v.regex(/^[A-Za-z]\w{0,23}$/));

export const PlanSchema = v.object({
  coreIdea: str(220),
  title: str(90),
  dek: str(220),
  takeaway: str(300),
  sections: list(v.object({ heading: str(90), paragraphs: list(str(700), 1, 4) }), 3, 5),
  figures: list(
    v.object({
      section: v.pipe(v.number(), v.integer(), v.minValue(0)),
      model: v.picklist(MODEL_IDS),
      title: str(120),
      caption: str(400),
      alt: str(600, 40),
      params: v.pipe(v.array(v.object({ name, value: v.number() })), v.maxLength(12)),
      controls: list(v.string(), 1, 3),
      readouts: list(v.string(), 1, 3),
      labels: v.optional(list(str(40), 1, 8)),
      curve: v.optional(
        v.object({
          expr: str(200),
          x: v.object({ label: str(60), min: v.number(), max: v.number(), scale: v.optional(v.picklist(['linear', 'log'])) }),
          y: v.object({ label: str(60), min: v.optional(v.number()), max: v.optional(v.number()) }),
          vars: v.pipe(v.array(v.object({ name, label: str(60), min: v.number(), max: v.number() })), v.maxLength(3)),
        }),
      ),
    }),
    2,
    3,
  ),
  // Paragraphs and the takeaway reference a note as [[id]]; the post-process renumbers them.
  notes: v.optional(v.pipe(v.array(v.object({ id: str(24), formula: str(160), plain: str(240) })), v.maxLength(12))),
});

export type Plan = v.InferOutput<typeof PlanSchema>;
export type PlanFigure = Plan['figures'][number];
export type PlanNote = NonNullable<Plan['notes']>[number];

let cached: object | undefined;
/** JSON Schema for Workers AI `response_format.json_schema` (built once per isolate). */
export function planJsonSchema(): object {
  cached ??= toJsonSchema(PlanSchema, { errorMode: 'ignore' });
  return cached;
}

/** The Plan in `data`, or undefined when it does not match the schema. */
export function parsePlan(data: unknown): Plan | undefined {
  const result = v.safeParse(PlanSchema, data);
  return result.success ? result.output : undefined;
}
