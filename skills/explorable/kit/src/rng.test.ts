import { describe, expect, it } from 'vitest';
import { gaussian, mulberry32 } from './rng.ts';

describe('mulberry32', () => {
  it('gives the documented stable sequence for seed 42', () => {
    const rng = mulberry32(42);
    const seq = Array.from({ length: 5 }, () => Number(rng().toFixed(10)));
    expect(seq).toEqual([0.6011037519, 0.448290559, 0.8524657935, 0.6697340414, 0.1748138987]);
    expect(seq).toMatchSnapshot();
  });

  it('stays in [0, 1) and differs by seed', () => {
    const rng = mulberry32(7);
    const values = Array.from({ length: 1000 }, rng);
    expect(values.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(mulberry32(8)()).not.toBe(mulberry32(7)());
  });
});

describe('gaussian', () => {
  it('has mean ≈ 0 and SD ≈ 1 over 20,000 draws', () => {
    const rng = mulberry32(1);
    const z = Array.from({ length: 20_000 }, () => gaussian(rng));
    const mean = z.reduce((s, x) => s + x, 0) / z.length;
    const sd = Math.sqrt(z.reduce((s, x) => s + (x - mean) ** 2, 0) / z.length);
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(sd - 1)).toBeLessThan(0.03);
    expect(z.every(Number.isFinite)).toBe(true);
  });
});
