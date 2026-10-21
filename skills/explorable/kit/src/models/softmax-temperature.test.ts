import { describe, expect, it } from 'vitest';
import { getModel } from '../registry.ts';
import { entropyBits, softmax, softmaxTemperature as model, type SoftmaxParams } from './softmax-temperature.ts';

const SAMPLE = { T: 1, n: 6, s1: 0.3, s2: 2.5, s3: 1.2, s4: 0.4, s5: 0.3, s6: 1.4 } as SoftmaxParams;
const LABELS = ['the', 'cat', 'sat', 'on', 'the', 'mat'];
const at = (T: number) => model.compute({ ...SAMPLE, T });

// docs/figures/attention.md, "Fixtures (softmax-temperature)".
const FIXTURES: [number, number[], number, number][] = [
  [0.05, [0, 1, 0, 0, 0, 0], 1, 0],
  [0.1, [0, 0.99998, 0, 0, 0, 0.00002], 0.999981, 0.00033],
  [0.25, [0.00015, 0.98201, 0.00542, 0.00022, 0.00015, 0.01206], 0.982009, 0.1498],
  [0.5, [0.01003, 0.81658, 0.06065, 0.01225, 0.01003, 0.09048], 0.816575, 1.00849],
  [1, [0.05684, 0.51296, 0.1398, 0.06282, 0.05684, 0.17075], 0.512961, 2.04735],
  [2, [0.10687, 0.32106, 0.16761, 0.11235, 0.10687, 0.18524], 0.321061, 2.45264],
  [5, [0.14253, 0.2213, 0.17064, 0.14541, 0.14253, 0.1776], 0.221303, 2.56533],
];

describe('softmax-temperature', () => {
  it('is registered', () => {
    expect(getModel('softmax-temperature')).toBe(model);
  });

  it('softmax([2, 1, 0.1]) at T = 1 is [0.659, 0.242, 0.099]', () => {
    const w = softmax([2, 1, 0.1], 1);
    [0.659, 0.2424, 0.0986].forEach((v, i) => expect(w[i]).toBeCloseTo(v, 3));
    expect(w.reduce((a, b) => a + b)).toBeCloseTo(1, 12);
  });

  it('is numerically stable for huge scores', () => {
    const w = softmax([1000, 999, -1000], 0.05);
    expect(w.every(Number.isFinite)).toBe(true);
    expect(w[0]).toBeGreaterThan(0.999);
  });

  it('top weight > 0.999 as T → 0.05', () => {
    expect(model.compute({ ...SAMPLE, n: 3, s1: 2, s2: 1, s3: 0.1, T: 0.05 }).top).toBeGreaterThan(0.999);
    expect(at(0.05).top).toBeGreaterThan(0.999);
  });

  it('entropy at T = 5 is within 0.05 bits of log2(6) for near-equal scores', () => {
    const o = model.compute({ T: 5, n: 6, s1: 0.1, s2: 0, s3: 0.05, s4: 0, s5: 0.1, s6: 0 } as SoftmaxParams);
    expect(Math.abs(o.entropy - Math.log2(6))).toBeLessThan(0.05);
    expect(o.entropy).toBeCloseTo(2.5849, 4);
  });

  it.each(FIXTURES)('matches the designer fixture at T = %s', (T, weights, top, entropy) => {
    const o = at(T);
    weights.forEach((w, i) => expect(Math.abs(o.weights[i]! - w)).toBeLessThan(1e-4));
    expect(Math.abs(o.top - top)).toBeLessThan(1e-4);
    expect(Math.abs(o.entropy - entropy)).toBeLessThan(1e-4);
    expect(o.topIndex).toBe(1);
    expect(o.weights[0]).toBe(o.weights[4]);
  });

  it('entropy counts zero weights as 0 and is never negative', () => {
    expect(entropyBits([1, 0, 0])).toBe(0);
    expect(entropyBits([0.5, 0.5])).toBeCloseTo(1, 12);
  });

  it('describes the state with the top label', () => {
    expect(model.describe({ ...SAMPLE, T: 1 }, at(1), LABELS)).toBe('Temperature 1.00: “cat” gets 51% of the attention; entropy 2.05 bits.');
    expect(model.describe({ ...SAMPLE, T: 0.5 }, at(0.5), LABELS)).toContain('“cat” gets 82% of the attention');
    expect(model.describe({ ...SAMPLE, T: 0.5 }, at(0.5))).toContain('“item 2”');
  });

  it('computes at maximum params in ≤ 8 ms (median of 20)', () => {
    const p = { T: 5, n: 8, s1: 10, s2: -10, s3: 5, s4: 1, s5: 2, s6: 3, s7: 4, s8: 9 } as SoftmaxParams;
    const times = Array.from({ length: 20 }, () => {
      const t0 = performance.now();
      model.compute(p);
      return performance.now() - t0;
    }).toSorted((a, b) => a - b);
    expect(times[10]).toBeLessThanOrEqual(8);
  });
});
