#!/usr/bin/env node
// node audit.mjs <explorable.json | page.html>
// Proves a spec or a built page is correct: schema (v1 or v2, with note references),
// models, params, expressions, palette (CVD + contrast via the kit), no network,
// reduced motion, landmarks. Prints numbered problems and exits 1, or ends with the
// line `audit passed`. Body text that reads like a formula is a warning, printed
// before that line: it belongs in a math note (schema 2).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as kit from '../kit/dist/explorable-kit.js';
import { buildPage } from './build.mjs';

const COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(/i;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** Problems with one figure; its model, params, expressions and readouts. */
function auditFigure(fig) {
  let model;
  if ('expr' in fig.model) {
    try {
      model = kit.exprCurveModel(fig);
    } catch (error) {
      return [`expression rejected: ${error.message}`];
    }
  } else {
    model = kit.getModel(fig.model.id);
    if (!model) return [`unknown model "${fig.model.id}"; use one of ${kit.BUILT_IN_MODELS.map((m) => m.id).join(', ')} or expr-curve`];
  }
  const out = [];
  const defs = model.params;
  const base = Object.fromEntries(Object.entries(defs).map(([k, d]) => [k, d.default]));
  if (!('expr' in fig.model)) {
    for (const [name, value] of Object.entries(fig.model.params)) {
      const def = defs[name];
      if (!def) out.push(`param "${name}" is not a parameter of ${model.id} (it has ${Object.keys(defs).join(', ')})`);
      else if (value < def.min || value > def.max) out.push(`param ${name} = ${value} is outside its range ${def.min} to ${def.max}`);
      else base[name] = value;
    }
  }
  if (!model.kinds.includes(fig.kind)) out.push(`kind "${fig.kind}" cannot show ${model.id}; use ${model.kinds.join(' or ')}`);
  const handle = fig.options?.handle;
  if (handle !== undefined && !fig.controls.includes(handle)) out.push(`options.handle "${handle}" is not one of the controls (${fig.controls.join(', ')})`);
  for (const [key, value] of Object.entries(fig.options ?? {})) {
    if ([value].flat().some((v) => typeof v === 'string' && COLOUR.test(v))) {
      out.push(`options.${key} sets a colour; the kit owns the palette (at most 3 hue-coded series), so encode with line style, shape or labels`);
    }
  }
  const o = fig.options ?? {};
  // Labels carry meaning (never colour alone), so a label the figure shows must have a visible letter or digit:
  // not blank, not only zero-width characters or combining marks, not only punctuation such as "-". A template
  // is judged by its words, so "{marker}" (just the number) fails while "k = {k}" passes.
  for (const key of LABEL_KEYS) {
    if (o[key] === undefined) continue;
    [o[key]].flat().forEach((v, i) => {
      if (typeof v !== 'string') return;
      const words = v.replace(PLACEHOLDER, '').replace(INVISIBLE, '');
      if (SAYS.test(words)) return;
      const where = `options.${key}${Array.isArray(o[key]) ? `[${i}]` : ''}`;
      out.push(PLACEHOLDER_ONE.test(v) ? `${where} "${v}" says only a number; add what it marks` : `${where} is empty; every label must say what it marks`);
    });
  }
  // Every number the figure shows must be finite wherever a reader can put it: at the defaults and at every
  // stop of every control (the others held at their defaults). That covers the readouts, the marker and
  // reference outputs, and every output a label or `describe` fills in.
  const states = [base, ...fig.controls.filter((c) => defs[c]).flatMap((c) => stops(defs[c]).map((v) => ({ ...base, [c]: v })))];
  const results = states.map((p) => [p, model.compute(p)]);
  const values = results[0][1];
  const shown = new Map(); // output id -> how the problem names it
  for (const id of fig.readouts) {
    if (!model.outputs[id] || !(id in values)) {
      out.push(`readout "${id}" is not an output of ${model.id} (it has ${Object.keys(values).filter((k) => model.outputs[k] && finite(values[k])).join(', ')})`);
    } else shown.set(id, `readout "${id}"`);
  }
  const positions = new Set(); // outputs plotted on an axis
  const markers = 'expr' in fig.model ? (typeof o.markerExpr === 'string' ? ['marker'] : []) : [o.markers ?? []].flat();
  if ('expr' in fig.model && typeof o.refExpr === 'string') markers.push('ref');
  for (const id of markers) {
    if (!Object.hasOwn(model.outputs, id) || Array.isArray(values[id])) out.push(`options.markers "${id}" is not a number output of ${model.id}`);
    else {
      // A marker is a position on an axis, so it stays strict even if its output allows ±∞.
      positions.add(id);
      shown.set(id, id === 'marker' || id === 'ref' ? id : `marker "${id}"`);
    }
  }
  for (const key of ['describe', ...LABEL_KEYS]) {
    for (const tpl of [o[key] ?? []].flat()) {
      if (typeof tpl !== 'string') continue;
      for (const [, id] of tpl.matchAll(/\{(\w+)(?::\w+)?\}/g)) {
        if (!shown.has(id) && Object.hasOwn(model.outputs, id) && !Array.isArray(values[id])) shown.set(id, `output "${id}" (in options.${key})`);
      }
    }
  }
  // Text may show ±∞ (as ∞) for an output flagged `infinite`; NaN never, and a position never.
  const ok = (id, v) => finite(v) || (!positions.has(id) && model.outputs[id]?.infinite === true && Math.abs(v) === Infinity);
  for (const [id, name] of shown) {
    const bad = results.find(([, r]) => !ok(id, r[id]));
    if (bad) out.push(`${name} is not a finite number at ${stateText(bad[0], base)}`);
  }
  return out;
}

/** Whitespace, invisible format characters and combining marks, stripped before a label is measured (as the schema's text() does). */
const INVISIBLE = /[\p{Cf}\p{M}\s]/gu;
/** A `{output}` or `{output:format}` slot in a template (the kit's fillTemplate syntax); it fills in a number, not words. */
const PLACEHOLDER = /\{\w+(?::\w+)?\}/g;
const PLACEHOLDER_ONE = /\{\w+(?::\w+)?\}/;
/** A label says something when it has at least one letter or digit. */
const SAYS = /[\p{L}\p{N}]/u;

/** Most stops checked per control; a finer grid is sampled evenly, always with both ends. */
const MAX_STOPS = 65;
const decimals = (step) => (String(step).split('.')[1] ?? '').length;
/** A value on the control's grid, rounded as the runtime's snap() rounds it (so k = 0 is exactly 0). */
const onGrid = (def, i) => Math.min(def.max, Math.max(def.min, Number((def.min + i * def.step).toFixed(decimals(def.step)))));

/** Every value a control can take (its step grid and both ends), or an even sample of at most MAX_STOPS + 2 of them. */
function stops(def) {
  const n = def.step > 0 ? Math.floor((def.max - def.min) / def.step + 1e-9) : 0;
  const idx = n + 1 <= MAX_STOPS ? Array.from({ length: n + 1 }, (_, i) => i) : Array.from({ length: MAX_STOPS }, (_, j) => Math.round((j * n) / (MAX_STOPS - 1)));
  return [...new Set([def.min, ...idx.map((i) => onGrid(def, i)), def.max])];
}

/** The option keys that hold labels (strings or string lists) the figure shows. */
const LABEL_KEYS = ['labels', 'compareLabels', 'seriesLabels', 'seriesSpoken', 'refLabel', 'markerLabel', 'markerLabels', 'yLabel'];

const assignments = (entries) => entries.map(([k, v]) => `${k} = ${v}`).join(', ');

/** "k = 0" for a state that moves one control off the defaults, "the defaults (x = 10, k = 0.05)" for the base. */
function stateText(state, base) {
  const moved = Object.entries(state).filter(([k, v]) => v !== base[k]);
  return moved.length ? assignments(moved) : `the defaults (${assignments(Object.entries(base))})`;
}

/** Problems with a doc (raw JSON input). */
export function auditDoc(input) {
  const parsed = kit.parseDoc(input);
  if (!parsed.ok) return parsed.errors.map((e) => `schema: ${e}`);
  const figures = parsed.doc.sections.flatMap((s) => (s.figure ? [s.figure] : []));
  if (!figures.length) return ['no section has a figure: an explorable needs at least one live figure'];
  return figures.flatMap((fig) => auditFigure(fig).map((p) => `figure "${fig.id}": ${p}`));
}

/** Body text (the dek, paragraphs, the takeaway) that reads like a formula, as `kit.findFormula` sees it. */
export function docWarnings(input) {
  const parsed = kit.parseDoc(input);
  if (!parsed.ok) return [];
  const { doc } = parsed;
  const bodies = [
    ['dek', doc.dek],
    ...doc.sections.flatMap((s, i) => s.paragraphs.map((p, j) => [`sections[${i}].paragraphs[${j}]`, p])),
    ['takeaway', doc.takeaway],
  ];
  return bodies.flatMap(([path, text]) => {
    const formula = kit.findFormula(text);
    return formula ? [`${path} reads like a formula (${formula}); say it in words and move the formula into a math note (schema 2, references/spec-format.md)`] : [];
  });
}

/** The system dark scheme (the kit writes `:root:not([data-theme=light])` inside it, so a chosen light theme opts out). */
const DARK = /@media\s*(?:screen\s+and\s*)?\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/gi;
/** A chosen dark theme (`<html data-theme="dark">`, as the app's header toggle sets): also the dark scheme, never light. */
const CHOSEN_DARK = /@media\s*screen\s*\{\s*:root\[data-theme=["']?dark["']?\]\s*\{([^{}]*)\}\s*\}/gi;
const decls = (css) => [...css.matchAll(/--([\w-]+)\s*:\s*([^;}]+)/g)].map((m) => [m[1], m[2].trim()]);
const hasDark = (css) => /prefers-color-scheme\s*:\s*dark/i.test(css) || new RegExp(CHOSEN_DARK.source, 'i').test(css);

/** Each colour token as the cascade resolves it in one scheme (last value wins; `var(--x)` chains followed to a #hex). */
function tokens(css, dark = false) {
  const darkBlocks = dark ? [...css.matchAll(DARK), ...css.matchAll(CHOSEN_DARK)].flatMap((m) => decls(m[1])) : [];
  const vars = Object.fromEntries([...decls(css.replace(DARK, '').replace(CHOSEN_DARK, '')), ...darkBlocks]);
  const hex = (name, depth = 0) => {
    const v = vars[name];
    const ref = v && depth < 8 && /^var\(\s*--([\w-]+)\s*\)$/.exec(v);
    if (ref) return hex(ref[1], depth + 1);
    return v && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : undefined;
  };
  return Object.fromEntries(Object.keys(vars).flatMap((k) => (hex(k) ? [[k, hex(k)]] : [])));
}

/** Palette problems, measured with the kit's colour-vision and contrast functions, in the light and (if present) dark scheme. */
function auditPalette(css) {
  const out = [];
  for (const dark of hasDark(css) ? [false, true] : [false]) {
    const t = tokens(css, dark);
    const tag = dark ? ' in the dark scheme' : '';
    const surfaces = ['paper', 'well'].filter((s) => t[s]);
    if (surfaces.length < 2) out.push(`the --paper and --well surface tokens are missing${tag}`);
    const series = Object.keys(t).filter((k) => /^(series-\d+|live)$/.test(k));
    if (series.length > 3) out.push(`${series.length} hue-coded series (${series.map((k) => `--${k}`).join(', ')}); at most 3 pass the colour-vision checks, so encode the rest with line style or pattern`);
    for (const f of kit.seriesFailures(series.map((k) => t[k]))) out.push(`series ${f.a} and ${f.b} are too close for ${f.vision} vision (ΔE ${f.deltaE.toFixed(1)})${tag}`);
    const need = [...series.map((k) => [k, 3]), ...['ink', 'ink-2', 'live-ink', 'link'].filter((k) => t[k]).map((k) => [k, 4.5])];
    for (const [k, min] of need) {
      for (const s of surfaces) {
        const c = kit.contrast(t[k], t[s]);
        if (c < min) out.push(`--${k} on --${s} has contrast ${c.toFixed(2)}:1${tag}; it needs ${min}:1`);
      }
    }
  }
  const css2 = css.replace(/url\(data:[^)]*\)/g, '')
    // Only the kit's own scale steps and Radix blackA tokens may hold a hex value (as the minifier writes them).
    .replace(/--(?:(?:sand|indigo|orange)-\d{1,2}\s*:\s*#[0-9a-f]{6}|black-a\d{1,2}\s*:\s*#000(?:[0-9a-f]|000[0-9a-f]{2}))(?![0-9a-f])/gi, '');
  // Fully transparent (#0000, #rrggbb00: the minifier's `transparent`) is not a colour.
  const raw = new Set([...css2.matchAll(/[:\s,(](#[0-9a-f]{3,8})\b/gi)].map((m) => m[1]).filter((c) => !/^#(?:[0-9a-f]{3}0|[0-9a-f]{6}00)$/i.test(c)));
  if (raw.size) out.push(`colours used outside the palette tokens: ${[...raw].join(', ')}`);
  return [...new Set(out)];
}

/** Problems with the page itself: landmarks, title, network, motion and palette. */
export function auditPage(html, doc) {
  const out = [];
  const outside = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>');
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  if (!/<html\b[^>]*\slang="[a-z]{2,3}(-[\w-]+)?"/i.test(html)) out.push('<html> has no lang attribute');
  if (!/<title>\s*\S[\s\S]*?<\/title>/i.test(html)) out.push('the page has no <title>');
  if ((outside.match(/<main\b/gi) ?? []).length !== 1) out.push('the page needs exactly one <main> landmark');
  if (!/<h1\b/i.test(outside)) out.push('the page has no <h1>');
  const links = new Set([doc?.source?.url, ...(doc?.notes ?? []).map((n) => n.url)].map((u) => u && kit.safeHttpUrl(u)).filter(Boolean).map(kit.escapeHtml));
  for (const m of outside.matchAll(/\s(src|href|srcset|action|poster|data)\s*=\s*["']?([^"'\s>]*)/gi)) {
    const [, attr, value] = m;
    if (attr.toLowerCase() === 'href' && (value.startsWith('#') || links.has(value))) continue;
    if (!value.startsWith('data:') || attr.toLowerCase() === 'src') out.push(`external reference ${attr}="${value}": only source.url and source notes may link out, and nothing may load from the network`);
  }
  for (const m of css.matchAll(/@import\b|url\(\s*["']?(?!data:)[^)]*\)/gi)) out.push(`CSS loads ${m[0]}: inline it as a data: URL`);
  if (/\sstyle\s*=/i.test(outside)) out.push('inline style= attribute in the markup; put styles in the stylesheet');
  if (!/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i.test(css)) out.push('no @media (prefers-reduced-motion: reduce) rule in the CSS');
  const shells = (outside.match(/<figure class="xfig"/g) ?? []).length;
  const figures = doc?.sections?.filter((s) => s.figure).length ?? 0;
  if (doc && shells !== figures) out.push(`${shells} figure shells in the markup but ${figures} figures in the doc`);
  const math = doc?.notes?.filter((n) => n.kind === 'math').length ?? 0;
  const markers = (outside.match(/<button class="xnote-mk"/g) ?? []).length;
  if (doc && markers !== math) out.push(`${markers} math markers in the markup but ${math} math notes in the doc`);
  return [...out, ...auditPalette(css)];
}

/** Audit a built page: the embedded doc, then the page. */
export function auditHtml(html) {
  const m = /<script type="application\/json" id="explorable-doc">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return ['no embedded doc (<script type="application/json" id="explorable-doc">): build the page with build.mjs', ...auditPage(html)];
  let doc;
  try {
    doc = JSON.parse(m[1]);
  } catch (error) {
    return [`the embedded doc is not valid JSON: ${error.message}`, ...auditPage(html)];
  }
  return [...auditDoc(doc), ...auditPage(html, doc)];
}

/** Audit a spec: the doc, then the page build.mjs would write for it. */
export function auditSpec(input) {
  const problems = auditDoc(input);
  const parsed = kit.parseDoc(input);
  return parsed.ok ? [...problems, ...auditPage(buildPage(parsed.doc, { fonts: false }), parsed.doc)] : problems;
}

/** The doc in a file: a spec, or the doc a built page embeds (undefined if there is none). */
function readDoc(file, text) {
  try {
    if (!/\.html?$/i.test(file)) return JSON.parse(text);
    const m = /<script type="application\/json" id="explorable-doc">([\s\S]*?)<\/script>/.exec(text);
    return m ? JSON.parse(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

/** Audit a file by extension. */
export function auditFile(file) {
  const text = readFileSync(file, 'utf8');
  if (/\.html?$/i.test(file)) return auditHtml(text);
  try {
    return auditSpec(JSON.parse(text));
  } catch (error) {
    return [`${file} is not valid JSON: ${error.message}`];
  }
}

/** Warnings for a file (they never fail the audit). */
export function warnFile(file) {
  const doc = readDoc(file, readFileSync(file, 'utf8'));
  return doc === undefined ? [] : docWarnings(doc);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node audit.mjs <explorable.json | page.html>');
    process.exit(1);
  }
  const problems = auditFile(file);
  console.log(`audit ${file}`);
  if (problems.length) console.log(problems.map((p, i) => `${i + 1}. ${p}`).join('\n'));
  for (const w of warnFile(file)) console.log(`warning: ${w}`);
  if (problems.length) {
    console.log(`audit failed: ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
    process.exitCode = 1;
  } else {
    console.log('audit passed');
  }
}
