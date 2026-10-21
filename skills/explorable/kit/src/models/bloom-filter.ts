/**
 * `bloom-filter`: a 32-bit Bloom filter over fixed word lists
 * (docs/figures/bloom-filter.md, Fig 1). FNV-1a plus a Murmur3-finalised
 * stride for double hashing: probe i = (a + i·b) mod m, b odd, so the k
 * probes are distinct.
 */
import { format } from '../format.ts';
import { registerModel } from '../registry.ts';

/** Inserted in this order; n takes the first n. */
export const INSERT = ['cat', 'dog', 'owl', 'fox', 'bee', 'elk', 'yak', 'eel', 'ant', 'bat', 'cow', 'hen'] as const;
/** The words the reader can ask about. */
export const QUERIES = ['cat', 'owl', 'plum', 'cherry', 'banana', 'hen'] as const;
/** 50 words never inserted, for the observed false-positive rate. */
export const PROBES = (
  'apple pear plum kiwi lime lemon mango peach grape melon cherry date fig guava papaya olive quince apricot banana orange ' +
  'lychee durian carrot potato onion garlic leek pea bean corn kale radish turnip celery squash pumpkin tomato pepper spinach ' +
  'lettuce cabbage beet okra yam ginger basil mint sage thyme parsley'
).split(' ');

/** FNV-1a, 32 bit, over char codes (all words are lowercase ASCII). */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** The Murmur3 32-bit finaliser: mixes high bits into low bits. */
export function fmix32(h: number): number {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** The k bit indices a word hashes to in an m-bit filter. */
export function probesFor(word: string, k: number, m = 32): number[] {
  const h1 = fnv1a32(word);
  const a = h1 % m;
  const b = (fmix32(h1) % m) | 1;
  return Array.from({ length: k }, (_, i) => (a + i * b) % m);
}

/** Predicted false-positive rate (1 − e^(−kn/m))^k. */
export const predictedFpr = (m: number, k: number, n: number) => (1 - Math.exp((-k * n) / m)) ** k;

export type BloomParams = { m: number; k: number; n: number; q: number };
/** queryState: 0 = definitely not, 1 = maybe (true positive), 2 = maybe (false positive). */
export type BloomOutputs = {
  bits: number[]; probes: number[]; queryState: number; firstZero: number;
  bitsSet: number; fpr: number; fpObserved: number;
};

export const VERDICTS = ['definitely not', 'maybe (true positive)', 'maybe (false positive)'] as const;

const whole = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

export const bloomFilter = registerModel<BloomParams, BloomOutputs>({
  id: 'bloom-filter',
  title: 'Bloom filter',
  kinds: ['bits'],
  keywords: ['bloom', 'filter', 'hash', 'hashing', 'set', 'membership', 'false positive', 'probabilistic', 'bits'],
  params: {
    m: { label: 'bits', min: 32, max: 32, step: 1, default: 32, unit: 'bits' },
    k: { label: 'hashes per word', min: 1, max: 6, step: 1, default: 3 },
    n: { label: 'words inserted', min: 0, max: INSERT.length, step: 1, default: 8 },
    q: { label: 'Ask about', min: 0, max: QUERIES.length - 1, step: 1, default: 0, control: 'choice', choices: [...QUERIES] },
  },
  outputs: {
    bitsSet: { label: 'bits set', unit: '/ 32', format: 'int' },
    fpr: { label: 'predicted FPR', format: 'percent' },
    fpObserved: { label: 'observed FP', unit: '/ 50', format: 'int' },
  },
  compute(p) {
    const m = 32;
    const [k, n, q] = [whole(p.k, 1, 6), whole(p.n, 0, INSERT.length), whole(p.q, 0, QUERIES.length - 1)];
    const bits = Array.from({ length: m }, () => 0);
    for (const w of INSERT.slice(0, n)) for (const i of probesFor(w, k, m)) bits[i] = 1;
    const allSet = (w: string) => probesFor(w, k, m).every((i) => bits[i]);
    const word = QUERIES[q]!;
    const probes = probesFor(word, k, m);
    const inserted = (INSERT as readonly string[]).indexOf(word);
    const queryState = inserted >= 0 && inserted < n ? 1 : allSet(word) ? 2 : 0;
    return {
      bits, probes, queryState,
      firstZero: probes.find((i) => !bits[i]) ?? -1,
      bitsSet: bits.reduce((a, b) => a + b, 0),
      fpr: predictedFpr(m, k, n),
      fpObserved: PROBES.filter(allSet).length,
    };
  },
  describe(p, o) {
    return (
      `${Math.round(p.n)} words inserted with k = ${Math.round(p.k)}: ${o.bitsSet} of 32 bits set. ` +
      `“${QUERIES[Math.round(p.q)]}”: ${VERDICTS[o.queryState]}. ` +
      `Predicted false-positive rate ${format(o.fpr, 'percent')}; ${o.fpObserved} of 50 test words came back maybe.`
    );
  },
  template: 'bloom-filter',
});
