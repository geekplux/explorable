// pnpm smoke [--out <dir>] [--routes / /s/attention …] [--no-build]
// Screenshots each route at desktop and mobile size and checks the basics.
import { readdirSync } from 'node:fs';
import { parseArgs, problems, run, shot, withBrowser, withPreview } from './lib/harness.mjs';

const VIEWPORTS = { desktop: { width: 1280, height: 800 }, '800': { width: 800, height: 800 }, mobile: { width: 390, height: 844 } };
const args = parseArgs(process.argv.slice(2));
const out = args.out?.[0] ?? 'test-results/smoke';
const sampleRoutes = readdirSync('src/samples')
  .filter((f) => f.endsWith('.json'))
  .map((f) => `/s/${f.replace(/\.json$/, '')}`);
const routes = args.routes?.length ? args.routes : ['/', ...sampleRoutes];

const nameFor = (route) => (route === '/' ? 'home' : route.replace(/^\/(s\/)?/, '').replace(/\W+/g, '-'));

async function check(page, route, viewportName) {
  const where = `${route} @ ${viewportName}`;
  await page.locator('main h1').first().waitFor({ timeout: 10_000 });
  if (route === '/') {
    const cards = await page.locator('.card a').count();
    if (cards < 3) problems.push(`${where}: expected ≥ 3 sample cards, found ${cards}`);
  } else if (route.startsWith('/s/')) {
    const figures = await page.locator('figure.xfig').count();
    const takeaway = await page.locator('.essay-takeaway').count();
    if (figures < 1 || takeaway !== 1) problems.push(`${where}: essay incomplete (${figures} figures, ${takeaway} takeaway)`);
  }
  const fontsOk = await page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('16px Newsreader')));
  if (!fontsOk) problems.push(`${where}: Newsreader did not load`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) problems.push(`${where}: horizontal scroll of ${overflow}px`);
}

await run(
  () =>
    withPreview(
      ({ baseURL }) =>
        withBrowser(
          async ({ newPage }) => {
            for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
              const page = await newPage(viewport);
              for (const route of viewportName === '800' ? routes.filter((r) => r === '/') : routes) {
                await page.goto(baseURL + route, { waitUntil: 'networkidle' });
                await check(page, route, viewportName);
                if (viewportName === 'desktop' && route.startsWith('/s/')) {
                  // SPA deep-link fallback must also hold on reload (served by the Worker's asset config).
                  await page.reload({ waitUntil: 'networkidle' });
                  await check(page, route, `${viewportName} after reload`);
                }
                console.log(`shot ${await shot(page, out, `${nameFor(route)}-${viewportName}`)}`);
              }
              await page.context().close();
            }
          },
          { baseURL },
        ),
      { build: !('no-build' in args) },
    ),
  'smoke passed',
);
