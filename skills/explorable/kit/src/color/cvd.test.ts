import { describe, expect, it } from 'vitest';
import { contrast, deltaE, seriesFailures } from './cvd.ts';
import { GRAPHIC_TOKENS, PALETTE, PALETTES, SERIES, SERIES_DARK, SURFACES, SURFACES_DARK, TEXT_TOKENS } from './palette.ts';

const schemes = [
  ['light', SERIES, SURFACES],
  ['dark', SERIES_DARK, SURFACES_DARK],
] as const;
const pairs = (series: readonly string[]) => series.flatMap((a, i) => series.slice(i + 1).map((b) => [a, b] as const));

describe('series palette under colour-vision deficiency', () => {
  it.each(schemes)('indigo, ink and orange stay apart for protan, deutan, tritan (≥ 8) and normal (≥ 15) (%s)', (_, series) => {
    expect(series).toHaveLength(3);
    for (const [a, b] of pairs(series)) {
      for (const vision of ['protan', 'deutan', 'tritan'] as const) expect(deltaE(a, b, vision)).toBeGreaterThanOrEqual(8);
      expect(deltaE(a, b)).toBeGreaterThanOrEqual(15);
    }
    expect(seriesFailures(series)).toEqual([]);
  });

  it('keeps data (indigo) and handle (orange) far apart in both schemes', () => {
    for (const p of Object.values(PALETTES)) {
      for (const vision of ['protan', 'deutan', 'tritan'] as const) expect(deltaE(p.data, p.handle, vision)).toBeGreaterThanOrEqual(25);
    }
  });

  it('rejects a fourth hue that collides with indigo (violet)', () => {
    const fails = seriesFailures([...SERIES, '#8E4EC6']).filter((f) => f.vision !== 'normal');
    expect(fails.length).toBeGreaterThan(0);
    expect(fails.every((f) => f.a === PALETTE['series-1'])).toBe(true);
  });

  it('matches the reference numbers from the redesign spec', () => {
    expect(contrast(PALETTE.handle, PALETTE.paper)).toBeCloseTo(3.27, 2);
    expect(contrast(PALETTE['ink-2'], PALETTE.paper)).toBeCloseTo(5.93, 2);
  });
});

describe('contrast on every surface, light and dark', () => {
  it.each(schemes)('text tokens reach 4.5:1 and graphic tokens 3:1 (%s)', (name, _, surfaces) => {
    const p = PALETTES[name];
    for (const surface of surfaces) {
      expect(TEXT_TOKENS.filter((t) => contrast(p[t], surface) < 4.5)).toEqual([]);
      expect(GRAPHIC_TOKENS.filter((t) => contrast(p[t], surface) < 3)).toEqual([]);
    }
  });

  it('keeps text readable on the washes and the primary button', () => {
    for (const p of Object.values(PALETTES)) {
      expect(contrast(p['live-ink'], p['live-wash'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.ink, p['note-wash'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.paper, p.ink)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('is symmetric and spans 1 to 21', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBe(1);
    expect(() => contrast('red', '#FFFFFF')).toThrow('Not a #RRGGBB colour: red');
  });
});
