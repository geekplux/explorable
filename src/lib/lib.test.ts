import { describe, expect, it } from 'vitest';
import { STAGES, ndjsonLines, readExplain, stageAt, stageIndex } from './explain.ts';
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

describe('stages', () => {
  it('match the Worker’s stream order', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['fetching', 'reading', 'planning', 'composing']);
    expect([stageIndex('planning'), stageIndex('nope')]).toEqual([2, -1]);
  });

  it('fall back to an honest timeline (1.5 s, 3 s) that never claims "composing"', () => {
    expect([0, 1499, 1500, 2999, 3000, 60_000].map((ms) => STAGES[stageAt(ms)]!.id)).toEqual([
      'fetching', 'fetching', 'reading', 'reading', 'planning', 'planning',
    ]);
  });
});

describe('ndjsonLines', () => {
  it('splits lines across chunks, including multi-byte characters', async () => {
    const bytes = new TextEncoder().encode('{"type":"stage","stage":"fetching"}\n{"a":"√d"}\n\n{"type":"result"}');
    const chunks = [bytes.slice(0, 10), bytes.slice(10, 41), bytes.slice(41, 42), bytes.slice(42)];
    const body = new ReadableStream<Uint8Array>({ start(c) { chunks.forEach((x) => c.enqueue(x)); c.close(); } });
    const out: string[] = [];
    for await (const line of ndjsonLines(body)) out.push(line);
    expect(out).toEqual(['{"type":"stage","stage":"fetching"}', '{"a":"√d"}', '{"type":"result"}']);
  });
});
