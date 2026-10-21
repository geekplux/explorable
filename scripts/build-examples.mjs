// pnpm build:examples: build every built-in sample (src/samples/<slug>.json)
// through the skill's page builder into examples/<slug>.html, the root gallery.
// Deterministic (same specs and kit, same bytes) and dependency-free, so CI can
// rebuild the pages and fail when the committed ones are stale.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Imported by URL so the root typecheck does not pull in the skill's untyped script and prebuilt bundle.
const skill = (path) => import(new URL(`../skills/explorable/${path}`, import.meta.url).href);
const kit = await skill('kit/dist/explorable-kit.js');
const { buildPage } = await skill('scripts/build.mjs');
const SAMPLES = 'src/samples';
const OUT = 'examples';

const slugs = readdirSync(SAMPLES)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -'.json'.length))
  .toSorted();
let failed = 0;
for (const slug of slugs) {
  const parsed = kit.parseDoc(JSON.parse(readFileSync(join(SAMPLES, `${slug}.json`), 'utf8')));
  if (!parsed.ok) {
    console.error(`${slug}: invalid doc\n- ${parsed.errors.join('\n- ')}`);
    failed++;
    continue;
  }
  const html = buildPage(parsed.doc);
  writeFileSync(join(OUT, `${slug}.html`), html);
  console.log(`wrote ${OUT}/${slug}.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
}
if (failed || !slugs.length) process.exitCode = 1;
