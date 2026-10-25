// pnpm build:pdf [--no-build]: render each built-in sample to public/pdf/<slug>.pdf (DESIGN §8). Builds (unless
// --no-build), starts the preview through the harness, opens each sample in one headless Chromium with print media,
// waits for fonts and live figures, opens every math note (paper has no click), and prints A4 with the page's own
// @page rules. Chromium stamps the time into the PDF; the dates are pinned in place (same length, so the xref stays
// valid) and a file whose bytes did not change is not rewritten.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs, run, withBrowser, withPreview } from './lib/harness.mjs';

const OUT = 'public/pdf';
/** Each PDF stays small enough to ship in the repo and download on a phone. */
const MAX_BYTES = 600 * 1024;
const PINNED = "D:20261024000000+00'00'";
/** Content width of an A4 page with the 72px side margins of app.css. */
const PAGE_WIDTH = 794 - 2 * 72;

/** Pin Chromium's CreationDate and ModDate (both `D:YYYYMMDDHHmmSS+00'00'`, the same length as PINNED). */
const pinDates = (pdf) => Buffer.from(pdf.toString('latin1').replace(/(\/(?:Creation|Mod)Date \()D:\d{14}[^)]*(\))/g, (m, a, b) => (m.length === a.length + PINNED.length + b.length ? `${a}${PINNED}${b}` : m)), 'latin1');

const args = parseArgs(process.argv.slice(2));
const slugs = readdirSync('src/samples').filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

await run(async () => {
  mkdirSync(OUT, { recursive: true });
  await withPreview(
    ({ baseURL }) =>
      withBrowser(
        async ({ newPage }) => {
          for (const slug of slugs) {
            const page = await newPage({ width: PAGE_WIDTH, height: 1000 }, { colorScheme: 'light' });
            await page.emulateMedia({ media: 'print' });
            await page.goto(`${baseURL}/s/${slug}`, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => {
              const figs = document.querySelectorAll('figure.xfig');
              return figs.length > 0 && document.querySelectorAll('figure.xfig[data-live]').length === figs.length;
            });
            await page.locator('.xnote-mk[aria-expanded="false"]').evaluateAll((marks) => marks.forEach((m) => m.click()));
            await page.evaluate(() => document.fonts.ready);
            const pdf = pinDates(await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }));
            const path = join(OUT, `${slug}.pdf`);
            const same = existsSync(path) && readFileSync(path).equals(pdf);
            if (!same) writeFileSync(path, pdf);
            console.log(`${path}: ${(pdf.length / 1024).toFixed(1)} KB${same ? ', unchanged' : ''}`);
            if (pdf.length > MAX_BYTES) throw new Error(`${path} is ${(pdf.length / 1024).toFixed(1)} KB, over 600 KB`);
            await page.context().close();
          }
        },
        { baseURL },
      ),
    { build: !('no-build' in args) },
  );
}, `build:pdf wrote ${slugs.length} PDFs to ${OUT}/`);
