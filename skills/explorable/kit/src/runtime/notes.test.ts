// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { essayHtml, hydrateFigures } from '../doc/essay.ts';
import type { ExplorableDoc } from '../doc/schema.ts';
import { HOVER_MS, hydrateNotes } from './notes.ts';

const DOC: ExplorableDoc = {
  schema: 2,
  id: 'demo',
  title: 'A demo',
  dek: 'One idea.',
  source: { kind: 'arxiv', url: 'https://arxiv.org/abs/1706.03762', title: 'A Paper' },
  provenance: { mode: 'curated', generatedAt: '2026-10-19T00:00:00.000Z' },
  sections: [
    { id: 's1', heading: 'One', paragraphs: ['First.[[m1]]', 'As [[src]] say.[[m2]]'] },
    { id: 's2', heading: 'Two', paragraphs: ['Plain.'] },
  ],
  takeaway: 'Done.',
  notes: [
    { id: 'm1', kind: 'math', formula: 'a = b + c·d', plain: 'One.' },
    { id: 'm2', kind: 'math', formula: 'e = f + g·h', plain: 'Two.' },
    { id: 'src', kind: 'source', label: 'Ada et al.', title: 'A Paper', url: 'https://arxiv.org/abs/1706.03762' },
  ],
};

let root: HTMLElement;
let notes: { destroy(): void };
const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel) as T & HTMLElement;
const key = (k: string, target: EventTarget = document) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const pointer = (type: string, target: EventTarget, extra: PointerEventInit = {}) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'mouse', ...extra }));

beforeEach(() => {
  root = document.createElement('main');
  root.innerHTML = essayHtml(DOC);
  document.body.append(root);
  notes = hydrateNotes(root, { reducedMotion: true });
});
afterEach(() => {
  notes.destroy();
  root.remove();
  vi.useRealTimers();
});

describe('math notes', () => {
  it('toggle their panel on click, keep aria-expanded in step, and allow several open', () => {
    const [m1, m2] = [$('[aria-controls="note-m1"]'), $('[aria-controls="note-m2"]')];
    m1.click();
    expect(m1.getAttribute('aria-expanded')).toBe('true');
    expect($('#note-m1').hidden).toBe(false);
    expect($('#note-m1').classList.contains('is-open')).toBe(true);
    m2.click();
    expect([$('#note-m1').hidden, $('#note-m2').hidden]).toEqual([false, false]);
    m1.click();
    expect(m1.getAttribute('aria-expanded')).toBe('false');
    expect($('#note-m1').hidden).toBe(true);
    expect($('#note-m1').classList.contains('is-open')).toBe(false);
    expect($('#note-m2').hidden).toBe(false);
  });

  it('keep focus on the marker (Enter and Space are a native button click)', () => {
    const m1 = $('[aria-controls="note-m1"]');
    m1.focus();
    m1.click();
    expect(document.activeElement).toBe(m1);
    expect(m1.tagName).toBe('BUTTON');
    expect(m1.getAttribute('type')).toBe('button');
  });

  it('enter with a start state unless motion is reduced', () => {
    notes.destroy();
    notes = hydrateNotes(root, { reducedMotion: false });
    const panel = $('#note-m1');
    const set = vi.spyOn(panel, 'setAttribute');
    const removed = vi.spyOn(panel, 'removeAttribute');
    $('[aria-controls="note-m1"]').click();
    // Set, then removed after a reflow: the CSS transition runs from the start state.
    expect(set).toHaveBeenCalledWith('data-enter', '');
    expect(removed).toHaveBeenCalledWith('data-enter');
    expect(panel.hasAttribute('data-enter')).toBe(false);
    notes.destroy();
    notes = hydrateNotes(root, { reducedMotion: true });
    $('[aria-controls="note-m1"]').click();
    set.mockClear();
    $('[aria-controls="note-m1"]').click();
    expect(panel.hidden).toBe(false);
    expect(set).not.toHaveBeenCalledWith('data-enter', '');
  });

  it('stop after destroy()', () => {
    notes.destroy();
    $('[aria-controls="note-m1"]').click();
    expect($('#note-m1').hidden).toBe(true);
  });
});

const label = () => $('.xnote-src');
const card = () => $('#note-src');

describe('source cards', () => {

  it('open on keyboard focus and close with Esc, returning focus to the label', () => {
    label().focus();
    expect(label().getAttribute('aria-expanded')).toBe('true');
    expect(card().hidden).toBe(false);
    expect(card().classList.contains('is-open')).toBe(true);
    card().querySelector('a')!.focus();
    expect(card().hidden).toBe(false);
    key('Escape');
    expect(card().hidden).toBe(true);
    expect(label().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(label());
  });

  it('close when focus leaves', () => {
    label().focus();
    $('[aria-controls="note-m1"]').focus();
    expect(card().hidden).toBe(true);
  });

  it('toggle on click or tap (the focus a click brings does not count twice)', () => {
    pointer('pointerdown', label(), { pointerType: 'touch' });
    label().focus();
    expect(card().hidden).toBe(true);
    label().click();
    expect(card().hidden).toBe(false);
    label().click();
    expect(card().hidden).toBe(true);
  });

  it('close on a click outside, not on a click inside', () => {
    label().click();
    pointer('pointerdown', card());
    expect(card().hidden).toBe(false);
    pointer('pointerdown', document.body);
    expect(card().hidden).toBe(true);
  });

  it(`open on hover after ${HOVER_MS}ms, stay while hovered, and close on leave`, () => {
    vi.useFakeTimers();
    pointer('pointerover', label());
    vi.advanceTimersByTime(HOVER_MS - 10);
    expect(card().hidden).toBe(true);
    vi.advanceTimersByTime(20);
    expect(card().hidden).toBe(false);
    // Moving from the label onto the card keeps it open.
    pointer('pointerout', label(), { relatedTarget: card() });
    expect(card().hidden).toBe(false);
    pointer('pointerout', card(), { relatedTarget: document.body });
    expect(card().hidden).toBe(true);
  });

  it('do not open from a hover that leaves before the delay, nor from touch hover', () => {
    vi.useFakeTimers();
    pointer('pointerover', label());
    pointer('pointerout', label(), { relatedTarget: document.body });
    vi.advanceTimersByTime(HOVER_MS * 2);
    expect(card().hidden).toBe(true);
    pointer('pointerover', label(), { pointerType: 'touch' });
    vi.advanceTimersByTime(HOVER_MS * 2);
    expect(card().hidden).toBe(true);
  });

  it('stay open after a click even when the pointer leaves', () => {
    vi.useFakeTimers();
    pointer('pointerover', label());
    vi.advanceTimersByTime(HOVER_MS);
    label().click();
    pointer('pointerout', label(), { relatedTarget: document.body });
    expect(card().hidden).toBe(false);
    key('Escape');
    expect(card().hidden).toBe(true);
  });
});

describe('hydrateFigures', () => {
  it('wires the notes too, and its destroy() unwires them', () => {
    notes.destroy();
    const live = hydrateFigures(root, DOC, { reducedMotion: true });
    $('[aria-controls="note-m1"]').click();
    expect($('#note-m1').hidden).toBe(false);
    live.destroy();
    $('[aria-controls="note-m1"]').click();
    expect($('#note-m1').hidden).toBe(false);
  });
});
