/**
 * The labelled native controls (range, toggle, choice). The value rules live
 * in values.ts (DOM-free) and are re-exported here.
 */
import { escapeHtml, mathVars } from '../doc/inline.ts';
import type { ParamDef } from '../registry.ts';
import { fromPos, keyValue, showValue, snap, toPos, valueOnly } from './values.ts';

export * from './values.ts';

const RANGE_STEPS = 1000;

/** A labelled native `<input type=range>` with an `<output>`, driven in track positions. */
export function createRange(id: string, def: ParamDef, onChange: (v: number, instant: boolean) => void, name = def.symbol ?? def.label) {
  const el = document.createElement('div');
  el.className = 'xfig-control';
  const [label, input, output] = [document.createElement('label'), document.createElement('input'), document.createElement('output')];
  label.htmlFor = input.id = id;
  label.innerHTML = mathVars(escapeHtml(def.label));
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
      // The value only (with its unit): the label already names the slider, so a reader would hear it twice.
      input.setAttribute('aria-valuetext', valueOnly(def, v));
      output.textContent = `${name} = ${showValue(def, v)}`;
    },
  };
}

/** A `role="switch"` button for a 0/1 param; the knob's position shows the state (not colour alone). */
export function createToggle(id: string, def: ParamDef, onChange: (v: number, instant: boolean) => void) {
  const el = Object.assign(document.createElement('div'), { className: 'xfig-control' });
  const button = Object.assign(document.createElement('button'), { type: 'button', id, className: 'xfig-switch' });
  button.setAttribute('role', 'switch');
  if (def.spoken) button.setAttribute('aria-label', def.spoken);
  button.append(Object.assign(document.createElement('span'), { className: 'xfig-switch-track' }), Object.assign(document.createElement('span'), { innerHTML: mathVars(escapeHtml(def.label)) }));
  el.append(button);
  let value = def.default;
  button.addEventListener('click', () => onChange(value ? def.min : def.max, true));
  return {
    el,
    set(v: number) {
      value = v;
      button.setAttribute('aria-checked', String(v === def.max));
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
