// O2: after one online visit the service worker (scripts/gen-sw.mjs) has
// precached the app; with the context offline, reloading / and /s/diffusion
// still renders live figures, and the input shows the offline message.
// Runs on the harness build (`vite build` + gen-sw: the same client bundle as
// `pnpm build:prod`, with the local-safe Worker config so no login is needed).
export const pageOptions = { serviceWorkers: 'allow' };

const OFFLINE = 'You’re offline. The samples below still work.';
const FIG = '#fig-histogram';

/** The figure answers the keyboard: End moves the knob and changes the readout. */
async function assertLive(page, assert, what) {
  const knob = page.locator(`${FIG} .xfig-knob`);
  const readout = page.locator(`${FIG} .xfig-readout`);
  const before = await readout.textContent();
  await knob.focus();
  await page.keyboard.press('End');
  await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('aria-valuenow') === '1000', `${FIG} .xfig-knob`);
  assert.notEqual(await readout.textContent(), before, `${what}: the readout follows the knob`);
}

export default async function offline({ page, baseURL, assert, shot }) {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => navigator.serviceWorker?.controller?.state === 'activated', null, { timeout: 15_000 });
  const cached = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (k) => (await (await caches.open(k)).keys()).length))).reduce((a, b) => a + b, 0));
  assert.ok(cached >= 8, `the service worker precached the app (${cached} entries)`);

  await page.context().setOffline(true);
  try {
    await page.reload({ waitUntil: 'load' });
    await page.locator('main h1').first().waitFor();
    assert.ok((await page.locator('.card').count()) >= 3, 'offline /: the sample cards render');
    assert.equal((await page.locator('.offline-banner').textContent())?.trim(), OFFLINE);
    assert.ok(await page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('16px Newsreader'))), 'offline /: fonts come from the cache');
    await shot('offline-reload-home');

    await page.goto(`${baseURL}/s/diffusion`, { waitUntil: 'load' });
    await page.reload({ waitUntil: 'load' });
    await page.locator('.essay-takeaway').waitFor();
    assert.ok((await page.locator('figure.xfig').count()) >= 2, 'offline /s/diffusion: both figures render');
    await assertLive(page, assert, 'offline /s/diffusion');
    await shot('offline-reload-diffusion');
  } finally {
    await page.context().setOffline(false);
  }
}
