import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { themeCss, withExplicitDark } from './theme-css.mjs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const SYSTEM = /@media screen and \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([^{}]*)\}\s*\}/g;
const EXPLICIT = /@media screen \{ :root\[data-theme="dark"\] \{([^{}]*)\} \}/g;
const bodies = (css: string, re: RegExp) => [...css.matchAll(re)].map((m) => m[1]);

describe('theme-css', () => {
  it('adds an explicit-dark copy right after a system-dark block, and leaves other CSS alone', () => {
    const css = ':root { --a: #fff; }\n@media screen and (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --a: #000; } }\n.x { color: red; }';
    expect(withExplicitDark(css)).toBe(
      ':root { --a: #fff; }\n@media screen and (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --a: #000; } }\n@media screen { :root[data-theme="dark"] { --a: #000; } }\n.x { color: red; }',
    );
    expect(withExplicitDark('.x { color: red; }')).toBe('.x { color: red; }');
  });

  it.each(['skills/explorable/kit/src/styles/tokens.css', 'src/styles/app.css'])('gives %s the same dark declarations for the system and for an explicit choice', (path) => {
    const css = read(path);
    const system = bodies(css, SYSTEM);
    expect(system).toHaveLength(1);
    expect(bodies(withExplicitDark(css), EXPLICIT)).toEqual(system);
  });

  it('transforms CSS modules only', () => {
    const plugin = themeCss() as { transform: (code: string, id: string) => { code: string } | undefined };
    const css = read('src/styles/app.css');
    expect(plugin.transform(css, '/x/app.css')?.code).toBe(withExplicitDark(css));
    expect(plugin.transform(css, '/x/app.css?direct')?.code).toBe(withExplicitDark(css));
    expect(plugin.transform(css, '/x/app.ts')).toBeUndefined();
    expect(plugin.transform('.x {}', '/x/base.css')).toBeUndefined();
  });
});
