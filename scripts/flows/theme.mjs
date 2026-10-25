// Light/dark toggle (DESIGN §4): the header button switches by keyboard, the tokens and the live figures follow
// without a reload, a stored dark choice paints dark before the app's JS runs (public/theme-init.js), print stays
// light, choosing the system's theme (or clearing site data) follows the system again, axe is clean in both themes,
// and on a phone the button stays in a one-row header.
import { blocking } from '../lib/axe.mjs';

const BG = { light: 'rgb(253, 253, 252)', dark: 'rgb(17, 17, 16)' }; // sand-1
const INK = { light: 'rgb(33, 32, 28)', dark: 'rgb(238, 238, 236)' }; // sand-12
const HANDLE = { light: 'rgb(239, 95, 0)', dark: 'rgb(247, 107, 21)' }; // orange-10, orange-9
const TOGGLE = '.site-header button.theme-toggle';

const css = (page, sel, prop) => page.locator(sel).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p).trim(), prop);
const bg = (page) => css(page, 'body', 'background-color');
const state = (page) =>
  page.evaluate(() => ({ attr: document.documentElement.dataset.theme ?? null, stored: localStorage.getItem('theme'), scheme: getComputedStyle(document.documentElement).colorScheme }));
/** A promise that waits until `release()`. */
function gate() {
  /** @type {(value?: unknown) => void} */
  let release = Boolean; // replaced at once: the executor runs synchronously
  const held = new Promise((resolve) => (release = resolve));
  return { held, release };
}
const label = (page) => page.locator(TOGGLE).getAttribute('aria-label');

export default async function theme({ page, baseURL, assert, axe, shot }) {
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  assert.equal(await label(page), 'Switch to dark theme', 'a light system: the button offers dark');
  assert.equal(await bg(page), BG.light);
  assert.deepEqual(blocking(await axe()), [], 'axe: no serious or critical violations in light');

  // Keyboard: Tab from the top of the page to the button (after the nav), Enter switches.
  let presses = 0;
  while (!(await page.evaluate((s) => document.activeElement?.matches(s) ?? false, TOGGLE))) {
    assert.ok(++presses <= 8, 'the toggle is reachable by Tab right after the header nav');
    await page.keyboard.press('Tab');
  }
  assert.ok(await page.evaluate(() => parseFloat(getComputedStyle(document.activeElement ?? document.body).outlineWidth) >= 2), 'the focused toggle shows a ≥ 2px ring');
  await page.keyboard.press('Enter');
  assert.deepEqual(await state(page), { attr: 'dark', stored: 'dark', scheme: 'dark' }, 'Enter chooses dark and remembers it');
  assert.equal(await bg(page), BG.dark, '--bg turns to dark sand-1');
  assert.equal(await label(page), 'Switch to light theme');
  assert.ok(await page.evaluate((s) => document.activeElement?.matches(s), TOGGLE), 'focus stays on the toggle');
  assert.equal(await css(page, '.hero-fig .xfig-bar-label', 'fill'), INK.dark, 'the hero figure redraws its labels in dark ink, no reload');
  assert.equal(await css(page, '.hero-fig .xfig-knob-ring', 'fill'), HANDLE.dark, 'the hero handle switches to orange-9');
  assert.deepEqual(blocking(await axe()), [], 'axe: no serious or critical violations in dark');
  await shot('theme-home-dark');

  // Reload with the app's JS held back: the stored choice is already on <html> when the CSS first paints.
  const { held, release } = gate();
  const js = /\/assets\/[^/]+\.js$/;
  await page.route(js, async (route) => {
    await held;
    await route.fallback();
  });
  await page.reload({ waitUntil: 'commit' });
  await page.waitForFunction(() => document.body && getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)');
  const first = await page.evaluate(() => ({
    attr: document.documentElement.dataset.theme,
    bg: getComputedStyle(document.body).backgroundColor,
    app: document.getElementById('root')?.childElementCount,
    bar: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content')),
  }));
  assert.deepEqual(first, { attr: 'dark', bg: BG.dark, app: 0, bar: ['#111110', '#111110'] }, 'first paint is dark before the app runs (no light flash), browser bar too');
  release();
  await page.locator(TOGGLE).waitFor();
  await page.waitForLoadState('networkidle');
  await page.unroute(js, { behavior: 'wait' });
  assert.equal(await label(page), 'Switch to light theme', 'the choice survives a reload');

  // Print stays light after choosing dark.
  await page.emulateMedia({ media: 'print' });
  assert.deepEqual([await css(page, 'main h1', 'color'), await css(page, 'html', 'color-scheme')], [INK.light, 'light'], 'print is light with dark chosen');
  await page.emulateMedia({ media: 'screen' });

  // Choosing the system's own theme drops the stored choice: the page follows the system again.
  await page.locator(TOGGLE).click();
  assert.deepEqual(await state(page), { attr: null, stored: null, scheme: 'light dark' }, 'light on a light system: nothing stored');
  assert.deepEqual(await page.locator('meta[name="theme-color"]').evaluateAll((ms) => ms.map((m) => m.getAttribute('content'))), ['#fdfdfc', '#111110'], 'the theme-color metas follow their media queries again');
  assert.equal(await bg(page), BG.light);

  // On a dark system the page follows it; choosing light is stored, survives a reload, and clearing site data ends it.
  await page.emulateMedia({ colorScheme: 'dark' });
  assert.deepEqual([await bg(page), await label(page)], [BG.dark, 'Switch to light theme'], 'follows a system switch to dark');
  await page.locator(TOGGLE).click();
  assert.deepEqual(await state(page), { attr: 'light', stored: 'light', scheme: 'light' }, 'light on a dark system is stored');
  assert.equal(await bg(page), BG.light);
  await page.reload({ waitUntil: 'networkidle' });
  assert.deepEqual([await bg(page), await label(page)], [BG.light, 'Switch to dark theme'], 'an explicit light choice survives a reload on a dark system');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  assert.deepEqual([await bg(page), (await state(page)).attr], [BG.dark, null], 'cleared site data follows the system again');
  await page.emulateMedia({ colorScheme: 'light' });

  // An essay figure follows a switch without a reload.
  await page.goto(`${baseURL}/s/attention`, { waitUntil: 'networkidle' });
  const knob = '#fig-temperature .xfig-knob-ring';
  assert.equal(await css(page, knob, 'fill'), HANDLE.light);
  await page.locator(TOGGLE).click();
  assert.deepEqual([await css(page, knob, 'fill'), await css(page, '#fig-temperature .xfig-bar-label', 'fill')], [HANDLE.dark, INK.dark], 'the essay figure redraws in dark');
  await page.locator(TOGGLE).click();
  assert.equal(await css(page, knob, 'fill'), HANDLE.light);

  // Phone: the nav is hidden, the toggle stays at the end of a one-row header with its icon on the 16px gutter.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  const box = await page.evaluate((s) => {
    const [header, btn, icon] = ['.site-header', s, `${s} svg`].map((sel) => document.querySelector(sel).getBoundingClientRect());
    return { header: header.height, top: btn.top >= header.top && btn.bottom <= header.bottom, w: btn.width, h: btn.height, iconRight: Math.round(icon.right), overflow: document.documentElement.scrollWidth - innerWidth };
  }, TOGGLE);
  assert.deepEqual(box, { header: 56, top: true, w: 44, h: 44, iconRight: 374, overflow: 0 }, 'phone: one-row header, 44px button, icon on the gutter, no overflow');
  assert.ok(await page.locator(TOGGLE).isVisible());
  assert.ok(await page.locator('.site-nav').isHidden());
}
