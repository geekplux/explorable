// Diffusion Fig 1 is live: keyboard scrubbing (PageUp = 50), a drag on the t
// track, the native range, "Show data", CVD, axe, reduced motion (no morph
// easing), and 1280 / 390 / 320 px with no text overlaps, no clipped text and
// ≥ 44 px hit areas.
// Diffusion Fig 2 (curve): signal solid with ●, noise dashed with ■, both
// labelled, the crossing at t = 260 marked, ∞ dB at t = 0, CVD, and no text
// overlaps or clipping at 1280 / 390 / 320 px.
import { blocking } from '../lib/axe.mjs';
import { assertHitAreas as hitAreas, assertTableContained, settledBy, textProblems as problemsIn } from '../lib/figure.mjs';

const FIG = '#fig-histogram';
const READ_T0 = 'signal √ᾱ_t 1.000 noise √(1−ᾱ_t) 0.000 spread (SD) 1.77';
const READ_T1000 = 'signal √ᾱ_t 0.006 noise √(1−ᾱ_t) 1.000 spread (SD) 1.01';

const readout = (page) => page.locator(`${FIG} .xfig-readout`).textContent();
const value = (page) => page.locator(`${FIG} .xfig-knob`).getAttribute('aria-valuenow');
/** Every bar height as one string: changes whenever the drawn histogram does. */
const heights = (page) =>
  page.evaluate((fig) => [...document.querySelectorAll(`${fig} rect.xfig-bar`)].map((r) => r.getAttribute('height')).join(), FIG);

/** Wait until eased motion has finished: the bars and the knob stop changing between polls. */
async function settled(page) {
  await page.waitForFunction(
    (fig) => {
      const root = document.querySelector(fig);
      const now = [...root.querySelectorAll('rect.xfig-bar')].map((r) => r.getAttribute('height')).join() + (root.querySelector('.xfig-knob g')?.getAttribute('transform') ?? '');
      const ok = now === root.dataset.lastDraw;
      root.dataset.lastDraw = now;
      return ok;
    },
    FIG,
    { polling: 200, timeout: 10_000 },
  );
}

/** Pairs of visible SVG texts whose boxes overlap, plus texts that leave the figure card or the viewport. */
const textProblems = (page) =>
  page.evaluate((fig) => {
    const root = document.querySelector(fig);
    const card = root.querySelector('.xfig-card') ?? root;
    const frame = card.getBoundingClientRect();
    const boxes = [...root.querySelectorAll('svg text')]
      .filter((t) => t.textContent.trim() && getComputedStyle(t).visibility !== 'hidden')
      .map((t) => ({ text: t.textContent, r: t.getBoundingClientRect() }));
    const hits = [];
    for (const [i, a] of boxes.entries()) {
      if (a.r.left < Math.max(0, frame.left) - 0.5 || a.r.right > Math.min(innerWidth, frame.right) + 0.5) hits.push(`clipped: ${a.text}`);
      for (const b of boxes.slice(i + 1)) {
        if (a.r.left < b.r.right && b.r.left < a.r.right && a.r.top < b.r.bottom && b.r.top < a.r.bottom) hits.push(`${a.text} × ${b.text}`);
      }
    }
    return hits;
  }, FIG);

/** Every control's pointer target is ≥ 44 × 44 CSS px. */
async function assertHitAreas(page, assert, width) {
  for (const sel of ['.xfig-knob-hit', '.xfig-track-hit', 'input[type=range]', '.xfig-data-toggle']) {
    const box = await page.locator(`${FIG} ${sel}`).boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, `${sel} hit area ${box.width}×${box.height} ≥ 44 px at ${width} px`);
  }
}

async function open(page, baseURL) {
  await page.goto(`${baseURL}/s/diffusion`, { waitUntil: 'networkidle' });
  const fig = page.locator(FIG);
  await fig.locator('.xfig-knob').waitFor();
  await fig.scrollIntoViewIfNeeded();
  return fig;
}

/** Press `key` on the focused control `n` times. */
async function press(page, key, n) {
  for (let i = 0; i < n; i++) await page.keyboard.press(key);
}

export default async function diffusion({ page, baseURL, shot, assert, cvd, axe }) {
  const fig = await open(page, baseURL);
  assert.equal(await readout(page), READ_T0);
  assert.equal(await fig.locator('.xfig-chip').textContent(), 't = 0 ᾱ_t = 1.00');
  assert.equal(await fig.locator('.xfig-ref-label').textContent(), 'N(0, 1)', 'the reference curve is labelled in the SVG');
  assert.equal(await fig.locator('.xfig-ref').evaluate((p) => getComputedStyle(p).strokeDasharray), '1px, 3px', 'the reference is dotted');
  const bar = await fig.locator('rect.xfig-bar').first().evaluate((r) => [getComputedStyle(r).fill, getComputedStyle(r).stroke]);
  assert.notEqual(bar[0], bar[1], 'bars have an outline distinct from their fill');
  assert.deepEqual(blocking(await axe()).map((v) => `${v.id}: ${v.help}`), [], 'axe: no serious/critical violations');
  await assertHitAreas(page, assert, 1280);
  await settled(page);
  assert.deepEqual(await textProblems(page), [], 'no text overlaps at 1280 px (t = 0)');
  await shot('diffusion-t0');

  // Keyboard on the knob: PageUp steps 50, then t = 100, 400 and End.
  const knob = fig.locator('.xfig-knob');
  await knob.focus();
  await page.keyboard.press('PageUp');
  assert.equal(await value(page), '50', 'PageUp from 0 goes to 50');
  await page.keyboard.press('PageUp');
  assert.equal(await knob.getAttribute('aria-valuetext'), '100 of 1000');
  assert.equal(await readout(page), 'signal √ᾱ_t 0.947 noise √(1−ᾱ_t) 0.321 spread (SD) 1.71');
  await settled(page);
  assert.deepEqual(await textProblems(page), [], 'no text overlaps at 1280 px (t = 100)');
  await shot('diffusion-t100');
  await press(page, 'PageUp', 6);
  assert.equal(await value(page), '400');
  assert.equal(await readout(page), 'signal √ᾱ_t 0.442 noise √(1−ᾱ_t) 0.897 spread (SD) 1.20');
  await settled(page);
  await shot('diffusion-t400');
  await page.keyboard.press('End');
  assert.equal(await readout(page), READ_T1000);
  await settled(page);
  assert.deepEqual(await textProblems(page), [], 'no text overlaps at 1280 px (t = 1000)');
  await shot('diffusion-t1000');

  // Drag the knob from 1000 back to about 250: the bars morph and the readout follows.
  const before = await heights(page);
  const track = await fig.locator('.xfig-track-line').boundingBox();
  const ring = await fig.locator('.xfig-knob-ring').boundingBox();
  const y = ring.y + ring.height / 2;
  await page.mouse.move(ring.x + ring.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(track.x + 0.25 * track.width, y, { steps: 8 });
  await page.mouse.up();
  const dragged = Number(await value(page));
  assert.ok(Math.abs(dragged - 250) <= 10, `drag lands near t = 250 (${dragged})`);
  assert.notEqual(await heights(page), before, 'dragging morphs the histogram');
  assert.notEqual(await readout(page), READ_T1000, 'the readout follows the drag');

  // The native range by keyboard stays in sync with the knob.
  await fig.locator('#fig-histogram-t').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('PageUp');
  assert.equal(await value(page), '50', 'the native range steps 50 with PageUp');
  assert.equal(await fig.locator('#fig-histogram-t').getAttribute('aria-valuetext'), '50 of 1000', 'the value only: the label already names the slider');
  assert.equal(await fig.locator('output').textContent(), 't = 50');

  // "Show data": 60 bins.
  await fig.locator('.xfig-data-toggle').click();
  assert.equal(await fig.locator('table.xfig-table tbody tr').count(), 60);
  await fig.locator('table.xfig-table').scrollIntoViewIfNeeded();
  // The PageUp above starts an eased morph; shoot only once it has landed.
  await settled(page);
  await shot('diffusion-table');
  await fig.locator('.xfig-data-toggle').click();

  await fig.scrollIntoViewIfNeeded();
  await knob.focus();
  await press(page, 'PageUp', 7);
  await settled(page);
  for (const vision of ['deutan', 'protan', 'tritan']) {
    await cvd(vision);
    await shot(`diffusion-${vision}`);
  }
  await cvd(null);

  // Reduced motion: a keyboard step lands at once, with no morph easing.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, baseURL);
  await settled(page);
  await knob.focus();
  await page.keyboard.press('PageUp');
  const h1 = await heights(page);
  await page.waitForTimeout(400);
  assert.equal(await heights(page), h1, 'reduced motion: no easing after a keyboard step');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page, baseURL);
  await settled(page);
  await knob.focus();
  await page.keyboard.press('End');
  const e1 = await heights(page);
  await page.waitForTimeout(600);
  assert.notEqual(await heights(page), e1, 'without reduced motion the histogram eases toward the target');

  // Narrow widths: no overlaps or clipped text (the static "drag" hint shows under reduced motion), hit areas ≥ 44 px.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await open(page, baseURL);
    await settled(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `no horizontal scroll at ${width} px`);
    await assertHitAreas(page, assert, width);
    assert.deepEqual(await textProblems(page), [], `no text overlaps or clipping at ${width} px (t = 0, hint showing)`);
    await knob.focus();
    for (const key of ['PageUp', 'PageUp', 'End']) {
      await page.keyboard.press(key);
      assert.deepEqual(await textProblems(page), [], `no text overlaps or clipping at ${width} px (t = ${await value(page)})`);
    }
    await page.keyboard.press('Home');
    await press(page, 'PageUp', 2);
    await settled(page);
    await shot(width === 390 ? 'diffusion-mobile' : 'diffusion-320');
    // The open data table scrolls inside its own focusable region, never the page (WCAG 1.4.10).
    await fig.locator('.xfig-data-toggle').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `open table: no page scroll at ${width} px`);
    await fig.locator('.xfig-table-wrap').focus();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'region');
    await fig.locator('.xfig-data-toggle').click();
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await signalNoise({ page, baseURL, shot, assert, cvd, axe });
}

const SN = '#fig-signal-noise';
const snReadout = (page) => page.locator(`${SN} .xfig-readout`).textContent();
const snSettled = (page) => settledBy(page, SN, (root) => root.querySelector('.xfig-knob g')?.getAttribute('transform') ?? '');

async function openSN(page, baseURL) {
  await page.goto(`${baseURL}/s/diffusion`, { waitUntil: 'networkidle' });
  const fig = page.locator(SN);
  await fig.locator('.xfig-knob').waitFor();
  await fig.scrollIntoViewIfNeeded();
  await snSettled(page);
  return fig;
}

/** Diffusion Fig 2: √ᾱ_t and √(1−ᾱ_t) over t from the registry's precomputed series. */
async function signalNoise({ page, baseURL, shot, assert, cvd, axe }) {
  const fig = await openSN(page, baseURL);
  assert.equal(await snReadout(page), 'ᾱ_t 0.897 SNR 9.4 dB');
  assert.deepEqual(await fig.locator('.xfig-series-label').allTextContents(), ['signal √ᾱ_t', 'noise √(1−ᾱ_t)']);
  assert.equal(await fig.locator('.xfig-marker-label').textContent(), 'signal = noise (t ≈ 260)');
  const dash = (sel) => fig.locator(`svg.xfig-curve ${sel}`).evaluate((p) => getComputedStyle(p).strokeDasharray);
  assert.equal(await dash('.xfig-line.xfig-s0'), 'none', 'signal is solid');
  assert.equal(await dash('.xfig-line.xfig-s1'), '6px, 3px', 'noise is dashed');
  assert.deepEqual(blocking(await axe()).map((v) => `${v.id}: ${v.help}`), [], 'axe: no serious/critical violations');
  await hitAreas(page, assert, SN, 1280);
  assert.deepEqual(await problemsIn(page, SN), [], 'Fig 2: no text overlaps at 1280 px');
  await shot('diffusion-fig2');
  for (const vision of ['deutan', 'protan', 'tritan']) {
    await cvd(vision);
    await shot(`diffusion-fig2-${vision}`);
  }
  await cvd(null);

  const knob = fig.locator('.xfig-knob');
  await knob.focus();
  await page.keyboard.press('Home');
  assert.equal(await snReadout(page), 'ᾱ_t 1.00 SNR ∞ dB', 'non-finite SNR prints as ∞');
  await page.keyboard.press('End');
  assert.equal(await snReadout(page), 'ᾱ_t 4.04 × 10⁻⁵ SNR −43.9 dB');
  await snSettled(page);
  assert.deepEqual(await problemsIn(page, SN), [], 'Fig 2: no text overlaps at t = 1000');
  await fig.locator('.xfig-data-toggle').click();
  assert.equal(await fig.locator('table.xfig-table tbody tr').count(), 6, 't = 950 … 1000, clipped to the range');
  await assertTableContained(page, assert, SN, 1280);
  await fig.locator('.xfig-data-toggle').click();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await openSN(page, baseURL);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `no horizontal scroll at ${width} px`);
    await hitAreas(page, assert, SN, width);
    assert.deepEqual(await problemsIn(page, SN), [], `Fig 2: no text overlaps or clipping at ${width} px (hint showing)`);
    await shot(width === 390 ? 'diffusion-fig2-mobile' : 'diffusion-fig2-320');
    await knob.focus();
    for (const key of ['Home', 'PageUp', 'PageUp', 'PageUp', 'PageUp', 'PageUp', 'End']) {
      await page.keyboard.press(key);
      assert.deepEqual(await problemsIn(page, SN), [], `Fig 2: no text overlaps or clipping at ${width} px (t = ${await knob.getAttribute('aria-valuenow')})`);
    }
    await fig.locator('.xfig-data-toggle').click();
    await assertTableContained(page, assert, SN, width);
    await fig.locator('.xfig-data-toggle').click();
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 800 });
}
