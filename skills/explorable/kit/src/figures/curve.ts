/**
 * `curve`: up to three series over one x param, with a ring knob that rides
 * the primary series (docs/figures/bloom-filter.md and diffusion.md, Fig 2).
 * Series differ by line style and marker shape as well as hue (solid with ●,
 * dashed with ■, dash-dot with ▲); a reference series is dotted ink. Every
 * line is labelled directly, vertical markers carry their own labels, and
 * paper halos keep crossing lines apart. Series are `number[]` outputs sampled
 * at evenly spaced positions along the x track (for diffusion, index = t).
 */
import { format } from '../format.ts';
import { exprCurveOptions } from '../models/expr-curve.ts';
import { fillTemplate, type ParamDef } from '../registry.ts';
import { showValue, toPos } from '../runtime/controls.ts';
import { createHandle, svgEl } from '../runtime/handle.ts';
import type { FigureMount, FigureView, Outputs, Params } from '../runtime/mount.ts';

const nums = (v: unknown): number[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const ATTR = (el: Element, attrs: Record<string, string | number>) => {
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
};
const f1 = (v: number) => v.toFixed(1);
/** Marker shapes by series style: circle, square, triangle. */
const SHAPES = [
  (x: number, y: number, r: number) => `M${f1(x - r)} ${f1(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`,
  (x: number, y: number, r: number) => `M${f1(x - r)} ${f1(y - r)}h${2 * r}v${2 * r}h${-2 * r}z`,
  (x: number, y: number, r: number) => `M${f1(x)} ${f1(y - 1.2 * r)}l${1.1 * r} ${2 * r}h${-2.2 * r}z`,
];
/** A round step near range / 5 (1, 2 or 5 × a power of ten). */
const niceStep = (r: number) => {
  const p = 10 ** Math.floor(Math.log10(r / 5));
  const m = r / 5 / p;
  return p * (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10);
};
const lastFinite = (s: readonly number[]) => s.findLast(Number.isFinite) ?? NaN;
/** Rendered text width, or an estimate where layout is unavailable (tests). */
const textWidth = (t: SVGTextElement) => {
  try {
    return t.getComputedTextLength() || (t.textContent ?? '').length * 7;
  } catch {
    return (t.textContent ?? '').length * 7;
  }
};

/** A series sampled at evenly spaced track positions, read at `pos` in [0, 1] (linear in between). */
export function yAt(s: readonly number[], pos: number): number {
  if (s.length < 2) return s[0] ?? NaN;
  const f = Math.min(1, Math.max(0, pos)) * (s.length - 1);
  const i = Math.min(s.length - 2, Math.floor(f));
  return s[i]! + (s[i + 1]! - s[i]!) * (f - i);
}

export const mountCurve: FigureMount = (el, { spec, model, setParam }) => {
  const o = { ...('expr' in spec.model ? exprCurveOptions(spec) : {}), ...spec.options };
  const defs = model.params as Record<string, ParamDef>;
  const xName = String(o.xParam ?? spec.controls[0]);
  if (!defs[xName]) throw new Error(`curve: x param "${xName}" is not a model param`);
  const xDef: ParamDef = defs[xName];
  const labels = strs(o.seriesLabels);
  let style = 0;
  const series = strs(o.series).slice(0, 3).map((id, i) => {
    const ref = id === o.refSeries;
    return { id, ref, s: ref ? -1 : style++, label: labels[i] ?? id };
  });
  const primaryId = series.find((d) => d.s === 0)?.id ?? '';
  const markers = strs(o.markers);
  const markerLabels = strs(o.markerLabels);
  const columnIds = strs(o.tableColumns).filter((id) => model.outputs[id]);
  const tableStep = typeof o.tableStep === 'number' ? o.tableStep : xDef.step;
  const markEvery = typeof o.markEvery === 'number' ? o.markEvery : niceStep(xDef.max - xDef.min);
  // The y range: declared, else the first state's data (fixed, so the axis never jumps).
  const first = model.compute(Object.fromEntries(Object.entries(defs).map(([k, d]) => [k, d.default])));
  const data = series.flatMap((d) => nums(first[d.id])).filter(Number.isFinite);
  const y0 = typeof o.yMin === 'number' ? o.yMin : Math.min(0, ...data);
  const y1 = typeof o.yMax === 'number' ? o.yMax : Math.max(y0 + 1e-9, ...data);

  // The legend names each line style once; the direct labels on the chart carry the same text.
  const legend = Object.assign(document.createElement('ul'), { className: 'xfig-legend' });
  legend.setAttribute('aria-hidden', 'true');
  if (series.length > 1) el.before(legend);
  const svg = svgEl(el, 'svg', { class: 'xfig-svg xfig-curve' });
  const clip = svgEl(svgEl(svgEl(svg, 'defs'), 'clipPath', { id: `${spec.id}-clip` }), 'rect');
  const axis = svgEl(svg, 'g', { class: 'xfig-axis', 'aria-hidden': 'true' });
  const plot = svgEl(svg, 'g', { role: 'img', 'aria-label': `${spec.title}: line chart of ${series.map((d) => d.label).join(' and ')}` });
  const lines = svgEl(plot, 'g', { 'clip-path': `url(#${spec.id}-clip)` });
  // The primary series is drawn last, so it sits on top and its halo cuts the others where they cross.
  const parts = new Map(
    series.toReversed().map((d) => [d.id, {
      halo: svgEl(lines, 'path', { class: 'xfig-line-halo' }),
      line: svgEl(lines, 'path', { class: d.ref ? 'xfig-ref' : `xfig-line xfig-s${d.s}` }),
      marks: svgEl(lines, 'path', { class: `xfig-marks xfig-s${d.s}` }),
    }] as const),
  );
  const markerEls = markers.map(() => ({
    line: svgEl(plot, 'path', { class: 'xfig-marker-line' }),
    dot: svgEl(plot, 'path', { class: 'xfig-meet' }),
    text: svgEl(plot, 'text', { class: 'xfig-marker-label' }),
  }));
  const drop = svgEl(plot, 'path', { class: 'xfig-drop' });
  const atKnob = series.filter((d) => d.s > 0).map((d) => [d, svgEl(plot, 'path', { class: `xfig-marks xfig-s${d.s}` })] as const);
  const endLabels = series.map((d) => svgEl(plot, 'text', { class: d.ref ? 'xfig-ref-label' : 'xfig-series-label', 'text-anchor': 'end' }));
  const legendText = series.map((d) => {
    const li = legend.appendChild(document.createElement('li'));
    const sw = svgEl(li, 'svg', { class: 'xfig-swatch', width: 30, height: 12, viewBox: '0 0 30 12' });
    svgEl(sw, 'path', { class: d.ref ? 'xfig-ref' : `xfig-line xfig-s${d.s}`, d: 'M2 6H28' });
    if (!d.ref) svgEl(sw, 'path', { class: `xfig-marks xfig-s${d.s}`, d: SHAPES[d.s]!(15, 6, 3.5) });
    return li.appendChild(document.createElement('span'));
  });
  const knob = createHandle(svg, { def: xDef, onChange: (v, instant) => setParam(xName, v, instant) });

  let g = { w: 640, L: 44, R: 622, top: 46, bottom: 316 };
  const px = (pos: number) => g.L + pos * (g.R - g.L);
  const py = (v: number) => g.bottom - Math.min(1.5, Math.max(-0.5, (v - y0) / (y1 - y0))) * (g.bottom - g.top);
  const yTick = (v: number) => (o.yFormat === 'percent' ? `${Math.round(v * 100)}%` : String(Number(v.toPrecision(3))).replace('-', '−'));
  const linePath = (s: readonly number[]) => {
    const n = s.length;
    const stride = Math.max(1, Math.floor(n / 300));
    let [d, pen] = ['', false];
    for (let i = 0; i < n; i = i < n - 1 ? Math.min(n - 1, i + stride) : n) {
      const v = s[i]!;
      if (Number.isFinite(v)) d += `${pen ? 'L' : 'M'}${f1(px(i / (n - 1)))} ${f1(py(v))}`;
      pen = Number.isFinite(v);
    }
    return d;
  };
  const markPath = (s: readonly number[], shape: number, r: number) => {
    let d = '';
    for (let k = Math.ceil(xDef.min / markEvery), x = k * markEvery; x <= xDef.max + 1e-9; x = ++k * markEvery) {
      const v = yAt(s, toPos(xDef, x));
      if (Number.isFinite(v)) d += SHAPES[shape]!(px(toPos(xDef, x)), py(v), r);
    }
    return d;
  };
  let last: [Params, Outputs] | undefined;

  function layout() {
    // Unrounded size: one SVG unit is exactly one CSS px, so 44-unit hit areas are ≥ 44 px.
    const box = el.getBoundingClientRect();
    const [w, h] = [box.width || 640, box.height || 360];
    // Above the plot: the y-axis title, then a row for marker labels. Below: x tick labels, then the x-axis title.
    g = { w, L: 44, R: w - 18, top: markers.length ? 50 : 30, bottom: h - 44 };
    ATTR(svg, { viewBox: `0 0 ${w} ${h}`, width: '100%', height: '100%' });
    ATTR(clip, { x: g.L - 6, y: g.top - 6, width: g.R - g.L + 12, height: g.bottom - g.top + 8 });
    axis.replaceChildren();
    for (let i = 0; i <= 4; i++) {
      const v = y0 + (i / 4) * (y1 - y0);
      svgEl(axis, 'path', { class: i ? 'xfig-grid' : 'xfig-baseline', d: `M${g.L} ${py(v)}H${g.R}` });
      svgEl(axis, 'text', { x: g.L - 6, y: py(v) + 4, 'text-anchor': 'end' }).textContent = yTick(v);
    }
    svgEl(axis, 'text', { x: 4, y: 16 }).textContent = String(o.yLabel ?? '');
    const step = niceStep(xDef.max - xDef.min);
    const ticks = Array.isArray(o.ticks)
      ? o.ticks.map(Number)
      : Array.from({ length: Math.floor(xDef.max / step) - Math.ceil(xDef.min / step) + 1 }, (_, i) => (Math.ceil(xDef.min / step) + i) * step);
    for (const t of ticks) {
      const x = px(toPos(xDef, t));
      svgEl(axis, 'path', { class: 'xfig-tick', d: `M${x} ${g.bottom}v4` });
      svgEl(axis, 'text', { x, y: g.bottom + 17, 'text-anchor': 'middle' }).textContent = format(t, Number.isInteger(t) ? 'int' : 'fixed2');
    }
    svgEl(axis, 'text', { x: g.R, y: g.bottom + 36, 'text-anchor': 'end' }).textContent = xDef.label;
    // The whole plot is the knob's pointer band: press anywhere to move along the curve.
    knob.layout(px(0), px(1), g.bottom, [g.top - 6, g.bottom + 6]);
    if (last) draw(...last);
  }

  /** Place a marker label in the row above the plot: right of its line (left if it would run out), or beside an edge ▶ / ◀. */
  function rowLabel(t: SVGTextElement, mx: number, side: number) {
    t.classList.remove('is-tight');
    if (textWidth(t) > g.w - 8 - (side ? 14 : 0)) t.classList.add('is-tight');
    const tw = textWidth(t);
    const tx = side > 0 ? mx - 10 - tw : side < 0 ? mx + 10 : mx + 5 + tw > g.w - 4 ? mx - 5 - tw : mx + 5;
    ATTR(t, { x: f1(Math.max(4, Math.min(g.w - 4 - tw, tx))), y: g.top - 15 });
  }

  function draw(p: Params, out: Outputs) {
    last = [p, out];
    const pos = toPos(xDef, p[xName] ?? xDef.default);
    const kx = px(pos);
    const primary = nums(out[primaryId]);
    const kv = yAt(primary, pos);
    const ky = Number.isFinite(kv) ? py(kv) : g.bottom;
    series.forEach((d, i) => {
      const s = nums(out[d.id]);
      const part = parts.get(d.id)!;
      const path = linePath(s);
      for (const n of [part.halo, part.line]) n.setAttribute('d', path);
      part.marks.setAttribute('d', d.ref ? '' : markPath(s, d.s, 3.5));
      legendText[i]!.textContent = endLabels[i]!.textContent = fillTemplate(d.label, model, p, out);
    });
    // Direct labels at the right end, clear of their own line: the highest line's label above it (below if there is no room), the others below
    // theirs (above if there is no room); then ≥ 16 px apart.
    let prev = -Infinity;
    series
      .map((d, i) => {
        const [t, s] = [endLabels[i]!, nums(out[d.id])];
        const [a, b] = [(g.R - 8 - textWidth(t) - g.L) / (g.R - g.L), (g.R - g.L - 8) / (g.R - g.L)];
        const ys = Array.from({ length: 9 }, (_, j) => yAt(s, a + ((b - a) * j) / 8)).filter(Number.isFinite).map(py);
        return { t, end: py(lastFinite(s)), hi: Math.min(...ys), lo: Math.max(...ys) };
      })
      .toSorted((u, v) => u.end - v.end)
      .forEach((e, i) => {
        const [above, below] = [e.hi - 5, e.lo + 15];
        const y = i === 0 ? (above - 11 >= g.top ? above : below) : below <= g.bottom - 4 ? below : above;
        prev = Math.max(y, prev + 16);
        ATTR(e.t, { x: g.R - 8, y: f1(prev) });
      });
    markers.forEach((id, i) => {
      const m = markerEls[i]!;
      const xv = Number(out[id]);
      const side = xv < xDef.min ? -1 : xv > xDef.max ? 1 : 0;
      const mpos = toPos(xDef, xv);
      const [mx, row] = [px(mpos), g.top - 15];
      m.text.textContent = `${fillTemplate(markerLabels[i] ?? '', model, p, out, { marker: xv })}${side ? ' (off the chart)' : ''}`;
      m.line.setAttribute('d', side ? '' : `M${f1(mx)} ${g.top}V${g.bottom}`);
      // On the chart, a filled ● where the marker meets the primary line (filled: a ring means draggable); off it, an edge ▶ or ◀.
      const mv = yAt(primary, mpos);
      m.dot.setAttribute('d', side ? `M${f1(mx - 4 * side)} ${row - 9}l${8 * side} 5l${-8 * side} 5z` : Number.isFinite(mv) ? SHAPES[0]!(mx, py(mv), 4) : '');
      rowLabel(m.text, mx, side);
    });
    for (const [d, at] of atKnob) {
      const v = yAt(nums(out[d.id]), pos);
      at.setAttribute('d', Number.isFinite(v) ? SHAPES[d.s]!(kx, py(v), 5) : '');
    }
    drop.setAttribute('d', `M${f1(kx)} ${f1(ky)}V${g.bottom}`);
    knob.place(pos, ky);
  }

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : undefined;
  ro?.observe(el);
  layout();

  const xHead = xDef.symbol ?? xName;
  const view: FigureView = {
    draw,
    handle: { name: xName, knob },
    rowHeader: 0,
    columns: [xHead, ...columnIds.map((id) => `${model.outputs[id]!.label}${model.outputs[id]!.unit ? ` (${model.outputs[id]!.unit})` : ''}`)],
    note: (p) => `the knob is at ${xHead} = ${showValue(xDef, p[xName]!)}`,
    // Sampled points around the knob: x − 5 … x + 5 steps, clipped to the range.
    rows: (p) =>
      Array.from({ length: 11 }, (_, i) => Number((p[xName]! + (i - 5) * tableStep).toFixed(9)))
        .filter((x) => x >= xDef.min && x <= xDef.max)
        .map((x) => {
          const out = model.compute({ ...p, [xName]: x });
          return [showValue(xDef, x), ...columnIds.map((id) => format(Number(out[id]), model.outputs[id]!.format))];
        }),
    destroy() {
      ro?.disconnect();
      legend.remove();
      svg.remove();
    },
  };
  return view;
};
