/**
 * Mount one live figure into its static shell: look up the model and the
 * figure kind, build the controls row, readout, live description and data
 * table, and keep them in sync. Updates pause while the figure is off screen.
 */
import { mountBars } from '../figures/bars.ts';
import { mountBits } from '../figures/bits.ts';
import { mountCurve } from '../figures/curve.ts';
import { mountHistogram } from '../figures/histogram.ts';
import { mathHtml } from '../doc/inline.ts';
import type { FigureSpec } from '../doc/schema.ts';
import { format } from '../format.ts';
import { attentionScaling } from '../models/attention-scaling.ts';
import { bloomFilter } from '../models/bloom-filter.ts';
import { diffusionForward } from '../models/diffusion-forward.ts';
import { exprCurveModel } from '../models/expr-curve.ts';
import { softmaxTemperature } from '../models/softmax-temperature.ts';
import { fillTemplate, getModel, type FigureKind, type ModelDef, type ParamDef } from '../registry.ts';
import { createAnnouncer } from './announce.ts';
import { createChoice, createRange, createToggle, fromPos, snap, toPos, varsOf } from './controls.ts';
import type { Handle } from './handle.ts';
import { follow, reducedMotion, settle } from './motion.ts';
import { createDataTable, type Column } from './table.ts';

export type Params = Record<string, number>;
export type Outputs = Record<string, number | number[]>;

/** What the runtime hands a figure kind. */
export interface FigureCtx {
  spec: FigureSpec;
  model: ModelDef;
  setParam(name: string, value: number, instant: boolean): void;
}

/** What a figure kind returns. */
export interface FigureView {
  /** Draw a (possibly in-between, eased) state; `eased` (when the view `settles`) are in-between outputs for the marks only. */
  draw(shown: Params, out: Outputs, eased?: Outputs): void;
  /** Marks settle in 250 ms after a drag step, while the knob and every number follow 1:1. */
  settles?: boolean;
  /** The ring knob on the figure, if any, and the param it controls. */
  handle?: { name: string; knob: Handle };
  /** Data-table column headers, fixed or following the current state. */
  columns: Column[] | ((p: Params, o: Outputs) => Column[]);
  /** One-line summary appended to the table caption. */
  note?(p: Params, o: Outputs): string;
  /** Index of the column that names each row (a row header). */
  rowHeader?: number;
  rows(p: Params, o: Outputs): string[][];
  destroy(): void;
}

export type FigureMount = (drawing: HTMLElement, ctx: FigureCtx) => FigureView;
const KINDS: Record<FigureKind, FigureMount> = { bars: mountBars, bits: mountBits, histogram: mountHistogram, curve: mountCurve };
/** Models registered by importing the runtime. */
export const BUILT_IN_MODELS = [softmaxTemperature, attentionScaling, bloomFilter, diffusionForward] as unknown as readonly ModelDef[];

const noop = () => {};
/** In-between outputs: numbers and equal-length number arrays blend, anything else is taken from `b`. */
function lerp(a: Outputs, b: Outputs, e: number): Outputs {
  const mix = (x: number, y: number) => x + (y - x) * e;
  return Object.fromEntries(
    Object.entries(b).map(([k, v]) => {
      const f = a[k];
      if (typeof v === 'number') return [k, typeof f === 'number' ? mix(f, v) : v];
      return [k, Array.isArray(f) && f.length === v.length ? v.map((y, i) => mix(f[i]!, y)) : v];
    }),
  );
}
/** Quiet time (ms) after the last drag input before the live description speaks. */
const DRAG_IDLE = 600;
const el = (tag: string, cls: string) => Object.assign(document.createElement(tag), { className: cls });

export interface MountOptions {
  /** Override `prefers-reduced-motion` detection (tests). */
  reducedMotion?: boolean;
}

/** An `expr-curve` spec's own model, or undefined if one of its expressions is invalid. */
function exprModel(spec: FigureSpec): ModelDef | undefined {
  try {
    return exprCurveModel(spec);
  } catch {
    return undefined;
  }
}

/** Mount a live figure, or return undefined (the static shell stays) if its kind or model is not available. */
export function mountFigure(stage: HTMLElement, spec: FigureSpec, opts: MountOptions = {}) {
  const found = 'expr' in spec.model ? exprModel(spec) : getModel(spec.model.id);
  const kind = KINDS[spec.kind];
  if (!found || !kind) return undefined;
  const model: ModelDef = found;
  const figure = stage.closest('figure') ?? stage;
  const reduced = opts.reducedMotion ?? reducedMotion();
  const defs = model.params as Record<string, ParamDef>;
  const controls = spec.controls.filter((c) => defs[c]);
  const target: Params = Object.fromEntries(Object.entries(defs).map(([k, d]) => [k, d.default]));
  if (!('expr' in spec.model)) Object.assign(target, spec.model.params);
  for (const c of controls) target[c] = snap(defs[c]!, target[c]!);
  let shown = { ...target };

  // Keep the static alt text, visually hidden, as the figure's description.
  const alt = stage.querySelector<HTMLElement>('.xfig-alt');
  const altId = `${spec.id}-alt`;
  if (alt) {
    alt.id = altId;
    alt.classList.add('xfig-sr');
    figure.setAttribute('aria-describedby', altId);
  }
  const drawing = el('div', 'xfig-drawing');
  const row = el('div', 'xfig-controls');
  const foot = el('div', 'xfig-foot');
  // The visible readout keeps its symbols; screen readers get the same numbers in words (OutputDef.spoken).
  const readout = el('p', 'xfig-readout');
  readout.setAttribute('aria-hidden', 'true');
  const spokenReadout = el('p', 'xfig-sr');
  const desc = el('p', 'xfig-sr');
  desc.id = `${spec.id}-desc`;
  stage.append(drawing, row, foot, desc);

  const announcer = createAnnouncer(desc);
  // While a pointer drags (knob or native slider), announce only once input has rested (keys keep the 500 ms throttle).
  let dragging = false;
  const endDrag = () => (dragging = false);
  stage.addEventListener('pointerdown', () => (dragging = true), { capture: true });
  for (const t of ['pointerup', 'pointercancel'] as const) window.addEventListener(t, endDrag, { capture: true });
  type Make = (id: string, def: ParamDef, cb: (v: number, instant: boolean) => void, name: string) => { el: HTMLElement; set(v: number): void };
  const CONTROLS: Record<string, Make> = { range: createRange, toggle: createToggle, choice: createChoice };
  const ranges = controls.map((name) => {
    const make = CONTROLS[defs[name]!.control ?? 'range']!;
    return [name, make(`${spec.id}-${name}`, defs[name]!, (v, i) => setParam(name, v, i), defs[name]!.symbol ?? name)] as const;
  });
  // The figure's one-letter parameters (T, t, k) are variables in its readout ("step t").
  const vars = varsOf(...controls);
  // Only sliders ease; a switch or a choice jumps.
  const eased = controls.filter((c) => (defs[c]!.control ?? 'range') === 'range');
  row.append(...ranges.map(([, r]) => r.el));
  const view = kind(drawing, { spec, model, setParam: (n, v, i) => setParam(n, v, i) });
  const columns = (o: Outputs) => (typeof view.columns === 'function' ? view.columns(target, o) : view.columns);
  const data = createDataTable(`${spec.id}-data`, `Data for: ${spec.title}`, columns(model.compute(target)), view.rowHeader, vars);
  foot.append(readout, spokenReadout, data.button);
  stage.append(data.wrap);
  // The knob on the chart is the slider people see; its native twin stays for assistive tech that cannot step an ARIA slider.
  const twin = ranges.find(([name]) => name === view.handle?.name)?.[1].el;
  twin?.classList.add('xfig-sr');
  twin?.querySelector('input')?.setAttribute('tabindex', '-1');

  const labels = spec.options?.labels;
  // A figure may word its own live description (`options.describe`); otherwise the model's sentence.
  const tpl = spec.options?.describe;
  const describe = (out: Outputs) =>
    typeof tpl === 'string' ? fillTemplate(tpl, model, target, out) : model.describe(target, out, Array.isArray(labels) ? labels : undefined);
  let drawn: Outputs | undefined;
  const drawState = (p: Params, out = model.compute(p), marks = out) => {
    shown = p;
    drawn = marks;
    view.draw(p, out, marks);
  };
  let stopFollow = noop;
  let visible = true;
  let dirty = false;

  const pos = (p: Params) => eased.map((c) => toPos(defs[c]!, p[c]!));
  function sync() {
    for (const [name, r] of ranges) r.set(target[name]!);
    if (view.handle) view.handle.knob.set(target[view.handle.name]!);
  }
  function render(instant: boolean) {
    dirty = false;
    const out = model.compute(target);
    const shownOuts = spec.readouts
      .map((id) => [model.outputs[id], out[id]] as const)
      .flatMap(([def, v]) => (def && typeof v === 'number' ? [[def, format(v, def.format)] as const] : []));
    // One span per output, "label <b>value</b> unit", spaced by CSS (a plain space between them for copy and tests).
    readout.replaceChildren(
      ...shownOuts.flatMap(([def, v], i) => {
        const span = document.createElement('span');
        span.innerHTML = `${mathHtml(def.label, { vars })} `;
        span.append(Object.assign(document.createElement('b'), { textContent: v }), def.unit ? ` ${def.unit}` : '');
        return i ? [' ', span] : [span];
      }),
    );
    spokenReadout.textContent = shownOuts.map(([def, v]) => `${def.spoken ?? def.label} ${v}${def.unit ? ` ${def.unit}` : ''}`).join(', ');
    data.setColumns(columns(out));
    data.setRows(view.rows(target, out));
    data.setNote(view.note?.(target, out) ?? '');
    announcer.say(describe(out), dragging ? DRAG_IDLE : undefined);
    stopFollow();
    const from = drawn;
    if (instant && view.settles && from && !reduced) {
      const p = { ...target };
      drawState(p, out, from);
      stopFollow = settle((e) => drawState(p, out, lerp(from, out, e)));
      return;
    }
    if (instant || reduced) return drawState({ ...target }, out);
    const goal = { ...target };
    stopFollow = follow(pos(shown), pos(goal), (v) =>
      drawState({ ...goal, ...Object.fromEntries(eased.map((c, i) => [c, fromPos(defs[c]!, v[i]!)])) }),
    );
  }
  function setParam(name: string, value: number, instant: boolean) {
    const def = defs[name];
    if (!def) return;
    target[name] = snap(def, value);
    sync();
    if (visible) render(instant);
    else dirty = true;
  }
  sync();
  render(true);
  let seen = false;
  const io =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          visible = entries.some((e) => e.isIntersecting);
          // A figure below the fold at load enters once (CSS: fade, 0.985 → 1, 250 ms); one on screen stays still.
          if (!seen && !visible && !reduced) figure.setAttribute('data-enter', '');
          else if (visible && figure.getAttribute('data-enter') === '') figure.setAttribute('data-enter', 'in');
          seen = true;
          if (!visible) return stopFollow();
          if (dirty) render(true);
        })
      : undefined;
  if (io) {
    visible = false;
    io.observe(figure);
  }

  return {
    setParam,
    destroy() {
      io?.disconnect();
      stopFollow();
      announcer.destroy();
      for (const t of ['pointerup', 'pointercancel'] as const) window.removeEventListener(t, endDrag, { capture: true });
      view.destroy();
      for (const node of [drawing, row, foot, desc, data.wrap]) node.remove();
      alt?.classList.remove('xfig-sr');
      figure.removeAttribute('data-enter');
      figure.removeAttribute('aria-describedby');
    },
  };
}
