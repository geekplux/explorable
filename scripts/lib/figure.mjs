// Shared figure checks for e2e flows: settling, text overlap/clipping and hit areas.

/** Wait (up to 10 s) until eased motion has finished: `read(root)`, a string of the drawn state, is the same on two polls 200 ms apart. */
export async function settledBy(page, fig, read) {
  const deadline = Date.now() + 10_000;
  for (let last; ; ) {
    const now = await page.locator(fig).evaluate(read);
    if (now === last) return;
    if (Date.now() > deadline) throw new Error(`${fig} did not settle within 10 s`);
    last = now;
    await page.waitForTimeout(200);
  }
}

/** Pairs of visible SVG texts in `fig` whose boxes overlap, plus texts that leave the figure card or the viewport. */
export const textProblems = (page, fig) =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const card = root.querySelector('.xfig-card') ?? root;
    const frame = card.getBoundingClientRect();
    const boxes = [...root.querySelectorAll('svg text')]
      .filter((t) => t.textContent.trim() && getComputedStyle(t).visibility !== 'hidden')
      .map((t) => ({ text: t.textContent, r: t.getBoundingClientRect() }));
    const hits = [];
    for (const [i, a] of boxes.entries()) {
      if (a.r.left < Math.max(0, frame.left) - 0.5 || a.r.right > Math.min(innerWidth, frame.right) + 0.5) hits.push(`clipped: ${a.text}`);
      for (const b of boxes.slice(i + 1)) {
        if (a.r.left < b.r.right && b.r.left < a.r.right && a.r.top < b.r.bottom && b.r.top < a.r.bottom) hits.push(`${a.text} × ${b.text}`);
      }
    }
    return hits;
  }, fig);

/** Every matching pointer target in `fig` is ≥ 44 × 44 CSS px. */
export async function assertHitAreas(page, assert, fig, width, sels = ['.xfig-knob-hit', '.xfig-track-hit', '.xfig-control:not(.xfig-sr) input[type=range]', '.xfig-data-toggle']) {
  for (const sel of sels) {
    for (const box of await Promise.all((await page.locator(`${fig} ${sel}`).all()).map((l) => l.boundingBox()))) {
      assert.ok(box.width >= 44 && box.height >= 44, `${fig} ${sel} hit area ${box.width}×${box.height} ≥ 44 px at ${width} px`);
    }
  }
}

/** An open data table stays inside its own scroll region: the page never scrolls sideways, and the table's box is within the region's. */
export async function assertTableContained(page, assert, fig, width) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `open table: no page scroll at ${width} px`);
  const [wrap, table] = await Promise.all([page.locator(`${fig} .xfig-table-wrap`).boundingBox(), page.locator(`${fig} table.xfig-table`).boundingBox()]);
  assert.ok(table.x >= wrap.x - 0.5 && table.y >= wrap.y - 0.5, `${fig} table starts inside its scroll region at ${width} px`);
}
