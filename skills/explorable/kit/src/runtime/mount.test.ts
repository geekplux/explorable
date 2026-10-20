// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { essayHtml, hydrateFigures } from '../doc/essay.ts';
import type { ExplorableDoc, FigureSpec } from '../doc/schema.ts';

const ALT = 'Bar chart of how much attention the word “sat” pays to each word of “the cat sat on the mat” at temperature 1.';
const fig1: FigureSpec = {
  id: 'fig-temperature', kind: 'bars', title: 'Temperature sets how sharp the softmax is', caption: 'Drag T.', alt: ALT,
  model: { id: 'softmax-temperature', params: { T: 1, n: 6, s1: 0.3, s2: 2.5, s3: 1.2, s4: 0.4, s5: 0.3, s6: 1.4 } },
  controls: ['T'], readouts: ['top', 'entropy'],
  options: { labels: ['the', 'cat', 'sat', 'on', 'the', 'mat'], query: 'sat', handle: 'T', itemName: 'token', ticks: ['0.1', '0.5', '1', '2', '5'] },
};
const fig2: FigureSpec = {
  id: 'fig-later', kind: 'curve', title: 'Not live yet', caption: 'Later.', alt: 'A static description of a later figure, long enough.',
  model: { id: 'not-registered', params: { x: 1 } }, controls: ['x'], readouts: ['y'],
};
const doc: ExplorableDoc = {
  schema: 1, id: 'attention', title: 'Why attention divides by √d', dek: 'Scale.', source: { kind: 'concept', title: 'Softmax' },
  provenance: { mode: 'curated', generatedAt: '2026-10-19T00:00:00.000Z' },
  sections: [
    { id: 'a', heading: 'A', paragraphs: ['p'], figure: fig1 },
    { id: 'b', heading: 'B', paragraphs: ['p'], figure: fig2 },
  ],
  takeaway: 'Done.',
};

/** A controllable IntersectionObserver. */
class MockIO {
  static all: MockIO[] = [];
  constructor(private cb: IntersectionObserverCallback) {
    MockIO.all.push(this);
  }
  observe() {}
  disconnect() {}
  fire(isIntersecting: boolean) {
    this.cb([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

let root: HTMLElement;
let destroy: () => void;
const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s)!;
const readout = () => $('.xfig-readout').textContent;
/** Fallback geometry: 640 px wide, track from 56 to 616 px. */
const xFor = (T: number) => 56 + (Math.log(T / 0.05) / Math.log(100)) * 560;
const ev = (type: string, x: number) => new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, bubbles: true, cancelable: true });
/** Drawn height of the "cat" bar. */
const bar = () => Number(root.querySelectorAll('rect.xfig-bar')[1]!.getAttribute('height'));
const knob = () => $<SVGGElement>('.xfig-knob');
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
function mount(reducedMotion = true, visible = true) {
  root = document.createElement('div');
  root.innerHTML = essayHtml(doc);
  document.body.append(root);
  destroy = hydrateFigures(root, doc, { reducedMotion }).destroy;
  if (visible) MockIO.all.at(-1)?.fire(true);
}

beforeEach(() => {
  MockIO.all = [];
  vi.stubGlobal('IntersectionObserver', MockIO);
});
afterEach(() => {
  destroy();
  root.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('hydrateFigures: fig-temperature', () => {
  it('draws 6 labelled bars, the readout, the chip and the top marker', () => {
    mount();
    expect([...root.querySelectorAll('.xfig-bar-label')].map((t) => t.textContent)).toEqual(['the', 'cat', 'sat', 'on', 'the', 'mat']);
    expect(root.querySelectorAll('rect.xfig-bar')).toHaveLength(6);
    expect(readout()).toBe('top weight 0.51 · entropy 2.05 bits');
    expect($('.xfig-chip').textContent).toBe('query: sat');
    expect($('.xfig-top text').textContent).toBe('top');
    expect($('.xfig-top path')).toBeTruthy();
    expect([...root.querySelectorAll('.xfig-bar-value.is-top')].map((t) => t.textContent)).toEqual(['0.51']);
    expect(root.querySelector('#fig-temperature')?.hasAttribute('data-live')).toBe(true);
  });

  it('keeps the alt text, visually hidden, as the figure description', () => {
    mount();
    const figure = $('#fig-temperature');
    const alt = root.querySelector(`#${figure.getAttribute('aria-describedby')}`);
    expect(alt?.textContent).toBe(ALT);
    expect(alt?.classList.contains('xfig-sr')).toBe(true);
    expect($('[role="img"]').getAttribute('aria-label')).toBe('Temperature sets how sharp the softmax is: bar chart');
    expect($('[role="img"]').hasAttribute('aria-labelledby')).toBe(false);
  });

  it('knob is an accessible slider with a ≥ 44 px hit area', () => {
    mount();
    const k = knob();
    expect(k.getAttribute('role')).toBe('slider');
    expect(k.getAttribute('aria-label')).toBe('temperature (drag on chart)');
    expect(k.getAttribute('tabindex')).toBe('0');
    expect([k.getAttribute('aria-valuemin'), k.getAttribute('aria-valuemax'), k.getAttribute('aria-valuenow')]).toEqual(['0.05', '5', '1']);
    expect(k.getAttribute('aria-valuetext')).toBe('1.00');
    expect(Number(k.querySelector('.xfig-knob-hit')?.getAttribute('r'))).toBeGreaterThanOrEqual(23);
    expect(Number($('.xfig-track-hit').getAttribute('height'))).toBeGreaterThanOrEqual(46);
  });

  it('Home, End, arrows and PageUp/Down change T, readout and native slider together', () => {
    mount();
    key(knob(), 'Home');
    expect(knob().getAttribute('aria-valuetext')).toBe('0.05');
    expect(readout()).toBe('top weight 1.00 · entropy 0.00 bits');
    key(knob(), 'End');
    expect(knob().getAttribute('aria-valuenow')).toBe('5');
    expect(readout()).toBe('top weight 0.22 · entropy 2.57 bits');
    expect($('output').textContent).toBe('T = 5.00');
    expect($<HTMLInputElement>('input[type=range]').getAttribute('aria-valuetext')).toBe('temperature 5.00');
    key(knob(), 'PageDown');
    key(knob(), 'ArrowLeft');
    expect(Number(knob().getAttribute('aria-valuenow'))).toBeLessThan(5);
    key($('input[type=range]'), 'Home');
    expect(knob().getAttribute('aria-valuenow')).toBe('0.05');
  });

  it('reads exactly "top weight 0.98 · entropy 0.15 bits" at T = 0.25 (native slider)', () => {
    mount();
    const input = $<HTMLInputElement>('input[type=range]');
    input.value = String(Math.round(1000 * (Math.log(0.25 / 0.05) / Math.log(100))));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(knob().getAttribute('aria-valuenow')).toBe('0.25');
    expect(readout()).toBe('top weight 0.98 · entropy 0.15 bits');
  });

  it('keeps the y axis fixed and the two "the" bars equal at every fixture T', () => {
    mount();
    const bars = () => [...root.querySelectorAll('rect.xfig-bar')].map((r) => [r.getAttribute('y'), r.getAttribute('height')]);
    // Fallback geometry: plot from y = 44 (weight 1) to y = 282 (weight 0).
    const full = 282 - 44;
    for (const T of [0.05, 0.1, 0.25, 0.5, 1, 2, 5]) {
      const input = $<HTMLInputElement>('input[type=range]');
      input.value = String(Math.round(1000 * (Math.log(T / 0.05) / Math.log(100))));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const b = bars();
      expect(b[0]).toEqual(b[4]);
      const heights = b.map(([, h]) => Number(h));
      expect(Math.max(...heights)).toBeLessThanOrEqual(full);
    }
    expect([...root.querySelectorAll('.xfig-grid')]).toHaveLength(4);
  });

  it('drags with touch pointers using pointer capture', () => {
    mount();
    const handle = $<SVGGElement>('.xfig-handle');
    const capture = vi.fn<(id: number) => void>();
    handle.setPointerCapture = capture;
    handle.releasePointerCapture = vi.fn<(id: number) => void>();
    handle.dispatchEvent(ev('pointerdown', xFor(1)));
    expect(capture).toHaveBeenCalledWith(7);
    expect(knob().classList.contains('is-pointer')).toBe(true);
    handle.dispatchEvent(ev('pointermove', xFor(0.1)));
    expect(knob().getAttribute('aria-valuenow')).toBe('0.1');
    expect(Number(readout()?.match(/top weight ([\d.]+)/)?.[1])).toBeGreaterThan(0.9);
    handle.dispatchEvent(ev('pointerup', xFor(0.1)));
    handle.dispatchEvent(ev('pointermove', xFor(5)));
    expect(knob().getAttribute('aria-valuenow')).toBe('0.1');
    key(knob(), 'ArrowRight');
    expect(knob().classList.contains('is-pointer')).toBe(false);
  });

  it('"Show data" toggles a real table of tokens and weights in a labelled scroll region', () => {
    mount();
    const button = $<HTMLButtonElement>('.xfig-data-toggle');
    const wrap = $<HTMLDivElement>('.xfig-table-wrap');
    const table = $<HTMLTableElement>('table.xfig-table');
    expect(table.parentElement).toBe(wrap);
    expect(wrap.hidden).toBe(true);
    expect(button.getAttribute('aria-controls')).toBe(wrap.id);
    expect(wrap.getAttribute('role')).toBe('region');
    expect(wrap.tabIndex).toBe(0);
    expect(wrap.getAttribute('aria-labelledby')).toBe(table.caption?.id);
    button.click();
    expect(wrap.hidden).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect([...table.querySelectorAll('thead th')].map((t) => t.textContent)).toEqual(['#', 'token', 'score', 'weight']);
    const rows = [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent));
    expect(rows[1]).toEqual(['2', 'cat', '2.50', '0.513']);
    expect([...table.querySelectorAll('tbody th[scope="row"]')].map((th) => th.textContent)).toEqual(['the', 'cat', 'sat', 'on', 'the', 'mat']);
    expect(table.querySelector('tbody tr')?.firstElementChild?.tagName).toBe('TD');
    expect(rows).toHaveLength(6);
    button.click();
    expect(wrap.hidden).toBe(true);
  });

  it('updates the live description (throttled)', () => {
    vi.useFakeTimers();
    mount();
    const desc = $('#fig-temperature-desc');
    expect(desc.getAttribute('aria-live')).toBe('polite');
    expect(desc.textContent).toBe('Temperature 1.00: “cat” gets 51% of the attention; entropy 2.05 bits.');
    const input = $<HTMLInputElement>('input[type=range]');
    input.value = '500';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(500);
    expect(desc.textContent).toBe('Temperature 0.50: “cat” gets 82% of the attention; entropy 1.01 bits.');
  });

  it('during a pointer drag, speaks only after 600 ms of rest', () => {
    vi.useFakeTimers();
    mount();
    const desc = $('#fig-temperature-desc');
    const input = $<HTMLInputElement>('input[type=range]');
    const before = desc.textContent;
    input.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    for (const v of ['700', '600', '500']) {
      vi.advanceTimersByTime(400);
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    vi.advanceTimersByTime(599);
    expect(desc.textContent).toBe(before);
    vi.advanceTimersByTime(1);
    expect(desc.textContent).toBe('Temperature 0.50: “cat” gets 82% of the attention; entropy 1.01 bits.');
    window.dispatchEvent(new Event('pointerup'));
  });

  it('pauses drawing while off screen and catches up when visible', () => {
    mount(true, false);
    const io = MockIO.all[0]!;
    io.fire(true);
    io.fire(false);
    key(knob(), 'End');
    expect(knob().getAttribute('aria-valuenow')).toBe('5');
    expect(readout()).toBe('top weight 0.51 · entropy 2.05 bits');
    io.fire(true);
    expect(readout()).toBe('top weight 0.22 · entropy 2.57 bits');
  });

  it('reduced motion: no nudge, a static "drag" hint, instant keyboard steps', () => {
    vi.useFakeTimers();
    mount(true);
    const move = () => knob().querySelector('g')!.getAttribute('transform');
    expect(knob().classList.contains('is-hinting')).toBe(true);
    const before = move();
    vi.advanceTimersByTime(1500);
    expect(move()).toBe(before);
    const h = bar();
    key(knob(), 'Home');
    expect(bar()).toBeGreaterThan(h);
    const settled = bar();
    vi.advanceTimersByTime(1000);
    expect(bar()).toBe(settled);
    expect(knob().classList.contains('is-hinting')).toBe(false);
  });

  it('without reduced motion: exactly one nudge, never repeated; keyboard steps ease', () => {
    vi.useFakeTimers();
    mount(false);
    const io = MockIO.all[0]!;
    const dx = () => Number(knob().querySelector('g')!.getAttribute('transform')?.match(/translate\(([-\d.]+)/)?.[1]);
    const base = dx();
    expect(knob().classList.contains('is-hinting')).toBe(false);
    vi.advanceTimersByTime(1200 + 300);
    expect(dx() - base).toBeGreaterThan(6);
    vi.advanceTimersByTime(1000);
    expect(dx()).toBeCloseTo(base, 1);
    io.fire(false);
    io.fire(true);
    let moved = 0;
    for (let t = 0; t < 3000; t += 50) {
      vi.advanceTimersByTime(50);
      if (Math.abs(dx() - base) > 0.01) moved++;
    }
    expect(moved).toBe(0);
    const h0 = bar();
    key(knob(), 'Home');
    const h1 = bar();
    expect(readout()).toBe('top weight 1.00 · entropy 0.00 bits');
    vi.advanceTimersByTime(1000);
    expect(h1).toBeGreaterThan(h0);
    expect(bar()).toBeGreaterThan(h1);
  });

  it('leaves a figure whose kind/model is not available as a static shell, and destroy restores Fig 1', () => {
    mount();
    expect(root.querySelector('#fig-later .xfig-drawing')).toBeNull();
    expect(root.querySelector('#fig-later .xfig-alt')?.classList.contains('xfig-sr')).toBe(false);
    destroy();
    expect(root.querySelector('#fig-temperature .xfig-drawing')).toBeNull();
    expect(root.querySelector('#fig-temperature .xfig-alt')?.classList.contains('xfig-sr')).toBe(false);
    destroy = () => {};
  });
});
