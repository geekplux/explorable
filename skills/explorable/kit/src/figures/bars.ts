/**
 * `bars`: a distribution over labelled items (docs/figures/attention.md).
 * Fixed 0–1 weight axis, direct labels, value labels, the top bar marked by a
 * filled ▼ plus "top" (never colour alone), and a ring knob on a track for
 * `options.handle`. Drawn in CSS pixels so text stays legible at any width.
 */
import { format } from '../format.ts';
import type { ParamDef } from '../registry.ts';
import { toPos } from '../runtime/controls.ts';
import { createHandle, svgEl } from '../runtime/handle.ts';
import type { FigureMount, FigureView, Outputs, Params } from '../runtime/mount.ts';

const nums = (v: unknown): number[] => (Array.isArray(v) ? v : []);
const ATTR = (el: Element, attrs: Record<string, string | number>) => {
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
};

/** Default log ticks: 1-2-5 values inside the range. */
function defaultTicks(def: ParamDef): number[] {
  if (def.scale !== 'log') return [def.min, (def.min + def.max) / 2, def.max];
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(def.min)); e <= Math.ceil(Math.log10(def.max)); e++) {
    for (const m of [1, 2, 5]) if (m * 10 ** e >= def.min && m * 10 ** e <= def.max) out.push(Number((m * 10 ** e).toPrecision(3)));
  }
  return out;
}

export const mountBars: FigureMount = (el, { spec, model, descId, setParam }) => {
  const o = spec.options ?? {};
  const labels = Array.isArray(o.labels) ? o.labels : [];
  const label = (i: number) => labels[i] ?? `item ${i + 1}`;
  const handleName = typeof o.handle === 'string' ? o.handle : spec.controls[0];
  const handleDef = handleName ? (model.params as Record<string, ParamDef>)[handleName] : undefined;

  const chip = typeof o.query === 'string' ? Object.assign(document.createElement('p'), { className: 'xfig-chip', textContent: `query: ${o.query}` }) : undefined;
  if (chip) el.before(chip);
  const svg = svgEl(el, 'svg', { class: 'xfig-svg' });
  const axis = svgEl(svg, 'g', { class: 'xfig-axis', 'aria-hidden': 'true' });
  const plot = svgEl(svg, 'g', { role: 'img', 'aria-labelledby': descId });
  const trackG = svgEl(svg, 'g', { class: 'xfig-track', 'aria-hidden': 'true' });
  const knob = handleDef ? createHandle(svg, { def: handleDef, onChange: (v, instant) => setParam(handleName!, v, instant) }) : undefined;

  let bars: { rect: SVGRectElement; value: SVGTextElement; name: SVGTextElement }[] = [];
  const marker = svgEl(plot, 'g', { class: 'xfig-top', 'aria-hidden': 'true' });
  svgEl(marker, 'path', { d: 'M-17 0h10l-5 7z' });
  svgEl(marker, 'text', { x: -4, y: 7 }).textContent = 'top';
  let g = { w: 640, h: 360, L: 44, R: 628, top: 44, bottom: 282, trackY: 326 };
  let last: [Params, Outputs] | undefined;

  function layout() {
    const w = Math.round(el.clientWidth) || 640;
    const h = Math.round(el.clientHeight) || 360;
    g = { w, h, L: 44, R: w - 12, top: 44, bottom: h - 78, trackY: h - 34 };
    ATTR(svg, { viewBox: `0 0 ${w} ${h}`, width: '100%', height: '100%' });
    axis.replaceChildren();
    for (const y of [0, 0.25, 0.5, 0.75, 1]) {
      const py = g.bottom - y * (g.bottom - g.top);
      svgEl(axis, 'path', { class: y ? 'xfig-grid' : 'xfig-baseline', d: `M${g.L} ${py}H${g.R}` });
      if (y * 2 === Math.round(y * 2)) svgEl(axis, 'text', { x: g.L - 6, y: py + 4, 'text-anchor': 'end' }).textContent = String(y);
    }
    svgEl(axis, 'text', { x: 4, y: g.top - 24 }).textContent = 'weight';
    trackG.replaceChildren();
    if (knob && handleDef && handleName) {
      const [x0, x1, y] = [g.L + 12, g.R - 12, g.trackY];
      knob.layout(x0, x1, y);
      svgEl(trackG, 'text', { x: g.L - 6, y: y + 4, 'text-anchor': 'end', class: 'xfig-track-label' }).textContent = handleName;
      svgEl(trackG, 'path', { class: 'xfig-track-line', d: `M${x0} ${y}H${x1}` });
      const ticks = Array.isArray(o.ticks) ? o.ticks.map(Number) : defaultTicks(handleDef);
      for (const t of ticks) {
        const x = x0 + toPos(handleDef, t) * (x1 - x0);
        svgEl(trackG, 'path', { class: 'xfig-tick', d: `M${x} ${y + 11}v4` });
        svgEl(trackG, 'text', { x, y: y + 28, 'text-anchor': 'middle' }).textContent = String(t);
      }
    }
    bars = [];
    if (last) draw(...last);
  }

  function draw(p: Params, out: Outputs) {
    last = [p, out];
    const weights = nums(out.weights);
    const top = typeof out.topIndex === 'number' ? out.topIndex : -1;
    const slot = (g.R - g.L) / Math.max(1, weights.length);
    const bw = Math.min(56, slot * 0.6);
    if (bars.length !== weights.length) {
      plot.querySelectorAll('.xfig-bar-g').forEach((n) => n.remove());
      bars = weights.map((_, i) => {
        const bg = svgEl(plot, 'g', { class: 'xfig-bar-g' });
        const name = svgEl(bg, 'text', { class: 'xfig-bar-label', 'text-anchor': 'middle' });
        name.textContent = label(i);
        return { rect: svgEl(bg, 'rect', { class: 'xfig-bar' }), value: svgEl(bg, 'text', { class: 'xfig-bar-value', 'text-anchor': 'middle' }), name };
      });
      plot.append(marker);
    }
    weights.forEach((wt, i) => {
      const b = bars[i]!;
      const cx = g.L + slot * (i + 0.5);
      const y = g.bottom - Math.min(1, Math.max(0, wt)) * (g.bottom - g.top);
      ATTR(b.rect, { x: cx - bw / 2, y, width: bw, height: g.bottom - y });
      ATTR(b.value, { x: cx, y: y - 6, class: `xfig-bar-value${i === top ? ' is-top' : ''}` });
      b.value.textContent = format(wt, 'fixed2');
      ATTR(b.name, { x: cx, y: g.bottom + 18 });
      if (i === top) ATTR(marker, { transform: `translate(${cx} ${y - 30})` });
    });
    if (knob && handleDef && handleName) knob.place(toPos(handleDef, p[handleName]!));
  }

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : undefined;
  ro?.observe(el);
  layout();

  const view: FigureView = {
    draw,
    handle: knob && handleName ? { name: handleName, knob } : undefined,
    columns: ['#', typeof o.itemName === 'string' ? o.itemName : 'item', 'score', 'weight'],
    rows: (_p, out) =>
      nums(out.weights).map((w, i) => [String(i + 1), label(i), format(nums(out.scores)[i] ?? NaN, 'fixed2'), format(w, 'fixed3')]),
    destroy() {
      ro?.disconnect();
      chip?.remove();
      svg.remove();
    },
  };
  return view;
};
