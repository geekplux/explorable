// PDF (DESIGN §8): the byline's "PDF" link, then print media on the attention sample (in a dark-scheme browser):
// no site chrome or buttons, figures keep the state they were left in with their state line, an open math note
// prints and a closed one does not, the source card never prints, and the page stays light. The sample PDF resolves.

/** A computed style property of the first element a locator matches. */
const css = (locator, prop) => locator.first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
const SAND_11 = 'rgb(99, 99, 94)';

export default async function pdf({ page, baseURL, assert }) {
  await page.goto(`${baseURL}/s/attention`, { waitUntil: 'networkidle' });
  const knob = page.locator('#fig-temperature .xfig-knob');
  await knob.waitFor();

  const link = page.getByRole('link', { name: 'Download PDF' });
  assert.equal(await link.getAttribute('href'), '/pdf/attention.pdf');
  assert.ok(await link.evaluate((a) => a.hasAttribute('download') && !!a.closest('.essay-byline-end')), 'a download link at the end of the byline');
  assert.equal(await css(link, 'color'), SAND_11, 'the PDF link is sand-11, not the byline link colour');
  await link.focus();
  assert.notEqual(await link.evaluate((a) => getComputedStyle(a).outlineStyle), 'none', 'the PDF link shows focus');

  // Leave the figure at T = 5, open the first math note, open the source card, then print.
  await knob.focus();
  await page.keyboard.press('End');
  await page.locator('button.xnote-mk[aria-controls="note-m1"]').click();
  await page.locator('button.xnote-src').focus();
  assert.ok(await page.locator('#note-vaswani').isVisible(), 'source card open on screen');
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });

  for (const sel of ['.site-header', '.site-footer', '.essay-toc', '.essay-pdf', '.xfig-controls', '.xfig-data-toggle', '.xnote-mk', '#note-vaswani']) {
    const shown = await page.locator(sel).evaluateAll((els) => els.filter((el) => el.checkVisibility()).length);
    assert.equal(shown, 0, `print hides ${sel}`);
  }
  assert.equal(
    await page.locator('#fig-temperature .xfig-state').innerText(),
    'Shown at T = 5. Interactive version at explorable.geekplux.com/s/attention#fig-temperature',
    'the state line keeps the figure where it was left',
  );
  assert.equal(await page.locator('#fig-temperature .xfig-state a').getAttribute('href'), 'https://explorable.geekplux.com/s/attention#fig-temperature', 'a PDF reader can follow the link');
  assert.equal(await css(page.locator('#fig-temperature .xfig-state a'), 'color'), SAND_11, 'the link prints as the line around it');
  assert.equal(await page.locator('#fig-scaling .xfig-state').innerText(), 'Shown at dk = 4, divide by √dk off. Interactive version at explorable.geekplux.com/s/attention#fig-scaling');
  assert.ok(await page.locator('#note-m1').isVisible(), 'an open math note prints');
  assert.ok(await page.locator('#note-m2').isHidden(), 'a closed math note does not');
  assert.equal(await page.locator('button.xnote-src').innerText(), 'Vaswani et al.', 'the source label stays as text');
  const ink = {
    bg: await css(page.locator('body'), 'background-color'),
    text: await css(page.locator('.essay h1'), 'color'),
    breakInside: await css(page.locator('#fig-temperature'), 'break-inside'),
  };
  assert.deepEqual(ink, { bg: 'rgba(0, 0, 0, 0)', text: 'rgb(33, 32, 28)', breakInside: 'avoid' }, 'white paper, sand-12 text (no dark scheme), figures whole');
  await page.emulateMedia({ media: 'screen', colorScheme: 'light' });

  const res = await page.request.get(`${baseURL}/pdf/attention.pdf`);
  assert.equal(res.status(), 200, 'the sample PDF resolves');
  assert.equal(res.headers()['content-type'], 'application/pdf');
  assert.equal((await res.body()).subarray(0, 5).toString(), '%PDF-');
}
