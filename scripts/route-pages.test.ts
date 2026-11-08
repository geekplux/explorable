// The HTML each route gets from Workers static assets, without the single-page fallback. Real routes have a file of
// their own (`/`, `/s/<slug>`, `/x`); any other path is 404.html at status 404 (`not_found_handling: "404-page"`), so
// a made-up URL no longer passes for a second copy of the home page (it used to get index.html with 200).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matchRoute } from '../src/router.ts';
import { NOT_FOUND_TITLE, SITE, routePages, routePagesPlugin, sampleRoutes } from './route-pages.mjs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('index.html');
const titleOf = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1];
const canonicalOf = (html: string) => [...html.matchAll(/<link rel="canonical" href="([^"]*)" \/>/g)].map((m) => m[1]);
const routes = sampleRoutes(new URL('../src/samples/', import.meta.url));
const pages = routePages(index, routes);
/** The samples src/samples/index.ts registers (its `import … from './<slug>.json'` lines). */
const registered = [...read('src/samples/index.ts').matchAll(/^import \w+ from '\.\/([\w-]+)\.json';$/gm)].map((m) => m[1]);

describe('home page', () => {
  it('names its absolute canonical URL once', () => {
    expect(SITE).toBe('https://explorable.geekplux.com');
    expect(canonicalOf(index)).toEqual(['https://explorable.geekplux.com/']);
  });
});

describe('route pages', () => {
  it('give every built-in sample a page at /s/<slug>, with and without the trailing slash', () => {
    expect(routes.length).toBeGreaterThan(0);
    for (const doc of routes) {
      for (const file of [`s/${doc.id}.html`, `s/${doc.id}/index.html`]) {
        const html = pages[file];
        expect(html).toBeDefined();
        expect(titleOf(html!)).toBe(`${doc.title} – Explorable`);
        expect(canonicalOf(html!)).toEqual([`${SITE}/s/${doc.id}`]);
        expect(html).toContain(`<meta property="og:url" content="${SITE}/s/${doc.id}" />`);
        expect(html).not.toContain('noindex');
      }
      expect(matchRoute(`/s/${doc.id}`)).toEqual({ name: 'sample', slug: doc.id });
    }
  });

  it('give /x (an essay for ?url=) the shell without the home canonical', () => {
    for (const file of ['x.html', 'x/index.html']) {
      expect(titleOf(pages[file]!)).toBe('Explorable');
      expect(canonicalOf(pages[file]!)).toEqual([]);
      expect(pages[file]).not.toContain('noindex');
    }
    expect(matchRoute('/x', '?url=https://arxiv.org/abs/1706.03762').name).toBe('explain');
  });

  it('give everything else a noindex 404 page with its own title and no canonical', () => {
    const page = pages['404.html']!;
    expect(NOT_FOUND_TITLE).toBe('Not found – Explorable');
    expect(titleOf(page)).toBe(NOT_FOUND_TITLE);
    expect(titleOf(page)).not.toBe(titleOf(index));
    expect(page).toContain('<meta name="robots" content="noindex" />');
    expect(canonicalOf(page)).toEqual([]);
  });

  it('keep the rest of the shell, so the app boots and routes on every page', () => {
    for (const html of Object.values(pages)) {
      expect(html).toContain('<div id="root"></div>');
      expect(html).toContain('<script type="module" src="/src/main.tsx"></script>');
    }
  });

  it('cover exactly the registered samples, and escape their titles', () => {
    expect(routes.map((s) => s.id).toSorted()).toEqual(registered.toSorted());
    const odd = routePages(index, [{ id: 'a-b', title: 'Tom & "Jerry" <3' }]);
    expect(titleOf(odd['s/a-b.html']!)).toBe('Tom &amp; &quot;Jerry&quot; &lt;3 – Explorable');
  });

  it('refuse a shell without its title or canonical', () => {
    expect(() => routePages('<html><head></head></html>', [])).toThrow('<title>');
    expect(() => routePages('<title>x</title>', [])).toThrow('canonical');
  });

  it('are emitted next to index.html in the client build only', () => {
    const plugin = routePagesPlugin();
    const emitted: string[] = [];
    const hook = plugin.generateBundle as { handler: (...args: unknown[]) => void };
    const ctx = { emitFile: (file: { fileName: string }) => emitted.push(file.fileName) };
    hook.handler.call(ctx, {}, {});
    expect(emitted).toEqual([]);
    hook.handler.call(ctx, {}, { 'index.html': { type: 'asset', source: index } });
    expect(emitted.toSorted()).toEqual(Object.keys(pages).toSorted());
  });

  it('are what wrangler.jsonc serves: 404-page, no single-page fallback', () => {
    const wrangler = read('wrangler.jsonc');
    expect(wrangler).toMatch(/"not_found_handling":\s*"404-page"/);
    expect(wrangler).not.toContain('single-page-application');
  });
});
