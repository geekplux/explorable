// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { essayHtml } from '@kit/doc/essay.ts';
import { getSample, samples, sourceChip } from './index.ts';

describe('built-in samples', () => {
  it('ships three samples in gallery order', () => {
    expect(samples.map((s) => s.id)).toEqual(['attention', 'bloom-filter', 'diffusion']);
    expect(getSample('bloom-filter')?.title).toContain('Bloom filter');
    expect(getSample('nope')).toBeUndefined();
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

  it('derives short source chips', () => {
    expect(sourceChip({ kind: 'arxiv', url: 'https://arxiv.org/abs/1706.03762', title: 't' })).toBe('arXiv 1706.03762');
    expect(sourceChip({ kind: 'arxiv', url: 'https://arxiv.org/pdf/2006.11239v2', title: 't' })).toBe('arXiv 2006.11239');
    expect(sourceChip({ kind: 'blog', url: 'https://llimllib.github.io/bloomfilter-tutorial/', title: 't' })).toBe('llimllib.github.io');
    expect(sourceChip({ kind: 'concept', title: 'Newton cooling' })).toBe('Newton cooling');
  });
});
