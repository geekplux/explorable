/**
 * Validation for `expr-curve` expressions: the expression parses,
 * every identifier is declared, and at least 90% of 64 samples over the x
 * range (other names at their defaults) are finite.
 */
import type { ParamDef } from '../registry.ts';
import { fromPos } from '../runtime/values.ts';
import { compileExpr, type Compiled } from './compile.ts';
import { ExprError } from './lexer.ts';

export const SAMPLES = 64;
export const MIN_FINITE = 0.9;

/** Compile `src` over `names` and check it is finite often enough; throws `ExprError` otherwise. */
export function validateExpr(src: string, names: readonly string[], defs: Record<string, ParamDef>): Compiled {
  const f = compileExpr(src, names);
  const base = names.map((n) => defs[n]?.default ?? NaN);
  const xi = names.indexOf('x');
  const n = xi < 0 ? 1 : SAMPLES;
  let finite = 0;
  for (let i = 0; i < n; i++) {
    if (xi >= 0) base[xi] = fromPos(defs.x!, i / (n - 1));
    if (Number.isFinite(f(base))) finite++;
  }
  if (finite < MIN_FINITE * n) throw new ExprError(`"${src}" is finite at only ${finite} of ${n} samples; at least 90% must be`);
  return f;
}
