// The single input end to end with /api/explain mocked (page.route): paste →
// /x?url= → honest stages → result (ai, match); every error code; Cancel;
// Back/Forward; offline; 320 px; reduced motion. No network, no Worker AI.
import { readFileSync } from 'node:fs';
import { blocking } from '../lib/axe.mjs';

export const pageOptions = { allowApi: true, apiErrors: true };

const URL_IN = 'https://arxiv.org/abs/1706.03762';
// A plain JSON answer (no streamed stages) falls back to the honest timeline: it never claims "composing".
const STAGES = ['Fetching the article…', 'Reading the text…', 'Finding the core idea and writing the essay…'];
const sample = (id) => JSON.parse(readFileSync(`src/samples/${id}.json`, 'utf8'));
const aiDoc = { ...sample('attention'), provenance: { mode: 'ai', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', generatedAt: '2026-10-21T00:00:00.000Z' } };
const matchDoc = { ...sample('bloom-filter'), provenance: { mode: 'match', generatedAt: '2026-10-21T00:00:00.000Z' } };
const ERRORS = {
  INVALID_URL: 400, BLOCKED_URL: 400, FETCH_FAILED: 502, UNSUPPORTED_CONTENT: 415, TOO_LITTLE_TEXT: 422,
  AI_UNAVAILABLE: 503, PLAN_INVALID: 502, NO_FIGURE: 422, RATE_LIMITED: 429, INTERNAL: 500,
};
const ROPE = 'Found “Why ropes beat strings for big edits”. A rope keeps text in a tree. The built-in samples still work.';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Replace the /api/explain mock: JSON `body` with `status` after `delay` ms, or a network failure. */
async function mock(page, status, body, delay = 0) {
  await page.unroute('**/api/explain**');
  await page.route('**/api/explain**', async (route) => {
    if (delay) await wait(delay);
    try {
      if (body === 'network') await route.abort('failed');
      else await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    } catch {
      // the page aborted the request (Cancel) or moved on
    }
  });
}

async function noBlocking(ctx, what) {
  const bad = blocking(await ctx.axe()).map((v) => `${v.id} (${v.impact}): ${v.help}`);
  ctx.assert.deepEqual(bad, [], `serious/critical axe violations: ${what}`);
}

async function fits(page, assert, what) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  assert.ok(sw <= iw, `${what}: no horizontal scroll at ${iw}px (scrollWidth ${sw})`);
}

const focusedId = (page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);

async function submit(page, url = URL_IN) {
  const input = page.getByLabel('Paste a link or type a topic');
  await input.fill('');
  await input.focus();
  await page.keyboard.insertText(url); // what a paste does
  await page.keyboard.press('Enter');
}

export default async function urlFlow(ctx) {
  const { page, baseURL, shot, assert } = ctx;
  const api = [];
  page.on('request', (req) => req.url().includes('/api/') && api.push(req.url()));
  const aborted = [];
  page.on('requestfailed', (req) => req.url().includes('/api/explain') && aborted.push(req.failure()?.errorText));

  // Empty state: the placeholder, and no Try chips (the essay index lists the samples).
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.url-row input').getAttribute('placeholder'), URL_IN);
  assert.equal(await page.locator('.try, .chip').count(), 0, 'no Try chips');
  await shot('input-empty');

  // Paste + Enter → /x?url=, the steps in order (no skeleton), then the AI result.
  await mock(page, 200, { ok: true, doc: aiDoc, cache: 'miss', mode: 'ai' }, 6500);
  await page.getByLabel('Paste a link or type a topic').focus();
  await page.keyboard.insertText(URL_IN);
  await shot('input-typed');
  await page.evaluate(() => {
    /** @type {string[]} */
    const seen = [];
    new MutationObserver(() => {
      const t = document.querySelector('.loading-stage')?.textContent;
      if (!t || seen.at(-1) === t) return;
      seen.push(t);
      document.documentElement.dataset.stages = JSON.stringify(seen);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await page.keyboard.press('Enter');
  await page.waitForURL(`${baseURL}/x?url=https%3A%2F%2Farxiv.org%2Fabs%2F1706.03762`);
  await page.locator('.loading-steps').waitFor();
  assert.equal(await focusedId(page), 'H1', 'focus moves to the loading heading');
  assert.equal(await page.locator('.skeleton, .bar, .kicker').count(), 0, 'no skeleton or kicker');
  await noBlocking(ctx, 'loading');
  await shot('loading-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot('loading-mobile');
  await page.setViewportSize({ width: 320, height: 700 });
  await fits(page, assert, 'loading');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('.essay-takeaway').waitFor({ timeout: 15_000 });
  assert.deepEqual(JSON.parse((await page.locator('html').getAttribute('data-stages')) ?? '[]'), STAGES, 'stages announced in order');
  assert.equal(await page.locator('.essay-byline p').textContent(), 'Based on Attention Is All You Need, Vaswani et al., 2017. Written by AI from the source.');
  assert.ok(await page.locator('.essay-byline a[href="https://arxiv.org/abs/1706.03762"]').count(), 'the AI sentence sits in the byline with the source link');
  assert.equal(await page.getByText('Written by AI', { exact: false }).count(), 1, 'said once');
  assert.ok((await page.locator('figure.xfig .xfig-knob').count()) >= 1, 'live figures are hydrated');
  assert.equal(await focusedId(page), 'H1', 'focus moves to the essay heading');
  await noBlocking(ctx, 'result-ai');
  await shot('result-ai');
  await page.setViewportSize({ width: 320, height: 700 });
  await fits(page, assert, 'result');
  await page.setViewportSize({ width: 1280, height: 800 });

  // A streaming Worker: NDJSON stage lines, keep-alive ticks, then the result line.
  await page.unroute('**/api/explain**');
  await page.route('**/api/explain**', (route) => {
    const lines = [{ type: 'stage', stage: 'fetching' }, { type: 'stage', stage: 'reading' }, { type: 'tick' }, { type: 'stage', stage: 'planning' }, { type: 'stage', stage: 'composing' }, { type: 'result', ok: true, doc: aiDoc, cache: 'miss', mode: 'ai' }];
    return route.fulfill({ status: 200, contentType: 'application/x-ndjson; charset=utf-8', body: lines.map((l) => JSON.stringify(l)).join('\n') + '\n' }).catch(() => {});
  });
  await page.goto(`${baseURL}/x?url=${encodeURIComponent('https://arxiv.org/abs/1706.03762v2')}`);
  await page.locator('.essay-takeaway').waitFor();
  assert.ok(api.some((u) => u.includes('1706.03762v2')), 'the streamed answer renders the essay');

  // Match mode.
  await mock(page, 200, { ok: true, doc: matchDoc, cache: 'hit', mode: 'match' });
  await page.goto(`${baseURL}/x?url=${encodeURIComponent(matchDoc.source.url)}`);
  await page.locator('.essay-takeaway').waitFor();
  assert.equal(await page.locator('.essay-byline p').textContent(), 'Based on Bloom Filters by Example, Bill Mill', 'a matched essay adds nothing to the byline');
  // Not a built-in sample object: "PDF" opens the print dialog, in sand-11 like the sample link.
  const printPdf = page.locator('.essay-byline-end').getByRole('button', { name: 'Print or save as PDF' });
  assert.equal(await printPdf.evaluate((b) => getComputedStyle(b).color), 'rgb(99, 99, 94)', 'the print button is sand-11');
  await shot('result-match');

  // Every error code: own copy, focused heading, three sample rows.
  const headings = new Set();
  for (const [code, status] of [...Object.entries(ERRORS), ['NETWORK', 0]]) {
    await mock(page, status, code === 'NETWORK' ? 'network' : { ok: false, error: { code, message: 'm', hint: code === 'AI_UNAVAILABLE' ? ROPE : 'h' } });
    await page.goto(`${baseURL}/x?url=${encodeURIComponent('https://notes.example.org/ropes')}`);
    await page.locator(`.error-panel[data-code="${code}"]`).waitFor();
    assert.equal(await focusedId(page), 'error-heading', `${code}: heading takes focus`);
    assert.equal(await page.locator('#error-heading').getAttribute('tabindex'), '-1');
    assert.equal(await page.locator('.error-state a.essay-row').count(), 3, `${code}: three sample rows`);
    headings.add(await page.locator('#error-heading').textContent());
    if (code === 'FETCH_FAILED') {
      await noBlocking(ctx, 'error');
      await shot('error-fetch-failed');
      // "Try again" (keyboard) swaps in the loading view: focus lands on its h1, not <body>.
      await mock(page, status, { ok: false, error: { code, message: 'm', hint: 'h' } }, 1000);
      await page.getByRole('button', { name: 'Try again' }).focus();
      await page.keyboard.press('Enter');
      await page.locator('.loading-steps').waitFor();
      assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'H1', 'Try again: focus on the loading h1');
      assert.equal(await page.locator('.loading h1').textContent(), 'Reading notes.example.org', 'loading h1 names the host only');
      await page.locator(`.error-panel[data-code="${code}"]`).waitFor();
    }
    if (code === 'AI_UNAVAILABLE') {
      assert.ok((await page.locator('.error-hint').textContent()).includes('Why ropes beat strings for big edits'), 'shows the extracted title');
      assert.match(await page.locator('.error-panel').textContent(), /Workers AI/);
      assert.match(await page.locator('.error-actions a[href*="DEPLOY.md#self-host-without-ai"]').getAttribute('href'), /^https:/);
      await noBlocking(ctx, 'error-ai-unavailable');
      await shot('error-ai-unavailable');
      await page.setViewportSize({ width: 390, height: 844 });
      await shot('error-mobile');
      await page.setViewportSize({ width: 320, height: 700 });
      await fits(page, assert, 'error');
      await page.setViewportSize({ width: 1280, height: 800 });
    }
  }
  assert.equal(headings.size, Object.keys(ERRORS).length + 1, 'each error code has its own heading');

  // Cancel (keyboard only) aborts the slow request and returns to / with the input filled.
  await mock(page, 200, { ok: true, doc: aiDoc, cache: 'miss', mode: 'ai' }, 5000);
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  await submit(page);
  await page.locator('.loading-steps').waitFor();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Cancel');
  await page.keyboard.press('Enter');
  await page.waitForURL(`${baseURL}/`);
  assert.equal(await page.locator('.url-row input').inputValue(), URL_IN, 'input still filled after Cancel');
  assert.equal(await page.evaluate(() => document.activeElement?.matches('.url-row input')), true, 'Cancel: focus on the filled input');
  await wait(300);
  assert.ok(aborted.length >= 1, 'Cancel aborted the request');

  // Back and forward between /, /s and /x.
  await mock(page, 200, { ok: true, doc: aiDoc, cache: 'hit', mode: 'ai' });
  await page.locator('#essays a.essay-row').first().click();
  await page.waitForURL(`${baseURL}/s/attention`);
  await page.goBack();
  await page.waitForURL(`${baseURL}/`);
  await page.goForward();
  await page.locator('.essay-takeaway').waitFor();
  await page.goBack();
  await submit(page);
  await page.getByText('Written by AI from the source.').waitFor();
  await page.goBack();
  await page.waitForURL(`${baseURL}/`);
  assert.equal(await page.locator('.url-row input').inputValue(), URL_IN, 'input filled after Back');
  await page.goForward();
  await page.getByText('Written by AI from the source.').waitFor();


  // Offline: banner above the input; submitting a link explains why instead of fetching.
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  const before = api.length;
  await page.context().setOffline(true);
  await page.locator('.offline-banner').waitFor();
  assert.equal((await page.locator('.offline-banner').textContent()).trim(), 'You’re offline. The samples below still work.');
  await submit(page);
  await page.locator('.url-message', { hasText: 'You’re offline, so this link can’t be read now.' }).waitFor();
  assert.doesNotMatch(await page.locator('.url-message').textContent(), /samples below/, 'offline message does not repeat the banner');
  assert.equal(new URL(page.url()).pathname, '/', 'stays on / while offline');
  await shot('offline-banner');
  await page.context().setOffline(false);
  await page.locator('.offline-banner').waitFor({ state: 'detached' });
  assert.equal(api.length, before, 'no request while offline');
}
