// Motion rules (DESIGN, Motion): nothing moves on its own. With reduced motion
// keyboard steps and drags are instant, no figure enters and the title does not
// rise. Without it keyboard steps ease, a figure below the fold enters once, and
// the title block fades in.
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
  assert.equal(await page.locator('.essay-hero h1').evaluate((h) => getComputedStyle(h).animationName), 'none', 'reduced motion: the title does not rise');
  await page.locator(FIG).scrollIntoViewIfNeeded();
  assert.equal((await watch(page, 1500)).size, 1, 'reduced motion: the knob never moves on its own');
  assert.equal(await page.locator('.xfig-knob-hint, .xfig-knob-grip').count(), 0, 'no drag hint');
  assert.equal(await page.locator('figure.xfig[data-enter]').count(), 0, 'reduced motion: no figure entrance');
  await shot('reduced-motion-fig');
  await page.locator(`${FIG} .xfig-knob`).focus();
  const h0 = await catHeight(page);
  await page.keyboard.press('PageDown');
  const h1 = await catHeight(page);
  await page.waitForTimeout(400);
  assert.notEqual(h1, h0, 'keyboard step applies at once');
  assert.equal(await catHeight(page), h1, 'reduced motion: no easing after a keyboard step');
  const blockingViolations = (await axe()).filter((v) => v.impact === 'serious' || v.impact === 'critical');
  assert.deepEqual(blockingViolations.map((v) => v.id), [], 'axe clean under reduced motion');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseURL}/s/attention`, { waitUntil: 'networkidle' });
  await page.locator(`${FIG} .xfig-knob`).waitFor();
  assert.equal(await page.locator('.essay-hero h1').evaluate((h) => getComputedStyle(h).animationName), 'enter', 'the title block fades in and rises');
  assert.equal(await page.locator('#fig-scaling').getAttribute('data-enter'), '', 'a figure below the fold waits to enter');
  await page.locator(FIG).scrollIntoViewIfNeeded();
  const rest = await watch(page, 2600);
  assert.equal(rest.size, 1, `nothing moves on its own (saw ${rest.size} positions)`);
  await page.locator('#fig-scaling').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#fig-scaling').getAttribute('data-enter'), 'in', 'it enters once in view');
  assert.equal(await page.locator('#fig-scaling').evaluate((f) => getComputedStyle(f).opacity), '1');
  await page.locator(FIG).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300); // drawing resumes once the figure is back in view
  await page.locator(`${FIG} .xfig-knob`).focus();
  const e0 = await catHeight(page);
  await page.keyboard.press('Home');
  const e1 = await catHeight(page);
  await page.waitForTimeout(600);
  const e2 = await catHeight(page);
  assert.ok(Number(e1) > Number(e0) && Number(e2) > Number(e1), `keyboard step eases (${e0} → ${e1} → ${e2})`);
}
