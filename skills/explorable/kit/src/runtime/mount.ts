/**
 * Mount one live figure into its static shell: look up the model and the
 * figure kind, build the controls row, readout, live description and data
 * table, and keep them in sync. Updates pause while the figure is off screen.
 */
import { mountBars } from '../figures/bars.ts';
import { mountBits } from '../figures/bits.ts';
import type { FigureSpec } from '../doc/schema.ts';
import { format } from '../format.ts';
import { attentionScaling } from '../models/attention-scaling.ts';
import { bloomFilter } from '../models/bloom-filter.ts';
import { softmaxTemperature } from '../models/softmax-temperature.ts';
import { getModel, type FigureKind, type ModelDef, type ParamDef } from '../registry.ts';
import { createAnnouncer } from './announce.ts';
import { createChoice, createRange, createToggle, fromPos, snap, toPos } from './controls.ts';
import type { Handle } from './handle.ts';
import { HINT_DELAY, follow, nudge, reducedMotion } from './motion.ts';
import { createDataTable } from './table.ts';

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
  columns: string[] | ((p: Params, o: Outputs) => string[]);
  /** One-line summary appended to the table caption. */
  note?(p: Params, o: Outputs): string;
  /** Index of the column that names each row (a row header). */
  rowHeader?: number;
  rows(p: Params, o: Outputs): string[][];
  destroy(): void;
}

export type FigureMount = (drawing: HTMLElement, ctx: FigureCtx) => FigureView;
const KINDS: Partial<Record<FigureKind, FigureMount>> = { bars: mountBars, bits: mountBits };
/** Models registered by importing the runtime. */
export const BUILT_IN_MODELS = [softmaxTemperature, attentionScaling, bloomFilter] as unknown as readonly ModelDef[];

const noop = () => {};
const el = (tag: string, cls: string) => Object.assign(document.createElement(tag), { className: cls });

export interface MountOptions {
  /** Override `prefers-reduced-motion` detection (tests). */
  reducedMotion?: boolean;
}

/** Mount a live figure, or return undefined (the static shell stays) if its kind or model is not available. */
export function mountFigure(stage: HTMLElement, spec: FigureSpec, opts: MountOptions = {}) {
  const found = getModel(spec.model.id);
  const kind = KINDS[spec.kind];
  if (!found || !kind || 'expr' in spec.model) return undefined;
  const model: ModelDef = found;
  const figure = stage.closest('figure') ?? stage;
  const reduced = opts.reducedMotion ?? reducedMotion();
  const defs = model.params as Record<string, ParamDef>;
  const controls = spec.controls.filter((c) => defs[c]);
  const target: Params = Object.fromEntries(Object.entries(defs).map(([k, d]) => [k, d.default]));
  Object.assign(target, spec.model.params);
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
  const readout = el('p', 'xfig-readout');
  const desc = el('p', 'xfig-sr');
  desc.id = `${spec.id}-desc`;
  stage.append(drawing, row, foot, desc);

  const announcer = createAnnouncer(desc);
  type Make = (id: string, def: ParamDef, cb: (v: number, instant: boolean) => void, name: string) => { el: HTMLElement; set(v: number): void };
  const CONTROLS: Record<string, Make> = { range: createRange, toggle: createToggle, choice: createChoice };
  const ranges = controls.map((name) => {
    const make = CONTROLS[defs[name]!.control ?? 'range']!;
    return [name, make(`${spec.id}-${name}`, defs[name]!, (v, i) => setParam(name, v, i), name)] as const;
  });
  // Only sliders ease; a switch or a choice jumps.
  const eased = controls.filter((c) => (defs[c]!.control ?? 'range') === 'range');
  row.append(...ranges.map(([, r]) => r.el));
  const view = kind(drawing, { spec, model, setParam: (n, v, i) => setParam(n, v, i) });
  const columns = (o: Outputs) => (typeof view.columns === 'function' ? view.columns(target, o) : view.columns);
  const data = createDataTable(`${spec.id}-data`, `Data for: ${spec.title}`, columns(model.compute(target)), view.rowHeader);
  foot.append(data.button, readout);
  stage.append(data.table);

  const labels = spec.options?.labels;
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
    readout.textContent = spec.readouts
      .map((id) => [model.outputs[id], out[id]] as const)
      .flatMap(([def, v]) => (def && typeof v === 'number' ? [`${def.label} ${format(v, def.format)}${def.unit ? ` ${def.unit}` : ''}`] : []))
      .join(' · ');
    data.setColumns(columns(out));
    data.setRows(view.rows(target, out));
    data.setNote(view.note?.(target, out) ?? '');
    announcer.say(model.describe(target, out, Array.isArray(labels) ? labels : undefined));
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
      view.destroy();
      for (const node of [drawing, row, foot, desc, data.table]) node.remove();
      alt?.classList.remove('xfig-sr');
      figure.removeAttribute('aria-describedby');
    },
  };
}
