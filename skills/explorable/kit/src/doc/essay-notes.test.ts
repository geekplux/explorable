// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { essayHtml } from './essay.ts';
import type { ExplorableDoc } from './schema.ts';

function doc(overrides: Partial<ExplorableDoc> = {}): ExplorableDoc {
  return {
    schema: 2,
    id: 'demo',
    title: 'A demo',
    dek: 'One idea.',
    source: { kind: 'arxiv', url: 'https://arxiv.org/abs/1706.03762', title: 'A Paper' },
    provenance: { mode: 'curated', generatedAt: '2026-10-19T00:00:00.000Z' },
    sections: [
      { id: 's1', heading: 'One', paragraphs: ['Weights add up to 1.[[m1]] Then *more*.', 'As [[src]] say, and [[src]] again.'] },
      { id: 's2', heading: 'Two', paragraphs: ['Plain.'] },
    ],
    takeaway: 'Soft at any width.[[m2]]',
    notes: [
      { id: 'm1', kind: 'math', formula: 'wᵢ = exp(sᵢ / T) / Σⱼ exp(sⱼ / T)', plain: 'Each weight *w* is a share; d_k <stays>.' },
      { id: 'm2', kind: 'math', formula: 'softmax(QKᵀ / √d_k) · V <script>', plain: 'Equation 1.' },
      { id: 'src', kind: 'source', label: 'Ada & <Bo>', title: 'A "Paper" <i>', detail: 'Ada and Bo, 2017', url: 'https://arxiv.org/abs/1706.03762' },
    ],
    ...overrides,
  };
}

const render = (d: ExplorableDoc) => new DOMParser().parseFromString(`<body>${essayHtml(d)}</body>`, 'text/html');

describe('essayHtml notes', () => {
  it('renders a math marker where [[id]] sits, wired to a closed panel after the paragraph', () => {
    const dom = render(doc());
    const p = dom.querySelector('.essay-section p')!;
    const mark = p.querySelector('button.xnote-mk')!;
    expect(mark.getAttribute('type')).toBe('button');
    expect(mark.getAttribute('aria-expanded')).toBe('false');
    expect(mark.getAttribute('aria-controls')).toBe('note-m1');
    expect(mark.getAttribute('aria-label')).toBe('Show the math');
    expect(mark.getAttribute('aria-describedby')).toBe('note-m1-g');
    expect(dom.getElementById('note-m1-g')?.className).toBe('xnote-g');
    expect(mark.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(mark.previousSibling?.textContent).toBe('Weights add up to 1.');
    expect(p.innerHTML).toContain('</button> Then <em>more</em>.');
    const panel = p.nextElementSibling as HTMLElement;
    expect(panel.id).toBe('note-m1');
    expect(panel.className).toBe('xnote');
    expect(panel.hasAttribute('hidden')).toBe(true);
    expect(panel.querySelector('.xnote-f')?.innerHTML).toBe(
      '<i>w</i>ᵢ = <span class="xnote-op">exp</span>(<i>s</i>ᵢ / <i>T</i>) / Σⱼ <span class="xnote-op">exp</span>(<i>s</i>ⱼ / <i>T</i>)',
    );
    expect(panel.querySelector('.xnote-g')?.innerHTML).toBe('Each weight <em>w</em> is a share; <i>d</i><span class="xsub">k</span> &lt;stays&gt;.');
  });

  it('renders a math note from the takeaway after the takeaway paragraph, before the original link', () => {
    const dom = render(doc());
    const take = dom.querySelector('.essay-takeaway')!;
    expect([...take.children].map((el) => el.id || el.className || el.tagName)).toEqual(['essay-takeaway', 'P', 'note-m2', 'essay-original']);
    expect(take.querySelector('#note-m2 .xnote-f')?.textContent).toBe('softmax(QKᵀ / √dk) · V <script>');
    expect(take.querySelector('script')).toBeNull();
  });

  it('renders a source note as its label with a card; each card id is unique and everything is escaped', () => {
    const html = essayHtml(doc());
    expect(html).not.toMatch(/<Bo>|<i>"|<script>/);
    const dom = render(doc());
    const cites = [...dom.querySelectorAll('.xnote-cite')];
    expect(cites).toHaveLength(2);
    const [a, b] = cites.map((c) => c.querySelector('button.xnote-src')!);
    expect(a!.textContent).toBe('Ada & <Bo>');
    expect(a!.getAttribute('aria-expanded')).toBe('false');
    expect([a!.getAttribute('aria-controls'), b!.getAttribute('aria-controls')]).toEqual(['note-src', 'note-src-2']);
    const card = dom.getElementById('note-src')!;
    expect(card.hasAttribute('hidden')).toBe(true);
    expect(card.querySelector('.xnote-card-title')?.textContent).toBe('A "Paper" <i>');
    expect(card.querySelector('.xnote-card-detail')?.textContent).toBe('Ada and Bo, 2017');
    const link = card.querySelector('a')!;
    expect([link.getAttribute('href'), link.textContent, link.getAttribute('rel')]).toEqual(['https://arxiv.org/abs/1706.03762', 'Open the paper on arXiv', 'noopener noreferrer']);
    expect(dom.querySelectorAll('[id]').length).toBe(new Set([...dom.querySelectorAll('[id]')].map((e) => e.id)).size);
  });

  it('says "Open the source" for other hosts and leaves the link out without a URL', () => {
    const notes = doc().notes!.map((n) => (n.kind === 'source' ? { ...n, url: 'https://example.com/post' } : n));
    expect(render(doc({ notes })).querySelector('#note-src a')?.textContent).toBe('Open the source');
    const bare = doc().notes!.map((n) => (n.kind === 'source' ? { id: n.id, kind: n.kind, label: n.label, title: n.title } : n));
    const dom = render(doc({ notes: bare }));
    expect(dom.querySelector('#note-src a')).toBeNull();
    expect(dom.querySelector('#note-src .xnote-card-detail')).toBeNull();
  });

  it('drops an unknown marker and private-use characters instead of showing them', () => {
    const dom = render(doc({ sections: [{ id: 's1', heading: 'One', paragraphs: ['A [[nope]] b  c.[[m1]]', 'As [[src]] say.'] }, { id: 's2', heading: 'Two', paragraphs: ['P.'] }] }));
    expect(dom.querySelector('.essay-section p')?.textContent).toBe('A  b  c.');
    expect(dom.querySelectorAll('.xnote-mk')).toHaveLength(2);
  });

  it('renders a v1 doc exactly as before: no note markup', () => {
    const v1 = doc({ schema: 1, notes: undefined, takeaway: 'Plain.', sections: [{ id: 's1', heading: 'One', paragraphs: ['First.'] }, { id: 's2', heading: 'Two', paragraphs: ['Second.'] }] });
    expect(essayHtml(v1)).not.toMatch(/xnote/);
  });
});

describe('formula panels', () => {
  it('set a power as a superscript without its brackets', () => {
    const notes = [{ id: 'm1', kind: 'math' as const, formula: 'FPR ≈ (1 − e^(−kn/m))^k', plain: 'Rate.' }, { id: 'm2', kind: 'math' as const, formula: 'x^(a(b)) + y²', plain: 'P.' }];
    const dom = render(doc({ notes, sections: [{ id: 's1', heading: 'One', paragraphs: ['A.[[m1]]', 'B.[[m2]]'] }, { id: 's2', heading: 'Two', paragraphs: ['P.'] }], takeaway: 'T.' }));
    expect(dom.querySelector('#note-m1 .xnote-f')?.innerHTML).toBe('<span class="xnote-op">FPR</span> ≈ (1 − e<sup>−<i>k</i><i>n</i>/<i>m</i></sup>)<sup><i>k</i></sup>');
    expect(dom.querySelector('#note-m2 .xnote-f')?.innerHTML).toBe('<i>x</i><sup><i>a</i>(<i>b</i>)</sup> + <i>y</i>²');
  });
});

describe('formula abbreviations', () => {
  it('set runs of capitals upright and keep single capitals italic', () => {
    const notes = [
      { id: 'm1', kind: 'math' as const, formula: 'FPR ≈ SNR / L', plain: 'A.' },
      { id: 'm2', kind: 'math' as const, formula: 'softmax(QKᵀ / √d_k) · V + T', plain: 'B.' },
    ];
    const dom = render(doc({ notes, sections: [{ id: 's1', heading: 'One', paragraphs: ['A.[[m1]]', 'B.[[m2]]'] }, { id: 's2', heading: 'Two', paragraphs: ['P.'] }], takeaway: 'T.' }));
    expect(dom.querySelector('#note-m1 .xnote-f')?.innerHTML).toBe('<span class="xnote-op">FPR</span> ≈ <span class="xnote-op">SNR</span> / <i>L</i>');
    const m2 = dom.querySelector('#note-m2 .xnote-f')!;
    expect([...m2.querySelectorAll('i')].map((i) => i.textContent)).toEqual(['Q', 'K', 'd', 'V', 'T']);
    expect(m2.querySelector('.xnote-op')?.textContent).toBe('softmax');
  });
});

/** The rendered formula panel of a doc whose one math note holds `formula`. */
const panel = (formula: string) => {
  const notes = [{ id: 'm1', kind: 'math' as const, formula, plain: 'A.' }];
  return render(doc({ notes, sections: [{ id: 's1', heading: 'One', paragraphs: ['A.[[m1]]'] }, { id: 's2', heading: 'Two', paragraphs: ['P.'] }], takeaway: 'T.' })).querySelector('#note-m1 .xnote-f')!;
};

describe('formula words and digits', () => {
  it('set words of three or more lowercase letters upright, and leave digits outside the italic variables', () => {
    const f = panel('k = (m/n)·ln 2; then FPR = (1/2)^k ≈ 0.6185^(m/n)');
    expect([...f.querySelectorAll('.xnote-op')].map((e) => e.textContent)).toEqual(['ln', 'then', 'FPR']);
    expect([...f.querySelectorAll('i')].map((e) => e.textContent)).toEqual(['k', 'm', 'n', 'k', 'm', 'n']);
    expect(f.innerHTML).not.toMatch(/<i>[^<]*\d/);
    expect(f.innerHTML).toContain('0.6185<sup>');
  });
  it('keeps a word inside a power upright and short products italic', () => {
    const f = panel('x with y^(kn + exp(t))');
    expect([...f.querySelectorAll('.xnote-op')].map((e) => e.textContent)).toEqual(['with', 'exp']);
    expect([...f.querySelectorAll('i')].map((e) => e.textContent)).toEqual(['x', 'y', 'k', 'n', 't']);
  });
});
