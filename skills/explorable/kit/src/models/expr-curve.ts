/**
 * `expr-curve`: a model built per figure from the spec, so the AI
 * pipeline can draw y = f(x) for any idea without running generated code.
 * The doc declares x, y and the params; `options` may add a dotted reference
 * curve (`refExpr`) and a vertical marker (`markerExpr`, over the params only).
 */
import type { ExprCurveModel, FigureSpec } from '../doc/schema.ts';
import type { Compiled } from '../expr/compile.ts';
import { ExprError } from '../expr/lexer.ts';
import { badName } from '../expr/parser.ts';
import { validateExpr } from '../expr/validate.ts';
import { isFormat } from '../format.ts';
import { fillTemplate, type ModelDef, type ParamDef } from '../registry.ts';
import { fromPos } from '../runtime/values.ts';

/** Points per drawn curve, evenly spaced along the x track. */
export const CURVE_POINTS = 201;

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
/** Default step: the power of ten at or below 1/100 of the range (so round defaults stay exact). */
const decade = (min: number, max: number) => 10 ** Math.floor(Math.log10((max - min) / 100));

/** The ModelDef for one `expr-curve` figure. Throws `ExprError` naming the first problem. */
export function exprCurveModel(spec: FigureSpec): ModelDef {
  const m = spec.model as ExprCurveModel;
  const o = spec.options ?? {};
  const names = m.params.map((p) => p.name);
  for (const [i, n] of names.entries()) {
    const bad = n === 'x' || names.indexOf(n) !== i ? `"${n}" is declared twice` : badName(n);
    if (bad) throw new ExprError(`param ${bad}`);
  }
  const { min, max } = m.x;
  const x: ParamDef = {
    label: m.x.label, symbol: str(o.xSymbol), min, max, step: num(o.xStep) ?? decade(min, max),
    default: Math.min(max, Math.max(min, num(o.x0) ?? (min + max) / 2)), scale: m.x.scale,
  };
  const params: Record<string, ParamDef> = { x };
  for (const p of m.params) params[p.name] = { label: p.label, min: p.min, max: p.max, default: p.default, step: p.step ?? decade(p.min, p.max) };
  const all = ['x', ...names];
  const f = validateExpr(m.expr, all, params);
  const ref = str(o.refExpr) ? validateExpr(str(o.refExpr)!, all, params) : undefined;
  const marker = str(o.markerExpr) ? validateExpr(str(o.markerExpr)!, names, params) : undefined;
  const yFormat = isFormat(o.yFormat) ? o.yFormat : 'fixed2';
  const xs = Array.from({ length: CURVE_POINTS }, (_, i) => fromPos(x, i / (CURVE_POINTS - 1)));
  const curve = (g: Compiled, ps: number[]) => xs.map((xv) => g([xv, ...ps]));

  const model: ModelDef = {
    id: 'expr-curve',
    title: spec.title,
    kinds: ['curve'],
    keywords: [],
    params,
    outputs: {
      x: { label: m.x.label, format: isFormat(o.xFormat) ? o.xFormat : 'fixed2' },
      y: { label: m.y.label, format: yFormat },
      ref: { label: str(o.refLabel) ?? 'reference', format: yFormat },
      marker: { label: 'marker', format: 'fixed1' },
    },
    compute(p) {
      const vals = all.map((n) => p[n] ?? params[n]!.default);
      const ps = vals.slice(1);
      return {
        x: vals[0]!, y: f(vals), curve: curve(f, ps),
        ...(ref && { ref: ref(vals), refCurve: curve(ref, ps) }),
        ...(marker && { marker: marker(ps) }),
      };
    },
    describe: (p, out) => fillTemplate(`At ${m.x.label} = {x}, ${m.y.label} is {y}.`, model, p, out),
  };
  return model;
}

/** The `curve` options an `expr-curve` spec implies; the spec's own options win. */
export function exprCurveOptions(spec: FigureSpec): Record<string, string | number | string[]> {
  const m = spec.model as ExprCurveModel;
  const o = spec.options ?? {};
  const ref = str(o.refExpr) !== undefined;
  return {
    xParam: 'x',
    series: ref ? ['curve', 'refCurve'] : ['curve'],
    refSeries: 'refCurve',
    seriesLabels: [m.params.map((p) => `${p.name} = {${p.name}}`).join(', ') || m.y.label, str(o.refLabel) ?? 'reference'],
    markers: str(o.markerExpr) ? ['marker'] : [],
    markerLabels: [str(o.markerLabel) ?? 'marker at {marker}'],
    tableColumns: ref ? ['y', 'ref'] : ['y'],
    yLabel: m.y.label,
    ...(m.y.min !== undefined && { yMin: m.y.min }),
    ...(m.y.max !== undefined && { yMax: m.y.max }),
  };
}
