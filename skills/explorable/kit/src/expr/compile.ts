/**
 * Compile a parsed expression to a tree of closures: no source text is ever
 * executed. The compiled function takes the values of the declared names, in order.
 */
import { parse, type Node } from './parser.ts';

export type Compiled = (vals: readonly number[]) => number;

const BIN: Record<string, (a: number, b: number) => number> = {
  '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b, '^': (a, b) => a ** b,
};

export function compile(n: Node): Compiled {
  switch (n.t) {
    case 'num': {
      const v = n.v;
      return () => v;
    }
    case 'var': {
      const i = n.i;
      return (vals) => vals[i] ?? NaN;
    }
    case 'neg': {
      const a = compile(n.a);
      return (vals) => -a(vals);
    }
    case 'bin': {
      const [a, b, op] = [compile(n.a), compile(n.b), BIN[n.op]!];
      return (vals) => op(a(vals), b(vals));
    }
    case 'call': {
      const [f, args] = [n.f, n.args.map(compile)];
      const [a0] = args;
      return args.length === 1 && a0 ? (vals) => f(a0(vals)) : (vals) => f(...args.map((g) => g(vals)));
    }
  }
}

/** Parse and compile `src` over the declared `names`. Throws `ExprError`. */
export const compileExpr = (src: string, names: readonly string[]): Compiled => compile(parse(src, names));
