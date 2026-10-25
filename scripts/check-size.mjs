// pnpm check:size: P1 budgets on dist/client/ (run `pnpm build` first). Initial JS
// and CSS for "/" in gzip; preloaded fonts as shipped (woff2 is compressed).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist/client'; // the Cloudflare Vite plugin puts the Worker in dist/explorable
const KB = 1024;
const BUDGETS = { js: 110 * KB, css: 20 * KB, fonts: 70 * KB };

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/client/index.html not found: run `pnpm build` first');
  process.exit(1);
}
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const attr = (tag, name) => new RegExp(`${name}="([^"]+)"`).exec(tag)?.[1];
const tags = (re) => [...html.matchAll(re)].map((m) => m[0]);

const files = {
  js: [
    // Module entries and classic scripts in <head> (theme-init.js), all loaded before first use.
    ...tags(/<script[^>]*\ssrc="[^"]+"[^>]*>/g).map((t) => attr(t, 'src')),
    ...tags(/<link[^>]*rel="modulepreload"[^>]*>/g).map((t) => attr(t, 'href')),
  ],
  css: readdirSync(join(DIST, 'assets'))
    .filter((f) => f.endsWith('.css'))
    .map((f) => `/assets/${f}`),
  fonts: tags(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/g).map((t) => attr(t, 'href')),
};

const rows = [];
let failed = false;
for (const [kind, list] of Object.entries(files)) {
  let total = 0;
  for (const href of /** @type {string[]} */ (list.filter(Boolean))) {
    const bytes = readFileSync(join(DIST, href.replace(/^\//, '')));
    const gzip = gzipSync(bytes).length;
    const counted = kind === 'fonts' ? bytes.length : gzip;
    total += counted;
    rows.push({ kind, file: href, raw: bytes.length, gzip, counted });
  }
  const ok = total <= BUDGETS[kind];
  failed ||= !ok;
  rows.push({ kind, file: `TOTAL ${ok ? 'ok' : 'OVER BUDGET'}`, raw: '', gzip: '', counted: total, budget: BUDGETS[kind] });
}

const kb = (n) => (typeof n === 'number' ? `${(n / KB).toFixed(1)} KB` : '');
const table = [['kind', 'file', 'raw', 'gzip', 'counted', 'budget'], ...rows.map((r) => [r.kind, r.file, kb(r.raw), kb(r.gzip), kb(r.counted), kb(r.budget)])];
const widths = table[0].map((_, i) => Math.max(...table.map((row) => row[i].length)));
for (const row of table) console.log(row.map((cell, i) => (i < 2 ? cell.padEnd(widths[i]) : cell.padStart(widths[i]))).join('  '));
console.log(failed ? 'size check FAILED' : 'size check passed');
process.exitCode = failed ? 1 : 0;
