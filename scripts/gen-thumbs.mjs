// node scripts/gen-thumbs.mjs: the essay-index thumbnails in src/samples/thumbs/, one per sample: its first
// figure at rest, drawn from the kit's own models, with the handle that moves it (DESIGN §5, board Home).
// Inline in the app, classes take the theme's colours; the presentation attributes (Radix light, from the kit
// palette) are the fallback where the SVG is shown as an image (examples/README.md).
// The home page sweeps the handle on hover from the data-* attributes (src/components/EssayIndex.tsx).
import { readFileSync, writeFileSync } from 'node:fs';
import { RADIX } from '../skills/explorable/kit/src/color/palette.ts';
import { softmax } from '../skills/explorable/kit/src/models/softmax-temperature.ts';
import { bloomFilter, QUERIES, VERDICTS } from '../skills/explorable/kit/src/models/bloom-filter.ts';
import { BIN_W, X_MAX, X_MIN, diffusionForward } from '../skills/explorable/kit/src/models/diffusion-forward.ts';

const W = 240, H = 134, SY = 120;
const f1 = (v) => String(Math.round(v * 10) / 10);
const [sand, indigo, orange] = ['sand', 'indigo', 'orange'].map((s) => (n) => RADIX.light[s][n - 1].toLowerCase());
const PAINT = {
  'th-bar': `fill="${indigo(9)}"`, 'th-bar is-top': `fill="${indigo(11)}"`, 'th-axis': `stroke="${sand(9)}"`,
  'th-bit': `fill="${sand(1)}" stroke="${sand(7)}" stroke-width="0.5"`, 'th-bit is-on': `fill="${sand(12)}" stroke="${sand(12)}" stroke-width="0.5"`,
  'th-hit': `fill="none" stroke="${indigo(9)}" stroke-width="1.5"`, 'th-ref': `fill="none" stroke="${sand(11)}" stroke-dasharray="1 3" stroke-linecap="round"`,
  'th-cat': `fill="${sand(12)}" font-size="14" font-family="Georgia, serif"`, 'th-val': `fill="${sand(12)}" font-size="12" font-family="monospace"`,
  'th-lab': `fill="${sand(11)}" font-size="12" font-family="sans-serif"`,
  'th-track': `stroke="${sand(6)}" stroke-width="2" stroke-linecap="round"`, 'th-fill': `stroke="${orange(10)}" stroke-width="2" stroke-linecap="round"`,
  'th-handle': `fill="${orange(10)}" stroke="${sand(1)}" stroke-width="3"`,
};
const tag = (name, cls, attrs, text) => `<${name} class="${cls}" ${attrs} ${PAINT[cls]}${text === undefined ? '/>' : `>${text}</${name}>`}`;
const rect = (cls, x, y, w, h, extra = '') => tag('rect', cls, `x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}"${extra}`);
const text = (cls, x, y, s, anchor = 'middle') => tag('text', cls, `x="${f1(x)}" y="${f1(y)}" text-anchor="${anchor}"`, s);

/** Track, fill and the round handle at `at` in [0, 1]; the data-* attributes let the page sweep it. */
const slider = (x0, x1, at) =>
  tag('path', 'th-track', `d="M${x0} ${SY}H${x1}"`) + tag('path', 'th-fill', `d="M${x0} ${SY}H${f1(x0 + (x1 - x0) * at)}"`) +
  tag('circle', 'th-handle', `cx="${f1(x0 + (x1 - x0) * at)}" cy="${SY}" r="9"`);
const svg = (data, body) => `<svg xmlns="http://www.w3.org/2000/svg" class="thumb" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false" ${data}>${body}</svg>\n`;
const sample = (id) => JSON.parse(readFileSync(new URL(`../src/samples/${id}.json`, import.meta.url), 'utf8'));
const firstFigure = (doc) => doc.sections.find((s) => s.figure).figure;
const logPos = (v, a, b) => Math.log(v / a) / Math.log(b / a);

/** Attention: the softmax over the six hand-set scores at T = 1, on the kit's T range (0.05 to 5, log). */
function attention() {
  const fig = firstFigure(sample('attention'));
  const p = fig.model.params, scores = Array.from({ length: p.n }, (_, i) => p[`s${i + 1}`]);
  const [L, R, top, base, T0, T1] = [36, 232, 8, 82, 0.05, 5];
  const w = softmax(scores, p.T), slot = (R - L) / w.length, bw = slot * 0.56, top1 = w.indexOf(Math.max(...w));
  const body = w.map((v, i) => {
    const cx = L + slot * (i + 0.5);
    return rect(i === top1 ? 'th-bar is-top' : 'th-bar', cx - bw / 2, base - v * (base - top), bw, Math.max(v * (base - top), 0.5), ` data-i="${i}"`) +
      text('th-cat', cx, base + 18, fig.options.labels[i]);
  });
  const data = `data-x0="${L}" data-x1="${R}" data-at="${Math.round(logPos(p.T, T0, T1) * 1000) / 1000}" data-scores="${scores.join(' ')}" data-t="${T0} ${T1}" data-top="${top}" data-base="${base}"`;
  return svg(data, tag('path', 'th-axis', `d="M${L} ${base}H${R}"`) + body.join('') + slider(L, R, logPos(p.T, T0, T1)));
}

/** Bloom filter: the 32 bits after the figure's n words with k hashes; the query's k bits ringed, and its verdict. */
function bloom() {
  const fig = firstFigure(sample('bloom-filter'));
  const p = fig.model.params, o = bloomFilter.compute(p), cell = (W - 16) / 16, out = [];
  o.bits.forEach((b, i) => {
    const x = 8 + (i % 16) * cell, y = 34 + Math.floor(i / 16) * (cell + 4);
    out.push(rect(b ? 'th-bit is-on' : 'th-bit', x + 1, y, cell - 2, cell - 2));
    if (o.probes.includes(i)) out.push(rect('th-hit', x - 1, y - 2, cell + 2, cell + 2));
  });
  out.push(text('th-cat', 8, 20, `${QUERIES[p.q]}?`, 'start'), text('th-val', W - 8, 20, VERDICTS[o.queryState].split(' ')[0], 'end'));
  const n = bloomFilter.params.n, at = (p.n - n.min) / (n.max - n.min);
  return svg(`data-x0="8" data-x1="${W - 8}" data-at="${Math.round(at * 1000) / 1000}"`, out.join('') + slider(8, W - 8, at));
}

/** Diffusion: the data histogram at t = 0 (the figure's seed) beside the dotted N(0, 1) it turns into. */
function diffusion() {
  const fig = firstFigure(sample('diffusion'));
  const o = diffusionForward.compute(fig.model.params), [L, R, base, k] = [8, W - 8, 96, 72];
  const bw = (R - L) / o.hist0.length, xs = (v) => L + ((v - X_MIN) / (X_MAX - X_MIN)) * (R - L);
  const bars = o.hist0.flatMap((d, i) => (d * k > 0.6 ? [rect('th-bar', L + i * bw + 0.5, base - d * k, bw - 1, d * k)] : []));
  let ref = '';
  for (let v = X_MIN; v <= X_MAX + 1e-9; v += BIN_W / 2) ref += `${ref ? 'L' : 'M'}${f1(xs(v))} ${f1(base - (Math.exp(-v * v / 2) / Math.sqrt(2 * Math.PI)) * k)}`;
  const t = diffusionForward.params.t, at = (fig.model.params.t - t.min) / (t.max - t.min);
  const body = bars.join('') + tag('path', 'th-ref', `d="${ref}"`) + tag('path', 'th-axis', `d="M${L} ${base}H${R}"`) + text('th-lab', xs(0), base - 40, fig.options.refLabel);
  return svg(`data-x0="8" data-x1="${W - 8}" data-at="${at}"`, body + slider(8, W - 8, at));
}

for (const [id, draw] of Object.entries({ attention, 'bloom-filter': bloom, diffusion })) {
  const file = new URL(`../src/samples/thumbs/${id}.svg`, import.meta.url);
  writeFileSync(file, draw());
  console.log('wrote', file.pathname);
}
