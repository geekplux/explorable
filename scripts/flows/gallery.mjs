// Home: the hero figure is live and keyboard-operable, the essay index has ≥ 3 complete single-link rows
// whose thumbnails play once on hover, axe is clean on / (light and dark) and /s/attention, CVD shots.
import { blocking } from '../lib/axe.mjs';

const VISIONS = ['protan', 'deutan', 'tritan'];
const HERO = '.hero-fig';

async function assertAxeClean({ page, axe, assert }, what = page.url()) {
  const bad = blocking(await axe());
  assert.deepEqual(
    bad.map((v) => `${v.id} (${v.impact}): ${v.help}`),
    [],
    `serious/critical axe violations on ${what}`,
  );
}

/** Handle x positions of a row's thumbnail, sampled every 40 ms for `ms`. */
async function handlePath(page, row, ms) {
  const seen = [];
  for (let t = 0; t <= ms; t += 40) {
    seen.push(Number(await row.locator('.th-handle').getAttribute('cx')));
    await page.waitForTimeout(40);
  }
  return seen;
}

export default async function gallery(ctx) {
  const { page, baseURL, shot, assert, cvd } = ctx;
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });

  const rows = await page.locator('#essays a.essay-row').evaluateAll((els) =>
    els.map((el) => ({
      href: el.getAttribute('href'),
      title: el.querySelector('.essay-title')?.textContent?.trim(),
      dek: el.querySelector('.essay-dek')?.textContent?.trim(),
      meta: el.querySelector('.essay-meta')?.textContent?.trim(),
      thumb: !!el.querySelector('svg.thumb .th-handle'),
      links: el.querySelectorAll('a').length,
    })),
  );
  assert.ok(rows.length >= 3, `expected ≥ 3 essay rows, found ${rows.length}`);
  for (const row of rows) assert.ok(row.title && row.dek && row.meta && row.thumb && row.links === 0, `incomplete row ${JSON.stringify(row)}`);

  // The hero figure runs the real model: End on its slider changes bars and readout.
  const knob = page.locator(`${HERO} .xfig-knob[role="slider"]`);
  const readout = page.locator(`${HERO} .xfig-readout`);
  assert.equal(await readout.textContent(), 'top weight 0.51 entropy 2.05 bits');
  await knob.focus();
  await page.keyboard.press('End');
  await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('aria-valuenow') === '5', `${HERO} .xfig-knob`);
  assert.match((await readout.textContent()) ?? '', /^top weight 0\.2\d entropy 2\.5\d bits$/, 'the readout follows the hero slider');
  await page.keyboard.press('Home');
  await page.keyboard.press('PageUp');

  await assertAxeClean(ctx, '/ (light)');
  await shot('gallery-home');

  // Hover plays the thumbnail once: the handle leaves its rest, then comes back within ~600 ms.
  const row = page.locator('#essays a.essay-row').first();
  await row.scrollIntoViewIfNeeded();
  const rest = Number(await row.locator('.th-handle').getAttribute('cx'));
  await row.hover();
  const path = await handlePath(page, row, 800);
  assert.ok(Math.min(...path) < rest - 50, `hover sweeps the handle toward the far end (${path.join(', ')})`);
  assert.equal(path.at(-1), rest, 'the handle returns to rest');
  assert.equal(await row.locator('.essay-no').evaluate((el) => getComputedStyle(el).color), await page.locator('h1').evaluate((el) => getComputedStyle(el).color), 'the hovered row number turns to ink');

  await page.emulateMedia({ colorScheme: 'dark' });
  await assertAxeClean(ctx, '/ (dark)');
  await shot('gallery-home-dark');
  await page.emulateMedia({ colorScheme: 'light' });

  for (const vision of VISIONS) {
    await cvd(vision);
    await shot(`home-${vision}`);
  }
  await cvd(null);

  await page.locator('#essays a.essay-row').first().click();
  await page.waitForURL(`${baseURL}/s/attention`);
  await page.locator('.essay-takeaway').waitFor();
  assert.ok((await page.locator('figure.xfig').count()) >= 2, 'attention essay shows ≥ 2 figures');
  await assertAxeClean(ctx);
  await shot('gallery-attention');
}
