// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { authorLine, essayHtml } from './essay.ts';
import type { ExplorableDoc, FigureSpec } from './schema.ts';

function figure(id: string, title: string): FigureSpec {
  return {
    id,
    kind: 'bars',
    title,
    caption: `Caption for ${id} with *emphasis*.`,
    alt: `A static description of ${id} that is long enough to stand alone.`,
    model: { id: 'softmax-temperature', params: { T: 1 } },
    controls: ['T'],
    readouts: ['top'],
  };
}

function makeDoc(overrides: Partial<ExplorableDoc> = {}): ExplorableDoc {
  return {
    schema: 1,
    id: 'demo',
    title: 'A demo title',
    dek: 'The one *core* idea.',
    source: { kind: 'arxiv', url: 'https://arxiv.org/abs/1706.03762', title: 'A Paper', authors: ['Ada Lovelace', 'Bo B', 'Cy C'], year: 2017 },
    provenance: { mode: 'curated', generatedAt: '2026-10-19T00:00:00.000Z' },
    sections: [
      { id: 's1', heading: 'One', paragraphs: ['First.'], figure: figure('fig-a', 'Figure A') },
      { id: 's2', heading: 'Two', paragraphs: ['Second.', 'More.'] },
      { id: 's3', heading: 'Three', paragraphs: ['Third.'], figure: figure('fig-b', 'Figure B') },
    ],
    takeaway: 'Take this away.',
    ...overrides,
  };
}

function render(doc: ExplorableDoc): Document {
  return new DOMParser().parseFromString(`<body>${essayHtml(doc)}</body>`, 'text/html');
}

describe('essayHtml', () => {
  it('renders the title block: h1, dek and the byline row, with no kicker or provenance line', () => {
    const dom = render(makeDoc());
    expect(dom.querySelectorAll('h1')).toHaveLength(1);
    expect(dom.querySelector('h1')?.textContent).toBe('A demo title');
    expect(dom.querySelector('.essay-dek')?.innerHTML).toBe('The one <em>core</em> idea.');
    const link = dom.querySelector<HTMLAnchorElement>('.essay-byline a');
    expect(link?.getAttribute('href')).toBe('https://arxiv.org/abs/1706.03762');
    expect(dom.querySelector('.essay-byline p')?.textContent).toBe('Based on A Paper, Lovelace et al., 2017');
    expect(dom.querySelector('.essay-byline-end')?.innerHTML).toBe('');
    expect([...dom.querySelector('.essay-hero')!.children].map((el) => el.className || el.tagName)).toEqual(['H1', 'essay-dek', 'essay-byline']);
    expect(essayHtml(makeDoc())).not.toMatch(/kicker|provenance|↗|·/);
  });

  it('adds one sentence to the byline for an AI-written essay', () => {
    const ai = render(makeDoc({ provenance: { mode: 'ai', generatedAt: '2026-10-19T00:00:00.000Z' } }));
    expect(ai.querySelector('.essay-byline p')?.textContent).toBe('Based on A Paper, Lovelace et al., 2017. Written by AI from the source.');
    const match = render(makeDoc({ provenance: { mode: 'match', generatedAt: '2026-10-19T00:00:00.000Z' } }));
    expect(match.querySelector('.essay-byline p')?.textContent).toBe('Based on A Paper, Lovelace et al., 2017');
  });

  it('sets variables in italics in titles and headings', () => {
    const dom = render(makeDoc({ title: 'Why attention divides by √d_k' }));
    expect(dom.querySelector('h1')?.innerHTML).toBe('Why attention divides by √<i>d</i><span class="sub">k</span>');
  });

  it('renders one section per doc section plus the takeaway', () => {
    const dom = render(makeDoc());
    const sections = dom.querySelectorAll('section.essay-section');
    expect(sections).toHaveLength(3);
    expect([...sections].map((s) => s.querySelector('h2')?.textContent)).toEqual(['One', 'Two', 'Three']);
    expect(sections[1]?.querySelectorAll('p')).toHaveLength(2);
    expect(dom.querySelector('.essay-takeaway p')?.textContent).toBe('Take this away.');
    expect(dom.querySelector('.essay-original a')?.getAttribute('href')).toBe('https://arxiv.org/abs/1706.03762');
    expect(dom.querySelector('.essay-original')?.textContent).toBe('Read the original paper');
    const blog = render(makeDoc({ source: { kind: 'blog', url: 'https://example.com/post', title: 'A Post' } }));
    expect(blog.querySelector('.essay-original')?.textContent).toBe('Read the original post');
  });

  it('renders one figure shell per figure with title, caption and alt, and no figure number', () => {
    const dom = render(makeDoc());
    const figs = [...dom.querySelectorAll('figure.xfig')];
    expect(figs.map((f) => f.id)).toEqual(['fig-a', 'fig-b']);
    expect(dom.querySelector('.xfig-num')).toBeNull();
    const second = figs[1];
    expect(second?.querySelector('.xfig-title')?.textContent).toBe('Figure B');
    expect(second?.getAttribute('aria-labelledby')).toBe('fig-b-title');
    expect(second?.querySelector('figcaption')?.innerHTML).toBe('Caption for fig-b with <em>emphasis</em>.');
    expect(second?.querySelector('.xfig-alt')?.textContent).toContain('static description of fig-b');
    expect([...(second?.children ?? [])].map((el) => el.className || el.tagName)).toEqual(['xfig-title', 'xfig-stage', 'FIGCAPTION']);
    expect(second?.closest('section')?.querySelector('h2')?.id).toBe('s3');
  });

  it('escapes hostile text everywhere and drops non-http links', () => {
    const evil = '<script>alert(1)</script>';
    const doc = makeDoc({
      title: evil,
      dek: evil,
      takeaway: evil,
      source: { kind: 'blog', url: 'javascript:alert(1)', title: evil },
      sections: [{ id: '"><script>', heading: evil, paragraphs: [evil], figure: { ...figure('x', evil), alt: evil, caption: evil } }],
    });
    const html = essayHtml(doc);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain('javascript:');
    const dom = render(doc);
    expect(dom.querySelectorAll('script')).toHaveLength(0);
    expect(dom.querySelector('h1')?.textContent).toBe(evil);
    expect(dom.querySelector('.essay-byline a')).toBeNull();
    expect(dom.querySelector('.essay-original')).toBeNull();
  });
});

describe('authorLine', () => {
  it('formats one, two and many authors', () => {
    expect(authorLine(['Bill Mill'])).toBe('Bill Mill');
    expect(authorLine(['A One', 'B Two'])).toBe('A One and B Two');
    expect(authorLine(['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar'])).toBe('Vaswani et al.');
    expect(authorLine(undefined)).toBe('');
  });
});
