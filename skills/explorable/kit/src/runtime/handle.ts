/**
 * The on-figure ring knob (PLAN §4.1): an SVG `role="slider"` on a track.
 * Pointer capture for mouse, pen and touch; Arrow/Page/Home/End keys.
 * The whole track band is a ≥ 44 px pointer target; so is the knob.
 */
import type { ParamDef } from '../registry.ts';
import { keyValue, snap, fromPos, spoken, valueOnly } from './controls.ts';

const NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element with attributes and append it to `parent`. */
export function svgEl<K extends keyof SVGElementTagNameMap>(parent: Element, tag: K, attrs: Record<string, string | number> = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  parent.append(el);
  return el;
}

export interface HandleOptions {
  def: ParamDef;
  /** A new value; `instant` is true while dragging (no easing). */
  onChange(value: number, instant: boolean): void;
}

export type Handle = ReturnType<typeof createHandle>;

export function createHandle(parent: SVGElement, { def, onChange }: HandleOptions) {
  const root = svgEl(parent, 'g', { class: 'xfig-handle' });
  const band = svgEl(root, 'rect', { class: 'xfig-track-hit', height: 46 });
  const knob = svgEl(root, 'g', {
    class: 'xfig-knob', role: 'slider', tabindex: 0, 'aria-label': `${spoken(def)} (drag on chart)`,
    'aria-valuemin': def.min, 'aria-valuemax': def.max, 'aria-orientation': 'horizontal',
  });
  const move = svgEl(knob, 'g');
  svgEl(move, 'circle', { class: 'xfig-knob-hit', r: 23 });
  svgEl(move, 'circle', { class: 'xfig-knob-hint', r: 15 });
  svgEl(move, 'text', { class: 'xfig-knob-hint', y: -21, 'text-anchor': 'middle', 'aria-hidden': 'true' }).textContent = 'drag';
  svgEl(move, 'circle', { class: 'xfig-knob-focus', r: 14 });
  svgEl(move, 'circle', { class: 'xfig-knob-ring', r: 9 });
  svgEl(move, 'path', { class: 'xfig-knob-grip', d: 'M-2.5 -3.5v7M0 -3.5v7M2.5 -3.5v7' });

  let x0 = 0, x1 = 1, y = 0, x = 0, dx = 0, value = def.default, dragging: number | undefined;
  const placeMove = () => move.setAttribute('transform', `translate(${(x + dx).toFixed(1)} ${y})`);

  const posAt = (clientX: number) => {
    const svg = root.ownerSVGElement;
    const box = svg?.getBoundingClientRect();
    const vbWidth = Number(svg?.getAttribute('viewBox')?.split(' ')[2]) || box?.width || 1;
    const scale = box && box.width ? vbWidth / box.width : 1;
    return ((clientX - (box?.left ?? 0)) * scale - x0) / (x1 - x0 || 1);
  };
  const onDown = (e: PointerEvent) => {
    if (e.button > 0) return;
    e.preventDefault();
    dragging = e.pointerId;
    root.setPointerCapture?.(e.pointerId);
    knob.classList.add('is-pointer'); // focus ring only for keyboard focus
    knob.focus({ preventScroll: true });
    onChange(snap(def, fromPos(def, posAt(e.clientX))), true);
  };
  const onMove = (e: PointerEvent) => {
    if (dragging === e.pointerId) onChange(snap(def, fromPos(def, posAt(e.clientX))), true);
  };
  const onUp = (e: PointerEvent) => {
    if (dragging !== e.pointerId) return;
    dragging = undefined;
    root.releasePointerCapture?.(e.pointerId);
  };
  const onKey = (e: KeyboardEvent) => {
    knob.classList.remove('is-pointer');
    const next = keyValue(def, value, e.key);
    if (next === undefined) return;
    e.preventDefault();
    onChange(next, false);
  };
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);
  knob.addEventListener('keydown', onKey);
  knob.addEventListener('blur', () => knob.classList.remove('is-pointer'));

  return {
    knob,
    /** Track from x0 to x1 at height y, in SVG user units (CSS px). */
    layout(nx0: number, nx1: number, ny: number) {
      [x0, x1, y] = [nx0, nx1, ny];
      for (const [k, v] of Object.entries({ x: x0 - 23, y: y - 23, width: x1 - x0 + 46 })) band.setAttribute(k, String(v));
    },
    /** Draw the knob at track position `pos` in [0, 1]. */
    place(pos: number) {
      x = x0 + pos * (x1 - x0);
      placeMove();
    },
    /** Current (target) value, for assistive tech. */
    set(v: number) {
      value = v;
      knob.setAttribute('aria-valuenow', String(v));
      knob.setAttribute('aria-valuetext', valueOnly(def, v));
    },
    /** Hint offset in px (the nudge), and the static reduced-motion hint. */
    nudge(px: number) {
      dx = px;
      placeMove();
    },
    showHint(on: boolean) {
      knob.classList.toggle('is-hinting', on);
    },
  };
}
