import { describe, expect, it } from 'vitest';
import { STAGES, readExplain, stageAt } from './explain.ts';
import { classifyInput } from './input.ts';
import { searchSamples } from './search.ts';
import attention from '../samples/attention.json';

describe('classifyInput', () => {
  it('treats links, bare hosts and arXiv ids as URLs', () => {
    expect(classifyInput(' https://arxiv.org/abs/1706.03762 ')).toEqual({ kind: 'url', url: 'https://arxiv.org/abs/1706.03762' });
    expect(classifyInput('llimllib.github.io/bloomfilter-tutorial/')).toEqual({ kind: 'url', url: 'https://llimllib.github.io/bloomfilter-tutorial/' });
    expect(classifyInput('arXiv:2006.11239v2')).toEqual({ kind: 'url', url: 'https://arxiv.org/abs/2006.11239v2' });
  });

  it('treats words as a search and flags broken or non-web links', () => {
    expect(classifyInput('bloom')).toEqual({ kind: 'text', query: 'bloom' });
    expect(classifyInput('how bloom filters work')).toEqual({ kind: 'text', query: 'how bloom filters work' });
    expect(classifyInput('   ')).toEqual({ kind: 'empty' });
    expect(classifyInput('https://').kind).toBe('invalid');
    expect(classifyInput('https://localhost x').kind).toBe('invalid');
    expect(classifyInput('javascript:alert(1)').kind).toBe('invalid');
    expect(classifyInput('ftp://example.org/a').kind).toBe('invalid');
  });
});

const ids = (q: string) => searchSamples(q).map((d) => d.id);

describe('searchSamples', () => {
  it('finds samples by title words and by registry keywords, best first', () => {
    expect(ids('bloom')).toEqual(['bloom-filter']);
    expect(ids('false positive')[0]).toBe('bloom-filter');
    expect(ids('softmax')).toContain('attention');
    expect(ids('ddpm noise')[0]).toBe('diffusion');
  });
  it('returns nothing for nonsense or one-letter input', () => {
    expect(ids('zzqx wibble')).toEqual([]);
    expect(ids('a')).toEqual([]);
  });
});

describe('readExplain', () => {
  it('accepts a success body', () => {
    const r = readExplain({ ok: true, doc: attention, mode: 'ai', cache: 'hit' });
    expect(r).toMatchObject({ ok: true, mode: 'ai', cache: 'hit' });
  });
  it('keeps known error codes and turns anything malformed into INTERNAL', () => {
    expect(readExplain({ ok: false, error: { code: 'NO_FIGURE', message: 'm', hint: 'h' } })).toEqual({ ok: false, error: { code: 'NO_FIGURE', message: 'm', hint: 'h' } });
    expect(readExplain({ ok: false, error: { code: 'EVIL' } })).toMatchObject({ error: { code: 'INTERNAL' } });
    expect(readExplain({ ok: true, doc: { title: 1 } })).toMatchObject({ error: { code: 'INTERNAL' } });
    expect(readExplain(null)).toMatchObject({ error: { code: 'INTERNAL' } });
  });
});

describe('stageAt', () => {
  it('moves through the stages at 1.5 s and 6 s', () => {
    expect([0, 1499, 1500, 5999, 6000, 29_000].map((ms) => STAGES[stageAt(ms)])).toEqual([
      'Fetching the article…', 'Fetching the article…', 'Finding the core idea…', 'Finding the core idea…', 'Assembling live figures…', 'Assembling live figures…',
    ]);
  });
});
