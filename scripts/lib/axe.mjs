// Run axe-core (from node_modules, no network) on a page. It is evaluated over
// CDP rather than added as an inline <script>, which the app's CSP blocks.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

/**
 * Inject axe-core once per document and return its violations.
 * @param {import('playwright-core').Page} page
 * @returns {Promise<Array<{ id: string, impact?: string | null, help: string, nodes: unknown[] }>>}
 */
export async function axe(page) {
  if (!(await page.evaluate(() => 'axe' in window))) await page.evaluate(AXE);
  // @ts-expect-error axe is a page global injected above
  return page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations));
}

/** Violations that fail a run: impact serious or critical. */
export const blocking = (violations) => violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
