/**
 * `diffusion-forward`: DDPM's forward process on 2,000 numbers from two clumps
 * (docs/figures/diffusion.md). Linear β schedule, ᾱ_t as a precomputed
 * cumulative product, and the closed form x_t = √ᾱ_t·x₀ + √(1−ᾱ_t)·ε. The
 * samples x₀ and ε are drawn once per seed; scrubbing t only transforms them.
 */
import { registerModel } from '../registry.ts';
import { mulberry32 } from '../rng.ts';

export const T = 1000;
export const N = 2000;
export const BINS = 60;
export const X_MIN = -4;
export const X_MAX = 4;
export const BIN_W = (X_MAX - X_MIN) / BINS;
const MODES = [-2, 1.5] as const;
const SPREAD = 0.25;

/** ᾱ_0 … ᾱ_1000 with β_t = 1e-4 + (0.02 − 1e-4)·(t − 1)/999. */
export const ALPHA_BAR = new Float64Array(T + 1);
ALPHA_BAR[0] = 1;
for (let t = 1; t <= T; t++) ALPHA_BAR[t] = ALPHA_BAR[t - 1]! * (1 - (1e-4 + ((0.02 - 1e-4) * (t - 1)) / (T - 1)));
const SIGNAL = Array.from(ALPHA_BAR, Math.sqrt);
const NOISE = Array.from(ALPHA_BAR, (a) => Math.sqrt(1 - a));
const CROSS_T = ALPHA_BAR.findIndex((a) => a <= 0.5);

export type DiffusionParams = { t: number; seed: number };
export type DiffusionOutputs = {
  hist: number[]; hist0: number[]; alphaBar: number; signal: number; noise: number; snrDb: number;
  mean: number; sd: number; signalSeries: number[]; noiseSeries: number[]; crossT: number;
};

/** Density histogram of `xs` (count / (N·w)); out-of-range values land in the edge bins. */
function histogram(xs: Float64Array): number[] {
  const h = Array.from({ length: BINS }, () => 0);
  for (const x of xs) h[Math.min(BINS - 1, Math.max(0, Math.floor((x - X_MIN) / BIN_W)))]! += 1;
  return h.map((c) => c / (xs.length * BIN_W));
}

const cache = new Map<number, { x0: Float64Array; eps: Float64Array; hist0: number[]; xt: Float64Array }>();

/** x₀ then ε: 2,000 normals each, one Box–Muller normal per two uniforms (samples.md §8). Cached per seed. */
export function samples(seed: number) {
  let s = cache.get(seed);
  if (!s) {
    const rng = mulberry32(seed);
    const normals = () =>
      Float64Array.from({ length: N }, () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()));
    const z = normals();
    const x0 = z.map((v, i) => MODES[i < N / 2 ? 0 : 1] + SPREAD * v);
    s = { x0, eps: normals(), hist0: histogram(x0), xt: new Float64Array(N) };
    if (cache.size > 16) cache.clear();
    cache.set(seed, s);
  }
  return s;
}

/** The standard normal density. */
export const normalPdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

export const diffusionForward = registerModel<DiffusionParams, DiffusionOutputs>({
  id: 'diffusion-forward',
  title: 'Diffusion forward process',
  kinds: ['histogram', 'curve'],
  keywords: ['diffusion', 'ddpm', 'denoising', 'noise', 'schedule', 'gaussian', 'forward process', 'generative'],
  params: {
    // The unit reads "260 of 1000" to assistive tech (diffusion.md, Fig 1 controls).
    t: { label: 'step t', min: 0, max: T, step: 1, pageStep: 50, default: 0, unit: 'of 1000' },
    seed: { label: 'seed', min: 0, max: 2 ** 32 - 1, step: 1, default: 2020 },
  },
  outputs: {
    alphaBar: { label: 'ᾱ_t', spoken: 'alpha-bar', format: 'sig3' },
    signal: { label: 'signal √ᾱ_t', spoken: 'signal', format: 'fixed3' },
    noise: { label: 'noise √(1−ᾱ_t)', spoken: 'noise', format: 'fixed3' },
    // +∞ dB at t = 0 (no noise yet); the page shows "∞ dB" (docs/figures/diffusion.md).
    snrDb: { label: 'SNR', spoken: 'signal-to-noise ratio', unit: 'dB', format: 'fixed1', infinite: true },
    sd: { label: 'spread (SD)', spoken: 'spread', format: 'fixed2' },
    mean: { label: 'mean', format: 'fixed2' },
    crossT: { label: 'signal = noise', spoken: 'signal equals noise at step', format: 'int' },
  },
  compute(p) {
    // Eased in-between states pass a fractional t; the schedule is per whole step.
    const t = Math.min(T, Math.max(0, Math.round(p.t)));
    const { x0, eps, hist0, xt } = samples(p.seed >>> 0);
    const a = ALPHA_BAR[t]!;
    const [s, n] = [SIGNAL[t]!, NOISE[t]!];
    let sum = 0;
    for (let i = 0; i < N; i++) sum += xt[i] = s * x0[i]! + n * eps[i]!;
    const mean = sum / N;
    let ss = 0;
    for (const x of xt) ss += (x - mean) ** 2;
    return {
      hist: histogram(xt), hist0, alphaBar: a, signal: s, noise: n, snrDb: 10 * Math.log10(a / (1 - a)),
      mean, sd: Math.sqrt(ss / (N - 1)), signalSeries: SIGNAL, noiseSeries: NOISE, crossT: CROSS_T,
    };
  },
  describe(p, o) {
    return (
      `Step t = ${Math.round(p.t)}: ${Math.round(o.signal * 100)}% of the original signal and noise of ${o.noise.toFixed(2)}; ` +
      `the samples spread with SD ${o.sd.toFixed(2)}, and pure noise would be 1.00.`
    );
  },
  template: 'diffusion',
});
