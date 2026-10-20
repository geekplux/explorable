/**
 * `bits`: a Bloom filter's bit array with hashed probes
 * (docs/figures/bloom-filter.md, Fig 1). Word chips with a ring knob for n,
 * 32 cells (one row, or 2 × 16 under 640 px) whose value is a "1"/"0" glyph
 * as well as a fill, and the query's arrows to its k cells. A false positive
 * gets a 45° hatch plus its label, so no meaning rests on colour.
 */
import { INSERT, VERDICTS } from '../models/bloom-filter.ts';
import type { ParamDef } from '../registry.ts';
import { toPos } from '../runtime/controls.ts';
import { createHandle, svgEl } from '../runtime/handle.ts';
import type { FigureMount, FigureView, Outputs, Params } from '../runtime/mount.ts';

const nums = (v: unknown): number[] => (Array.isArray(v) ? v : []);
const set = (el: Element, attrs: Record<string, string | number>) => {
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
};
const ICONS = ['M-4 -4L4 4M4 -4L-4 4', 'M-4.5 0l3 3.5l6-7', 'M0 -5v5.5M0 4v.5'];
const NOTE = ["the filter can't tell this apart from a false positive;", 'the figure knows because it keeps the list'];
const NOTE3 = ["the filter can't tell this apart from a", 'false positive; the figure knows because', 'it keeps the list'];

export const mountBits: FigureMount = (el, { spec, model, setParam }) => {
  const defs = model.params as Record<string, ParamDef>;
  const handleName = typeof spec.options?.handle === 'string' ? spec.options.handle : 'n';
  const handleDef = defs[handleName];
  const queries = defs.q?.choices ?? [];
  const hatch = `${spec.id}-hatch`;
  const arrow = `${spec.id}-arrow`;

  const svg = svgEl(el, 'svg', { class: 'xfig-svg xfig-bits' });
  const defsEl = svgEl(svg, 'defs');
  const pattern = svgEl(defsEl, 'pattern', { id: hatch, width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  svgEl(pattern, 'path', { class: 'xfig-hatch', d: 'M0 0v4' });
  const head = svgEl(defsEl, 'marker', { id: arrow, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' });
  svgEl(head, 'path', { class: 'xfig-arrowhead', d: 'M0 0L10 5L0 10z' });
  const chart = svgEl(svg, 'g', { role: 'img', 'aria-label': `${spec.title}: ${INSERT.length} words and a row of 32 bits` });
  const [words, track, arrows, cells, outlines, mark, query] = Array.from({ length: 7 }, () => svgEl(chart, 'g')) as [SVGGElement, SVGGElement, SVGGElement, SVGGElement, SVGGElement, SVGGElement, SVGGElement];
  track.setAttribute('aria-hidden', 'true');
  words.setAttribute('class', 'xfig-words');
  const knob = handleDef ? createHandle(svg, { def: handleDef, onChange: (v, instant) => setParam(handleName, v, instant) }) : undefined;

  let g = { w: 640, h: 250, wide: true, cell: 24, pitch: 27, rowGap: 18, top: 124, chipTop: 192 };
  let chips: SVGGElement[] = [];
  let bits: SVGGElement[] = [];
  let last: [Params, Outputs] | undefined;
  const cellXY = (i: number) => {
    const cols = g.wide ? 32 : 16;
    return { x: 2 + (i % cols) * g.pitch, y: g.top + Math.floor(i / cols) * (g.cell + g.rowGap) };
  };

  function layout() {
    const w = el.getBoundingClientRect().width || 640;
    if (last && w === g.w) return;
    const wide = w >= 640;
    const pitch = (w - 4) / (wide ? 32 : 16);
    const cell = pitch - Math.min(4, Math.max(2, pitch * 0.1));
    const chipsBottom = wide ? 30 : 78;
    // Room above the knob for its "drag" hint, clear of the chips.
    const trackY = chipsBottom + 36;
    const rowGap = wide ? 18 : 40;
    const top = trackY + 68;
    const chipTop = top + (wide ? cell : 2 * cell + rowGap) + 44;
    g = { w, h: chipTop + (wide ? 56 : w < 330 ? 92 : 74), wide, cell, pitch, rowGap, top, chipTop };
    set(svg, { viewBox: `0 0 ${w} ${g.h}`, width: '100%', height: g.h });

    words.replaceChildren();
    const x0 = wide ? 76 : 8;
    const cp = (w - x0 - 8) / (wide ? 12 : 6);
    words.classList.toggle('is-tight', cp < 44);
    svgEl(words, 'text', { x: 0, y: wide ? 22 : 14 }).textContent = 'inserted:';
    chips = INSERT.map((word, i) => {
      const chip = svgEl(words, 'g', { class: 'xfig-word', transform: `translate(${x0 + (i % (wide ? 12 : 6)) * cp + (cp < 44 ? 1.5 : 3)} ${wide ? 4 : i < 6 ? 22 : 52})` });
      const cw = cp - (cp < 44 ? 3 : 6);
      svgEl(chip, 'rect', { width: cw, height: 26, rx: 13 });
      svgEl(chip, 'text', { x: cw / 2, y: 17.5, 'text-anchor': 'middle' }).textContent = word;
      return chip;
    });

    track.replaceChildren();
    if (knob && handleDef) {
      const [t0, t1] = wide ? [x0, x0 + 12 * cp] : [24, w - 24];
      knob.layout(t0, t1, trackY);
      svgEl(track, 'text', { x: t0 - 12, y: trackY + 4, 'text-anchor': 'end' }).textContent = handleName;
      svgEl(track, 'path', { class: 'xfig-track-line', d: `M${t0} ${trackY}H${t1}` });
      for (let t = handleDef.min; t <= handleDef.max; t++) {
        const x = t0 + toPos(handleDef, t) * (t1 - t0);
        svgEl(track, 'path', { class: 'xfig-tick', d: `M${x} ${trackY + 11}v4` });
        svgEl(track, 'text', { x, y: trackY + 28, 'text-anchor': 'middle' }).textContent = String(t);
      }
    }

    cells.replaceChildren();
    // Two-digit indices nearly touch on a small pitch (2 × 16 at 320 px): use a smaller index face.
    cells.classList.toggle('is-tight', pitch < 22);
    bits = Array.from({ length: 32 }, (_, i) => {
      const { x, y } = cellXY(i);
      svgEl(cells, 'text', { class: 'xfig-bit-index', x: x + g.cell / 2, y: y - 5, 'text-anchor': 'middle' }).textContent = String(i);
      const bit = svgEl(cells, 'g', { class: 'xfig-bit', transform: `translate(${x} ${y})` });
      svgEl(bit, 'rect', { width: g.cell, height: g.cell });
      svgEl(bit, 'text', { x: g.cell / 2, y: g.cell / 2 + 4.5, 'text-anchor': 'middle' });
      return bit;
    });
    if (last) draw(...last);
  }

  function draw(p: Params, out: Outputs) {
    last = [p, out];
    const n = Math.round(p.n ?? 0);
    chips.forEach((chip, i) => {
      chip.classList.toggle('is-in', i < n);
      chip.lastElementChild!.textContent = `${i < n ? '+ ' : ''}${INSERT[i]}`;
    });
    nums(out.bits).forEach((b, i) => {
      bits[i]!.classList.toggle('is-set', b === 1);
      bits[i]!.lastElementChild!.textContent = String(b);
    });

    const state = typeof out.queryState === 'number' ? out.queryState : 0;
    const probes = nums(out.probes);
    const word = `${queries[Math.round(p.q ?? 0)] ?? ''}?`;
    const verdict = VERDICTS[state] ?? '';
    const chipW = 16 + word.length * 8;
    const badgeW = 30 + verdict.length * 7.4;
    const centre = probes.reduce((a, i) => a + cellXY(i).x + g.cell / 2, 0) / Math.max(1, probes.length);
    const qx = Math.min(g.w - chipW - badgeW - 8, Math.max(0, centre - chipW / 2));
    const fp: Record<string, string> = state === 2 ? { fill: `url(#${hatch})`, 'data-fp': '' } : {};

    for (const layer of [arrows, outlines, mark, query]) layer.replaceChildren();
    for (const cls of ['xfig-probe-halo', 'xfig-probe']) {
      for (const i of probes) {
        const { x, y } = cellXY(i);
        svgEl(outlines, 'rect', { class: cls, x: x - 2.5, y: y - 2.5, width: g.cell + 5, height: g.cell + 5 });
      }
    }
    for (const i of probes) {
      const { x, y } = cellXY(i);
      const d = `M${qx + chipW / 2} ${g.chipTop}L${x + g.cell / 2} ${y + g.cell + 7}`;
      svgEl(arrows, 'path', { class: 'xfig-arrow-halo', d });
      svgEl(arrows, 'path', { class: 'xfig-arrow', d, 'marker-end': `url(#${arrow})` });
    }
    if (state === 0 && typeof out.firstZero === 'number' && out.firstZero >= 0) {
      const { x, y } = cellXY(out.firstZero);
      const cx = x + g.cell / 2;
      const right = cx + 170 < g.w;
      svgEl(mark, 'path', { class: 'xfig-zero', d: ICONS[0]!, transform: `translate(${cx} ${y - 26})` });
      svgEl(mark, 'text', { x: cx + (right ? 10 : -10), y: y - 22, 'text-anchor': right ? 'start' : 'end' }).textContent = '0 here → definitely not';
    }
    svgEl(query, 'rect', { class: 'xfig-query', x: qx, y: g.chipTop, width: chipW, height: 26, rx: 13, ...fp });
    svgEl(query, 'text', { class: 'xfig-query-text', x: qx + chipW / 2, y: g.chipTop + 17.5, 'text-anchor': 'middle' }).textContent = word;
    const bx = qx + chipW + 8;
    svgEl(query, 'rect', { class: 'xfig-verdict', x: bx, y: g.chipTop, width: badgeW, height: 26, rx: 4, ...fp });
    svgEl(query, 'path', { class: 'xfig-verdict-icon', d: ICONS[state] ?? '', transform: `translate(${bx + 14} ${g.chipTop + 13})` });
    svgEl(query, 'text', { class: 'xfig-verdict-text', x: bx + 26, y: g.chipTop + 17.5 }).textContent = verdict;
    if (state === 1) {
      const lines = g.wide ? [NOTE.join(' ')] : g.w < 330 ? NOTE3 : NOTE;
      lines.forEach((line, i) => {
        svgEl(query, 'text', { class: 'xfig-note', x: 0, y: g.chipTop + 46 + i * 18 }).textContent = line;
      });
    }
    if (knob && handleDef) knob.place(toPos(handleDef, p[handleName]!));
  }

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : undefined;
  ro?.observe(el);
  layout();

  const view: FigureView = {
    draw,
    handle: knob ? { name: handleName, knob } : undefined,
    rowHeader: 0,
    columns: (p) => ['bit', 'value', `probed by “${queries[Math.round(p.q ?? 0)] ?? ''}”`],
    note: (p, out) => `“${queries[Math.round(p.q ?? 0)] ?? ''}”: ${VERDICTS[Number(out.queryState)] ?? ''}`,
    rows: (_p, out) => {
      const probes = nums(out.probes);
      return nums(out.bits).map((b, i) => [String(i), String(b), probes.includes(i) ? 'yes' : 'no']);
    },
    destroy() {
      ro?.disconnect();
      svg.remove();
    },
  };
  return view;
};
