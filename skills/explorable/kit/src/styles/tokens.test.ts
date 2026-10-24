/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PALETTES, RADIX, type Scheme } from '../color/palette.ts';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const kitCss = readFileSync(new URL('./kit.css', import.meta.url), 'utf8');

const DARK = /@media \(prefers-color-scheme: dark\) \{([\s\S]*)\}\s*$/;
const decls = (block: string) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]?.trim() ?? '']));

/** Custom properties as the cascade sees them in one scheme: the dark block overrides :root. */
function scheme(name: Scheme): Record<string, string> {
  const dark = DARK.exec(css);
  const base = decls(dark ? css.slice(0, dark.index) : css);
  return name === 'dark' && dark ? { ...base, ...decls(dark[1] ?? '') } : base;
}

/** Follow var(--x) chains to a hex value (undefined when the token is not a colour). */
function resolve(vars: Record<string, string>, name: string): string | undefined {
  const v = vars[name];
  const ref = v && /^var\(--([\w-]+)\)$/.exec(v);
  if (ref?.[1]) return resolve(vars, ref[1]);
  return v && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : undefined;
}

describe('tokens.css', () => {
  it.each(['light', 'dark'] as const)('defines the Radix scales and points every token at its step (%s)', (name) => {
    const vars = scheme(name);
    for (const [scale, steps] of Object.entries(RADIX[name])) steps.forEach((hex, i) => expect([`${scale}-${i + 1}`, resolve(vars, `${scale}-${i + 1}`)]).toEqual([`${scale}-${i + 1}`, hex]));
    for (const [token, hex] of Object.entries(PALETTES[name])) expect([token, resolve(vars, token)]).toEqual([token, hex]);
  });

  it('writes hex only on the scale steps, and nowhere in kit.css', () => {
    const literal = [...css.matchAll(/--([\w-]+):\s*#/g)].map((m) => m[1]);
    expect(literal.every((n) => /^(sand|indigo|orange)-\d+$/.test(n ?? ''))).toBe(true);
    expect(literal).toHaveLength(72);
    expect(kitCss.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi)).toBeNull();
  });

  it('swaps the handle to orange-9 in the dark scheme', () => {
    expect(scheme('light').handle).toBe('var(--orange-10)');
    expect(scheme('dark').handle).toBe('var(--orange-9)');
  });
});
