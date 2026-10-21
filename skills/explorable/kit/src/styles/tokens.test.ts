/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../color/palette.ts';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

describe('tokens.css', () => {
  it('defines exactly the palette colours', () => {
    const defined = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]?.toUpperCase()]));
    expect(defined).toEqual(PALETTE);
  });
});
