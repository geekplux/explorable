// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { ParamDef } from '../registry.ts';
import { attentionScaling } from '../models/attention-scaling.ts';
import { bloomFilter } from '../models/bloom-filter.ts';
import { createRange, createToggle, fromPos, keyValue, snap, stateText, toPos, valueOnly, valueText } from './controls.ts';

const T: ParamDef = { label: 'temperature', min: 0.05, max: 5, step: 0.01, default: 1, scale: 'log' };
const K: ParamDef = { label: 'hashes per word', min: 1, max: 6, step: 1, default: 3 };

describe('stateText (the print state line)', () => {
  const scaling = attentionScaling.params as Record<string, ParamDef>;
  it('names sliders by symbol and value, switches as on or off, choices by name', () => {
    expect(stateText({ T }, ['T'], { T: 1 })).toBe('Shown at T = 1.');
    expect(stateText({ T }, ['T'], { T: 0.25 })).toBe('Shown at T = 0.25.');
    expect(stateText(scaling, ['dk', 'scaled'], { dk: 4, scaled: 0, seed: 229 })).toBe('Shown at d_k = 4, divide by √d_k off.');
    expect(stateText(scaling, ['dk', 'scaled'], { dk: 512, scaled: 1 })).toBe('Shown at d_k = 512, divide by √d_k on.');
    expect(stateText(bloomFilter.params as Record<string, ParamDef>, ['n', 'k', 'q'], { n: 8, k: 3, q: 2 })).toBe('Shown at n = 8, k = 3, ask about “plum”.');
  });
  it('is empty for a figure with no controls, and skips unknown ones', () => {
    expect(stateText({ T }, [], { T: 1 })).toBe('');
    expect(stateText({ T }, ['x'], { T: 1 })).toBe('');
    expect(stateText({ SNR: { ...K, label: 'SNR', control: 'toggle' } }, ['SNR'], { SNR: 1 })).toBe('Shown at SNR off.');
  });
});

describe('control value rules', () => {
  it('snaps to step and clamps', () => {
    expect(snap(T, 0.123)).toBe(0.12);
    expect(snap(T, 99)).toBe(5);
    expect(snap(T, 0)).toBe(0.05);
    expect(snap(K, 2.6)).toBe(3);
  });

  it('maps log params through log space', () => {
    expect(toPos(T, 0.05)).toBe(0);
    expect(toPos(T, 5)).toBe(1);
    expect(toPos(T, 0.5)).toBeCloseTo(0.5, 12);
    expect(fromPos(T, 0.5)).toBeCloseTo(0.5, 12);
    expect(toPos(K, 3.5)).toBe(0.5);
  });

  it('steps log params by 1 % / 10 % of the log range, at least one step', () => {
    expect(keyValue(T, 1, 'ArrowRight')).toBe(1.05);
    expect(keyValue(T, 1, 'ArrowLeft')).toBe(0.95);
    expect(keyValue(T, 1, 'PageUp')).toBe(1.58);
    expect(keyValue(T, 1, 'PageDown')).toBe(0.63);
    expect(keyValue(T, 0.05, 'ArrowUp')).toBe(0.06);
    expect(keyValue(T, 3, 'Home')).toBe(0.05);
    expect(keyValue(T, 3, 'End')).toBe(5);
    expect(keyValue(T, 5, 'ArrowRight')).toBe(5);
    expect(keyValue(T, 1, 'a')).toBeUndefined();
  });

  it('steps linear params by step and pageStep', () => {
    expect(keyValue(K, 3, 'ArrowUp')).toBe(4);
    expect(keyValue(K, 3, 'PageDown')).toBe(1);
    expect(keyValue({ ...K, max: 100, pageStep: 50 }, 3, 'PageUp')).toBe(53);
  });

  it('writes aria-valuetext with words', () => {
    expect(valueText(T, 0.5)).toBe('temperature 0.50');
    expect(valueText({ ...K, unit: 'dimensions' }, 4)).toBe('hashes per word 4 dimensions');
    expect(valueOnly(T, 0.5)).toBe('0.50');
    expect(valueOnly({ ...K, unit: 'dimensions' }, 4)).toBe('4 dimensions');
  });

  it('native range: labelled, and its <output> is not a live region', () => {
    const r = createRange('fig-T', T, () => {}, 'T');
    r.set(0.5);
    const output = r.el.querySelector('output')!;
    expect(output.getAttribute('aria-live')).toBe('off');
    expect(output.getAttribute('for')).toBe('fig-T');
    expect(output.textContent).toBe('T = 0.50');
    expect(r.el.querySelector('label')?.htmlFor).toBe('fig-T');
    expect(r.el.querySelector('input')?.getAttribute('aria-valuetext')).toBe('0.50');
  });

  it('switch: its name starts with the visible words before the first symbol (WCAG 2.5.3)', () => {
    const def = attentionScaling.params.scaled;
    const button = createToggle('fig-s', def, () => {}).el.querySelector('button')!;
    const visible = def.label.split(/[^\p{L}\s]/u)[0]!.trim();
    expect(visible).toBe('Divide by');
    expect(button.getAttribute('aria-label')?.startsWith(visible)).toBe(true);
  });

  it('native range: a symbol label is named in words, the readout shows the symbol', () => {
    const def = attentionScaling.params.dk;
    const r = createRange('fig-dk', def, () => {});
    r.set(64);
    expect(r.el.querySelector('input')?.getAttribute('aria-label')).toBe('key width d sub k');
    expect(r.el.querySelector('output')?.textContent).toBe('dk = 64');
  });
});
