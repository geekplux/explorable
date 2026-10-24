// Keyboard only: Tab to the second essay row (visible ring), Enter opens it, focus
// lands on the essay heading, and the header wordmark (Shift+Tab back to it) returns to the gallery.

/** Tab until `selector` has focus; returns the number of presses. */
async function tabTo(page, selector, assert, max = 25, key = 'Tab') {
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press(key);
    if (await page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector)) return i;
  }
  assert.fail(`could not Tab to ${selector} in ${max} presses`);
}

/** Focus ring width on the focused element. */
const ringWidth = (page) =>
  page.evaluate(() => {
    const s = document.activeElement ? getComputedStyle(document.activeElement) : undefined;
    return s && s.outlineStyle !== 'none' ? parseFloat(s.outlineWidth) : 0;
  });

export default async function keyboard({ page, baseURL, shot, assert }) {
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  // The hero slider is in the tab order on the way.
  await tabTo(page, '.hero-fig .xfig-knob', assert);
  await tabTo(page, '#essays a.essay-row[href="/s/bloom-filter"]', assert);
  assert.ok((await ringWidth(page)) >= 2, 'focused essay row shows a ≥ 2px focus ring');
  await shot('keyboard-row-focus');

  await page.keyboard.press('Enter');
  await page.waitForURL(`${baseURL}/s/bloom-filter`);
  await page.locator('.essay-takeaway').waitFor();
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  assert.equal(focused, 'H1', 'focus moves to the essay heading after navigation');
  await shot('keyboard-essay');

  await tabTo(page, '.site-header a.site-home', assert, 8, 'Shift+Tab');
  assert.ok((await ringWidth(page)) >= 2, 'home link shows a ≥ 2px focus ring');
  await shot('keyboard-back-focus');
  await page.keyboard.press('Enter');
  await page.waitForURL(`${baseURL}/`);
  await page.locator('#essays a.essay-row').first().waitFor();
}
