// Typed words search the built-in samples locally: no /api request at all
// (the harness also fails the run on any /api/* request from this page).
import { readFileSync } from 'node:fs';
import { blocking } from '../lib/axe.mjs';

const LABEL = 'Paste an arXiv or blog link, or type a topic';
const bloom = JSON.parse(readFileSync('src/samples/bloom-filter.json', 'utf8'));

export default async function search(ctx) {
  const { page, baseURL, shot, assert } = ctx;
  let api = 0;
  page.on('request', (req) => (api += req.url().includes('/api/') ? 1 : 0));
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  const input = page.getByLabel(LABEL);

  await input.pressSequentially('bloom');
  assert.deepEqual(await page.locator('.search-results .mini-card a').allTextContents(), [bloom.title]);
  assert.equal(await page.locator('.search-count').textContent(), '1 built-in match. Open one, or paste a link.');
  assert.deepEqual(blocking(await ctx.axe()).map((v) => v.id), [], 'axe on search results');
  await shot('search-bloom');

  await input.fill('zzqx wibble');
  assert.equal(await page.locator('.search-count').textContent(), 'No built-in match: paste a link instead.');
  await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).pathname, '/', 'Enter on words does not leave /');

  // A broken link gets an inline message and aria-invalid.
  await input.fill('ftp://example.org/notes');
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.url-message').textContent(), /http and https/);
  assert.equal(await input.getAttribute('aria-invalid'), 'true');

  // A Try chip fills the field with its link.
  await input.fill('');
  await page.locator('.try .chip').nth(1).click();
  assert.equal(await input.inputValue(), bloom.source.url);

  // Keyboard only: type, Tab to the match, Enter opens it; Back restores the search.
  await input.fill('');
  await input.pressSequentially('bloom');
  for (let i = 0; i < 4 && !(await page.evaluate(() => document.activeElement?.closest('.mini-card'))); i++) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.waitForURL(`${baseURL}/s/bloom-filter`);
  await page.goBack();
  await page.locator('.search-results .mini-card').waitFor();
  assert.equal(await input.inputValue(), 'bloom');
  assert.equal(api, 0, 'search made zero /api requests');
}
