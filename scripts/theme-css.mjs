// The explicit dark theme (docs/redesign/DESIGN.md §4) from one source. Each system-dark block in the app's CSS,
//   @media screen and (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }
// gets a copy right after it that applies when the reader chose dark, whatever the system says:
//   @media screen { :root[data-theme="dark"] { … } }
// so the dark tokens are written once. Both stay screen-only: print is always light. The kit's own build
// (vite.kit.config.ts) does not use this, so standalone skill pages follow the system only.

const SYSTEM_DARK = /@media screen and \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([^{}]*)\}\s*\}/g;

/** `css` with an explicit-dark copy after every system-dark block. @param {string} css */
export const withExplicitDark = (css) => css.replace(SYSTEM_DARK, (block, body) => `${block}\n@media screen { :root[data-theme="dark"] {${body}} }`);

/**
 * Vite plugin: applies `withExplicitDark` to the app's CSS files. A file that asks for the dark scheme in any other
 * shape fails the build, since a reader's dark choice would silently miss it. @returns {import('vite').Plugin}
 */
export const themeCss = () => ({
  name: 'explorable-theme-css',
  enforce: 'pre',
  transform(code, id) {
    if (!/\.css(?:$|\?)/.test(id) || !/prefers-color-scheme\s*:\s*dark/.test(code)) return undefined;
    const out = withExplicitDark(code);
    if (out === code) {
      this.error(`${id}: a prefers-color-scheme: dark rule that is not \`@media screen and (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }\`, so a chosen dark theme would miss it (scripts/theme-css.mjs)`);
    }
    return { code: out, map: null };
  },
});
