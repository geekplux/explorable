/** Readout formats (docs/figures/samples.md §4). */
export const FORMATS = ['int', 'fixed1', 'fixed2', 'fixed3', 'percent', 'sci', 'sig3'] as const;
export type Format = (typeof FORMATS)[number];
export const isFormat = (v: unknown): v is Format => (FORMATS as readonly unknown[]).includes(v);

const MINUS = '−';
const SUPER = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sign = (s: string) => s.replace(/^-/, MINUS);
/** toFixed without a negative zero ("0.00", never "-0.00"). */
const fixed = (v: number, digits: number) => {
  const s = v.toFixed(digits);
  return Number(s) === 0 ? s.replace('-', '') : sign(s);
};

function int(v: number): string {
  const n = Math.sign(v) * Math.round(Math.abs(v)) || 0;
  return sign(Math.abs(n) >= 10_000 ? n.toLocaleString('en-US') : String(n));
}

function sci(v: number): string {
  if (v === 0) return '0';
  const [mantissa = '', exp = '0'] = v.toExponential(2).split('e');
  if (Number(exp) === 0) return sign(mantissa);
  const power = [...String(Math.abs(Number(exp)))].map((d) => SUPER[Number(d)]).join('');
  return `${sign(mantissa)} × 10${Number(exp) < 0 ? '⁻' : ''}${power}`;
}

/**
 * Format a number for a readout. Non-finite values print as ∞, −∞ or "–";
 * negatives use a true minus sign (U+2212).
 */
export function format(value: number, fmt: Format): string {
  if (Number.isNaN(value)) return '–';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : `${MINUS}∞`;
  switch (fmt) {
    case 'int':
      return int(value);
    case 'fixed1':
    case 'fixed2':
    case 'fixed3':
      return fixed(value, Number(fmt.slice(-1)));
    case 'percent': {
      const p = value * 100;
      return p === 0 ? '0%' : `${fixed(p, Math.abs(p) >= 1 ? 1 : 2)}%`;
    }
    case 'sci':
      return sci(value);
    case 'sig3': {
      if (Math.abs(value) < 0.001) return sci(value);
      const s = value.toPrecision(3);
      return s.includes('e') ? int(value) : sign(s);
    }
  }
}
