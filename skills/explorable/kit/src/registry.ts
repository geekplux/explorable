/**
 * The model registry: every number a figure shows comes from a `ModelDef`
 * (docs/PLAN.md §5.2). Models are pure and deterministic (seeded RNG only).
 */
import type { FigureKind } from './doc/schema.ts';
import { format, isFormat, type Format } from './format.ts';
import { showValue } from './runtime/values.ts';

export type { FigureKind };

/** One numeric input of a model, with its range and how it is controlled. */
export interface ParamDef {
  label: string;
  /** The label in words for assistive tech ("key width d sub k"), when `label` has symbols. Default `label`. */
  spoken?: string;
  /** Short display name for the track label and the slider readout ("d_k"). Default: the param id. */
  symbol?: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
  scale?: 'linear' | 'log';
  /** Native control in the controls row; `toggle` is a 0/1 switch, `choice` a radio group. Default `range`. */
  control?: 'range' | 'toggle' | 'choice';
  /** Labels for a `choice` param; the value is the index. */
  choices?: string[];
  /** PageUp/PageDown step. Default 10 × `step`. */
  pageStep?: number;
}

/** One readout a model can produce. */
export interface OutputDef {
  label: string;
  /** The label in words for screen readers when `label` has symbols ("signal" for "signal √ᾱ_t"). Default: `label`. */
  spoken?: string;
  unit?: string;
  format: Format;
  /**
   * ±∞ is a meaningful value of this output (it formats as ∞ or −∞), such as an SNR in dB at
   * t = 0. Text only: the audit still rejects NaN, and a marker or anything plotted stays finite.
   */
  infinite?: boolean;
}

/** A registered model: params in, outputs out, plus a one-sentence live description. */
export interface ModelDef<
  P extends Record<string, number> = Record<string, number>,
  O extends Record<string, number | number[]> = Record<string, number | number[]>,
> {
  id: string;
  title: string;
  kinds: FigureKind[];
  /** Words that drive offline search and match mode. */
  keywords: string[];
  params: { [K in keyof P]: ParamDef };
  outputs: Partial<Record<keyof O, OutputDef>>;
  compute(p: P): O;
  /** One-sentence live description; `labels` are the figure's item labels, if any. */
  describe(p: P, o: O, labels?: readonly string[]): string;
  /** Slug of the curated sample used in match mode. */
  template?: string;
}

/**
 * Fill a live-text template: `{name}` is an output (in its readout format) or a
 * param (at its step's precision); `{name:fmt}` picks the format. `extra`
 * values (such as `{marker}`) print with one decimal, integers without.
 * Unknown placeholders stay as written.
 */
export function fillTemplate(
  tpl: string, model: ModelDef, p: Record<string, number>, o: Record<string, number | number[]>, extra: Record<string, number> = {},
): string {
  return tpl.replace(/\{(\w+)(?::(\w+))?\}/g, (whole, name: string, f?: string) => {
    const fmt = isFormat(f) ? f : undefined;
    const own = <T extends object>(obj: T) => (Object.hasOwn(obj, name) ? (obj as Record<string, unknown>)[name] : undefined);
    const [ex, out, param] = [own(extra), own(o), own(p)];
    if (typeof ex === 'number') return fmt ? format(ex, fmt) : Number.isInteger(ex) ? format(ex, 'int') : format(ex, 'fixed1');
    if (typeof out === 'number') return format(out, fmt ?? model.outputs[name]?.format ?? 'fixed2');
    if (typeof param !== 'number') return whole;
    const def = own(model.params) as ParamDef | undefined;
    return fmt ? format(param, fmt) : def ? showValue(def, param) : String(param);
  });
}

const models = new Map<string, ModelDef>();

/** Register a model. Throws on a duplicate id or a default outside its range. */
export function registerModel<P extends Record<string, number>, O extends Record<string, number | number[]>>(
  def: ModelDef<P, O>,
): ModelDef<P, O> {
  const existing = models.get(def.id);
  if (existing && existing !== (def as unknown)) throw new Error(`model "${def.id}" is already registered`);
  for (const [name, p] of Object.entries<ParamDef>(def.params)) {
    if (!(p.min <= p.default && p.default <= p.max)) throw new Error(`model "${def.id}": param "${name}" default out of range`);
  }
  models.set(def.id, def as unknown as ModelDef);
  return def;
}

/** Look up a registered model by id. */
export function getModel(id: string): ModelDef | undefined {
  return models.get(id);
}

/**
 * Rank registered models for a free-text query: id and keyword matches beat
 * title matches; whole words beat prefixes. Returns matches, best first.
 */
export function searchModels(query: string): ModelDef[] {
  const words = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const score = (m: ModelDef) => {
    const ids = m.id.split('-');
    const keys = m.keywords.flatMap((k) => k.toLowerCase().split(/\s+/));
    const title: string[] = m.title.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    let s = 0;
    for (const w of words) {
      if (ids.includes(w)) s += 10;
      else if (ids.some((x) => x.startsWith(w))) s += 6;
      if (keys.includes(w)) s += 8;
      else if (keys.some((x) => x.startsWith(w))) s += 4;
      if (title.includes(w)) s += 3;
    }
    return s;
  };
  return [...models.values()]
    .map((m) => ({ m, s: score(m) }))
    .filter((r) => r.s > 0)
    .toSorted((a, b) => b.s - a.s || a.m.id.localeCompare(b.m.id))
    .map((r) => r.m);
}
