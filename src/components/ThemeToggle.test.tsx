// @vitest-environment happy-dom
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_KEY } from '../lib/theme.ts';
import { Header } from './Header.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const html = document.documentElement;
const host = document.createElement('div');
const root = createRoot(host);
const button = () => host.querySelector<HTMLButtonElement>('button.theme-toggle');
const name = () => button()?.getAttribute('aria-label');

const fail = () => {
  throw new Error('SecurityError');
};

/** A system setting that a test can flip; `change` listeners hear it. */
function systemScheme(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = { get matches() { return dark; }, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) };
  vi.stubGlobal('matchMedia', (q: string) => (q === '(prefers-color-scheme: dark)' ? query : { matches: false, addEventListener() {}, removeEventListener() {} }));
  return (next: boolean) => {
    dark = next;
    for (const fn of listeners) fn();
  };
}

beforeEach(() => {
  delete html.dataset.theme;
  localStorage.clear();
});
afterEach(() => {
  act(() => root.render(null));
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ThemeToggle', () => {
  it('starts from the system setting and names the theme it switches to', () => {
    systemScheme(false);
    act(() => root.render(<ThemeToggle />));
    expect(name()).toBe('Switch to dark theme');
    expect(button()?.hasAttribute('aria-pressed')).toBe(false);
    act(() => root.render(null));
    systemScheme(true);
    act(() => root.render(<ThemeToggle />));
    expect(name()).toBe('Switch to light theme');
  });

  it('starts from a stored choice on <html data-theme> over the system', () => {
    systemScheme(true);
    html.dataset.theme = 'light';
    act(() => root.render(<ThemeToggle />));
    expect(name()).toBe('Switch to dark theme');
  });

  it('flips the theme on click; a choice other than the system is set and remembered', () => {
    systemScheme(false);
    act(() => root.render(<ThemeToggle />));
    act(() => button()?.click());
    expect([html.dataset.theme, localStorage.getItem(THEME_KEY), name()]).toEqual(['dark', 'dark', 'Switch to light theme']);
  });

  it('choosing the system theme clears the attribute and the stored entry, so the page follows the system again', () => {
    systemScheme(false);
    act(() => root.render(<ThemeToggle />));
    act(() => button()?.click());
    act(() => button()?.click());
    expect([html.dataset.theme, localStorage.getItem(THEME_KEY), name()]).toEqual([undefined, null, 'Switch to dark theme']);

    act(() => root.render(null));
    systemScheme(true);
    html.dataset.theme = 'light';
    localStorage.setItem(THEME_KEY, 'light');
    act(() => root.render(<ThemeToggle />));
    act(() => button()?.click());
    expect([html.dataset.theme, localStorage.getItem(THEME_KEY), name()]).toEqual([undefined, null, 'Switch to light theme']);
  });

  it('still switches when storage throws (private mode, blocked site data)', () => {
    systemScheme(false);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(fail);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(fail);
    act(() => root.render(<ThemeToggle />));
    expect(() => act(() => button()?.click())).not.toThrow();
    expect([html.dataset.theme, name()]).toEqual(['dark', 'Switch to light theme']);
    expect(() => act(() => button()?.click())).not.toThrow();
    expect([html.dataset.theme, name()]).toEqual([undefined, 'Switch to dark theme']);
  });

  it('follows a system change until the reader chooses a theme other than the system', () => {
    const flip = systemScheme(false);
    act(() => root.render(<ThemeToggle />));
    act(() => flip(true));
    expect(name()).toBe('Switch to light theme');
    act(() => button()?.click());
    act(() => flip(true));
    expect([html.dataset.theme, localStorage.getItem(THEME_KEY), name()]).toEqual(['light', 'light', 'Switch to dark theme']);
  });

  it('sits after the nav, outside it, so it stays on phones where the nav is hidden', () => {
    systemScheme(false);
    act(() => root.render(<Header />));
    const end = host.querySelector('.site-end');
    expect([...(end?.children ?? [])].map((el) => el.className)).toEqual(['site-nav', 'theme-toggle']);
    expect(button()?.type).toBe('button');
    expect(button()?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('public/theme-init.js', () => {
  const src = readFileSync('public/theme-init.js', 'utf8');
  const run = (storage: { getItem: (k: string) => string | null }) => {
    const el = { dataset: {} as Record<string, string> };
    new Function('localStorage', 'document', src)(storage, { documentElement: el });
    return el.dataset.theme;
  };

  it('stays under 300 bytes and reads the key the toggle writes', () => {
    expect(Buffer.byteLength(src)).toBeLessThanOrEqual(300);
    expect(src).toContain(`"${THEME_KEY}"`);
  });

  it('applies a stored light or dark choice and ignores anything else', () => {
    expect(run({ getItem: () => 'dark' })).toBe('dark');
    expect(run({ getItem: () => 'light' })).toBe('light');
    expect(run({ getItem: () => 'system' })).toBeUndefined();
    expect(run({ getItem: () => null })).toBeUndefined();
  });

  it('does nothing when storage throws', () => {
    expect(() => run({ getItem: () => { throw new Error('SecurityError'); } })).not.toThrow();
  });

  it('loads as a blocking script before any stylesheet in index.html', () => {
    const index = readFileSync('index.html', 'utf8');
    const at = index.indexOf('<script src="/theme-init.js"></script>');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(index.indexOf('</head>'));
    expect(index.slice(0, at)).not.toMatch(/stylesheet|<style/);
  });
});
