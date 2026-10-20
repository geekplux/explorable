import { describe, expect, it } from 'vitest';
import { contrast, deltaE, seriesFailures } from './cvd.ts';
import { GRAPHIC_TOKENS, PALETTE, SERIES, SURFACES, TEXT_TOKENS } from './palette.ts';

const pairs = SERIES.flatMap((a, i) => SERIES.slice(i + 1).map((b) => [a, b] as const));

describe('series palette under colour-vision deficiency', () => {
  it.each(pairs)('%s vs %s stays apart for protan, deutan, tritan (≥ 8) and normal (≥ 15)', (a, b) => {
    for (const vision of ['protan', 'deutan', 'tritan'] as const) expect(deltaE(a, b, vision)).toBeGreaterThanOrEqual(8);
    expect(deltaE(a, b)).toBeGreaterThanOrEqual(15);
  });

  it('has no failing pair across every SERIES entry (a 4th hue must pass too)', () => {
    expect(SERIES.length).toBeLessThanOrEqual(3);
    expect(seriesFailures(SERIES)).toEqual([]);
  });

  it('rejects a fourth hue that collides with cobalt (purple: protan 5.47, deutan 6.67)', () => {
    const fails = seriesFailures([...SERIES, '#7B3FA0']).filter((f) => f.vision !== 'normal');
    expect(fails.map((f) => [f.a, f.vision])).toEqual([[PALETTE['series-1'], 'protan'], [PALETTE['series-1'], 'deutan']]);
    expect(fails[0]?.deltaE).toBeCloseTo(5.47, 1);
  });

  it('matches the reference numbers from the identity spec', () => {
    expect(Math.abs(deltaE(PALETTE['series-1'], PALETTE['series-2'], 'tritan') - 9.51)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(deltaE(PALETTE.live, PALETTE['series-2'], 'deutan') - 10.58)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(contrast(PALETTE['ink-2'], PALETTE.well) - 6.4)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(contrast(PALETTE['series-2'], PALETTE.well) - 3.72)).toBeLessThanOrEqual(0.02);
  });
});

describe('contrast on both surfaces', () => {
  it.each(SURFACES)('text tokens reach 4.5:1 and graphic tokens 3:1 on %s', (surface) => {
    expect(TEXT_TOKENS.filter((t) => contrast(PALETTE[t], surface) < 4.5)).toEqual([]);
    expect(GRAPHIC_TOKENS.filter((t) => contrast(PALETTE[t], surface) < 3)).toEqual([]);
  });

  it('keeps text readable on the washes', () => {
    expect(contrast(PALETTE['live-ink'], PALETTE['live-wash'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(PALETTE.ink, PALETTE['note-wash'])).toBeGreaterThanOrEqual(4.5);
  });

  it('is symmetric and spans 1 to 21', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBe(1);
    expect(() => contrast('red', '#FFFFFF')).toThrow('Not a #RRGGBB colour: red');
  });
});
