import { describe, expect, it } from 'vitest';
import { mulberry32 } from './rng.ts';

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
