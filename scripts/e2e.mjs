// pnpm e2e <flow…> [--out <dir>] [--no-build]
// Runs scripts/flows/<flow>.mjs inside one preview server and one browser.
// A flow is `export default async ({ page, baseURL, shot, assert, cvd, axe }) => {}`;
// it may `export const pageOptions = { allowApi, apiErrors }` (see newPage).
import assert from 'node:assert/strict';
import { axe } from './lib/axe.mjs';
import { cvd } from './lib/cvd.mjs';
import { parseArgs, run, shot, withBrowser, withPreview } from './lib/harness.mjs';

const args = parseArgs(process.argv.slice(2));
const flows = args._ ?? [];
const out = args.out?.[0] ?? 'test-results/e2e';

await run(async () => {
  if (!flows.length) throw new Error('usage: pnpm e2e <flow…> [--out <dir>] [--no-build]');
  const modules = await Promise.all(flows.map((name) => import(`./flows/${name}.mjs`)));
  await withPreview(
    ({ baseURL }) =>
      withBrowser(
        async ({ newPage }) => {
          for (const [i, name] of flows.entries()) {
            const page = await newPage({ width: 1280, height: 800 }, modules[i].pageOptions);
            console.log(`flow ${name}`);
            await modules[i].default({
              page,
              baseURL,
              assert,
              cvd: (vision) => cvd(page, vision),
              axe: () => axe(page),
              shot: async (shotName) => console.log(`  shot ${await shot(page, out, shotName)}`),
            });
            await page.context().close();
          }
        },
        { baseURL },
      ),
    { build: !('no-build' in args) },
  );
}, `e2e passed: ${flows.join(', ')}`);
