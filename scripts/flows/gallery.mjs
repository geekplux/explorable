// Gallery: cards are complete, axe is clean on / and /s/attention, CVD shots.
import { blocking } from '../lib/axe.mjs';

const VISIONS = ['protan', 'deutan', 'tritan'];

async function assertAxeClean({ page, axe, assert }) {
  const bad = blocking(await axe());
  assert.deepEqual(
    bad.map((v) => `${v.id} (${v.impact}): ${v.help}`),
    [],
    `serious/critical axe violations on ${page.url()}`,
  );
}

export default async function gallery(ctx) {
  const { page, baseURL, shot, assert, cvd } = ctx;
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  const cards = await page.locator('.card').evaluateAll((els) =>
    els.map((el) => ({
      title: el.querySelector('.card-title a')?.textContent?.trim(),
      dek: el.querySelector('.card-dek')?.textContent?.trim(),
      source: el.querySelector('.card-source')?.textContent?.trim(),
      thumb: el.querySelector('img')?.getAttribute('src'),
    })),
  );
  assert.ok(cards.length >= 3, `expected ≥ 3 cards, found ${cards.length}`);
  for (const card of cards) assert.ok(card.title && card.dek && card.source && card.thumb, `incomplete card ${JSON.stringify(card)}`);
  await assertAxeClean(ctx);
  await shot('gallery-home');

  for (const vision of VISIONS) {
    await cvd(vision);
    await shot(`home-${vision}`);
  }
  await cvd(null);

  await page.locator('.card-title a').first().click();
  await page.waitForURL(`${baseURL}/s/attention`);
  await page.locator('.essay-takeaway').waitFor();
  assert.ok((await page.locator('figure.xfig').count()) >= 2, 'attention essay shows ≥ 2 figures');
  await assertAxeClean(ctx);
  await shot('gallery-attention');
}
