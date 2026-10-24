/**
 * `attention-scaling`: softmax of q·kⱼ for a random query and 8 random keys
 * of width d_k, with or without dividing by √d_k (docs/figures/attention.md,
 * Fig 2). Normals are drawn once per seed; width d uses the first d
 * components, so dragging d_k grows the vectors instead of redrawing them.
 */
import { registerModel } from '../registry.ts';
import { mulberry32 } from '../rng.ts';
import { softmax, summarize } from './softmax-temperature.ts';

export const MAX_DK = 512;
export const KEYS = 8;

export type ScalingParams = { dk: number; scaled: number; seed: number };
export type ScalingOutputs = {
  scores: number[]; weights: number[]; weightsOther: number[];
  sd: number; sdExpected: number; top: number; entropy: number; topIndex: number;
};

const cache = new Map<number, { q: Float64Array; keys: Float64Array[] }>();

/** q[0..511], then key₁ … key₈, one Box–Muller normal per two uniforms (samples.md §8). Cached per seed. */
export function vectors(seed: number) {
  let v = cache.get(seed);
  if (!v) {
    const rng = mulberry32(seed);
    const normals = () =>
      Float64Array.from({ length: MAX_DK }, () => {
        const u1 = 1 - rng();
        return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng());
      });
    v = { q: normals(), keys: Array.from({ length: KEYS }, normals) };
    if (cache.size > 16) cache.clear();
    cache.set(seed, v);
  }
  return v;
}

/** Sample standard deviation (divisor n − 1). */
export function sampleSd(xs: readonly number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (xs.length - 1));
}

export const attentionScaling = registerModel<ScalingParams, ScalingOutputs>({
  id: 'attention-scaling',
  title: 'Scaled dot-product attention',
  kinds: ['bars'],
  keywords: ['attention', 'scaled', 'dot product', 'transformer', 'softmax', 'saturation', 'dimension', 'sqrt'],
  params: {
    dk: { label: 'key width d_k', spoken: 'key width d sub k', symbol: 'd_k', min: 1, max: MAX_DK, step: 1, default: 4, unit: 'dimensions', scale: 'log' },
    scaled: { label: 'Divide by √d_k', spoken: 'Divide by square root of d sub k', min: 0, max: 1, step: 1, default: 0, control: 'toggle' },
    seed: { label: 'seed', min: 0, max: 2 ** 32 - 1, step: 1, default: 229 },
  },
  outputs: {
    sd: { label: 'score SD', format: 'fixed2' },
    sdExpected: { label: 'expected SD', format: 'fixed2' },
    top: { label: 'top weight', format: 'fixed2' },
    entropy: { label: 'entropy', unit: 'bits', format: 'fixed2' },
    topIndex: { label: 'top key', format: 'int' },
  },
  compute(p) {
    const d = Math.min(MAX_DK, Math.max(1, Math.round(p.dk)));
    const { q, keys } = vectors(p.seed >>> 0);
    const raw = keys.map((key) => {
      let s = 0;
      for (let i = 0; i < d; i++) s += q[i]! * key[i]!;
      return s;
    });
    const root = Math.sqrt(d);
    const scaled = raw.map((s) => s / root);
    const [scores, other] = p.scaled ? [scaled, raw] : [raw, scaled];
    return {
      ...summarize(scores, softmax(scores)),
      weightsOther: softmax(other),
      sd: sampleSd(scores),
      sdExpected: p.scaled ? 1 : root,
    };
  },
  describe(p, o) {
    return (
      `d sub k = ${Math.round(p.dk)}, ${p.scaled ? 'divided by the square root of d sub k' : 'not scaled'}: ` +
      `scores spread with SD ${o.sd.toFixed(2)} (expected ${o.sdExpected.toFixed(2)}); ` +
      `key ${o.topIndex + 1} gets ${Math.round(o.top * 100)}% of the weight.`
    );
  },
  template: 'attention',
});
