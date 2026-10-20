import { describe, expect, it } from 'vitest';
import { getModel, registerModel, searchModels, type ModelDef } from './registry.ts';

function stub(id: string, title: string, keywords: string[]): ModelDef<{ n: number }, { y: number }> {
  return {
    id,
    title,
    kinds: ['bars'],
    keywords,
    params: { n: { label: 'n', min: 0, max: 10, step: 1, default: 2 } },
    outputs: { y: { label: 'y', format: 'int' } },
    compute: ({ n }) => ({ y: n * 2 }),
    describe: ({ n }, { y }) => `Twice ${n} is ${y}.`,
  };
}

const bloom = registerModel(stub('bloom-filter', 'Bloom filter false positives', ['bloom', 'hash', 'set membership']));
registerModel(stub('softmax-temperature', 'Softmax temperature', ['attention', 'softmax', 'temperature']));
registerModel(stub('hash-table', 'Hash table load (mentions bloom in title)', ['hash', 'bucket']));

describe('registry', () => {
  it('gets registered models by id', () => {
    expect(getModel('bloom-filter')).toBe(bloom);
    expect(getModel('nope')).toBeUndefined();
    expect(bloom.describe({ n: 3 }, bloom.compute({ n: 3 }))).toBe('Twice 3 is 6.');
  });

  it('ranks bloom-filter first for "bloom"', () => {
    expect(searchModels('bloom').map((m) => m.id)).toEqual(['bloom-filter', 'hash-table']);
    expect(searchModels('Bloom filters, please')[0]?.id).toBe('bloom-filter');
    expect(searchModels('temp')[0]?.id).toBe('softmax-temperature');
    expect(searchModels('')).toEqual([]);
    expect(searchModels('zebra')).toEqual([]);
  });

  it('refuses duplicate ids and out-of-range defaults', () => {
    expect(registerModel(bloom)).toBe(bloom);
    expect(() => registerModel(stub('bloom-filter', 'Other', []))).toThrow(/already registered/);
    const bad = stub('bad', 'Bad', []);
    bad.params.n.default = 11;
    expect(() => registerModel(bad)).toThrow(/default out of range/);
  });
});
