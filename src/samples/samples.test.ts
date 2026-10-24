// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { essayHtml } from '@kit/doc/essay.ts';
import { findFormula } from '@kit/doc/formula.ts';
import { noteRefs } from '@kit/doc/notes.ts';
import { parseDoc } from '@kit/doc/schema.ts';
import { essayMeta, getSample, samples, sourceChip } from './index.ts';

describe('built-in samples', () => {
  it('ships three samples in gallery order', () => {
    expect(samples.map((s) => s.id)).toEqual(['attention', 'bloom-filter', 'diffusion']);
    expect(getSample('bloom-filter')?.title).toContain('Bloom filter');
    expect(getSample('nope')).toBeUndefined();
  });

  it.each(samples.map((s) => [s.id, s] as const))('%s passes parseDoc', (_id, doc) => {
    const result = parseDoc(doc);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it.each(samples.map((s) => [s.id, s] as const))('%s renders sections and figure shells', (_id, doc) => {
    const dom = new DOMParser().parseFromString(essayHtml(doc), 'text/html');
    const figures = doc.sections.filter((s) => s.figure).length;
    expect(figures).toBeGreaterThanOrEqual(2);
    expect(dom.querySelectorAll('section.essay-section')).toHaveLength(doc.sections.length);
    expect(dom.querySelectorAll('figure.xfig')).toHaveLength(figures);
    for (const fig of dom.querySelectorAll('figure.xfig')) {
      expect(fig.querySelector('.xfig-alt')?.textContent?.length).toBeGreaterThanOrEqual(40);
    }
  });

  it.each(samples.map((s) => [s.id, s] as const))('%s is v2 in plain words: no formula in any paragraph or the takeaway', (_id, doc) => {
    expect(doc.schema).toBe(2);
    const bodies = [...doc.sections.flatMap((s) => s.paragraphs), doc.takeaway, doc.dek];
    expect(bodies.map(findFormula).filter(Boolean)).toEqual([]);
  });

  it.each(samples.map((s) => [s.id, s] as const))('%s references every note, and every note renders', (_id, doc) => {
    const refs = new Set([...doc.sections.flatMap((s) => s.paragraphs), doc.takeaway].flatMap(noteRefs));
    expect(doc.notes?.length).toBeGreaterThan(0);
    expect([...refs].toSorted()).toEqual(doc.notes!.map((n) => n.id).toSorted());
    const dom = new DOMParser().parseFromString(essayHtml(doc), 'text/html');
    const math = doc.notes!.filter((n) => n.kind === 'math');
    expect(dom.querySelectorAll('.xnote-mk')).toHaveLength(math.length);
    expect(dom.querySelectorAll('.xnote[hidden]')).toHaveLength(math.length);
    expect(dom.body.textContent).not.toMatch(/\[\[|\]\]/);
  });

  it('the attention sample matches the board: dek, four math notes and the Vaswani et al. card', () => {
    const doc = getSample('attention')!;
    expect(doc.dek).toBe('Attention lets each word decide how much to listen to every other word. When the vectors behind it get long, those decisions turn all-or-nothing. Dividing by √d_k keeps them soft.');
    expect(doc.notes!.map((n) => n.id)).toEqual(['m1', 'm2', 'm3', 'm4', 'vaswani']);
    const dom = new DOMParser().parseFromString(essayHtml(doc), 'text/html');
    expect(dom.querySelector('#note-m1 .xnote-f')?.textContent).toBe('wᵢ = exp(sᵢ / T) / Σⱼ exp(sⱼ / T)');
    expect(dom.querySelector('.xnote-src')?.textContent).toBe('Vaswani et al.');
    expect(dom.querySelector('#note-vaswani')?.textContent).toBe('Attention Is All You NeedVaswani, Shazeer, Parmar and 5 others, 2017Open the paper on arXiv');
    const first = dom.querySelector('#scores-to-weights ~ p')!;
    expect(first.textContent).toContain('turns them into weights with a softmax. The weights are positive');
    expect(first.nextElementSibling?.id).toBe('note-m1');
  });

  it('derives short source chips', () => {
    expect(sourceChip({ kind: 'arxiv', url: 'https://arxiv.org/abs/1706.03762', title: 't' })).toBe('arXiv 1706.03762');
    expect(sourceChip({ kind: 'arxiv', url: 'https://arxiv.org/pdf/2006.11239v2', title: 't' })).toBe('arXiv 2006.11239');
    expect(sourceChip({ kind: 'blog', url: 'https://llimllib.github.io/bloomfilter-tutorial/', title: 't' })).toBe('llimllib.github.io');
    expect(sourceChip({ kind: 'concept', title: 'Newton cooling' })).toBe('Newton cooling');
  });

  it('counts sections and figures for the index meta line', () => {
    expect(samples.map(essayMeta)).toEqual(['4 sections, 2 figures', '5 sections, 2 figures', '5 sections, 2 figures']);
    const one = { ...samples[0]!, sections: samples[0]!.sections.slice(0, 1) };
    expect(essayMeta(one)).toBe('1 section, 1 figure');
  });
});
