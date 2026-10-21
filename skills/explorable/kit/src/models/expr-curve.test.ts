// expr-curve built from the Bloom Fig 2 spec: the designer's fixture table, the marker, the reference, and bad specs.
import { describe, expect, it } from 'vitest';
import bloomDoc from '../../../../../src/samples/bloom-filter.json';
import { parseDoc, type FigureSpec } from '../doc/schema.ts';
import { ExprError } from '../expr/lexer.ts';
import { fillTemplate } from '../registry.ts';
import { CURVE_POINTS, exprCurveModel, exprCurveOptions } from './expr-curve.ts';

const parsed = parseDoc(bloomDoc);
if (!parsed.ok) throw new Error('bloom sample does not parse');
const spec = parsed.doc.sections.flatMap((s) => (s.figure?.id === 'fig-fpr-curve' ? [s.figure] : []))[0]!;
const model = exprCurveModel(spec);
type Out = { y: number; ref: number; marker: number; curve: number[]; refCurve: number[] };
const at = (m: number, k: number, x: number) => model.compute({ m, k, x }) as Out;
const withModel = (patch: Record<string, unknown>, options: Record<string, unknown> = {}): FigureSpec =>
  ({ ...spec, model: { ...spec.model, ...patch }, options: { ...spec.options, ...options } }) as FigureSpec;

describe('expr-curve (Bloom Fig 2)', () => {
  it('declares x and the spec params, with the knob at x0 and whole-item steps', () => {
    expect(Object.keys(model.params)).toEqual(['x', 'k', 'm']);
    expect(model.params.x).toMatchObject({ label: 'items inserted n', symbol: 'n', min: 1, max: 64, step: 1, default: 8 });
    expect(model.params.m).toMatchObject({ min: 16, max: 128, step: 8, default: 32 });
  });

  it.each([
    [32, 3, 1, 0.00072, 2.4e-7, 7.394], [32, 3, 4, 0.03058, 0.02142, 7.394], [32, 3, 8, 0.14689, 0.14634, 7.394],
    [32, 3, 16, 0.46886, 0.38255, 7.394], [32, 3, 32, 0.85795, 0.6185, 7.394], [32, 3, 64, 0.99258, 0.78645, 7.394],
    [32, 1, 8, 0.2212, 0.14634, 22.181], [32, 6, 8, 0.21983, 0.14634, 3.697], [64, 3, 8, 0.03058, 0.02142, 14.787],
    [128, 6, 8, 0.00094, 0.00046, 14.787], [16, 3, 8, 0.46886, 0.38255, 3.697],
  ])('m = %i, k = %i, n = %i: FPR %f, best %f, marker %f', (m, k, n, fpr, best, marker) => {
    const o = at(m, k, n);
    expect(o.y).toBeCloseTo(fpr, 5);
    expect(o.ref).toBeCloseTo(best, 5);
    expect(o.marker).toBeCloseTo(marker, 3);
  });

  it('touches the reference at the marker, at exactly (1/2)^k', () => {
    for (const [m, k] of [[32, 3], [32, 1], [32, 6], [96, 2]] as const) {
      const o = at(m, k, (m * Math.LN2) / k);
      expect(o.y).toBeCloseTo(0.5 ** k, 9);
      expect(o.ref).toBeCloseTo(0.5 ** k, 9);
    }
  });

  it('samples the curve and the reference along x for drawing', () => {
    const o = at(32, 3, 8);
    expect(o.curve).toHaveLength(CURVE_POINTS);
    expect(o.curve[0]).toBeCloseTo(at(32, 3, 1).y, 12);
    expect(o.curve.at(-1)).toBeCloseTo(at(32, 3, 64).y, 12);
    expect(o.refCurve).toHaveLength(CURVE_POINTS);
  });

  it('words the live description and fills labels', () => {
    const o = model.compute({ x: 8, k: 3, m: 32 });
    expect(fillTemplate(String(spec.options!.describe), model, { x: 8, k: 3, m: 32 }, o)).toBe('At n = 8 items, the false-positive rate is 14.7%.');
    expect(model.describe({ x: 8, k: 3, m: 32 }, o)).toBe('At items inserted n = 8, false-positive rate is 14.7%.');
    expect(fillTemplate(String(spec.options!.markerLabel), model, { x: 8, k: 6, m: 32 }, o, { marker: 3.697 })).toBe('k = 6 is best at n ≈ 3.7');
    expect(fillTemplate('{k} {nope} {y:fixed3} {marker}', model, { k: 2.6 }, o, { marker: 260 })).toBe('3 {nope} 0.147 260');
  });

  it('implies curve options from the spec', () => {
    expect(exprCurveOptions(spec)).toMatchObject({
      xParam: 'x', series: ['curve', 'refCurve'], refSeries: 'refCurve', seriesLabels: ['k = {k}, m = {m}', 'best possible k'],
      markers: ['marker'], markerLabels: ['k = {k} is best at n ≈ {marker}'], tableColumns: ['y', 'ref'], yMin: 0, yMax: 1,
    });
  });

  it.each([
    ['an unsafe expression', withModel({ expr: 'constructor(x)' }), '"constructor" is not allowed'],
    ['an undeclared name', withModel({ expr: 'q*x' }), 'unknown name "q"'],
    ['a mostly non-finite curve', withModel({ expr: 'log(x - 60)' }), 'finite at only'],
    ['a marker over x', withModel({}, { markerExpr: 'x/2' }), 'unknown name "x"'],
    ['a bad reference', withModel({}, { refExpr: 'x.y' }), 'member access'],
    ['a param named like a function', withModel({ params: [{ name: 'exp', label: 'e', min: 0, max: 1, default: 0 }] }), 'param "exp" is a built-in name'],
    ['a param named x', withModel({ params: [{ name: 'x', label: 'x', min: 0, max: 1, default: 0 }] }), 'param "x" is declared twice'],
  ])('rejects %s', (_what, bad, message) => {
    expect(() => exprCurveModel(bad)).toThrow(ExprError);
    expect(() => exprCurveModel(bad)).toThrow(message);
  });
});
