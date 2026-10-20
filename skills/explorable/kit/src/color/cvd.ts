/**
 * Colour-vision checks: Machado, Oliveira & Fernandes (2009) at severity 1.0,
 * applied in linear sRGB, then ΔE as Euclidean OKLab distance × 100. WCAG 2.x
 * contrast ratios. Pure functions, no DOM.
 */
export type Vision = 'normal' | 'protan' | 'deutan' | 'tritan';
type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3];

const MACHADO: Record<Exclude<Vision, 'normal'>, Mat3> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

const mul = (m: Mat3, v: Vec3): Vec3 =>
  m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]) as Vec3;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** "#RRGGBB" → linear sRGB in [0, 1]. */
export function linearRgb(hex: string): Vec3 {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) throw new Error(`Not a #RRGGBB colour: ${hex}`);
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => toLinear(c / 255)) as Vec3;
}

/** Linear sRGB as seen with the given vision (severity 1.0). */
export function simulate(rgb: Vec3, vision: Vision): Vec3 {
  return vision === 'normal' ? rgb : (mul(MACHADO[vision], rgb).map(clamp01) as Vec3);
}

/** Linear sRGB → OKLab (Ottosson 2020). */
export function oklab(rgb: Vec3): Vec3 {
  const lms = mul(
    [
      [0.4122214708, 0.5363325363, 0.0514459929],
      [0.2119034982, 0.6806995451, 0.1073969566],
      [0.0883024619, 0.2817188376, 0.6299787005],
    ],
    rgb,
  ).map(Math.cbrt) as Vec3;
  return mul(
    [
      [0.2104542553, 0.793617785, -0.0040720468],
      [1.9779984951, -2.428592205, 0.4505937099],
      [0.0259040371, 0.7827717662, -0.808675766],
    ],
    lms,
  );
}

/** Perceptual distance between two colours under a vision type (OKLab × 100). */
export function deltaE(a: string, b: string, vision: Vision = 'normal'): number {
  const p = oklab(simulate(linearRgb(a), vision));
  const q = oklab(simulate(linearRgb(b), vision));
  return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

function luminance(hex: string): number {
  const [r, g, b] = linearRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const CVD_FLOOR = 8;
export const NORMAL_FLOOR = 15;

export interface PairFailure {
  a: string;
  b: string;
  vision: Vision;
  deltaE: number;
}

/** Every series pair under every vision type that falls below its floor. */
export function seriesFailures(series: readonly string[]): PairFailure[] {
  const out: PairFailure[] = [];
  series.forEach((a, i) =>
    series.slice(i + 1).forEach((b) => {
      for (const vision of ['normal', 'protan', 'deutan', 'tritan'] as const) {
        const d = deltaE(a, b, vision);
        if (d < (vision === 'normal' ? NORMAL_FLOOR : CVD_FLOOR)) out.push({ a, b, vision, deltaE: d });
      }
    }),
  );
  return out;
}
