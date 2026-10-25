// Typed words search the built-in samples locally: no /api request at all
// (the harness also fails the run on any /api/* request from this page).
import { readFileSync } from 'node:fs';
import { blocking } from '../lib/axe.mjs';

const LABEL = 'Paste a link or type a topic';
const bloom = JSON.parse(readFileSync('src/samples/bloom-filter.json', 'utf8'));

export default async function search(ctx) {
  const { page, baseURL, shot, assert } = ctx;
  let api = 0;
  page.on('request', (req) => (api += req.url().includes('/api/') ? 1 : 0));
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  const input = page.getByLabel(LABEL);
  assert.equal(await page.locator('output.search-live').count(), 1, 'count live region mounted before any typing');

  await input.pressSequentially('bloom');
  assert.deepEqual(await page.locator('.search-results a.essay-row .essay-title').allTextContents(), [bloom.title]);
  assert.equal(await page.locator('.search-count').textContent(), '1 match. Open it, or paste a link.');
  // The polite live region was mounted before typing and gets the count once typing pauses.
  assert.equal(await page.locator('output.search-live').count(), 1, 'one live region for the count');
  await page.locator('output.search-live', { hasText: '1 match. Open it, or paste a link.' }).waitFor();
  assert.deepEqual(blocking(await ctx.axe()).map((v) => v.id), [], 'axe on search results');
  await shot('search-bloom');

  await input.fill('zzqx wibble');
  assert.equal(await page.locator('.search-count').textContent(), 'No match: paste a link instead.');
  await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).pathname, '/', 'Enter on words does not leave /');

  // A broken link gets an inline message and aria-invalid.
  await input.fill('ftp://example.org/notes');
  await page.keyboard.press('Enter');
  await page.locator('.url-message', { hasText: /http and https/ }).waitFor();
  assert.equal(await input.getAttribute('aria-invalid'), 'true');

  // Keyboard only: type, Tab to the match, Enter opens it; Back restores the search.
  await input.fill('');
  await input.pressSequentially('bloom');
  for (let i = 0; i < 4 && !(await page.evaluate(() => document.activeElement?.closest('.search-results .essay-row'))); i++) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.waitForURL(`${baseURL}/s/bloom-filter`);
  await page.goBack();
  await page.locator('.search-results .essay-row').waitFor();
  assert.equal(await input.inputValue(), 'bloom');
  assert.equal(api, 0, 'search made zero /api requests');
}
