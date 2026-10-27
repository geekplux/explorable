/**
 * Recursive-descent parser for the safe expression language.
 * Precedence: `+ -` < `* /` < unary `-` < `^` (right-associative), so
 * `-x^2` is −(x²). Identifiers resolve at parse time to a declared name, `pi`
 * or `e`; calls only to the whitelisted functions. AST depth ≤ 32.
 */
import { ExprError, lex, type Token } from './lexer.ts';

export const MAX_DEPTH = 32;

export type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; i: number }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: string; a: Node; b: Node }
  | { t: 'call'; f: (...args: number[]) => number; args: Node[] };

/** Whitelisted functions and their arity (0 = two or more). `log` is the natural log, like `ln`. */
export const FUNCS = new Map<string, [(...args: number[]) => number, number]>([
  ['exp', [Math.exp, 1]], ['log', [Math.log, 1]], ['ln', [Math.log, 1]], ['sqrt', [Math.sqrt, 1]], ['abs', [Math.abs, 1]],
  ['sin', [Math.sin, 1]], ['cos', [Math.cos, 1]], ['tan', [Math.tan, 1]], ['floor', [Math.floor, 1]], ['ceil', [Math.ceil, 1]],
  ['min', [Math.min, 0]], ['max', [Math.max, 0]], ['pow', [Math.pow, 2]],
]);
const CONSTS = new Map([['pi', Math.PI], ['e', Math.E]]);
const RESERVED = /^(?:__\w*|constructor|prototype|this|self|window|globalThis|document|eval|Function|new|function|return|import|require)$/;

/** Why `name` cannot be a declared param, or undefined if it can. */
export function badName(name: string): string | undefined {
  if (RESERVED.test(name)) return `"${name}" is not allowed`;
  if (FUNCS.has(name) || CONSTS.has(name)) return `"${name}" is a built-in name`;
  return undefined;
}

const depth = (n: Node): number =>
  1 + (n.t === 'neg' ? depth(n.a) : n.t === 'bin' ? Math.max(depth(n.a), depth(n.b)) : n.t === 'call' ? Math.max(...n.args.map(depth)) : 0);

/** Parse `src` where `names` are the declared identifiers (a var node holds the index into `names`). */
export function parse(src: string, names: readonly string[]): Node {
  const toks = lex(src);
  let k = 0;
  const fail = (msg: string, tok: Token | undefined = toks[k]): never => {
    throw new ExprError(`${msg} (${tok ? `at ${tok.at + 1}` : 'at the end'})`);
  };
  const isOp = (s: string) => toks[k]?.t === 'op' && toks[k]!.s === s;
  const expect = (s: string) => (isOp(s) ? k++ : fail(`expected "${s}"`));

  function sum(): Node {
    let a = product();
    while (isOp('+') || isOp('-')) a = { t: 'bin', op: toks[k++]!.s, a, b: product() };
    return a;
  }
  function product(): Node {
    let a = unary();
    while (isOp('*') || isOp('/')) a = { t: 'bin', op: toks[k++]!.s, a, b: unary() };
    return a;
  }
  function unary(): Node {
    if (!isOp('-')) return power();
    k++;
    return { t: 'neg', a: unary() };
  }
  function power(): Node {
    const a = primary();
    if (!isOp('^')) return a;
    k++;
    return { t: 'bin', op: '^', a, b: unary() };
  }
  function primary(): Node {
    const tok = toks[k] ?? fail('expression ends too early');
    k++;
    if (tok.t === 'num') return { t: 'num', v: tok.v };
    if (tok.t === 'op') {
      if (tok.s !== '(') return fail(`unexpected "${tok.s}"`, tok);
      const a = sum();
      expect(')');
      return a;
    }
    const name = tok.s;
    if (RESERVED.test(name)) return fail(`"${name}" is not allowed`, tok);
    if (isOp('(')) {
      const [f, arity] = FUNCS.get(name) ?? fail(names.includes(name) ? `"${name}" is not a function` : `unknown function "${name}"`, tok);
      k++;
      const args = [sum()];
      while (isOp(',')) {
        k++;
        args.push(sum());
      }
      expect(')');
      if (arity ? args.length !== arity : args.length < 2) fail(`${name}() takes ${arity || 'at least 2'} argument${arity === 1 ? '' : 's'}`, tok);
      return { t: 'call', f, args };
    }
    const i = names.indexOf(name);
    if (i >= 0) return { t: 'var', i };
    const c = CONSTS.get(name);
    if (c !== undefined) return { t: 'num', v: c };
    return fail(FUNCS.has(name) ? `${name} needs parentheses, e.g. ${name}(x)` : `unknown name "${name}"`, tok);
  }

  const ast = sum();
  if (k < toks.length) fail(`unexpected "${toks[k]!.s}"`);
  const d = depth(ast);
  if (d > MAX_DEPTH) throw new ExprError(`expression is nested too deeply (depth ${d}; the limit is ${MAX_DEPTH})`);
  return ast;
}
