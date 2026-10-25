// The explicit dark theme (docs/redesign/DESIGN.md §4) from one source. Each system-dark block in the app's CSS,
//   @media screen and (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }
// gets a copy right after it that applies when the reader chose dark, whatever the system says:
//   @media screen { :root[data-theme="dark"] { … } }
// so the dark tokens are written once. Both stay screen-only: print is always light. The kit's own build
// (vite.kit.config.ts) does not use this, so standalone skill pages follow the system only.

const SYSTEM_DARK = /@media screen and \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([^{}]*)\}\s*\}/g;

/** `css` with an explicit-dark copy after every system-dark block. @param {string} css */
export const withExplicitDark = (css) => css.replace(SYSTEM_DARK, (block, body) => `${block}\n@media screen { :root[data-theme="dark"] {${body}} }`);

/** Vite plugin: applies `withExplicitDark` to the app's CSS files that have a system-dark block. @returns {import('vite').Plugin} */
export const themeCss = () => ({
  name: 'explorable-theme-css',
  enforce: 'pre',
  transform(code, id) {
    if (!/\.css(?:$|\?)/.test(id) || !code.includes('prefers-color-scheme: dark')) return undefined;
    const out = withExplicitDark(code);
    return out === code ? undefined : { code: out, map: null };
  },
});
