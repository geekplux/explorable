// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawThumb, sweepAt } from '../lib/thumbPlay.ts';
import { GalleryPage } from './GalleryPage.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const host = document.createElement('div');
document.body.append(host);
const root = createRoot(host);
afterEach(() => act(() => root.render(null)));
const texts = (sel: string) => [...host.querySelectorAll(sel)].map((n) => n.textContent);

describe('home', () => {
  it('mounts the attention temperature figure live, with a keyboard slider and a spaced readout', () => {
    vi.stubGlobal('IntersectionObserver', undefined); // no observer: the figure counts as on screen
    act(() => root.render(<GalleryPage />));
    const fig = host.querySelector('figure.hero-fig')!;
    expect(fig.querySelector('.hero-fig-title')?.textContent).toBe('Temperature sets how sharp the softmax is');
    expect(texts('.hero-fig .xfig-bar-label')).toEqual(['the', 'cat', 'sat', 'on', 'the', 'mat']);
    expect(texts('.hero-fig .xfig-readout > span')).toEqual(['top weight 0.51', 'entropy 2.05 bits']);
    const knob = fig.querySelector<SVGGElement>('.xfig-knob')!;
    expect([knob.getAttribute('role'), knob.getAttribute('tabindex')]).toEqual(['slider', '0']);
    act(() => void knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(texts('.hero-fig .xfig-readout > span')).toEqual(['top weight 1.00', 'entropy 0.00 bits']);
    expect(fig.querySelector('figcaption a')?.getAttribute('href')).toBe('/s/attention');
    vi.unstubAllGlobals();
  });

  it('lists the essays as numbered single-link rows with source, size and an inline thumbnail', () => {
    act(() => root.render(<GalleryPage />));
    const rows = [...host.querySelectorAll<HTMLAnchorElement>('#essays a.essay-row')];
    expect(rows.map((a) => a.getAttribute('href'))).toEqual(['/s/attention', '/s/bloom-filter', '/s/diffusion']);
    expect(texts('#essays .essay-no')).toEqual(['01', '02', '03']);
    expect(texts('#essays .essay-src')).toEqual(['arXiv 1706.03762', 'llimllib.github.io', 'arXiv 2006.11239']);
    expect(texts('#essays .essay-meta > span:last-child')).toEqual(['4 sections, 2 figures', '5 sections, 2 figures', '5 sections, 2 figures']);
    expect(host.querySelectorAll('#essays .essay-thumb svg.thumb')).toHaveLength(3);
    expect(rows[0]!.querySelector('.essay-title')?.textContent).toBe('Why attention divides by √d');
    // No chips, eyebrows or "·" left on the page.
    expect(host.querySelector('.try, .chip, .kicker, .card')).toBeNull();
    expect(host.textContent).not.toContain('·');
  });

  it('has how it works with three steps and the skill command', () => {
    act(() => root.render(<GalleryPage />));
    expect(texts('#how .steps b')).toEqual(['Read.', 'Explain.', 'Show.']);
    expect(host.querySelector('#how .cmdbox')?.textContent).toBe('npx degit geekplux/explorable/skills/explorable ~/.claude/skills/explorable');
  });
});

describe('thumbnail play', () => {
  it('sweeps to the far end and back to rest', () => {
    expect(sweepAt(0.65, 0)).toBe(0.65);
    expect(sweepAt(0.65, 0.5)).toBe(0);
    expect(sweepAt(0.65, 1)).toBeCloseTo(0.65);
    expect(sweepAt(0, 0.5)).toBe(1);
    expect(sweepAt(0, 0.25)).toBeGreaterThan(0.5); // ease-out: past halfway at a quarter of the time
  });

  it('moves the handle and fill, and redraws attention bars as the softmax at that temperature', () => {
    act(() => root.render(<GalleryPage />));
    const svg = host.querySelector<SVGSVGElement>('#essays .essay-thumb svg')!;
    drawThumb(svg, 0);
    expect(svg.querySelector('.th-handle')?.getAttribute('cx')).toBe('36.0');
    expect(svg.querySelector('.th-fill')?.getAttribute('d')).toBe('M36 120H36.0');
    const bars = [...svg.querySelectorAll('rect.th-bar')];
    // T = 0.05: "cat" takes all the weight (bar 74 px tall), the rest flatten to 0.5 px.
    expect(bars.map((b) => b.getAttribute('height'))).toEqual(['0.5', '74.0', '0.5', '0.5', '0.5', '0.5']);
    expect(bars[1]!.classList.contains('is-top')).toBe(true);
  });
});
