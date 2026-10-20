/**
 * Parameter value rules shared by the native slider and the on-figure knob
 * (docs/figures/samples.md §5), plus the labelled native range control.
 */
import type { ParamDef } from '../registry.ts';

const decimals = (step: number) => (String(step).split('.')[1] ?? '').length;
const clamp = (v: number, def: ParamDef) => Math.min(def.max, Math.max(def.min, v));
const isLog = (def: ParamDef) => def.scale === 'log' && def.min > 0;

/** Clamp to [min, max] and round to `step`. */
export function snap(def: ParamDef, v: number): number {
  const stepped = def.min + Math.round((clamp(v, def) - def.min) / def.step) * def.step;
  return clamp(Number(stepped.toFixed(decimals(def.step))), def);
}

/** Track position in [0, 1] (log params use log space). */
export function toPos(def: ParamDef, v: number): number {
  const c = clamp(v, def);
  return isLog(def) ? Math.log(c / def.min) / Math.log(def.max / def.min) : (c - def.min) / (def.max - def.min);
}

/** Unsnapped value for a track position in [0, 1]. */
export function fromPos(def: ParamDef, pos: number): number {
  const p = Math.min(1, Math.max(0, pos));
  return isLog(def) ? def.min * (def.max / def.min) ** p : def.min + p * (def.max - def.min);
}

/** The value after a key press, or undefined if the key is not a slider key. */
export function keyValue(def: ParamDef, v: number, key: string): number | undefined {
  if (key === 'Home') return def.min;
  if (key === 'End') return def.max;
  const dir = { ArrowRight: 1, ArrowUp: 1, PageUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: -1 }[key];
  if (!dir) return undefined;
  const big = key.startsWith('Page');
  if (!isLog(def)) return snap(def, v + dir * (big ? (def.pageStep ?? 10 * def.step) : def.step));
  const next = snap(def, fromPos(def, toPos(def, v) + dir * (big ? 0.1 : 0.01)));
  return next === v ? snap(def, v + dir * def.step) : next;
}

/** "1.00": the value at the precision of its step. */
export const showValue = (def: ParamDef, v: number) => v.toFixed(decimals(def.step));
/** "1.00" plus the unit in words, if any: aria-valuetext where the name already says the label. */
export const valueOnly = (def: ParamDef, v: number) => `${showValue(def, v)}${def.unit ? ` ${def.unit}` : ''}`;
/** The label in words, for assistive tech. */
export const spoken = (def: ParamDef) => def.spoken ?? def.label;
/** "temperature 1.00" (plus the unit in words, if any) for aria-valuetext. */
export const valueText = (def: ParamDef, v: number) => `${spoken(def)} ${valueOnly(def, v)}`;

const RANGE_STEPS = 1000;

/** A labelled native `<input type=range>` with an `<output>`, driven in track positions. */
export function createRange(id: string, def: ParamDef, onChange: (v: number, instant: boolean) => void, name = def.symbol ?? def.label) {
  const el = document.createElement('div');
  el.className = 'xfig-control';
  const [label, input, output] = [document.createElement('label'), document.createElement('input'), document.createElement('output')];
  label.htmlFor = input.id = id;
  label.textContent = def.label;
  output.setAttribute('for', id);
  // <output> is an implicit live region; the throttled description speaks instead.
  output.setAttribute('aria-live', 'off');
  Object.assign(input, { type: 'range', min: '0', max: String(RANGE_STEPS), step: '1' });
  // Symbols such as "d_k" are read out badly ("d underscore k"); name the slider in words.
  if (def.spoken) input.setAttribute('aria-label', def.spoken);
  el.append(label, input, output);
  let value = def.default;
  input.addEventListener('input', () => onChange(snap(def, fromPos(def, Number(input.value) / RANGE_STEPS)), true));
  input.addEventListener('keydown', (e) => {
    const next = keyValue(def, value, e.key);
    if (next === undefined) return;
    e.preventDefault();
    onChange(next, false);
  });
  return {
    el,
    set(v: number) {
      value = v;
      input.value = String(Math.round(toPos(def, v) * RANGE_STEPS));
      input.setAttribute('aria-valuetext', valueText(def, v));
      output.textContent = `${name} = ${showValue(def, v)}`;
    },
  };
}

/** A `role="switch"` button for a 0/1 param; the visible state reads "on" / "off" as well as the knob position. */
export function createToggle(id: string, def: ParamDef, onChange: (v: number, instant: boolean) => void) {
  const el = Object.assign(document.createElement('div'), { className: 'xfig-control' });
  const button = Object.assign(document.createElement('button'), { type: 'button', id, className: 'xfig-switch' });
  button.setAttribute('role', 'switch');
  if (def.spoken) button.setAttribute('aria-label', def.spoken);
  const state = Object.assign(document.createElement('span'), { className: 'xfig-switch-state' });
  state.setAttribute('aria-hidden', 'true');
  button.append(Object.assign(document.createElement('span'), { className: 'xfig-switch-track' }), def.label, state);
  el.append(button);
  let value = def.default;
  button.addEventListener('click', () => onChange(value ? def.min : def.max, true));
  return {
    el,
    set(v: number) {
      value = v;
      button.setAttribute('aria-checked', String(v === def.max));
      state.textContent = v === def.max ? 'on' : 'off';
    },
  };
}

/** A radio group (`<fieldset>` + `<legend>`) for a `choice` param; the value is the option index. */
export function createChoice(id: string, def: ParamDef, onChange: (v: number, instant: boolean) => void) {
  const el = Object.assign(document.createElement('fieldset'), { className: 'xfig-control xfig-choice' });
  el.append(Object.assign(document.createElement('legend'), { textContent: def.label }));
  const inputs = (def.choices ?? []).map((text, i) => {
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: id, id: `${id}-${i}`, value: String(i) });
    input.addEventListener('change', () => input.checked && onChange(i, true));
    const label = document.createElement('label');
    label.append(input, text);
    el.append(label);
    return input;
  });
  return {
    el,
    set(v: number) {
      inputs.forEach((input, i) => (input.checked = i === v));
    },
  };
}
