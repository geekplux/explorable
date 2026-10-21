/**
 * Parameter value rules shared by the native slider, the on-figure knob
 * (docs/figures/samples.md §5) and DOM-free code such as the Worker.
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
