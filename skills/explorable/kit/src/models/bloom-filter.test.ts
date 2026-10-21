import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng.ts';
import { bloomFilter, fmix32, fnv1a32, INSERT, PROBES, predictedFpr, probesFor, QUERIES } from './bloom-filter.ts';

const run = (k: number, n: number, q = 0) => bloomFilter.compute({ m: 32, k, n, q });
const qi = (w: string) => (QUERIES as readonly string[]).indexOf(w);
const STATE = { NO: 0, TP: 1, FP: 2 } as const;
const times = (count: number, v: number) => Array.from({ length: count }, () => v);
/** Query state of word w at k = 3 for n = 0 … 12. */
const states = (w: string) => Array.from({ length: 13 }, (_, n) => run(3, n, qi(w)).queryState);

describe('bloom-filter hashing', () => {
  it('FNV-1a matches known vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('reproduces the per-word hash table', () => {
    const table: [string, number, number, number[]][] = [
      ['cat', 0x06745c07, 0xf01dce9c, [7, 4, 1, 30, 27, 24]],
      ['dog', 0xe668bd09, 0x91a945a7, [9, 16, 23, 30, 5, 12]],
      ['fox', 0xb6f3934e, 0x424c7b24, [14, 19, 24, 29, 2, 7]],
      ['eel', 0x84774549, 0x0214095f, [9, 8, 7, 6, 5, 4]],
      ['hen', 0x08b4ad08, 0x1d0ed0e6, [8, 15, 22, 29, 4, 11]],
      ['plum', 0xb6adb06b, 0x8296261c, [11, 8, 5, 2, 31, 28]],
      ['cherry', 0x497ae878, 0xf89ae55a, [24, 19, 14, 9, 4, 31]],
    ];
    for (const [w, h1, h2, probes] of table) {
      expect(fnv1a32(w)).toBe(h1);
      expect(fmix32(h1)).toBe(h2);
      expect(probesFor(w, 6)).toEqual(probes);
      expect(probesFor(w, 3)).toEqual(probes.slice(0, 3));
    }
    expect(probesFor('banana', 6)).toEqual([16, 29, 10, 23, 4, 17]);
  });

  it('inserted words always query positive (200 seeded words, k = 1…6)', () => {
    const rng = mulberry32(7);
    const words = Array.from({ length: 200 }, () =>
      Array.from({ length: 3 + Math.floor(rng() * 5) }, () => String.fromCharCode(97 + Math.floor(rng() * 26))).join(''),
    );
    for (let k = 1; k <= 6; k++) {
      const bits = times(32, 0);
      for (const w of words) {
        const probes = probesFor(w, k);
        expect(new Set(probes).size).toBe(k);
        for (const i of probes) bits[i] = 1;
        expect(probes.every((i) => bits[i])).toBe(true);
      }
    }
  });
});

describe('bloom-filter model', () => {
  it('predicts (1 − e^(−0.75))³ = 0.1469 at m = 32, k = 3, n = 8', () => {
    expect(predictedFpr(32, 3, 8)).toBeCloseTo(0.1469, 4);
    expect(run(3, 8).fpr).toBeCloseTo(0.1469, 4);
    expect([1, 2, 4, 5, 6].map((k) => Number(run(k, 8).fpr.toFixed(4)))).toEqual([0.2212, 0.1548, 0.1597, 0.1849, 0.2198]);
    expect(run(3, 0).fpr).toBe(0);
  });

  it('reproduces the bit arrays', () => {
    const cases: [number, number, string, number][] = [
      [3, 8, '11001101111010101011010110010111', 20],
      [1, 8, '00000101010010100000000000000101', 7],
      [6, 8, '11101111111110101111011111010111', 26],
      [3, 4, '11001101010000101001000110010000', 12],
      [3, 12, '11001101111011111011011110110111', 24],
      [3, 0, '0'.repeat(32), 0],
    ];
    for (const [k, n, bits, set] of cases) {
      const o = run(k, n);
      expect(o.bits.join('')).toBe(bits);
      expect(o.bitsSet).toBe(set);
    }
  });

  it('reproduces the query states at n = 8', () => {
    const expected = ['TP TP NO NO NO NO', 'TP TP NO NO FP NO', 'TP TP NO FP FP NO', 'TP TP NO FP FP NO', 'TP TP FP FP FP NO', 'TP TP NO FP FP NO'];
    for (let k = 1; k <= 6; k++) {
      const row = QUERIES.map((_, q) => (['NO', 'TP', 'FP'] as const)[run(k, 8, q).queryState]).join(' ');
      expect(row).toBe(expected[k - 1]);
    }
    expect(run(3, 8, qi('plum')).firstZero).toBe(11);
    expect(run(3, 8, qi('hen')).firstZero).toBe(15);
    expect(run(3, 8, qi('cat')).firstZero).toBe(-1);
  });

  it('walks hen NO → FP → TP and cherry / banana into false positives as n grows (k = 3)', () => {
    expect(states('hen')).toEqual([...times(11, STATE.NO), STATE.FP, STATE.TP]);
    expect(states('cherry')).toEqual([...times(4, STATE.NO), ...times(9, STATE.FP)]);
    expect(states('banana')).toEqual([...times(6, STATE.NO), ...times(7, STATE.FP)]);
    expect(QUERIES.every((_, q) => run(3, 0, q).queryState === STATE.NO)).toBe(true);
  });

  it('observed false positives over the 50 fixed probes are deterministic', () => {
    const grid = Array.from({ length: 13 }, (_, n) => Array.from({ length: 6 }, (__, k) => run(k + 1, n).fpObserved).join(' '));
    expect(grid).toMatchSnapshot();
    expect(grid[8]).toBe('9 9 10 11 14 15');
    expect(grid[12]).toBe('14 17 19 19 23 27');
    const o = run(3, 8);
    const fps = PROBES.filter((w) => probesFor(w, 3).every((i) => o.bits[i]));
    expect(fps).toEqual(['cherry', 'banana', 'bean', 'radish', 'turnip', 'spinach', 'lettuce', 'okra', 'thyme', 'parsley']);
  });

  it('rounds eased (fractional) params and describes the state', () => {
    expect(run(2.6, 7.6).bits.join('')).toBe(run(3, 8).bits.join(''));
    const o = run(3, 8, qi('cherry'));
    expect(bloomFilter.describe({ m: 32, k: 3, n: 8, q: qi('cherry') }, o)).toBe(
      '8 words inserted with k = 3: 20 of 32 bits set. “cherry”: maybe (false positive). ' +
        'Predicted false-positive rate 14.7%; 10 of 50 test words came back maybe.',
    );
  });

  it('word lists are finance-free, lowercase ASCII, and probes are never inserted', () => {
    const guard = /price|trading|crypto|payment|invoice|stock|market|money|cash|bank|coin/i;
    for (const w of [...INSERT, ...QUERIES, ...PROBES]) {
      expect(w).toMatch(/^[a-z]+$/);
      expect(w).not.toMatch(guard);
    }
    expect(PROBES).toHaveLength(50);
    expect(PROBES.filter((w) => (INSERT as readonly string[]).includes(w))).toEqual([]);
  });
});
