/**
 * `histogram`: a density histogram that morphs with one param
 * (docs/figures/diffusion.md, Fig 1). Fixed 0–1 density axis, cobalt bars with
 * an ink outline, a dotted ink N(0, 1) reference labelled directly, an
 * optional dashed ghost of the t = 0 histogram, a ±2σ bracket under the axis, and a ring knob on
 * a ticked scrubber. Drawn in CSS pixels so text stays legible at any width.
 */
import { format } from '../format.ts';
import { BINS, BIN_W, X_MAX, X_MIN, normalPdf } from '../models/diffusion-forward.ts';
import type { ParamDef } from '../registry.ts';
import { toPos } from '../runtime/controls.ts';
import { createHandle, svgEl } from '../runtime/handle.ts';
import type { FigureMount, FigureView, Outputs, Params } from '../runtime/mount.ts';

const nums = (v: unknown): number[] => (Array.isArray(v) ? v : []);
const ATTR = (el: Element, attrs: Record<string, string | number>) => {
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
};
const edge = (j: number) => X_MIN + j * BIN_W;

export const mountHistogram: FigureMount = (el, { spec, model, setParam }) => {
  const o = spec.options ?? {};
  const handleName = typeof o.handle === 'string' ? o.handle : spec.controls[0];
  const handleDef = handleName ? (model.params as Record<string, ParamDef>)[handleName] : undefined;
  const refLabel = typeof o.refLabel === 'string' ? o.refLabel : 'N(0, 1)';

  // The chip repeats the drawn state; the readout and live description carry it for assistive tech.
  const chip = Object.assign(document.createElement('p'), { className: 'xfig-chip' });
  chip.setAttribute('aria-hidden', 'true');
  el.before(chip);
  const svg = svgEl(el, 'svg', { class: 'xfig-svg xfig-hist' });
  const axis = svgEl(svg, 'g', { class: 'xfig-axis', 'aria-hidden': 'true' });
  const plot = svgEl(svg, 'g', { role: 'img', 'aria-label': `${spec.title}: histogram with the ${refLabel} reference curve` });
  const barsG = svgEl(plot, 'g');
  const bars = Array.from({ length: BINS }, () => svgEl(barsG, 'rect', { class: 'xfig-bar' }));
  // Paper halos under the dashed ghost and the dotted reference keep them ≥ 3:1 where they cross bars.
  const ghostHalo = o.ghost === true ? svgEl(plot, 'path', { class: 'xfig-line-halo' }) : undefined;
  const ghost = o.ghost === true ? svgEl(plot, 'path', { class: 'xfig-ghost' }) : undefined;
  const refHalo = svgEl(plot, 'path', { class: 'xfig-line-halo' });
  const ref = svgEl(plot, 'path', { class: 'xfig-ref' });
  const ghostText = ghost ? svgEl(plot, 'text', { class: 'xfig-ghost-label', 'text-anchor': 'middle' }) : undefined;
  if (ghostText) ghostText.textContent = 'data (t = 0)';
  const refText = svgEl(plot, 'text', { class: 'xfig-ref-label' });
  refText.textContent = refLabel;
  const trackG = svgEl(svg, 'g', { class: 'xfig-track', 'aria-hidden': 'true' });
  const knob = handleDef ? createHandle(svg, { def: handleDef, onChange: (v, instant) => setParam(handleName!, v, instant) }) : undefined;

  let g = { L: 40, R: 628, top: 30, bottom: 252 };
  // The x domain starts 12 px right of the y axis, so the "0" density label and the "−4" tick label never meet.
  const px = (x: number) => g.L + 12 + ((x - X_MIN) / (X_MAX - X_MIN)) * (g.R - g.L - 12);
  const py = (d: number) => g.bottom - Math.min(1, Math.max(0, d)) * (g.bottom - g.top);
  let last: [Params, Outputs] | undefined;

  function layout() {
    // Unrounded size: one SVG unit is exactly one CSS px, so 44-unit hit areas are ≥ 44 px.
    const box = el.getBoundingClientRect();
    const [w, h] = [box.width || 640, box.height || 360];
    // Below the plot: x tick labels, the ±2σ bracket and its label, then the scrubber with room above for the "drag" hint.
    g = { L: 40, R: w - 12, top: 30, bottom: h - 114 };
    const trackY = h - 34;
    ATTR(svg, { viewBox: `0 0 ${w} ${h}`, width: '100%', height: '100%' });
    axis.replaceChildren();
    for (const d of [0, 0.25, 0.5, 0.75, 1]) {
      svgEl(axis, 'path', { class: d ? 'xfig-grid' : 'xfig-baseline', d: `M${g.L} ${py(d)}H${g.R}` });
      svgEl(axis, 'text', { x: g.L - 6, y: py(d) + 4, 'text-anchor': 'end' }).textContent = String(d);
    }
    svgEl(axis, 'text', { x: 4, y: g.top - 14 }).textContent = 'density';
    for (let x = X_MIN; x <= X_MAX; x++) {
      svgEl(axis, 'path', { class: 'xfig-tick', d: `M${px(x)} ${g.bottom}v4` });
      svgEl(axis, 'text', { x: px(x), y: g.bottom + 17, 'text-anchor': 'middle' }).textContent = format(x, 'int');
    }
    // ±2σ of N(0, 1): a bracket in the free row under the tick labels (x = ±2 are bin edges, so marks over the bars get lost), named at its middle.
    const by = g.bottom + 26;
    svgEl(axis, 'path', { class: 'xfig-sigma', d: `M${px(-2)} ${by - 5}V${by}H${px(2)}V${by - 5}` });
    svgEl(axis, 'text', { class: 'xfig-sigma-label', x: px(0), y: by + 13, 'text-anchor': 'middle' }).textContent = '±2σ of N(0, 1)';
    const curve = Array.from({ length: 161 }, (_, i) => X_MIN + i * 0.05).map((x) => `${px(x).toFixed(1)} ${py(normalPdf(x)).toFixed(1)}`);
    for (const path of [refHalo, ref]) ATTR(path, { d: `M${curve.join('L')}` });
    // Just right of the peak; on a narrow plot that is over the +1.5 clump, so centre it above the peak instead (no bar tops 0.46 there).
    const narrow = g.R - g.L < 400;
    ATTR(refText, narrow ? { x: px(0), y: py(0.5), 'text-anchor': 'middle' } : { x: px(0.45), y: py(0.42), 'text-anchor': 'start' });
    const bw = (g.R - g.L - 12) / BINS;
    bars.forEach((b, j) => ATTR(b, { x: px(edge(j)), width: bw }));

    trackG.replaceChildren();
    if (knob && handleDef && handleName) {
      const [x0, x1] = [g.L + 12, g.R - 12];
      knob.layout(x0, x1, trackY);
      svgEl(trackG, 'text', { x: g.L - 6, y: trackY + 4, 'text-anchor': 'end', class: 'xfig-track-label' }).textContent = handleDef.symbol ?? handleName;
      svgEl(trackG, 'path', { class: 'xfig-track-line', d: `M${x0} ${trackY}H${x1}` });
      const ticks = Array.isArray(o.ticks) ? o.ticks.map(Number) : [handleDef.min, handleDef.max];
      for (const t of ticks) {
        const x = x0 + toPos(handleDef, t) * (x1 - x0);
        svgEl(trackG, 'path', { class: 'xfig-tick', d: `M${x} ${trackY + 11}v4` });
        svgEl(trackG, 'text', { x, y: trackY + 28, 'text-anchor': 'middle' }).textContent = String(t);
      }
    }
    if (last) draw(...last);
  }

  function draw(p: Params, out: Outputs) {
    last = [p, out];
    const hist = nums(out.hist);
    bars.forEach((b, j) => {
      const y = py(hist[j] ?? 0);
      ATTR(b, { y, height: g.bottom - y });
    });
    const t = handleName ? Math.round(p[handleName] ?? 0) : 0;
    if (ghost && ghostHalo && ghostText) {
      const h0 = nums(out.hist0);
      const d = `M${px(X_MIN)} ${g.bottom}${h0.map((v, j) => `V${py(v).toFixed(1)}H${px(edge(j + 1)).toFixed(1)}`).join('')}V${g.bottom}`;
      for (const path of [ghostHalo, ghost]) ATTR(path, { d });
      const peak = Math.max(...h0.slice(Math.floor((1 - X_MIN) / BIN_W), Math.ceil((2 - X_MIN) / BIN_W)));
      ATTR(ghostText, { x: px(1.5), y: py(peak) - 8 });
      // At t = 0 the ghost would coincide with the bars.
      for (const n of [ghostHalo, ghost, ghostText]) n.classList.toggle('is-hidden', t === 0);
    }
    chip.textContent = `t = ${t} · ᾱ_t = ${format(Number(out.alphaBar), 'sig3')}`;
    if (knob && handleDef && handleName) knob.place(toPos(handleDef, p[handleName]!));
  }

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : undefined;
  ro?.observe(el);
  layout();

  const view: FigureView = {
    draw,
    handle: knob && handleName ? { name: handleName, knob } : undefined,
    rowHeader: 0,
    columns: ['bin from', 'bin to', 'density now', 'density at t = 0', `${refLabel} at bin centre`],
    note: (p, out) => `step t = ${Math.round(p[handleName ?? 't'] ?? 0)}, alpha-bar ${format(Number(out.alphaBar), 'sig3')}`,
    rows: (_p, out) => {
      const h0 = nums(out.hist0);
      return nums(out.hist).map((d, j) => [
        format(edge(j), 'fixed2'), format(edge(j + 1), 'fixed2'), format(d, 'fixed3'), format(h0[j] ?? NaN, 'fixed3'),
        format(normalPdf(edge(j) + BIN_W / 2), 'fixed3'),
      ]);
    },
    destroy() {
      ro?.disconnect();
      chip.remove();
      svg.remove();
    },
  };
  return view;
};
