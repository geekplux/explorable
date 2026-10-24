// Motion rules for Fig 1: with reduced motion there is no nudge, a static
// "drag" hint, and keyboard steps are instant. Without it there is exactly one
// nudge (1.2 s after the figure first enters view) that never repeats.
const FIG = '#fig-temperature';

const knobX = (page) =>
  page.evaluate((fig) => document.querySelector(`${fig} .xfig-knob g`)?.getAttribute('transform') ?? '', FIG);
const catHeight = (page) =>
  page.evaluate((fig) => document.querySelectorAll(`${fig} rect.xfig-bar`)[1]?.getAttribute('height'), FIG);

/** Distinct knob transforms seen while polling for `ms`. */
async function watch(page, ms) {
  const seen = new Set();
  for (let t = 0; t < ms; t += 40) {
    seen.add(await knobX(page));
    await page.waitForTimeout(40);
  }
  return seen;
}

export default async function reducedMotion({ page, baseURL, shot, assert, axe }) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Home: hovering an essay row leaves its thumbnail still.
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  const row = page.locator('#essays a.essay-row').first();
  const cx = () => row.locator('.th-handle').getAttribute('cx');
  const still = await cx();
  await row.hover();
  await page.waitForTimeout(300);
  assert.equal(await cx(), still, 'reduced motion: the row thumbnail does not play');

  await page.goto(`${baseURL}/s/attention`, { waitUntil: 'networkidle' });
  await page.locator(`${FIG} .xfig-knob`).waitFor();
  await page.locator(FIG).scrollIntoViewIfNeeded();
  assert.equal((await watch(page, 2200)).size, 1, 'reduced motion: the knob never nudges');
  assert.ok(await page.locator(`${FIG} .xfig-knob.is-hinting`).count(), 'reduced motion: static dashed "drag" hint');
  assert.equal(await page.locator(`${FIG} text.xfig-knob-hint`).textContent(), 'drag');
  await shot('reduced-motion-hint');
  await page.locator(`${FIG} .xfig-knob`).focus();
  const h0 = await catHeight(page);
  await page.keyboard.press('PageDown');
  const h1 = await catHeight(page);
  await page.waitForTimeout(400);
  assert.notEqual(h1, h0, 'keyboard step applies at once');
  assert.equal(await catHeight(page), h1, 'reduced motion: no easing after a keyboard step');
  assert.equal(await page.locator(`${FIG} .xfig-knob.is-hinting`).count(), 0, 'hint goes away after the first interaction');
  const blockingViolations = (await axe()).filter((v) => v.impact === 'serious' || v.impact === 'critical');
  assert.deepEqual(blockingViolations.map((v) => v.id), [], 'axe clean under reduced motion');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseURL}/s/attention`, { waitUntil: 'networkidle' });
  await page.locator(`${FIG} .xfig-knob`).waitFor();
  await page.locator(FIG).scrollIntoViewIfNeeded();
  const first = await watch(page, 2600);
  assert.ok(first.size > 2, `one nudge after first view (saw ${first.size} positions)`);
  const rest = await knobX(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.locator(FIG).scrollIntoViewIfNeeded();
  const again = await watch(page, 2600);
  assert.deepEqual([...again], [rest], 'the nudge never repeats');
  await page.locator(`${FIG} .xfig-knob`).focus();
  const e0 = await catHeight(page);
  await page.keyboard.press('Home');
  const e1 = await catHeight(page);
  await page.waitForTimeout(600);
  const e2 = await catHeight(page);
  assert.ok(Number(e1) > Number(e0) && Number(e2) > Number(e1), `keyboard step eases (${e0} → ${e1} → ${e2})`);
}
