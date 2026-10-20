// Bloom Fig 1 is live: the false-positive query by keyboard, k = 1 then 6 by
// keyboard, an n drag, CVD, axe, and the 2 × 16 layout at 390 px.
import { blocking } from '../lib/axe.mjs';

const FIG = '#fig-bits';
const readout = (page) => page.locator(`${FIG} .xfig-readout`).textContent();
const fpr = (text) => Number(/predicted FPR ([\d.]+)%/.exec(text)?.[1]);

/** Wait until eased motion has finished: the knob stops moving and the 150 ms bit fade is over. */
async function settled(page) {
  await page.waitForFunction(
    (fig) => {
      const root = document.querySelector(fig);
      const move = root.querySelector('.xfig-knob g')?.getAttribute('transform') ?? '';
      const ok = move === root.dataset.lastKnob;
      root.dataset.lastKnob = move;
      return ok;
    },
    FIG,
    { polling: 200, timeout: 5000 },
  );
  await page.waitForTimeout(250);
}

/** Every control's pointer target is ≥ 44 × 44 CSS px. */
async function assertHitAreas(page, assert, width) {
  for (const sel of ['.xfig-knob-hit', '.xfig-track-hit', 'input[type=range]', 'fieldset label', '.xfig-data-toggle']) {
    for (const box of await Promise.all((await page.locator(`${FIG} ${sel}`).all()).map((l) => l.boundingBox()))) {
      assert.ok(box.width >= 44 && box.height >= 44, `${sel} hit area ${box.width}×${box.height} ≥ 44 px at ${width} px`);
    }
  }
}

/** Client x of n on the knob track (0 … 12). */
async function trackX(page, n) {
  const box = await page.locator(`${FIG} .xfig-track-line`).boundingBox();
  return box.x + (n / 12) * box.width;
}

export default async function bloom({ page, baseURL, shot, assert, cvd, axe }) {
  await page.goto(`${baseURL}/s/bloom-filter`, { waitUntil: 'networkidle' });
  const fig = page.locator(FIG);
  await fig.locator('.xfig-knob').waitFor();
  await fig.scrollIntoViewIfNeeded();
  assert.equal(await readout(page), 'bits set 20 / 32 · predicted FPR 14.7% · observed FP 10 / 50');
  assert.equal((await fig.locator('.xfig-bit text').allTextContents()).join(''), '11001101111010101011010110010111', 'every cell shows its 1/0 glyph');
  const cell = await fig.locator('.xfig-bit rect').first().boundingBox();
  assert.ok(cell.width >= 24 && cell.height >= 24, `cells ≥ 24 px on desktop (${cell.width})`);
  assert.equal(new Set(await fig.locator('.xfig-bit').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top))).size, 1, 'one row on desktop');
  assert.equal(await fig.locator('.xfig-verdict-text').textContent(), 'maybe (true positive)');
  assert.deepEqual(blocking(await axe()).map((v) => `${v.id}: ${v.help}`), [], 'axe: no serious/critical violations');
  await assertHitAreas(page, assert, 1280);
  await settled(page);
  await shot('bloom-default');

  // The query picker by keyboard: cat → owl → plum → cherry with the arrow keys.
  await fig.locator('input[type=radio]:checked').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  assert.equal(await fig.locator('.xfig-verdict-text').textContent(), 'definitely not', 'plum is definitely not');
  assert.ok(await fig.getByText('0 here → definitely not').isVisible(), 'the first 0 bit is marked');
  await page.keyboard.press('ArrowRight');
  const fp = fig.getByText('maybe (false positive)', { exact: true });
  assert.ok(await fp.isVisible(), '"maybe (false positive)" is visible for cherry');
  assert.equal(await fig.locator('.xfig-verdict').getAttribute('fill'), 'url(#fig-bits-hatch)', 'false positive is hatched');
  assert.deepEqual(blocking(await axe()).map((v) => v.id), [], 'axe clean on the false-positive state');
  await settled(page);
  await shot('bloom-false-positive');
  for (const vision of ['deutan', 'protan', 'tritan']) {
    await cvd(vision);
    await shot(`bloom-${vision}`);
  }
  await cvd(null);

  // k = 1, then k = 6, with the keyboard on the native slider.
  await fig.locator('#fig-bits-k').focus();
  await page.keyboard.press('Home');
  const k1 = await readout(page);
  assert.equal(k1, 'bits set 7 / 32 · predicted FPR 22.1% · observed FP 9 / 50');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  const k6 = await readout(page);
  assert.equal(k6, 'bits set 26 / 32 · predicted FPR 22.0% · observed FP 15 / 50');
  assert.notEqual(fpr(k1), fpr(k6), 'predicted FPR changes with k');
  await settled(page);
  assert.equal(await fig.locator('.xfig-arrow').count(), 6, 'six probe arrows at k = 6 once motion settles');
  await shot('bloom-k6');

  // Drag n with the mouse: at k = 3, "hen" says maybe at n = 11 before it is inserted.
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await fig.locator('input[type=radio]').last().check();
  const ring = await fig.locator('.xfig-knob-ring').boundingBox();
  const y = ring.y + ring.height / 2;
  await page.mouse.move(await trackX(page, 8), y);
  await page.mouse.down();
  await page.mouse.move(await trackX(page, 11), y, { steps: 5 });
  await page.mouse.up();
  assert.equal(await fig.locator('.xfig-knob').getAttribute('aria-valuenow'), '11');
  assert.equal(await fig.locator('.xfig-verdict-text').textContent(), 'maybe (false positive)', 'hen is a false positive at n = 11');

  // 390 px: 2 rows of 16, no horizontal scroll, hit areas ≥ 44 px.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/s/bloom-filter`, { waitUntil: 'networkidle' });
  await fig.locator('.xfig-knob').waitFor();
  await fig.scrollIntoViewIfNeeded();
  const rows = await fig.locator('.xfig-bit').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  assert.equal(new Set(rows).size, 2, 'two rows of cells at 390 px');
  assert.equal(rows.filter((t) => t === rows[0]).length, 16, '16 cells per row');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'no horizontal scroll at 390 px');
  await assertHitAreas(page, assert, 390);
  await settled(page);
  await shot('bloom-mobile');
}
