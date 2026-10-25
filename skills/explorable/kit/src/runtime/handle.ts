/**
 * The on-figure ring knob (PLAN §4.1): an SVG `role="slider"` on a track.
 * Pointer capture for mouse, pen and touch; Arrow/Page/Home/End keys.
 * The whole track band is a ≥ 44 px pointer target; so is the knob.
 */
import type { ParamDef } from '../registry.ts';
import { keyValue, snap, fromPos, spoken, valueOnly } from './controls.ts';
import { setMath } from './math.ts';

export { setMath };

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
  /** Draw the track from its start to the knob in the handle colour (a straight track only). */
  fill?: boolean;
}

export type Handle = ReturnType<typeof createHandle>;

/** The knob's symbol at the start of its track. */
export function trackLabel(parent: Element, x: number, y: number, symbol: string) {
  setMath(svgEl(parent, 'text', { x, y, 'text-anchor': 'end', class: 'xfig-track-label' }), symbol);
}

export function createHandle(parent: SVGElement, { def, onChange, fill }: HandleOptions) {
  const root = svgEl(parent, 'g', { class: 'xfig-handle' });
  const band = svgEl(root, 'rect', { class: 'xfig-track-hit' });
  const filled = fill ? svgEl(root, 'path', { class: 'xfig-track-fill', 'aria-hidden': 'true' }) : undefined;
  // The symbol in words ("d_k" reads "d sub k"), added unless the spoken label already ends with it.
  const said = def.symbol?.replace(/_/g, ' sub ');
  const knob = svgEl(root, 'g', {
    class: 'xfig-knob', role: 'slider', tabindex: 0, 'aria-label': `${spoken(def)} (${said && !spoken(def).endsWith(` ${said}`) ? `${said}, ` : ''}drag on chart)`,
    'aria-valuemin': def.min, 'aria-valuemax': def.max, 'aria-orientation': 'horizontal',
  });
  const move = svgEl(knob, 'g');
  svgEl(move, 'circle', { class: 'xfig-knob-hit', r: 23 });
  svgEl(move, 'circle', { class: 'xfig-knob-focus', r: 14 });
  svgEl(move, 'circle', { class: 'xfig-knob-ring', r: 9 });

  let x0 = 0, x1 = 1, y = 0, x = 0, value = def.default, dragging: number | undefined;
  const placeMove = () => {
    move.setAttribute('transform', `translate(${x.toFixed(1)} ${y})`);
    filled?.setAttribute('d', `M${x0} ${y}H${Math.max(x0, x).toFixed(1)}`);
  };

  const posAt = (clientX: number) => {
    const svg = root.ownerSVGElement;
    const box = svg?.getBoundingClientRect();
    const vbWidth = Number(svg?.getAttribute('viewBox')?.split(' ')[2]) || box?.width || 1;
    const scale = box && box.width ? vbWidth / box.width : 1;
    return ((clientX - (box?.left ?? 0)) * scale - x0) / (x1 - x0 || 1);
  };
  // A touch on the band (not the knob) may be the start of a vertical page scroll (`touch-action: pan-y`), so it
  // moves nothing until it turns sideways (|dx| > 8 px) or ends as a tap. A cancelled gesture puts the value back.
  const SLOP = 8;
  let saved = value, pending: { x: number; y: number } | undefined;
  const begin = (clientX: number) => {
    knob.classList.add('is-pointer'); // focus ring only for keyboard focus
    knob.focus({ preventScroll: true });
    onChange(snap(def, fromPos(def, posAt(clientX))), true);
  };
  const onDown = (e: PointerEvent) => {
    if (e.button > 0) return;
    dragging = e.pointerId;
    saved = value;
    root.setPointerCapture?.(e.pointerId);
    if (e.pointerType === 'touch' && !knob.contains(e.target as Node)) {
      pending = { x: e.clientX, y: e.clientY };
      return;
    }
    e.preventDefault();
    pending = undefined;
    begin(e.clientX);
  };
  const onMove = (e: PointerEvent) => {
    if (dragging !== e.pointerId) return;
    if (!pending) return onChange(snap(def, fromPos(def, posAt(e.clientX))), true);
    if (Math.abs(e.clientX - pending.x) <= SLOP) return;
    pending = undefined;
    begin(e.clientX);
  };
  const onUp = (e: PointerEvent) => {
    if (dragging !== e.pointerId) return;
    const tap = pending && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) <= SLOP;
    if (pending && e.type === 'pointerup' && tap) begin(e.clientX);
    if (!pending && e.type === 'pointercancel' && value !== saved) onChange(saved, true);
    dragging = pending = undefined;
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
    /** Track from x0 to x1 at height y, in SVG user units (CSS px); `band` = [top, bottom] of a taller pointer band. */
    layout(nx0: number, nx1: number, ny: number, [top, bottom] = [ny - 23, ny + 23]) {
      [x0, x1, y] = [nx0, nx1, ny];
      for (const [k, v] of Object.entries({ x: x0 - 23, y: top, width: x1 - x0 + 46, height: bottom - top })) band.setAttribute(k, String(v));
    },
    /** Draw the knob at track position `pos` in [0, 1] (and at height `ny`, for a knob that rides a curve). */
    place(pos: number, ny = y) {
      [x, y] = [x0 + pos * (x1 - x0), ny];
      placeMove();
    },
    /** Current (target) value, for assistive tech. */
    set(v: number) {
      value = v;
      knob.setAttribute('aria-valuenow', String(v));
      knob.setAttribute('aria-valuetext', valueOnly(def, v));
    },
  };
}
