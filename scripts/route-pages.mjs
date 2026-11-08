// One HTML file per route, so Workers static assets can answer an unknown path with a real 404 instead of the
// single-page fallback (which gave every path index.html, the home page's title and a 200). wrangler.jsonc sets
// `not_found_handling: "404-page"`; the routes are src/router.ts's:
//   /            index.html (the gallery), canonical https://explorable.geekplux.com/
//   /s/<slug>    s/<slug>.html and s/<slug>/index.html for each built-in sample, the essay's title and canonical
//   /x?url=…     x.html and x/index.html, the shell without the home canonical (the essay depends on the query)
//   anything     404.html at status 404: noindex, no canonical, the not-found title; the app still boots and shows
//                its own not-found page.
// Both spellings of a page (with and without the trailing slash) answer 200, as they did before; the canonical names
// the one without.
import { readFileSync, readdirSync } from 'node:fs';

export const SITE = 'https://explorable.geekplux.com';
/** The not-found title, the same as src/pages/NotFoundPage.tsx sets. */
export const NOT_FOUND_TITLE = 'Not found – Explorable';

const TITLE_RE = /<title>[^<]*<\/title>/;
const CANONICAL_RE = /<link rel="canonical" href="[^"]*" \/>/;
const OG_URL_RE = /<meta property="og:url" content="[^"]*" \/>/;

/** @param {string} text */
const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The built-in samples' slugs and titles, read from their JSON. @param {URL} dir @returns {{ id: string; title: string }[]} */
export const sampleRoutes = (dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .toSorted()
    .map((name) => {
      const { id, title } = JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
      return { id, title };
    });

/**
 * Every route page, by file name, from the built index.html.
 * @param {string} html @param {{ id: string; title: string }[]} routes @returns {Record<string, string>}
 */
export function routePages(html, routes) {
  if (!TITLE_RE.test(html)) throw new Error('index.html has no <title> to replace');
  if (!CANONICAL_RE.test(html)) throw new Error('index.html has no <link rel="canonical"> to replace');
  /** @param {{ title: string; canonical?: string; noindex?: boolean }} options */
  const page = ({ title, canonical, noindex = false }) =>
    html
      .replace(TITLE_RE, `${noindex ? '<meta name="robots" content="noindex" />\n    ' : ''}<title>${title}</title>`)
      .replace(canonical ? CANONICAL_RE : /\s*<link rel="canonical" href="[^"]*" \/>/, canonical ? `<link rel="canonical" href="${canonical}" />` : '')
      .replace(OG_URL_RE, (tag) => (canonical ? `<meta property="og:url" content="${canonical}" />` : tag));
  /** @type {Record<string, string>} */
  const pages = { '404.html': page({ title: NOT_FOUND_TITLE, noindex: true }) };
  const x = page({ title: /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '' });
  pages['x.html'] = x;
  pages['x/index.html'] = x;
  for (const { id, title } of routes) {
    const sample = page({ title: `${escapeHtml(title)} – Explorable`, canonical: `${SITE}/s/${id}` });
    pages[`s/${id}.html`] = sample;
    pages[`s/${id}/index.html`] = sample;
  }
  return pages;
}

/** Vite plugin: writes the route pages next to index.html in the client build. @returns {import('vite').Plugin} */
export const routePagesPlugin = () => ({
  name: 'explorable-route-pages',
  apply: 'build',
  generateBundle: {
    order: 'post',
    handler(_, bundle) {
      const index = bundle['index.html'];
      if (index?.type !== 'asset') return;
      const pages = routePages(String(index.source), sampleRoutes(new URL('../src/samples/', import.meta.url)));
      for (const [fileName, source] of Object.entries(pages)) this.emitFile({ type: 'asset', fileName, source });
    },
  },
});
