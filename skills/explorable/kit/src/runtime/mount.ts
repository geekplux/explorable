/**
 * Mount one live figure into its static shell: look up the model and the
 * figure kind, build the controls row, readout, live description and data
 * table, and keep them in sync. Updates pause while the figure is off screen.
 */
import { mountBars } from '../figures/bars.ts';
import { mountBits } from '../figures/bits.ts';
import { mountCurve } from '../figures/curve.ts';
import { mountHistogram } from '../figures/histogram.ts';
import type { FigureSpec } from '../doc/schema.ts';
import { format } from '../format.ts';
import { attentionScaling } from '../models/attention-scaling.ts';
import { bloomFilter } from '../models/bloom-filter.ts';
import { diffusionForward } from '../models/diffusion-forward.ts';
import { exprCurveModel } from '../models/expr-curve.ts';
import { softmaxTemperature } from '../models/softmax-temperature.ts';
import { fillTemplate, getModel, type FigureKind, type ModelDef, type ParamDef } from '../registry.ts';
import { createAnnouncer } from './announce.ts';
import { createChoice, createRange, createToggle, fromPos, snap, toPos } from './controls.ts';
import type { Handle } from './handle.ts';
import { HINT_DELAY, follow, nudge, reducedMotion } from './motion.ts';
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
  /** Draw a (possibly in-between, eased) state. */
  draw(shown: Params, out: Outputs): void;
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
  // Only sliders ease; a switch or a choice jumps.
  const eased = controls.filter((c) => (defs[c]!.control ?? 'range') === 'range');
  row.append(...ranges.map(([, r]) => r.el));
  const view = kind(drawing, { spec, model, setParam: (n, v, i) => setParam(n, v, i) });
  const columns = (o: Outputs) => (typeof view.columns === 'function' ? view.columns(target, o) : view.columns);
  const data = createDataTable(`${spec.id}-data`, `Data for: ${spec.title}`, columns(model.compute(target)), view.rowHeader);
  foot.append(data.button, readout, spokenReadout);
  stage.append(data.wrap);

  const labels = spec.options?.labels;
  // A figure may word its own live description (`options.describe`); otherwise the model's sentence.
  const tpl = spec.options?.describe;
  const describe = (out: Outputs) =>
    typeof tpl === 'string' ? fillTemplate(tpl, model, target, out) : model.describe(target, out, Array.isArray(labels) ? labels : undefined);
  const drawState = (p: Params) => {
    shown = p;
    view.draw(p, model.compute(p));
  };
  let stopFollow = noop;
  let visible = true;
  let dirty = false;
  let interacted = false;
  let hinted = false;
  let stopHint = noop;
  let hintTimer: ReturnType<typeof setTimeout> | undefined;

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
      .flatMap(([def, v]) => (def && typeof v === 'number' ? [[def, `${format(v, def.format)}${def.unit ? ` ${def.unit}` : ''}`] as const] : []));
    readout.textContent = shownOuts.map(([def, v]) => `${def.label} ${v}`).join(' · ');
    spokenReadout.textContent = shownOuts.map(([def, v]) => `${def.spoken ?? def.label} ${v}`).join(', ');
    data.setColumns(columns(out));
    data.setRows(view.rows(target, out));
    data.setNote(view.note?.(target, out) ?? '');
    announcer.say(describe(out), dragging ? DRAG_IDLE : undefined);
    stopFollow();
    if (instant || reduced) return drawState({ ...target });
    const goal = { ...target };
    stopFollow = follow(pos(shown), pos(goal), (v) =>
      drawState({ ...goal, ...Object.fromEntries(eased.map((c, i) => [c, fromPos(defs[c]!, v[i]!)])) }),
    );
  }
  function setParam(name: string, value: number, instant: boolean) {
    const def = defs[name];
    if (!def) return;
    if (!interacted) {
      interacted = true;
      clearTimeout(hintTimer);
      stopHint();
      view.handle?.knob.nudge(0);
      view.handle?.knob.showHint(false);
    }
    target[name] = snap(def, value);
    sync();
    if (visible) render(instant);
    else dirty = true;
  }
  function hint() {
    if (hinted || interacted || !view.handle) return;
    hinted = true;
    const knob = view.handle.knob;
    if (reduced) return knob.showHint(true);
    hintTimer = setTimeout(() => {
      if (!interacted && visible) stopHint = nudge((dx) => knob.nudge(dx));
    }, HINT_DELAY);
  }

  sync();
  render(true);
  const io =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          visible = entries.some((e) => e.isIntersecting);
          if (!visible) return stopFollow();
          if (dirty) render(true);
          hint();
        })
      : undefined;
  if (io) {
    visible = false;
    io.observe(figure);
  } else hint();

  return {
    setParam,
    destroy() {
      io?.disconnect();
      stopFollow();
      stopHint();
      clearTimeout(hintTimer);
      announcer.destroy();
      for (const t of ['pointerup', 'pointercancel'] as const) window.removeEventListener(t, endDrag, { capture: true });
      view.destroy();
      for (const node of [drawing, row, foot, desc, data.wrap]) node.remove();
      alt?.classList.remove('xfig-sr');
      figure.removeAttribute('aria-describedby');
    },
  };
}
