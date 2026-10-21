// The safe expression language: what it accepts, the hostile inputs it refuses
// (with specific errors), compiled accuracy against Math, and the finite check.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ParamDef } from '../registry.ts';
import { mulberry32 } from '../rng.ts';
import { compileExpr } from './compile.ts';
import { ExprError, lex } from './lexer.ts';
import { parse } from './parser.ts';
import { validateExpr } from './validate.ts';

const NAMES = ['x', 'k', 'm', 'a'];
const err = (src: string, names = NAMES) => {
  try {
    parse(src, names);
  } catch (e) {
    expect(e).toBeInstanceOf(ExprError);
    return (e as Error).message;
  }
  throw new Error(`accepted: ${src}`);
};

const at3 = (src: string) => compileExpr(src, ['x'])([3]);
const defs = (min: number, max: number): Record<string, ParamDef> => ({
  x: { label: 'x', min, max, step: 0.01, default: 0 },
  k: { label: 'k', min: 1, max: 6, step: 1, default: 3 },
});

describe('parse', () => {
  it('accepts the sample expressions and numbers in every spelling', () => {
    expect(() => parse('(1 - exp(-k*x/m))^k', NAMES)).not.toThrow();
    expect(() => parse('sqrt(1-a)', NAMES)).not.toThrow();
    expect(() => parse('0.5^(m*ln(2)/x) + 1e-3 + .5 + 2. + pi*e', NAMES)).not.toThrow();
    expect(() => parse('min(x, k, m) + max(a, 1) + pow(x, 2) + floor(x) + ceil(x) + abs(sin(x)) + cos(x) + tan(x) + log(x)', NAMES)).not.toThrow();
    expect(lex('1e-3*x').map((t) => t.s)).toEqual(['1e-3', '*', 'x']);
  });

  it.each([
    ['constructor', '"constructor" is not allowed (at 1)'],
    ['__proto__', '"__proto__" is not allowed (at 1)'],
    ['x + prototype', '"prototype" is not allowed (at 5)'],
    ['this.x', 'member access is not allowed (at 5)'],
    ['a=1', 'assignment is not allowed (at 2)'],
    ['"str"', 'strings are not allowed (at 1)'],
    ["'str'", 'strings are not allowed (at 1)'],
    ['`x`', 'strings are not allowed (at 1)'],
    ['x;y', 'statements are not allowed (at 2)'],
    ['alert(1)', 'unknown function "alert" (at 1)'],
    ['eval(x)', '"eval" is not allowed (at 1)'],
    ['y + 1', 'unknown name "y" (at 1)'],
    ['k(2)', '"k" is not a function (at 1)'],
    ['x[0]', 'indexing is not allowed (at 2)'],
    ['{x}', 'blocks are not allowed (at 1)'],
    ['x => x', 'assignment is not allowed (at 3)'],
    ['x @ 2', 'unexpected character "@" (at 3)'],
    ['', 'expression is empty'],
    ['   ', 'expression is empty'],
    ['1e999', 'number 1e999 is not finite (at 1)'],
    ['x'.padEnd(201, ' '), 'expression is 201 characters; the limit is 200'],
    [`${'-'.repeat(32)}x`, 'expression is nested too deeply (depth 33; the limit is 32)'],
    ['2x', 'unexpected "x" (at 2)'],
    ['(x + 1', 'expected ")" (at the end)'],
    ['x +', 'expression ends too early (at the end)'],
    ['exp', 'exp needs parentheses, e.g. exp(x) (at 1)'],
    ['pow(x)', 'pow() takes 2 arguments (at 1)'],
    ['max(x)', 'max() takes at least 2 arguments (at 1)'],
    ['sqrt(x, 2)', 'sqrt() takes 1 argument (at 1)'],
  ])('rejects %j: %s', (src, message) => expect(err(src)).toBe(message));

  it('allows depth 32 and exactly 200 characters', () => {
    expect(() => parse(`${'-'.repeat(31)}x`, NAMES)).not.toThrow();
    expect(() => parse('x'.padEnd(200, ' '), NAMES)).not.toThrow();
  });

  it('follows the usual precedence: unary minus under ^, ^ right-associative', () => {
    expect(at3('-x^2')).toBe(-9);
    expect(at3('2^3^2')).toBe(512);
    expect(at3('2^-1')).toBe(0.5);
    expect(at3('1 - 2 - 3')).toBe(-4);
    expect(at3('12 / 3 / 2')).toBe(2);
    expect(at3('1 + 2 * x')).toBe(7);
  });
});

describe('compile', () => {
  it('matches Math references to 1e-12 on 100 seeded points', () => {
    const rng = mulberry32(7);
    const cases: [string, (x: number, k: number, m: number, a: number) => number][] = [
      ['(1 - exp(-k*x/m))^k', (x, k, m) => (1 - Math.exp((-k * x) / m)) ** k],
      ['sqrt(1-a)', (_x, _k, _m, a) => Math.sqrt(1 - a)],
      ['0.5^(m*ln(2)/x)', (x, _k, m) => 0.5 ** ((m * Math.log(2)) / x)],
      ['sin(x)*cos(k) - tan(a/2) + abs(-m)/pi + e', (x, k, m, a) => Math.sin(x) * Math.cos(k) - Math.tan(a / 2) + Math.abs(-m) / Math.PI + Math.E],
      ['max(x, k) - min(m, a, 2) + pow(x, 0.5) + floor(k) * ceil(a) + log(m)', (x, k, m, a) =>
        Math.max(x, k) - Math.min(m, a, 2) + Math.pow(x, 0.5) + Math.floor(k) * Math.ceil(a) + Math.log(m)],
    ];
    for (const [src, ref] of cases) {
      const f = compileExpr(src, NAMES);
      for (let i = 0; i < 100; i++) {
        const v = [1 + 63 * rng(), 1 + 5 * rng(), 16 + 112 * rng(), rng()] as const;
        expect(Math.abs(f(v) - ref(...v))).toBeLessThanOrEqual(1e-12);
      }
    }
  });
});

describe('validateExpr', () => {
  it('needs at least 90% of 64 samples finite', () => {
    expect(() => validateExpr('sqrt(x)', ['x'], defs(-0.1, 1))).not.toThrow(); // 58 of 64
    expect(() => validateExpr('sqrt(x)', ['x'], defs(-0.2, 1))).toThrow('"sqrt(x)" is finite at only 53 of 64 samples; at least 90% must be');
    expect(() => validateExpr('log(x)', ['x'], defs(-1, 1))).toThrow(ExprError);
    expect(() => validateExpr('1/x', ['x'], defs(-1, 1))).not.toThrow();
    expect(() => validateExpr('1/(k-3)', ['k'], defs(0, 1))).toThrow('finite at only 0 of 1');
  });
  it('rejects undeclared names', () => {
    expect(() => validateExpr('x*q', ['x', 'k'], defs(0, 1))).toThrow('unknown name "q"');
  });
});

const FORBIDDEN = /\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(|\bwith\s*\(|setTimeout\s*\(\s*['"`]/;

describe('no code execution in the kit', () => {
  it('never uses eval, Function or with (source grep, comments stripped)', () => {
    const root = join(import.meta.dirname, '..');
    const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'));
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      const code = readFileSync(join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect({ f, hit: FORBIDDEN.exec(code)?.[0] }).toEqual({ f, hit: undefined });
    }
  });
});
