#!/usr/bin/env node
// node build.mjs <explorable.json> [--out page.html] [--no-fonts]
// Writes one self-contained HTML page (inline CSS, JS, font and doc) that opens
// from file:// with no network. Zero dependencies; Node 20.10+.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as kit from '../kit/dist/explorable-kit.js';

const DIST = fileURLToPath(new URL('../kit/dist/', import.meta.url));
const dist = (file, encoding) => readFileSync(join(DIST, file), encoding);

/** The code points of serif-math.woff2 (src/styles/fonts.css). */
const SERIF_MATH = 'U+2190,U+2192,U+2202,U+2206,U+2211,U+221A,U+221E,U+222B,U+2248,U+2260,U+2264-2265';

/** Page-level CSS on top of the kit's tokens and styles. Only the roman serif (Source Serif 4, as "Explorable Serif") and its math signs are inlined. */
const PAGE_CSS = `*,*::before,*::after{box-sizing:border-box}
html{color:var(--text);background:var(--bg)}
body{margin:0;font:400 1.1875rem/1.6 var(--font-text);overflow-wrap:break-word}
main{padding:var(--space-7) 1rem var(--space-6)}
h1,h2,h3{font-family:var(--font-display);font-weight:600;color:var(--text)}
a{color:var(--link);text-decoration:underline var(--hairline) var(--link-line);text-underline-offset:3px}
code{font:.9em var(--font-mono);overflow-wrap:anywhere}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
h1[tabindex="-1"]:focus{outline:none}
.page-foot{max-width:var(--measure);margin:0 auto;padding:var(--space-4) 1rem var(--space-7);font:var(--text-12) var(--font-ui);color:var(--text-2)}
@media (max-width:639.98px){body{font-size:1.0625rem}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}}
@media (forced-colors:active){:focus-visible{outline-color:Highlight}}`;

/** The ESM bundle as page script: its trailing `export{a as b,…}` becomes `const explorableKit={b:a,…}`. */
export function inlineKit(source) {
  const m = /export\s*\{([^}]*)\};?\s*$/.exec(source);
  if (!m) throw new Error('kit bundle has no trailing export list: rebuild it with `pnpm build:kit`');
  const props = m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const [local, name = local] = s.split(/\s+as\s+/);
    return `${name}:${local}`;
  });
  return `${source.slice(0, m.index)}const explorableKit={${props.join(',')}};`;
}

const sha256 = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
const plain = (text) => kit.escapeHtml(text.replace(/[*`]/g, ''));

/** One standalone page for a validated doc. Deterministic: same doc, same bytes. */
export function buildPage(doc, { fonts = true } = {}) {
  const face = (file, range = '') =>
    `@font-face{font-family:"Explorable Serif";src:url(data:font/woff2;base64,${dist(file).toString('base64')}) format("woff2");font-weight:400 600;font-display:swap${range}}\n`;
  // The serif's own math signs, as in the app (src/styles/fonts.css), so √ in the text matches the letters around it.
  const font = fonts ? face('serif-latin.woff2') + face('serif-math.woff2', `;unicode-range:${SERIF_MATH}`) : '';
  const css = `${font}${dist('explorable-kit.css', 'utf8').trim()}\n${PAGE_CSS}`;
  const js =
    `${inlineKit(dist('explorable-kit.js', 'utf8').trim())}\n` +
    'explorableKit.hydrateFigures(document.getElementById("explorable"),JSON.parse(document.getElementById("explorable-doc").textContent));';
  // `<` is escaped so no text in the doc can close the data block.
  const data = JSON.stringify(doc).replace(/</g, '\\u003c');
  const csp = `default-src 'none'; img-src data:; font-src data:; style-src ${sha256(css)}; script-src ${sha256(js)}; base-uri 'none'; form-action 'none'`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="color-scheme" content="light dark">
<meta name="description" content="${plain(doc.dek)}">
<meta name="generator" content="explorable kit">
<title>${kit.escapeHtml(doc.title)}</title>
<style>${css}</style>
</head>
<body>
<main id="explorable">${kit.essayHtml(doc)}</main>
<footer class="page-foot"><p>A standalone explorable: every number comes from a live model, and this one file works offline.</p></footer>
<script type="application/json" id="explorable-doc">${data}</script>
<script type="module">${js}</script>
</body>
</html>
`;
}

function main(argv) {
  const args = { fonts: true, out: undefined, spec: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--no-fonts') args.fonts = false;
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (!argv[i].startsWith('--') && !args.spec) args.spec = argv[i];
    else return fail([`unknown argument ${argv[i]}`]);
  }
  if (!args.spec || (argv.includes('--out') && !args.out)) return fail(['usage: node build.mjs <explorable.json> [--out page.html] [--no-fonts]']);
  let input;
  try {
    input = JSON.parse(readFileSync(args.spec, 'utf8'));
  } catch (error) {
    return fail([`cannot read ${args.spec} as JSON: ${error.message}`]);
  }
  const parsed = kit.parseDoc(input);
  if (!parsed.ok) return fail(parsed.errors);
  const out = resolve(args.out ?? join(dirname(args.spec), 'index.html'));
  const html = buildPage(parsed.doc, { fonts: args.fonts });
  writeFileSync(out, html);
  console.log(`wrote ${out} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
  console.log(`next: node ${join(dirname(fileURLToPath(import.meta.url)), 'audit.mjs')} ${out}`);
}

function fail(problems) {
  console.error(`build failed:\n${problems.map((p, i) => `${i + 1}. ${p}`).join('\n')}`);
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
