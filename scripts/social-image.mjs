// pnpm build:images [--no-build]: the README hero and the social preview card,
// both captured through the harness (one preview server, one system Chrome).
// - docs/assets/hero.png: Fig. 1 of /s/attention mid-drag, the temperature knob
//   held at T = 0.5 so the bars are visibly sharpening (760 px page, 2x pixels).
// - docs/assets/social-preview.png: scripts/social/social.html at 1280×640,
//   with a still of the same live figure, taken in this run.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs, problems, run, withBrowser, withPreview } from './lib/harness.mjs';

const args = parseArgs(process.argv.slice(2));
const FIG = '#fig-temperature';
const [T_MIN, T_MAX, T_HELD] = [0.05, 5, 0.5];

/** Open /s/attention, grab the temperature knob at T = 1 and drag it to `T`, keeping the button down. Returns the readout. */
async function holdKnob(page, baseURL, T) {
  await page.goto(`${baseURL}/s/attention`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const fig = page.locator(FIG);
  await fig.scrollIntoViewIfNeeded();
  await fig.locator('.xfig-knob').waitFor();
  const track = await fig.locator('.xfig-track-line').boundingBox();
  const ring = await fig.locator('.xfig-knob-ring').boundingBox();
  if (!track || !ring) throw new Error('attention figure has no track or knob');
  const x = (t) => track.x + (Math.log(t / T_MIN) / Math.log(T_MAX / T_MIN)) * track.width;
  const y = ring.y + ring.height / 2;
  await page.mouse.move(x(1), y);
  await page.mouse.down();
  await page.mouse.move(x(T), y, { steps: 8 });
  const readout = (await fig.locator('.xfig-readout').textContent()) ?? '';
  if (!/top weight 0\.[6-9]/.test(readout)) problems.push(`drag to T = ${T} did not sharpen the bars (${readout})`);
  return readout;
}

await run(
  () =>
    withPreview(
      ({ baseURL }) =>
        withBrowser(
          async ({ newPage }) => {
            const page = await newPage({ width: 760, height: 1000 }, { deviceScaleFactor: 2, reducedMotion: 'reduce' });
            const readout = await holdKnob(page, baseURL, T_HELD);
            const box = await page.locator(FIG).boundingBox();
            if (!box) throw new Error('attention figure is not visible');
            const pad = 16;
            const hero = await page.screenshot({ clip: { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad } });
            writeFileSync('docs/assets/hero.png', hero);
            const still = await page.locator(`${FIG} .xfig-card`).screenshot();
            await page.mouse.up();
            console.log(`hero: ${readout}, ${(hero.length / 1024).toFixed(0)} KB`);

            const card = await newPage({ width: 1280, height: 640 }, { deviceScaleFactor: 1 });
            await card.route(`${baseURL}/social/**`, (route) => {
              const name = new URL(route.request().url()).pathname.slice('/social/'.length);
              if (name === 'figure.png') return route.fulfill({ body: still, contentType: 'image/png' });
              return route.fulfill({ body: readFileSync(`scripts/social/${name}`), contentType: 'text/html' });
            });
            await card.goto(`${baseURL}/social/social.html`, { waitUntil: 'networkidle' });
            await card.evaluate(() => document.fonts.ready);
            const social = await card.screenshot();
            writeFileSync('docs/assets/social-preview.png', social);
            console.log(`social: 1280×640, ${(social.length / 1024).toFixed(0)} KB`);
          },
          { baseURL },
        ),
      { build: !args['no-build'] },
    ),
  'wrote docs/assets/hero.png and docs/assets/social-preview.png',
);
