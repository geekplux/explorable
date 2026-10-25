// @vitest-environment happy-dom
/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { Footer } from './Footer.tsx';
import { Header } from './Header.tsx';
import { Logo } from './Logo.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const host = document.createElement('div');
const root = createRoot(host);
afterEach(() => act(() => root.render(null)));

describe('header and footer', () => {
  it('has the wordmark home link and the three nav links', () => {
    act(() => root.render(<Header />));
    expect(host.querySelector('header a.site-home')?.getAttribute('href')).toBe('/');
    expect(host.querySelector('.wordmark')?.textContent).toBe('Explorable');
    expect([...host.querySelectorAll('nav a')].map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Essays', '/#essays'],
      ['How it works', '/#how'],
      ['GitHub', 'https://github.com/geekplux/explorable'],
    ]);
  });

  it('lists geekplux.com first, then four projects, and the licence as plain text', () => {
    act(() => root.render(<Footer />));
    expect([...host.querySelectorAll('.made-by a')].map((a) => a.getAttribute('href'))).toEqual([
      'https://geekplux.com',
      'https://vert.geekplux.org',
      'https://reasontrail.geekplux.com',
      'https://pagelapse.geekplux.com',
      'https://github.com/geekplux/markvis',
    ]);
    expect(host.querySelector('.made-by h2')?.textContent).toBe('Made by GeekPlux');
    const items = [...host.querySelectorAll('.site-foot li')];
    expect(items.map((li) => li.textContent)).toEqual(['Source on GitHub', 'Accessibility', 'MIT licence']);
    expect(items[2]?.querySelector('a')).toBeNull();
  });
});

describe('Logo', () => {
  it('gives each mark on a page its own gradient ids', () => {
    act(() => root.render(<><Header /><Footer /></>));
    const ids = [...host.querySelectorAll('radialGradient')].map((g) => g.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ids).size).toBe(ids.length);
    for (const svg of host.querySelectorAll('svg.logo')) {
      const fill = svg.querySelector('path[fill^="url"]')?.getAttribute('fill');
      expect(fill && svg.querySelector(`[id="${fill.slice(5, -1)}"]`)).toBeTruthy();
    }
  });

  it('draws construction lines and a halo only at 28px and up, and uses the wide crop for lockups', () => {
    act(() => root.render(<><Logo size={48} /><Logo size={24} wide /></>));
    const [large, small] = [...host.querySelectorAll('svg')];
    expect(large?.querySelectorAll('circle')).toHaveLength(6);
    expect(small?.querySelector('[stroke="var(--logo-faint)"]')).toBeNull();
    expect(small?.getAttribute('viewBox')).toBe('3 10 58 41');
    expect(small?.getAttribute('width')).toBe('34');
  });

  it('keeps the header mark under 4 KB', () => {
    act(() => root.render(<Header />));
    expect(host.querySelector('svg.logo')?.outerHTML.length).toBeLessThanOrEqual(4096);
    act(() => root.render(<Logo size={64} />));
    expect(host.querySelector('svg.logo')?.outerHTML.length).toBeLessThanOrEqual(4096);
  });
});

describe('copy', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.(tsx?|css)$/.test(e.name) && !/\.test\./.test(e.name) ? [join(dir, e.name)] : []));
  it('never uses "·" as a separator in src/', () => {
    expect(files('src').filter((f) => readFileSync(f, 'utf8').includes('·'))).toEqual([]);
  });
});
