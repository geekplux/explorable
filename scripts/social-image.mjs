// pnpm build:images [--no-build]: the README hero and the social preview card,
// both captured through the harness (one preview server, one system Chrome).
// - docs/assets/hero.webp: the home page, first screen at 1440 × 900, light. Chrome
//   encodes the WebP itself (a canvas on about:blank), so no image library is needed.
// - public/social-preview.png: scripts/social/social.html at 1280 × 640, with a still
//   of the home page's live figure, its temperature knob held at T = 0.5 so the bars
//   are visibly sharpening. Served at /social-preview.png for the og:image meta tags.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs, problems, run, withBrowser, withPreview } from './lib/harness.mjs';

const args = parseArgs(process.argv.slice(2));
const FIG = '.hero-fig';
const [T_MIN, T_MAX, T_HELD] = [0.05, 5, 0.5];

/** Grab the hero figure's temperature knob at T = 1 and drag it to `T`, keeping the button down. Returns the readout. */
async function holdKnob(page, T) {
  const fig = page.locator(FIG);
  await fig.locator('.xfig-knob').waitFor();
  const track = await fig.locator('.xfig-track-line').boundingBox();
  const ring = await fig.locator('.xfig-knob-ring').boundingBox();
  if (!track || !ring) throw new Error('hero figure has no track or knob');
  const x = (t) => track.x + (Math.log(t / T_MIN) / Math.log(T_MAX / T_MIN)) * track.width;
  const y = ring.y + ring.height / 2;
  await page.mouse.move(x(1), y);
  await page.mouse.down();
  await page.mouse.move(x(T), y, { steps: 8 });
  await page.waitForTimeout(400); // the bars settle in 250 ms
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
            const home = await newPage({ width: 1440, height: 900 }, { colorScheme: 'light', reducedMotion: 'reduce' });
            await home.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
            await home.evaluate(() => document.fonts.ready);
            await home.locator(`${FIG} .xfig-knob`).waitFor();
            const shot = await home.screenshot();

            const blank = await newPage({ width: 200, height: 200 });
            const webp = await blank.evaluate(async (b64) => {
              const img = new Image();
              img.src = `data:image/png;base64,${b64}`;
              await img.decode();
              const canvas = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
              canvas.getContext('2d')?.drawImage(img, 0, 0);
              return canvas.toDataURL('image/webp', 0.9).split(',')[1];
            }, shot.toString('base64'));
            const hero = Buffer.from(webp, 'base64');
            if (hero.subarray(8, 12).toString() !== 'WEBP') throw new Error('Chrome did not encode a WebP');
            mkdirSync('docs/assets', { recursive: true });
            writeFileSync('docs/assets/hero.webp', hero);
            console.log(`hero: 1440×900, ${(hero.length / 1024).toFixed(0)} KB`);

            const page = await newPage({ width: 1440, height: 900 }, { deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce' });
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
            await page.evaluate(() => document.fonts.ready);
            const readout = await holdKnob(page, T_HELD);
            const still = await page.locator(`${FIG} .xfig-stage`).screenshot();
            await page.mouse.up();
            console.log(`still: ${readout}`);

            const card = await newPage({ width: 1280, height: 640 }, { deviceScaleFactor: 1, colorScheme: 'light' });
            await card.route(`${baseURL}/social/**`, (route) => {
              const name = new URL(route.request().url()).pathname.slice('/social/'.length);
              if (name === 'figure.png') return route.fulfill({ body: still, contentType: 'image/png' });
              return route.fulfill({ body: readFileSync(`scripts/social/${name}`), contentType: 'text/html' });
            });
            await card.goto(`${baseURL}/social/social.html`, { waitUntil: 'networkidle' });
            await card.evaluate(() => document.fonts.ready);
            const social = await card.screenshot();
            writeFileSync('public/social-preview.png', social);
            console.log(`social: 1280×640, ${(social.length / 1024).toFixed(0)} KB`);
          },
          { baseURL },
        ),
      { build: !args['no-build'] },
    ),
  'wrote docs/assets/hero.webp and public/social-preview.png',
);
