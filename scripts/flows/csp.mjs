// S3: the preview serves public/_headers, so every page carries the production
// CSP. Under it, /, every sample and /x (with /api/explain mocked) render and
// work with zero CSP violations (securitypolicyviolation events or console).
import { readFileSync, readdirSync } from 'node:fs';

export const pageOptions = { allowApi: true };

export const CSP =
  "default-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'";
const SAMPLES = readdirSync('src/samples').filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
const doc = { ...JSON.parse(readFileSync('src/samples/attention.json', 'utf8')), provenance: { mode: 'ai', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', generatedAt: '2026-10-21T00:00:00.000Z' } };
const ROUTES = ['/', ...SAMPLES.map((id) => `/s/${id}`), `/x?url=${encodeURIComponent('https://arxiv.org/abs/1706.03762')}`];

export default async function csp({ page, baseURL, assert }) {
  const violations = [];
  page.on('console', (msg) => /content security policy/i.test(msg.text()) && violations.push(`${page.url()}: ${msg.text()}`));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`Content Security Policy violation: ${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.route('**/api/explain**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'x-explorable-cache': 'miss' }, body: JSON.stringify({ ok: true, doc, cache: 'miss', mode: 'ai' }) }),
  );

  for (const route of ROUTES) {
    const res = await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
    assert.equal(res?.headers()['content-security-policy'], CSP, `${route}: CSP header`);
    assert.equal(res?.headers()['x-content-type-options'], 'nosniff', `${route}: nosniff`);
    assert.ok(res?.headers()['referrer-policy'], `${route}: Referrer-Policy`);
    await page.locator('main h1').first().waitFor();
    if (route !== '/') {
      await page.locator('figure.xfig').first().waitFor();
      // Exercise the live path (SVG attributes, eased motion) under the CSP.
      await page.locator('.xfig-knob').first().focus();
      await page.keyboard.press('End');
      await page.waitForTimeout(400);
    }
  }
  const asset = await page.request.get(`${baseURL}${await page.locator('script[type="module"]').getAttribute('src')}`);
  assert.match(asset.headers()['cache-control'] ?? '', /max-age=31536000.*immutable/, '/assets/* is immutable for a year');
  const html = await page.request.get(`${baseURL}/`);
  assert.equal(html.headers()['cache-control'], 'no-cache', 'index.html is no-cache');
  assert.deepEqual(violations, [], 'no CSP violations');
  console.log(`  CSP clean on ${ROUTES.length} routes`);
}
