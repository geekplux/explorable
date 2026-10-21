// P2: LCP on / and /s/attention with 4× CPU throttling (CDP) is ≤ 1500 ms on the
// local preview. The harness routes every request, which disables the HTTP
// cache, so each navigation is a cold load.
const BUDGET_MS = 1500;
const ROUTES = ['/', '/s/attention'];

export default async function lcp({ page, baseURL, assert }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  for (const route of ROUTES) {
    await page.goto(`${baseURL}${route}`, { waitUntil: 'load' });
    const ms = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let last = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) last = entry.startTime;
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => resolve(last), 1000);
        }),
    );
    console.log(`  LCP ${route}: ${Math.round(ms)} ms (4× CPU throttle, budget ${BUDGET_MS} ms)`);
    assert.ok(ms > 0 && ms <= BUDGET_MS, `${route}: LCP ${Math.round(ms)} ms > ${BUDGET_MS} ms`);
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
}
