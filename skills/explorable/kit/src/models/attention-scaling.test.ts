import { describe, expect, it } from 'vitest';
import { attentionScaling, vectors } from './attention-scaling.ts';

const run = (dk: number, scaled: 0 | 1, seed = 229) => attentionScaling.compute({ dk, scaled, seed });
const near = (got: readonly number[], want: number[], tol: number) => got.forEach((v, i) => expect(Math.abs(v - want[i]!)).toBeLessThan(tol));

describe('attention-scaling (seed 229)', () => {
  it('reproduces the fixture table', () => {
    // d_k, unscaled SD, top, key, H, scaled SD, top, key, H
    const rows: [number, number, number, number, number, number, number, number, number][] = [
      [1, 1.0664, 0.3092, 3, 2.5081, 1.0664, 0.3092, 3, 2.5081],
      [4, 2.0162, 0.5738, 4, 1.8542, 1.0081, 0.3412, 4, 2.5778],
      [16, 3.4911, 0.4834, 2, 1.5957, 0.8728, 0.2475, 2, 2.6936],
      [64, 7.9282, 0.9998, 7, 0.0025, 0.991, 0.4797, 7, 2.31],
      [256, 19.8407, 0.9976, 1, 0.0272, 1.24, 0.2897, 1, 2.5213],
      [512, 23.9455, 1, 1, 0, 1.0583, 0.6059, 1, 1.9985],
    ];
    for (const [d, sd, top, key, h, ssd, stop, skey, sh] of rows) {
      const u = run(d, 0);
      const s = run(d, 1);
      near([u.sd, u.top, u.entropy, s.sd, s.top, s.entropy], [sd, top, h, ssd, stop, sh], 1.01e-4);
      expect([u.topIndex + 1, s.topIndex + 1], `d_k=${d}`).toEqual([key, skey]);
      expect(u.sdExpected).toBeCloseTo(Math.sqrt(d), 12);
      expect(s.sdExpected).toBe(1);
    }
  });

  it('reproduces the full score and weight vectors', () => {
    near(run(4, 0).scores, [1.6296, -0.1152, -0.47, 2.9303, -0.7801, -3.7044, 1.6703, 0.4067], 1e-3);
    near(run(4, 0).weights, [0.1563, 0.0273, 0.0191, 0.5738, 0.014, 0.0008, 0.1628, 0.046], 1.01e-4);
    near(run(4, 1).scores, [0.8148, -0.0576, -0.235, 1.4651, -0.39, -1.8522, 0.8352, 0.2034], 1e-3);
    near(run(64, 1).weights, [0.1586, 0.13, 0.0357, 0.0226, 0.0672, 0.071, 0.4797, 0.0352], 1.01e-4);
    near(run(64, 0).scores, [2.8841, 1.2931, -9.0573, -12.6939, -3.9898, -3.5474, 11.7376, -9.1697], 1e-3);
  });

  it('unscaled: dragging d_k from 1 to 512 drives the top weight toward 1 and the SD toward √d_k', () => {
    const tops = [1, 64, 128, 512].map((d) => run(d, 0).top);
    expect(tops[0]).toBeLessThan(0.4);
    expect(Math.min(...tops.slice(1))).toBeGreaterThan(0.99);
    for (const d of [64, 128, 256, 512]) {
      const ratio = run(d, 0).sd / Math.sqrt(d);
      expect(ratio, `d_k=${d}`).toBeGreaterThan(0.75);
      expect(ratio).toBeLessThan(1.3);
    }
  });

  it('scaled: SD ≈ 1 at every width, and the mean over seeds 1–50 at d_k = 64 is 1 ± 0.1', () => {
    for (let d = 1; d <= 512; d *= 2) expect(Math.abs(run(d, 1).sd - 1), `d_k=${d}`).toBeLessThan(0.3);
    const mean = Array.from({ length: 50 }, (_, i) => run(64, 1, i + 1).sd).reduce((a, b) => a + b) / 50;
    expect(mean).toBeCloseTo(1.0014, 3);
    expect(Math.abs(mean - 1)).toBeLessThan(0.1);
  });

  it('weightsOther is the other setting, and at d_k = 1 the switch changes nothing', () => {
    expect(run(64, 0).weightsOther).toEqual(run(64, 1).weights);
    expect(run(64, 1).weightsOther).toEqual(run(64, 0).weights);
    const [a, b] = [run(1, 0), run(1, 1)];
    expect([a.sd, a.top, a.entropy]).toEqual([b.sd, b.top, b.entropy]);
  });

  it('prefix property: widening d does not redraw earlier components; draws are cached per seed', () => {
    const v = vectors(229);
    expect(vectors(229)).toBe(v);
    expect(v.q).toHaveLength(512);
    expect(v.keys).toHaveLength(8);
    let partial = 0;
    for (let i = 0; i < 4; i++) partial += v.q[i]! * v.keys[0]![i]!;
    expect(run(4, 0).scores[0]).toBeCloseTo(partial, 12);
    expect(run(5, 0).scores[0]).toBeCloseTo(partial + v.q[4]! * v.keys[0]![4]!, 12);
  });

  it('describes the state in words', () => {
    const p = { dk: 64, scaled: 0, seed: 229 };
    expect(attentionScaling.describe(p, attentionScaling.compute(p))).toBe(
      'd k = 64, not scaled: scores spread with SD 7.93 (expected 8.00); key 7 gets 100% of the weight.',
    );
  });
});
