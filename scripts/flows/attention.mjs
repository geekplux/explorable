// Attention Fig 1 is live: mouse drag, keyboard-only End, "Show data", CVD,
// axe, and a touch drag at 390 px with ≥ 44 px hit areas. Fig 2: drag d_k
// unscaled, then flip the √d_k switch by keyboard and drag again.
import { blocking } from '../lib/axe.mjs';

const FIG = '#fig-temperature';
const T_MIN = 0.05;
const T_MAX = 5;

/** Readout, knob value and the drawn height of the "cat" bar relative to the full axis, read in one task. */
const state = (page) =>
  page.evaluate((fig) => {
    const root = document.querySelector(fig);
    const bar = root.querySelectorAll('rect.xfig-bar')[1];
    const grid = [...root.querySelectorAll('.xfig-grid, .xfig-baseline')].map((p) => Number(p.getAttribute('d').split(' ')[1].split('H')[0]));
    return {
      readout: root.querySelector('.xfig-readout').textContent,
      value: Number(root.querySelector('.xfig-knob').getAttribute('aria-valuenow')),
      valuetext: root.querySelector('.xfig-knob').getAttribute('aria-valuetext'),
      catShare: Number(bar.getAttribute('height')) / (Math.max(...grid) - Math.min(...grid)),
    };
  }, FIG);
const topWeight = (readout) => Number(/top weight ([\d.]+)/.exec(readout)?.[1]);

/** Wait until eased keyboard motion has finished: the top bar's label matches the readout and the knob stops moving. */
async function settled(page) {
  await page.waitForFunction((fig) => {
    const root = document.querySelector(fig);
    const top = root.querySelector('.xfig-bar-value.is-top')?.textContent;
    const move = root.querySelector('.xfig-knob g')?.getAttribute('transform');
    const ok = top && root.querySelector('.xfig-readout').textContent.includes(`top weight ${top}`) && move === root.dataset.lastKnob;
    root.dataset.lastKnob = move ?? "";
    return ok;
  }, FIG, { polling: 100, timeout: 5000 });
}

/** Hit areas of every control in Fig 1 are ≥ 44 × 44 CSS px. */
async function assertHitAreas(page, assert, width) {
  for (const sel of ['.xfig-knob-hit', '.xfig-track-hit', 'input[type=range]', '.xfig-data-toggle']) {
    const box = await page.locator(`${FIG} ${sel}`).boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, `${sel} hit area ${box.width}×${box.height} ≥ 44 px at ${width} px`);
  }
}

/** Client x of temperature T on the track. */
async function trackX(page, T) {
  const box = await page.locator(`${FIG} .xfig-track-line`).boundingBox();
  return box.x + (Math.log(T / T_MIN) / Math.log(T_MAX / T_MIN)) * box.width;
}

export default async function attention({ page, baseURL, shot, assert, cvd, axe }) {
  await page.goto(`${baseURL}/s/attention`, { waitUntil: 'networkidle' });
  const fig = page.locator(FIG);
  await fig.locator('.xfig-knob').waitFor();
  await fig.scrollIntoViewIfNeeded();
  const labels = await fig.locator('.xfig-bar-label').allTextContents();
  assert.deepEqual(labels, ['the', 'cat', 'sat', 'on', 'the', 'mat'], 'six token-labelled bars');
  assert.equal((await state(page)).readout, 'top weight 0.51 · entropy 2.05 bits');
  assert.equal(await fig.locator('.xfig-top text').textContent(), 'top', 'top bar carries ▼ + "top"');
  const describedBy = await fig.getAttribute('aria-describedby');
  assert.ok((await page.locator(`#${describedBy}`).textContent()).startsWith('Bar chart'), 'alt text kept via aria-describedby');
  const live = await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    return {
      speaking: [...root.querySelectorAll('[aria-live]')].filter((e) => e.getAttribute('aria-live') !== 'off').map((e) => e.id),
      outputs: [...root.querySelectorAll('output')].map((e) => e.getAttribute('aria-live')),
      status: root.querySelectorAll('[role="status"]').length,
    };
  }, FIG);
  assert.deepEqual(live, { speaking: ['fig-temperature-desc'], outputs: ['off'], status: 0 }, 'only the throttled description is live');
  assert.deepEqual(blocking(await axe()).map((v) => `${v.id}: ${v.help}`), [], 'axe: no serious/critical violations');
  await shot('attention-fig1-default');

  // Mouse drag from T = 1 to T = 0.1; bars and readout change together.
  const knobBox = await fig.locator('.xfig-knob-ring').boundingBox();
  const y = knobBox.y + knobBox.height / 2;
  await page.mouse.move(await trackX(page, 1), y);
  await page.mouse.down();
  const before = await state(page);
  await page.mouse.move(await trackX(page, 0.3), y, { steps: 4 });
  const mid = await state(page);
  assert.ok(Math.abs(mid.catShare - topWeight(mid.readout)) < 0.01, `bars and readout agree mid-drag: ${JSON.stringify(mid)}`);
  await page.mouse.move(await trackX(page, 0.1), y, { steps: 6 });
  await page.mouse.up();
  const sharp = await state(page);
  assert.notEqual(sharp.readout, before.readout, 'readout changes while dragging');
  assert.ok(Math.abs(sharp.value - 0.1) <= 0.011, `knob near T = 0.1, got ${sharp.value}`);
  assert.ok(topWeight(sharp.readout) > 0.9, `top weight > 0.9 at T = 0.1: ${sharp.readout}`);
  assert.ok(Math.abs(sharp.catShare - topWeight(sharp.readout)) < 0.01, 'bars match readout after drag');
  await shot('attention-fig1-sharp');

  // "Show data" reveals a real table.
  await fig.locator('.xfig-data-toggle').click();
  const rows = await fig.locator('table.xfig-table tbody tr').count();
  assert.equal(rows, 6, 'data table has one row per token');
  await shot('attention-fig1-table');
  await fig.locator('.xfig-data-toggle').click();

  // Keyboard only: reload, Tab to the knob, End.
  await page.goto(`${baseURL}/s/attention`, { waitUntil: 'networkidle' });
  await page.locator(`${FIG} .xfig-knob`).waitFor();
  let tabs = 0;
  while (!(await page.evaluate(() => document.activeElement?.classList.contains('xfig-knob')))) {
    assert.ok(++tabs < 40, 'could not Tab to the knob');
    await page.keyboard.press('Tab');
  }
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'slider');
  await shot('attention-fig1-focus');
  await page.keyboard.press('End');
  const flat = await state(page);
  assert.equal(flat.value, T_MAX, 'End sets T to max');
  assert.equal(flat.valuetext, '5.00');
  assert.equal(flat.readout, 'top weight 0.22 · entropy 2.57 bits');
  await settled(page);
  await shot('attention-fig1-flat');
  await page.keyboard.press('Home');
  assert.equal((await state(page)).readout, 'top weight 1.00 · entropy 0.00 bits');
  await page.keyboard.press('ArrowRight');
  assert.ok((await state(page)).value > T_MIN, 'ArrowRight steps up');
  await settled(page);

  for (const vision of ['deutan', 'protan', 'tritan']) {
    await cvd(vision);
    await shot(`attention-fig1-${vision}`);
  }
  await cvd(null);

  // Hit areas at other widths (sub-pixel layout must not shrink them).
  for (const width of [1280, 480]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(100);
    await assertHitAreas(page, assert, width);
  }

  // 390 px with touch: hit areas ≥ 44 px, no horizontal scroll, touch drag via pointer capture.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/s/attention`, { waitUntil: 'networkidle' });
  await fig.locator('.xfig-knob').waitFor();
  await fig.scrollIntoViewIfNeeded();
  await assertHitAreas(page, assert, 390);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'no horizontal scroll at 390 px');
  await page.evaluate(() => {
    document.body.dataset.pointerTypes = '';
    document.addEventListener('pointerdown', (e) => (document.body.dataset.pointerTypes += `${e.pointerType} `), true);
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const ring = await fig.locator('.xfig-knob-ring').boundingBox();
  const ty = ring.y + ring.height / 2;
  const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: ty }] });
  await touch('touchStart', await trackX(page, 1));
  for (const T of [0.7, 0.4, 0.2, 0.1]) await touch('touchMove', await trackX(page, T));
  await touch('touchEnd');
  const touched = await state(page);
  assert.equal(await page.evaluate(() => document.body.dataset.pointerTypes), 'touch ', 'pointerType is touch');
  assert.ok(Math.abs(touched.value - 0.1) <= 0.011 && topWeight(touched.readout) > 0.9, `touch drag reaches T ≈ 0.1: ${JSON.stringify(touched)}`);
  await cdp.detach();
  await shot('attention-mobile');

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${baseURL}/s/attention`, { waitUntil: 'networkidle' });
  await fig2(page, { shot, assert, axe });
}

const FIG2 = '#fig-scaling';
const sd = (text) => Number(/score SD ([\d.]+)/.exec(text)?.[1]);

/** Drag the d_k knob along its log track to each width in `widths`; returns the readout at each. */
async function dragDk(page, widths) {
  const track = await page.locator(`${FIG2} .xfig-track-line`).boundingBox();
  const ring = await page.locator(`${FIG2} .xfig-knob-ring`).boundingBox();
  const x = (d) => track.x + (Math.log(d) / Math.log(512)) * track.width;
  const y = ring.y + ring.height / 2;
  await page.mouse.move(ring.x + ring.width / 2, y);
  await page.mouse.down();
  const seen = [];
  for (const d of widths) {
    await page.mouse.move(x(d), y, { steps: 3 });
    seen.push(await page.locator(`${FIG2} .xfig-readout`).textContent());
  }
  await page.mouse.up();
  return seen;
}

async function fig2(page, { shot, assert, axe }) {
  const fig = page.locator(FIG2);
  await fig.locator('.xfig-knob').waitFor();
  await fig.scrollIntoViewIfNeeded();
  const sw = fig.locator('[role="switch"]');
  assert.equal(await fig.locator('.xfig-readout').textContent(), 'score SD 2.02 · top weight 0.57 · entropy 1.85 bits');
  assert.equal(await sw.getAttribute('aria-checked'), 'false');
  assert.equal(await sw.getAttribute('aria-label'), 'divide scores by square root of d k');

  // Unscaled: d_k 1 → 512 drives the top weight to 1 and the SD toward √d_k.
  const unscaled = await dragDk(page, [1, 64, 512]);
  assert.equal(await fig.locator('.xfig-knob').getAttribute('aria-valuenow'), '512');
  assert.ok(sd(unscaled[0]) < 1.5 && topWeight(unscaled[0]) < 0.5, `d_k = 1 is soft: ${unscaled[0]}`);
  assert.ok(sd(unscaled[1]) > 6 && sd(unscaled[1]) < 10, `SD ≈ √64 = 8: ${unscaled[1]}`);
  assert.equal(unscaled[2], 'score SD 23.95 · top weight 1.00 · entropy 0.00 bits', 'SD ≈ √512 and one-hot at 512');
  assert.deepEqual(await fig.locator('.xfig-legend text').allTextContents(), ['this setting', 'with ÷√d_k']);
  await page.waitForTimeout(200);
  await shot('attention-fig2-unscaled');

  // The switch by keyboard: Space and Enter both toggle.
  await sw.focus();
  await page.keyboard.press('Space');
  assert.equal(await sw.getAttribute('aria-checked'), 'true', 'Space turns the switch on');
  await page.keyboard.press('Enter');
  assert.equal(await sw.getAttribute('aria-checked'), 'false', 'Enter turns it off');
  await page.keyboard.press('Space');
  assert.equal(await fig.locator('.xfig-readout').textContent(), 'score SD 1.06 · top weight 0.61 · entropy 2.00 bits');
  assert.deepEqual(await fig.locator('.xfig-legend text').allTextContents(), ['this setting', 'without ÷√d_k']);

  // Scaled: the SD stays near 1 across the whole drag.
  const scaled = await dragDk(page, [1, 8, 64, 512]);
  for (const r of scaled) assert.ok(Math.abs(sd(r) - 1) <= 0.3, `scaled SD ≈ 1: ${r}`);
  assert.deepEqual(blocking(await axe()).map((v) => `${v.id}: ${v.help}`), [], 'axe clean with Fig 2 live');
  await page.waitForTimeout(200);
  await shot('attention-fig2-scaled');
}
