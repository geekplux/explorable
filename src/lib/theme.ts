/**
 * Light or dark (docs/redesign/DESIGN.md §4). The page follows the system until the reader picks a theme with the
 * header button; the choice is `<html data-theme>` plus localStorage, which public/theme-init.js reads back before the
 * first paint. There is no third "system" state: choosing the theme the system already has, or clearing site data,
 * returns to following the system.
 */
export type Theme = 'light' | 'dark';

/** The localStorage key; public/theme-init.js reads the same one. */
export const THEME_KEY = 'theme';
const DARK = '(prefers-color-scheme: dark)';

const systemDark = () => typeof matchMedia === 'function' && matchMedia(DARK).matches;

/** The theme on screen: the reader's choice on `<html data-theme>`, else the system's. */
export function currentTheme(root: HTMLElement = document.documentElement): Theme {
  const chosen = root.dataset.theme;
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return systemDark() ? 'dark' : 'light';
}

/**
 * Show `theme`. A choice that differs from the system is set on `<html>` and remembered; one that equals the system
 * clears both, so the page follows the system again. Without storage (private mode, blocked site data) it still
 * switches this page.
 */
export function chooseTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  const follow = theme === (systemDark() ? 'dark' : 'light');
  if (follow) delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (follow) localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Not remembered; the page still switches.
  }
}

/** Call `onChange` when the system setting flips (it matters only while the reader has not chosen). */
export function onSystemTheme(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const query = matchMedia(DARK);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
