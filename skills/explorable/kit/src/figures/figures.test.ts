// @vitest-environment happy-dom
// Live `bits` (Bloom Fig 1) and `bars` with a √d_k switch (attention Fig 2), mounted from the real samples.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import bloomDoc from '../../../../../src/samples/bloom-filter.json';
import attentionDoc from '../../../../../src/samples/attention.json';
import diffusionDoc from '../../../../../src/samples/diffusion.json';
import { essayHtml, hydrateFigures } from '../doc/essay.ts';
import { parseDoc, type ExplorableDoc } from '../doc/schema.ts';

let root: HTMLElement;
let destroy = () => {};
const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s)!;
const texts = (s: string) => [...root.querySelectorAll(s)].map((e) => e.textContent);
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

/** Mount a sample's figure at a drawing width of `width` px (always on screen). */
function mount(json: unknown, fig: string, width = 862) {
  vi.stubGlobal('IntersectionObserver', undefined);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width, height: 360, left: 0 } as DOMRect);
  const parsed = parseDoc(json);
  if (!parsed.ok) throw new Error('sample does not parse');
  const doc: ExplorableDoc = parsed.doc;
  root = document.createElement('div');
  root.innerHTML = essayHtml(doc);
  document.body.append(root);
  destroy = hydrateFigures(root, doc, { reducedMotion: true }).destroy;
  root = $(`#${fig}`);
}
const readout = () => $('.xfig-readout').textContent;
const sw = () => $<HTMLButtonElement>('[role="switch"]');
/** x of a `translate(x y)` transform. */
const x = (t: string) => Number(/translate\(([\d.]+)/.exec(t)![1]);
/** Pick a query word in the radio group. */
function ask(word: string) {
  const radio = [...root.querySelectorAll<HTMLInputElement>('input[type=radio]')].find((r) => r.parentElement?.textContent === word)!;
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}
afterEach(() => {
  destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('bits: Bloom Fig 1', () => {
  beforeEach(() => mount(bloomDoc, 'fig-bits'));

  it('draws 32 cells whose value is a glyph as well as a fill, and the default readout', () => {
    expect(readout()).toBe('bits set 20 / 32 · predicted FPR 14.7% · observed FP 10 / 50');
    const cells = [...root.querySelectorAll('.xfig-bit')];
    expect(cells).toHaveLength(32);
    expect(cells.map((c) => c.textContent).join('')).toBe('11001101111010101011010110010111');
    expect(cells.every((c) => c.classList.contains('is-set') === (c.textContent === '1'))).toBe(true);
    expect(Number(cells[0]!.querySelector('rect')!.getAttribute('width'))).toBeGreaterThanOrEqual(24);
    expect(texts('.xfig-bit-index')).toHaveLength(32);
    expect(texts('.xfig-word.is-in text')).toEqual(['+ cat', '+ dog', '+ owl', '+ fox', '+ bee', '+ elk', '+ yak', '+ eel']);
    expect(texts('.xfig-verdict-text')).toEqual(['maybe (true positive)']);
    expect(root.querySelectorAll('.xfig-arrow')).toHaveLength(3);
    expect(root.querySelectorAll('rect.xfig-probe')).toHaveLength(3);
    expect(root.querySelectorAll('rect.xfig-probe-halo')).toHaveLength(3);
  });

  it('a radio group picks the query; cherry is a hatched false positive, plum a definite no at bit 11', () => {
    expect($('fieldset legend').textContent).toBe('Ask about');
    expect(texts('fieldset label')).toEqual(['cat', 'owl', 'plum', 'cherry', 'banana', 'hen']);
    ask('cherry');
    expect(texts('.xfig-verdict-text')).toEqual(['maybe (false positive)']);
    expect($('.xfig-query').getAttribute('fill')).toMatch(/^url\(#fig-bits-hatch\)$/);
    expect($('.xfig-verdict').getAttribute('fill')).toBe('url(#fig-bits-hatch)');
    expect($('#fig-bits-hatch')).toBeTruthy();
    expect($('.xfig-query-text').textContent).toBe('cherry?');
    ask('plum');
    expect(texts('.xfig-verdict-text')).toEqual(['definitely not']);
    expect($('.xfig-verdict').hasAttribute('fill')).toBe(false);
    expect(texts('.xfig-svg text')).toContain('0 here → definitely not');
    const zero = $('.xfig-zero').getAttribute('transform')!;
    const bit11 = root.querySelectorAll('.xfig-bit')[11]!.getAttribute('transform')!;
    expect(x(zero)).toBeCloseTo(x(bit11) + Number($('.xfig-bit rect').getAttribute('width')) / 2, 6);
  });

  it('the n knob and the k slider update bits, readout and verdict; hen goes NO → FP → TP', () => {
    const knob = $('.xfig-knob');
    expect(knob.getAttribute('aria-label')).toBe('words inserted (drag on chart)');
    expect(knob.getAttribute('aria-valuetext')).toBe('8');
    ask('hen');
    const verdicts: (string | null)[] = [];
    for (const n of [10, 11, 12]) {
      while (Number(knob.getAttribute('aria-valuenow')) < n) key(knob, 'ArrowRight');
      verdicts.push($('.xfig-verdict-text').textContent);
    }
    expect(verdicts).toEqual(['definitely not', 'maybe (false positive)', 'maybe (true positive)']);
    key(knob, 'Home');
    expect(readout()).toBe('bits set 0 / 32 · predicted FPR 0% · observed FP 0 / 50');
    key(knob, 'End');
    expect(readout()).toBe('bits set 24 / 32 · predicted FPR 30.8% · observed FP 19 / 50');
    const k = $<HTMLInputElement>('#fig-bits-k');
    expect(k.getAttribute('aria-valuetext')).toBe('hashes per word 3');
    key(k, 'Home');
    key(knob, 'PageDown');
    expect(k.getAttribute('aria-valuetext')).toBe('hashes per word 1');
    expect($('output').textContent).toBe('n = 2');
    key(k, 'End');
    expect(texts('output')).toContain('k = 6');
    expect(root.querySelectorAll('.xfig-arrow')).toHaveLength(6);
  });

  it('"Show data" lists every bit, marks the probed ones, and repeats the verdict', () => {
    ask('cherry');
    const table = $<HTMLTableElement>('table.xfig-table');
    expect(texts('thead th')).toEqual(['bit', 'value', 'probed by “cherry”']);
    expect(table.caption?.textContent).toContain('“cherry”: maybe (false positive)');
    const rows = [...table.querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.textContent));
    expect(rows).toHaveLength(32);
    expect(rows.filter((r) => r[2] === 'yes').map((r) => r[0])).toEqual(['14', '19', '24']);
    expect(table.querySelector('tbody tr')!.firstElementChild!.tagName).toBe('TH');
  });

  it('the live description says the verdict in words', () => {
    vi.useFakeTimers();
    ask('cherry');
    vi.advanceTimersByTime(600);
    expect($('#fig-bits-desc').textContent).toBe(
      '8 words inserted with k = 3: 20 of 32 bits set. “cherry”: maybe (false positive). Predicted false-positive rate 14.7%; 10 of 50 test words came back maybe.',
    );
  });
});

describe('bits: narrow layout', () => {
  it('wraps to 2 rows of 16 under 640 px', () => {
    mount(bloomDoc, 'fig-bits', 340);
    const ys = new Set([...root.querySelectorAll('.xfig-bit')].map((c) => /translate\([\d.]+ ([\d.]+)\)/.exec(c.getAttribute('transform')!)![1]));
    expect(ys.size).toBe(2);
    const xs = [...root.querySelectorAll('.xfig-bit')].map((c) => Number(/translate\(([\d.]+)/.exec(c.getAttribute('transform')!)![1]));
    expect(Math.max(...xs) + Number($('.xfig-bit rect').getAttribute('width'))).toBeLessThanOrEqual(340);
  });
});

describe('bars + switch: attention Fig 2', () => {
  beforeEach(() => mount(attentionDoc, 'fig-scaling'));

  it('starts unscaled at d_k = 4 with dashed "other setting" outlines and a legend that follows the switch', () => {
    expect(readout()).toBe('score SD 2.02 · top weight 0.57 · entropy 1.85 bits');
    expect(root.querySelectorAll('.xfig-bar-g rect.xfig-bar-other')).toHaveLength(8);
    expect(texts('.xfig-legend text')).toEqual(['this setting', 'with ÷√d_k']);
    expect(sw().getAttribute('aria-checked')).toBe('false');
    expect(sw().getAttribute('aria-label')).toBe('divide by square root of d k');
    expect(sw().textContent).toBe('divide by √d_koff');
    sw().click();
    expect(sw().getAttribute('aria-checked')).toBe('true');
    expect(readout()).toBe('score SD 1.01 · top weight 0.34 · entropy 2.58 bits');
    expect(texts('.xfig-legend text')).toEqual(['this setting', 'without ÷√d_k']);
  });

  it('dragging d_k to 512 unscaled saturates the softmax; scaled keeps SD near 1', () => {
    const knob = $('.xfig-knob');
    expect(knob.getAttribute('aria-label')).toBe('key width d k (d_k, drag on chart)');
    expect($('#fig-scaling-dk').getAttribute('aria-valuetext')).toBe('key width d k 4 dimensions');
    key(knob, 'End');
    expect(knob.getAttribute('aria-valuetext')).toBe('512 dimensions');
    expect(readout()).toBe('score SD 23.95 · top weight 1.00 · entropy 0.00 bits');
    sw().click();
    expect(readout()).toBe('score SD 1.06 · top weight 0.61 · entropy 2.00 bits');
  });

  it('at d_k = 1 the switch changes no number', () => {
    key($('.xfig-knob'), 'Home');
    const before = readout();
    sw().click();
    expect(readout()).toBe(before);
  });

  it('the data table has the other setting as a column', () => {
    expect(texts('thead th')).toEqual(['#', 'key', 'score', 'weight', 'weight with other setting']);
    const first = [...$('tbody tr').children].map((c) => c.textContent);
    expect(first).toEqual(['1', 'k₁', '1.630', '0.156', '0.178']);
  });
});

/** Each density label (right-aligned in the axis group) and its y. */
const yAxis = () => [...root.querySelectorAll('.xfig-axis text[text-anchor="end"]')].map((t) => `${t.textContent}@${t.getAttribute('y')}`);
const heights = () => [...root.querySelectorAll('rect.xfig-bar')].map((r) => r.getAttribute('height')).join();

describe('histogram: diffusion Fig 1', () => {
  beforeEach(() => mount(diffusionDoc, 'fig-histogram'));

  it('draws 60 ink-outlined bars, the labelled dotted reference and the ±2σ guides', () => {
    expect(readout()).toBe('signal √ᾱ_t 1.000 · noise √(1−ᾱ_t) 0.000 · spread (SD) 1.77');
    expect(root.querySelectorAll('rect.xfig-bar')).toHaveLength(60);
    expect(texts('.xfig-ref-label')).toEqual(['N(0, 1)']);
    expect(texts('.xfig-ghost-label')).toEqual(['data (t = 0)']);
    expect($('.xfig-ref').getAttribute('d')).toMatch(/^M[\d.]+ [\d.]+(L[\d.]+ [\d.]+){160}$/);
    expect(texts('.xfig-sigma-label')).toEqual(['±2σ of N(0, 1)']);
    // The hairlines are drawn after (over) the bars; the dotted and dashed lines sit on paper halos with the same path.
    const sigma = [...root.querySelectorAll('.xfig-sigma')];
    expect(sigma).toHaveLength(2);
    expect(sigma.every((s) => s.closest('[aria-hidden="true"]') && s.compareDocumentPosition($('.xfig-bar')) & Node.DOCUMENT_POSITION_PRECEDING)).toBe(true);
    expect(($('.xfig-ref').previousElementSibling as Element).getAttribute('d')).toBe($('.xfig-ref').getAttribute('d'));
    expect(($('.xfig-ghost').previousElementSibling as Element).classList.contains('xfig-line-halo')).toBe(true);
    expect(($('.xfig-ghost').previousElementSibling as Element).classList.contains('is-hidden')).toBe(true);
    expect($('.xfig-foot .xfig-sr').textContent).toBe('signal 1.000, noise 0.000, spread 1.77');
    expect($('.xfig-ghost').classList.contains('is-hidden')).toBe(true);
    expect($('.xfig-chip').textContent).toBe('t = 0 · ᾱ_t = 1.00');
    expect(texts('.xfig-track text')).toEqual(['t', '0', '250', '500', '750', '1000']);
  });

  it('keys scrub t: PageUp from 0 goes to 50, End to 1000; the y axis never rescales', () => {
    const knob = $('.xfig-knob');
    expect(knob.getAttribute('aria-label')).toBe('step t (drag on chart)');
    expect(knob.getAttribute('aria-valuetext')).toBe('0 of 1000');
    const axis0 = yAxis();
    expect(axis0.map((a) => a.split('@')[0])).toEqual(['0', '0.25', '0.5', '0.75', '1']);
    const h0 = heights();
    key(knob, 'PageUp');
    expect(knob.getAttribute('aria-valuenow')).toBe('50');
    expect($('#fig-histogram-t').getAttribute('aria-valuetext')).toBe('step t 50 of 1000');
    expect(heights()).not.toBe(h0);
    expect($('.xfig-ghost').classList.contains('is-hidden')).toBe(false);
    key(knob, 'End');
    expect(knob.getAttribute('aria-valuenow')).toBe('1000');
    expect(readout()).toBe('signal √ᾱ_t 0.006 · noise √(1−ᾱ_t) 1.000 · spread (SD) 1.01');
    expect($('.xfig-chip').textContent).toBe('t = 1000 · ᾱ_t = 4.04 × 10⁻⁵');
    expect(yAxis()).toEqual(axis0);
  });

  it('"Show data" lists 60 bins with the t = 0 and N(0, 1) columns', () => {
    key($('.xfig-knob'), 'End');
    const table = $<HTMLTableElement>('table.xfig-table');
    expect(texts('thead th')).toEqual(['bin from', 'bin to', 'density now', 'density at t = 0', 'N(0, 1) at bin centre']);
    expect(table.caption?.textContent).toContain('step t = 1000, alpha-bar 4.04 × 10⁻⁵');
    const rows = [...table.querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.textContent));
    expect(rows).toHaveLength(60);
    expect(rows[15]).toEqual(['−2.00', '−1.87', '0.105', '0.735', '0.062']);
    expect(rows[59]![1]).toBe('4.00');
  });

  it('the live description is one throttled sentence', () => {
    vi.useFakeTimers();
    key($('.xfig-knob'), 'End');
    key($('.xfig-knob'), 'Home');
    for (let i = 0; i < 10; i++) key($('.xfig-knob'), 'PageUp');
    vi.advanceTimersByTime(600);
    expect($('#fig-histogram-desc').textContent).toBe(
      'Step t = 500: 28% of the original signal and noise of 0.96; the samples spread with SD 1.09, and pure noise would be 1.00.',
    );
  });
});
