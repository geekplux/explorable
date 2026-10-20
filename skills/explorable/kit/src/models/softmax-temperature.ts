/**
 * `softmax-temperature`: softmax of fixed scores divided by a temperature T
 * (docs/figures/attention.md, Fig 1). Numerically stable; entropy in bits.
 */
import { registerModel, type ParamDef } from '../registry.ts';

export type SoftmaxParams = { T: number; n: number } & Record<`s${number}`, number>;
export type SoftmaxOutputs = { scores: number[]; weights: number[]; top: number; entropy: number; topIndex: number };

const MAX_ITEMS = 8;

/** Stable softmax of `scores / T` (subtracts the max before exp). */
export function softmax(scores: readonly number[], T = 1): number[] {
  const z = scores.map((s) => s / T);
  const max = Math.max(...z);
  const e = z.map((v) => Math.exp(v - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
}

/** Shannon entropy in bits; zero weights contribute 0. */
export function entropyBits(weights: readonly number[]): number {
  return Math.max(0, -weights.reduce((h, w) => (w > 0 ? h + w * Math.log2(w) : h), 0));
}

/** Weights plus top weight, its index (first wins a tie) and entropy. */
export function summarize(scores: number[], weights: number[]) {
  const top = Math.max(...weights);
  return { scores, weights, top, entropy: entropyBits(weights), topIndex: weights.indexOf(top) };
}

const scoreParams = Object.fromEntries(
  Array.from({ length: MAX_ITEMS }, (_, i) => [`s${i + 1}`, { label: `score ${i + 1}`, min: -10, max: 10, step: 0.01, default: 0 }]),
) as Record<`s${number}`, ParamDef>;

export const softmaxTemperature = registerModel<SoftmaxParams, SoftmaxOutputs>({
  id: 'softmax-temperature',
  title: 'Softmax temperature',
  kinds: ['bars'],
  keywords: ['softmax', 'temperature', 'attention', 'sharpness', 'entropy', 'logits', 'distribution'],
  params: {
    T: { label: 'temperature', min: 0.05, max: 5, step: 0.01, default: 1, scale: 'log' },
    n: { label: 'number of items', min: 2, max: MAX_ITEMS, step: 1, default: 6 },
    ...scoreParams,
  },
  outputs: {
    top: { label: 'top weight', format: 'fixed2' },
    entropy: { label: 'entropy', unit: 'bits', format: 'fixed2' },
    topIndex: { label: 'top item', format: 'int' },
  },
  compute(p) {
    const n = Math.min(MAX_ITEMS, Math.max(2, Math.round(p.n)));
    const scores = Array.from({ length: n }, (_, i) => p[`s${i + 1}`] ?? 0);
    return summarize(scores, softmax(scores, p.T));
  },
  describe(p, o, labels) {
    const name = labels?.[o.topIndex] ?? `item ${o.topIndex + 1}`;
    return `Temperature ${p.T.toFixed(2)}: “${name}” gets ${Math.round(o.top * 100)}% of the attention; entropy ${o.entropy.toFixed(2)} bits.`;
  },
  template: 'attention',
});
