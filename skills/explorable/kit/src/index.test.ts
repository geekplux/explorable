import { describe, expect, it } from 'vitest';
import * as kit from './index.ts';

describe('kit public API', () => {
  it('exposes the contracts later phases build on', () => {
    const names = ['parseDoc', 'essayHtml', 'registerModel', 'getModel', 'searchModels', 'mulberry32', 'format', 'deltaE'];
    const types = names.map((name) => [name, typeof (kit as Record<string, unknown>)[name]]);
    expect(types).toEqual(names.map((name) => [name, 'function']));
    expect(kit.FIGURE_KINDS).toEqual(['bars', 'bits', 'histogram', 'curve']);
  });
});
