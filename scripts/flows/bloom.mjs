// Bloom Fig 1 is live: the false-positive query by keyboard, k = 1 then 6 by
// keyboard, an n drag, CVD, axe, and the 2 × 16 layout at 390 px.
// Bloom Fig 2 (curve): the knob dragged along the FPR curve, the optimal-k
// marker for k = 6 and off the chart, the data table, CVD, 1280 / 390 / 320 px
// with no text overlaps or clipping and ≥ 44 px hit areas, and a vertical
// touch swipe at 390 px that scrolls without moving the knob.
import { blocking } from '../lib/axe.mjs';
import { assertHitAreas as hitAreas, assertTableContained, settledBy, textProblems } from '../lib/figure.mjs';

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
    { polling: 200, timeout: 10_000 },
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
  assert.equal(await readout(page), 'bits set 20 / 32 predicted FPR 14.7% observed FP 10 / 50');
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
  assert.equal(k1, 'bits set 7 / 32 predicted FPR 22.1% observed FP 9 / 50');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  const k6 = await readout(page);
  assert.equal(k6, 'bits set 26 / 32 predicted FPR 22.0% observed FP 15 / 50');
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
  await page.setViewportSize({ width: 1280, height: 800 });
  await fprCurve({ page, baseURL, shot, assert, cvd, axe });
}

const CURVE = '#fig-fpr-curve';
const curveReadout = (page) => page.locator(`${CURVE} .xfig-readout`).textContent();
const curveSettled = (page) =>
  settledBy(page, CURVE, (root) => (root.querySelector('svg.xfig-curve .xfig-line')?.getAttribute('d') ?? '') + (root.querySelector('.xfig-knob g')?.getAttribute('transform') ?? ''));

async function openCurve(page, baseURL) {
  await page.goto(`${baseURL}/s/bloom-filter`, { waitUntil: 'networkidle' });
  const fig = page.locator(CURVE);
  await fig.locator('.xfig-knob').waitFor();
  await fig.scrollIntoViewIfNeeded();
  await curveSettled(page);
  return fig;
}

/** A vertical touch swipe over the plot, away from the knob, scrolls the page and leaves n alone. */
async function verticalSwipe(page, assert, fig) {
  const before = await fig.locator('.xfig-knob').getAttribute('aria-valuenow');
  const band = await fig.locator('.xfig-track-hit').boundingBox();
  const [x, y] = [band.x + band.width * 0.8, band.y + band.height * 0.6];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const touch = (type, dy = 0) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: y + dy }] });
  await touch('touchStart');
  for (const dy of [-10, -25, -45, -70, -100]) await touch('touchMove', dy);
  await touch('touchEnd');
  await page.waitForTimeout(150);
  assert.equal(await fig.locator('.xfig-knob').getAttribute('aria-valuenow'), before, 'a vertical touch swipe over the plot does not move the knob');
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await cdp.detach();
  await fig.scrollIntoViewIfNeeded();
}

/** Bloom Fig 2: the FPR curve over n for the current m and k. */
async function fprCurve({ page, baseURL, shot, assert, cvd, axe }) {
  const fig = await openCurve(page, baseURL);
  assert.equal(await curveReadout(page), 'items inserted n 8 false-positive rate 14.7%');
  assert.equal(await fig.locator('.xfig-marker-label').textContent(), 'k = 3 is best at n ≈ 7.4');
  assert.equal(await fig.locator('.xfig-series-label').textContent(), 'k = 3, m = 32');
  assert.equal(await fig.locator('.xfig-ref-label').textContent(), 'best possible k');
  assert.equal(await fig.locator('svg.xfig-curve .xfig-ref').evaluate((p) => getComputedStyle(p).strokeDasharray), '1px, 3px', 'the reference is dotted');
  assert.notEqual(await fig.locator('.xfig-meet').evaluate((p) => getComputedStyle(p).fill), 'none', 'the marker point is filled, not a ring');
  assert.deepEqual(blocking(await axe()).map((v) => `${v.id}: ${v.help}`), [], 'axe: no serious/critical violations');
  await hitAreas(page, assert, CURVE, 1280);
  assert.deepEqual(await textProblems(page, CURVE), [], 'Fig 2: no text overlaps at 1280 px');
  await shot('bloom-fig2');

  // Drag the knob along the curve from n = 8 to n = 16.
  const band = await fig.locator('.xfig-track-hit').boundingBox();
  const xOf = (n) => band.x + 23 + ((n - 1) / 63) * (band.width - 46);
  const ring = await fig.locator('.xfig-knob-ring').boundingBox();
  await page.mouse.move(ring.x + ring.width / 2, ring.y + ring.height / 2);
  await page.mouse.down();
  await page.mouse.move(xOf(16), ring.y - 60, { steps: 8 });
  await page.mouse.up();
  assert.equal(await fig.locator('.xfig-knob').getAttribute('aria-valuenow'), '16');
  assert.equal(await curveReadout(page), 'items inserted n 16 false-positive rate 46.9%');
  await page.waitForFunction((sel) => document.querySelector(`${sel}-desc`)?.textContent === 'At n = 16 items, the false-positive rate is 46.9%; k = 3 is best at n ≈ 7.4.', CURVE, { timeout: 10_000 });
  const knobY = (await fig.locator('.xfig-knob-ring').boundingBox()).y;
  assert.ok(knobY < ring.y - 40, 'the knob climbs the curve as n grows');
  await curveSettled(page);
  assert.deepEqual(await textProblems(page, CURVE), [], 'Fig 2: no text overlaps after the drag');
  await shot('bloom-fig2-drag');

  // k = 6 keeps n and moves the marker; m = 128 with k = 1 pushes it off the chart.
  await fig.locator('#fig-fpr-curve-k').focus();
  await page.keyboard.press('End');
  await curveSettled(page);
  assert.equal(await fig.locator('.xfig-marker-label').textContent(), 'k = 6 is best at n ≈ 3.7');
  assert.match(await curveReadout(page), /^items inserted n 16 /);
  await curveSettled(page);
  for (const vision of ['deutan', 'protan', 'tritan']) {
    await cvd(vision);
    await shot(`bloom-fig2-${vision}`);
  }
  await cvd(null);
  await fig.locator('#fig-fpr-curve-m').focus();
  await page.keyboard.press('End');
  await fig.locator('#fig-fpr-curve-k').focus();
  await page.keyboard.press('Home');
  await curveSettled(page);
  assert.equal(await fig.locator('.xfig-marker-label').textContent(), 'k = 1 is best at n ≈ 88.7 (off the chart)');
  await curveSettled(page);
  assert.deepEqual(await textProblems(page, CURVE), [], 'Fig 2: no text overlaps with the marker off the chart');

  // "Show data": 11 points around the knob, inside the table's own scroll region.
  await fig.locator('.xfig-data-toggle').click();
  assert.equal(await fig.locator('table.xfig-table tbody tr').count(), 11);
  await assertTableContained(page, assert, CURVE, 1280);
  await fig.locator('table.xfig-table').scrollIntoViewIfNeeded();
  await shot('bloom-fig2-table');
  await fig.locator('.xfig-data-toggle').click();

  // Narrow widths with the static "drag" hint (reduced motion): no overlaps, clipping or sideways scroll.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await openCurve(page, baseURL);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `no horizontal scroll at ${width} px`);
    await hitAreas(page, assert, CURVE, width);
    assert.deepEqual(await textProblems(page, CURVE), [], `Fig 2: no text overlaps or clipping at ${width} px (hint showing)`);
    await shot(width === 390 ? 'curve-mobile' : 'bloom-fig2-320');
    if (width === 390) await verticalSwipe(page, assert, fig);
    const states = [['#fig-fpr-curve-k', 'End'], ['#fig-fpr-curve-m', 'End'], ['#fig-fpr-curve-k', 'Home'], ['#fig-fpr-curve-x', 'End'], ['#fig-fpr-curve-m', 'Home']];
    for (const [sel, key] of states) {
      await fig.locator(sel).focus();
      await page.keyboard.press(key);
      assert.deepEqual(await textProblems(page, CURVE), [], `Fig 2: no text overlaps or clipping at ${width} px (${sel} ${key})`);
    }
    await fig.locator('.xfig-data-toggle').click();
    await assertTableContained(page, assert, CURVE, width);
    await fig.locator('.xfig-data-toggle').click();
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 800 });
}
