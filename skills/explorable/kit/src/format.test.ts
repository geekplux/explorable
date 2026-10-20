import { describe, expect, it } from 'vitest';
import { format, type Format } from './format.ts';

const cases: [Format, number, string][] = [
  ['int', 0, '0'],
  ['int', 1e-9, '0'],
  ['int', 1e6, '1,000,000'],
  ['int', 2.5, '3'],
  ['int', -2.5, '−3'],
  ['int', -0.4, '0'],
  ['int', 9999, '9999'],
  ['fixed1', 0, '0.0'],
  ['fixed2', 1e-9, '0.00'],
  ['fixed2', -0.001, '0.00'],
  ['fixed2', 1e6, '1000000.00'],
  ['fixed2', 7.934, '7.93'],
  ['fixed3', -1.5, '−1.500'],
  ['sci', 0, '0'],
  ['sci', 1e-9, '1.00 × 10⁻⁹'],
  ['sci', 1e6, '1.00 × 10⁶'],
  ['sci', 4.04e-5, '4.04 × 10⁻⁵'],
  ['sci', -12345, '−1.23 × 10⁴'],
  ['sci', 4.5, '4.50'],
  ['percent', 0, '0%'],
  ['percent', 0.1469, '14.7%'],
  ['percent', 0.0007, '0.07%'],
  ['percent', 1e-9, '0.00%'],
  ['sig3', 0.9999, '1.00'],
  ['sig3', 0.897, '0.897'],
  ['sig3', 0.0786, '0.0786'],
  ['sig3', 0.00335, '0.00335'],
  ['sig3', 4.04e-5, '4.04 × 10⁻⁵'],
  ['sig3', 1e6, '1,000,000'],
];

describe('format', () => {
  it.each(cases)('%s(%d) is %s', (fmt, value, expected) => {
    expect(format(value, fmt)).toBe(expected);
  });

  it('prints non-finite values as symbols in every format', () => {
    expect(format(Infinity, 'fixed1')).toBe('∞');
    expect(format(-Infinity, 'int')).toBe('−∞');
    expect(format(Number.NaN, 'sig3')).toBe('–');
  });
});
