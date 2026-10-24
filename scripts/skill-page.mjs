// pnpm check:skill-page [--out <dir>]: open each built skill example from file://
// in one headless system Chrome with the network off, and prove the figures are
// live, a keyboard step changes a readout, and nothing logs an error.
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { parseArgs, problems, run, shot } from './lib/harness.mjs';

const EXAMPLES = resolve('skills/explorable/examples');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const out = parseArgs(process.argv.slice(2)).out?.[0];

await run(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, chromiumSandbox: process.env.EXPLORABLE_CHROME_NO_SANDBOX !== '1' });
  try {
    for (const name of readdirSync(EXAMPLES).toSorted()) {
      const url = pathToFileURL(join(EXAMPLES, name, 'index.html')).href;
      /** @type {Array<[string, import('playwright-core').BrowserContextOptions]>} */
      const runs = [['', { viewport: { width: 1280, height: 800 } }], ['-mobile', { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }]];
      for (const [label, options] of runs) {
        const context = await browser.newContext({ ...options, offline: true });
        await context.route(/^(?!file:|data:)/, (route) => route.abort('blockedbyclient'));
        const page = await context.newPage();
        page.on('request', (req) => !/^(file|data):/.test(req.url()) && problems.push(`${name}: network request ${req.url()}`));
        page.on('console', (msg) => msg.type() === 'error' && problems.push(`${name}: console error: ${msg.text()}`));
        page.on('pageerror', (error) => problems.push(`${name}: page error: ${error.message}`));
        await page.goto(url, { waitUntil: 'load' });
        const shells = await page.locator('figure.xfig').count();
        await page.locator('figure.xfig[data-live]').nth(shells - 1).waitFor({ timeout: 5000 });
        const figure = page.locator('figure.xfig[data-live]').first();
        const readout = figure.locator('.xfig-readout');
        await figure.scrollIntoViewIfNeeded();
        const before = await readout.textContent();
        await figure.locator('.xfig-controls input').first().focus();
        await page.keyboard.press('ArrowRight');
        await page
          .waitForFunction((text) => document.querySelector('figure.xfig[data-live] .xfig-readout')?.textContent !== text, before ?? '', { timeout: 2000 })
          .catch(() => {});
        const after = await readout.textContent();
        if (!before || after === before) problems.push(`${name}${label}: ArrowRight on the first control did not change the readout (${before})`);
        // Notes: Enter on the first math marker opens its panel under the paragraph.
        const marker = page.locator('button.xnote-mk').first();
        let notes = 'no notes';
        if (await marker.count()) {
          await marker.focus();
          await page.keyboard.press('Enter');
          const panel = page.locator(`#${await marker.getAttribute('aria-controls')}`);
          const open = (await marker.getAttribute('aria-expanded')) === 'true' && (await panel.isVisible());
          if (!open) problems.push(`${name}${label}: Enter on the first math marker did not open its note`);
          notes = `${await page.locator('button.xnote-mk').count()} math note(s), first ${open ? 'opens' : 'stays shut'}`;
        }
        console.log(`${name}${label}: ${shells} live figure(s); readout "${before}" -> "${after}"; ${notes}`);
        if (out) console.log(`  shot ${await shot(page, out, `skill-${name}${label}`)}`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}, 'skill page check passed');
