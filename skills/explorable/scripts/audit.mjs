#!/usr/bin/env node
// node audit.mjs <explorable.json | page.html>
// Proves a spec or a built page is correct: schema, models, params, expressions,
// palette (CVD + contrast via the kit), no network, reduced motion, landmarks.
// Prints numbered problems and exits 1, or ends with the line `audit passed`.
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
  // Every readout must be a finite number at the defaults and at each end of every control.
  const states = [base, ...fig.controls.filter((c) => defs[c]).flatMap((c) => [{ ...base, [c]: defs[c].min }, { ...base, [c]: defs[c].max }])];
  const values = model.compute(base);
  for (const id of fig.readouts) {
    if (!model.outputs[id] || !(id in values)) {
      out.push(`readout "${id}" is not an output of ${model.id} (it has ${Object.keys(values).filter((k) => model.outputs[k] && finite(values[k])).join(', ')})`);
      continue;
    }
    const bad = states.find((p) => !finite(model.compute(p)[id]));
    if (bad) out.push(`readout "${id}" is not a finite number at ${Object.entries(bad).map(([k, v]) => `${k} = ${v}`).join(', ')}`);
  }
  return out;
}

/** Problems with a doc (raw JSON input). */
export function auditDoc(input) {
  const parsed = kit.parseDoc(input);
  if (!parsed.ok) return parsed.errors.map((e) => `schema: ${e}`);
  const figures = parsed.doc.sections.flatMap((s) => (s.figure ? [s.figure] : []));
  if (!figures.length) return ['no section has a figure: an explorable needs at least one live figure'];
  return figures.flatMap((fig) => auditFigure(fig).map((p) => `figure "${fig.id}": ${p}`));
}

/** Last value of each `--token: #hex` in the CSS (the cascade winner in one :root). */
const tokens = (css) => Object.fromEntries([...css.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2].toUpperCase()]));

/** Palette problems, measured with the kit's colour-vision and contrast functions. */
function auditPalette(css) {
  const t = tokens(css);
  const out = [];
  const surfaces = ['paper', 'well'].filter((s) => t[s]);
  if (surfaces.length < 2) out.push('the --paper and --well surface tokens are missing');
  const series = Object.keys(t).filter((k) => /^(series-\d+|live)$/.test(k));
  if (series.length > 3) out.push(`${series.length} hue-coded series (${series.map((k) => `--${k}`).join(', ')}); at most 3 pass the colour-vision checks, so encode the rest with line style or pattern`);
  for (const f of kit.seriesFailures(series.map((k) => t[k]))) out.push(`series ${f.a} and ${f.b} are too close for ${f.vision} vision (ΔE ${f.deltaE.toFixed(1)})`);
  const need = [...series.map((k) => [k, 3]), ...['ink', 'ink-2', 'live-ink'].filter((k) => t[k]).map((k) => [k, 4.5])];
  for (const [k, min] of need) {
    for (const s of surfaces) {
      const c = kit.contrast(t[k], t[s]);
      if (c < min) out.push(`--${k} on --${s} has contrast ${c.toFixed(2)}:1; it needs ${min}:1`);
    }
  }
  const css2 = css.replace(/url\(data:[^)]*\)/g, '').replace(/--[\w-]+\s*:\s*#[0-9a-f]{6}\b/gi, '');
  // Fully transparent (#0000, #rrggbb00: the minifier's `transparent`) is not a colour.
  const raw = new Set([...css2.matchAll(/[:\s,(](#[0-9a-f]{3,8})\b/gi)].map((m) => m[1]).filter((c) => !/^#(?:[0-9a-f]{3}0|[0-9a-f]{6}00)$/i.test(c)));
  if (raw.size) out.push(`colours used outside the palette tokens: ${[...raw].join(', ')}`);
  return out;
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
  const source = doc?.source?.url && kit.safeHttpUrl(doc.source.url);
  for (const m of outside.matchAll(/\s(src|href|srcset|action|poster|data)\s*=\s*["']?([^"'\s>]*)/gi)) {
    const [, attr, value] = m;
    if (attr.toLowerCase() === 'href' && (value.startsWith('#') || (source && value === kit.escapeHtml(source)))) continue;
    if (!value.startsWith('data:') || attr.toLowerCase() === 'src') out.push(`external reference ${attr}="${value}": only source.url may link out, and nothing may load from the network`);
  }
  for (const m of css.matchAll(/@import\b|url\(\s*["']?(?!data:)[^)]*\)/gi)) out.push(`CSS loads ${m[0]}: inline it as a data: URL`);
  if (/\sstyle\s*=/i.test(outside)) out.push('inline style= attribute in the markup; put styles in the stylesheet');
  if (!/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i.test(css)) out.push('no @media (prefers-reduced-motion: reduce) rule in the CSS');
  const shells = (outside.match(/<figure class="xfig"/g) ?? []).length;
  const figures = doc?.sections?.filter((s) => s.figure).length ?? 0;
  if (doc && shells !== figures) out.push(`${shells} figure shells in the markup but ${figures} figures in the doc`);
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node audit.mjs <explorable.json | page.html>');
    process.exit(1);
  }
  const problems = auditFile(file);
  console.log(`audit ${file}`);
  if (problems.length) {
    console.log(problems.map((p, i) => `${i + 1}. ${p}`).join('\n'));
    console.log(`audit failed: ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
    process.exitCode = 1;
  } else {
    console.log('audit passed');
  }
}
