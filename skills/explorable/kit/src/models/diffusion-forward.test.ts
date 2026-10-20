import { describe, expect, it, vi } from 'vitest';

// Count every uniform drawn, to prove scrubbing never resamples (diffusion.md Fig 1 AC 5).
const draws = vi.hoisted(() => ({ n: 0 }));
vi.mock('../rng.ts', async (orig) => {
  const real = await orig<typeof import('../rng.ts')>();
  return { mulberry32: (seed: number) => { const r = real.mulberry32(seed); return () => (draws.n++, r()); } };
});

const { ALPHA_BAR, BINS, N, diffusionForward, normalPdf, samples } = await import('./diffusion-forward.ts');
const { format } = await import('../format.ts');
const run = (t: number, seed = 2020) => diffusionForward.compute({ t, seed });
const four = (a: Float64Array, i: number) => Array.from(a.subarray(i, i + 4), (v) => Number(v.toFixed(6)));
const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe('diffusion-forward schedule', () => {
  it('matches P6 AC 1 at both ends', () => {
    expect(Math.abs(ALPHA_BAR[1]! - (1 - 1e-4))).toBeLessThan(1e-12);
    expect(rel(ALPHA_BAR[1000]!, 4.0e-5)).toBeLessThan(0.1);
  });

  it('reproduces the schedule fixtures', () => {
    const rows: [number, number, number, number, number][] = [
      [1, 0.9999, 0.9999, 0.01, 40.0], [2, 0.99978, 0.9999, 0.0148, 36.58], [10, 0.998105, 0.9991, 0.0435, 27.22],
      [50, 0.971016, 0.9854, 0.1702, 15.25], [100, 0.897018, 0.9471, 0.3209, 9.4], [200, 0.659039, 0.8118, 0.5839, 2.86],
      [250, 0.524085, 0.7239, 0.6899, 0.42], [300, 0.39642, 0.6296, 0.7769, -1.83], [400, 0.195146, 0.4418, 0.8971, -6.15],
      [500, 0.078587, 0.2803, 0.9599, -10.69], [600, 0.025879, 0.1609, 0.987, -15.76], [750, 0.0033506, 0.0579, 0.9983, -24.73],
      [900, 0.00027521, 0.0166, 0.9999, -35.6], [1000, 4.0358e-5, 0.0064, 1.0, -43.94],
    ];
    for (const [t, a, s, n, db] of rows) {
      const o = run(t);
      expect(rel(o.alphaBar, a), `ᾱ_${t}`).toBeLessThan(1e-4);
      expect(o.signal).toBeCloseTo(s, 4);
      expect(o.noise).toBeCloseTo(n, 4);
      expect(o.snrDb).toBeCloseTo(db, 2);
    }
    expect(rel(ALPHA_BAR[259]!, 0.500245)).toBeLessThan(1e-5);
    expect(rel(ALPHA_BAR[260]!, 0.497614)).toBeLessThan(1e-5);
    const o = run(0);
    expect([o.alphaBar, o.signal, o.noise, o.snrDb, o.crossT]).toEqual([1, 1, 0, Infinity, 260]);
    expect(o.signalSeries).toHaveLength(1001);
    expect(o.noiseSeries[1000]).toBeCloseTo(1, 4);
    expect(o.signalSeries.findIndex((s) => s < 0.1)).toBe(674);
    expect(o.signalSeries.findIndex((s) => s < 0.05)).toBe(770);
  });
});

describe('diffusion-forward samples at seed 2020', () => {
  it('matches the stream check', () => {
    const { x0, eps } = samples(2020);
    expect(four(x0, 0)).toEqual([-2.32599, -2.465774, -2.224807, -1.984393]);
    expect(four(x0, 1000)).toEqual([1.759179, 1.174598, 1.814187, 1.091213]);
    expect(four(eps, 0)).toEqual([-0.91109, 1.359381, 0.159937, -0.531646]);
  });

  it('reproduces the histogram fixtures', () => {
    const rows = [
      [0, -0.2547, 1.7694, 0.735, 0.817, 0, 0.817, 0.748], [100, -0.245, 1.708, 0.401, 0.491, 0, 0.499, 0.42],
      [250, -0.1924, 1.4607, 0.214, 0.214, 0.09, 0.33, 0.319], [400, -0.123, 1.1995, 0.116, 0.109, 0.341, 0.349, 0.117],
      [500, -0.0826, 1.0915, 0.112, 0.131, 0.457, 0.457, 0.11], [600, -0.0525, 1.0386, 0.079, 0.128, 0.352, 0.454, 0.069],
      [750, -0.0264, 1.0149, 0.075, 0.128, 0.36, 0.409, 0.059], [1000, -0.0133, 1.0111, 0.105, 0.15, 0.39, 0.401, 0.084],
    ] as const;
    for (const [t, mean, sd, b15, b41, b28, max, gap] of rows) {
      const o = run(t);
      const centre = (j: number) => -4 + (j + 0.5) * (8 / BINS);
      expect(o.hist).toHaveLength(BINS);
      expect(o.mean, `mean at ${t}`).toBeCloseTo(mean, 3);
      expect(o.sd, `sd at ${t}`).toBeCloseTo(sd, 3);
      expect([o.hist[15], o.hist[41], o.hist[28], Math.max(...o.hist)].map((v) => Number(v!.toFixed(3)))).toEqual([b15, b41, b28, max]);
      expect(Math.max(...o.hist.map((h, j) => Math.abs(h - normalPdf(centre(j)))))).toBeCloseTo(gap, 3);
      expect(o.hist.reduce((a, b) => a + b, 0) * (8 / BINS)).toBeCloseTo(1, 10);
    }
  });

  it('meets P6 AC 1: pure noise at t = 1000, two clumps at t = 0', () => {
    const end = run(1000);
    expect(Math.abs(end.mean)).toBeLessThan(0.1);
    expect(Math.abs(end.sd - 1)).toBeLessThan(0.05);
    const start = run(0);
    const scale = N * (8 / BINS);
    expect([15, 41, 28].map((j) => Math.round(start.hist[j]! * scale))).toEqual([196, 218, 0]);
    expect([15, 41, 28].map((j) => Math.round(end.hist[j]! * scale))).toEqual([28, 40, 104]);
    // Bimodal: peaks either side of an empty middle, near −2 and +1.5.
    const peak = (from: number, to: number) => {
      const slice = start.hist.slice(from, to);
      return -4 + (from + slice.indexOf(Math.max(...slice)) + 0.5) * (8 / BINS);
    };
    expect(Math.abs(peak(0, 28) + 2)).toBeLessThan(0.3);
    expect(Math.abs(peak(29, 60) - 1.5)).toBeLessThan(0.3);
    expect(start.hist0).toBe(end.hist0);
  });

  it('formats the Fig 1 readouts as the spec says', () => {
    const line = (t: number) => {
      const o = run(t);
      return (['signal', 'noise', 'sd'] as const).map((k) => `${diffusionForward.outputs[k]!.label} ${format(o[k], diffusionForward.outputs[k]!.format)}`).join(' · ');
    };
    expect(line(0)).toBe('signal √ᾱ_t 1.000 · noise √(1−ᾱ_t) 0.000 · spread (SD) 1.77');
    expect(line(1000)).toBe('signal √ᾱ_t 0.006 · noise √(1−ᾱ_t) 1.000 · spread (SD) 1.01');
    expect(format(run(1000).alphaBar, 'sig3')).toBe('4.04 × 10⁻⁵');
    expect(diffusionForward.describe({ t: 500, seed: 2020 }, run(500))).toBe(
      'Step t = 500: 28% of the original signal and noise of 0.96; the samples spread with SD 1.09, and pure noise would be 1.00.',
    );
  });

  it('never redraws samples while scrubbing, and computes in ≤ 8 ms', () => {
    run(0, 7);
    const before = draws.n;
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      run((i * 53) % 1001, 7);
      times.push(performance.now() - t0);
    }
    run(412.6, 7);
    expect(draws.n).toBe(before);
    expect(times.toSorted((a, b) => a - b)[10]).toBeLessThanOrEqual(8);
  });
});
