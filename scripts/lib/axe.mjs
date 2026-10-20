// Run axe-core (from node_modules, injected inline: no network) on a page.
import { createRequire } from 'node:module';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

/**
 * Inject axe-core once per document and return its violations.
 * @param {import('playwright-core').Page} page
 * @returns {Promise<Array<{ id: string, impact?: string | null, help: string, nodes: unknown[] }>>}
 */
export async function axe(page) {
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ path: AXE });
  // @ts-expect-error axe is a page global injected above
  return page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations));
}

/** Violations that fail the A4 bar: impact serious or critical. */
export const blocking = (violations) => violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
