/**
 * Lexer for the safe expression language (PLAN §5.2): numbers, identifiers,
 * `+ - * / ^ ( ) ,` and whitespace. Anything else is rejected with a specific
 * message; there are no strings, member access, assignment or statements.
 */
export const MAX_LENGTH = 200;

/** Any problem with an expression; the message says what and where. */
export class ExprError extends Error {}

export interface Token {
  t: 'num' | 'id' | 'op';
  /** The source text of the token. */
  s: string;
  /** The value of a number token. */
  v: number;
  /** Offset in the source. */
  at: number;
}

const NUM = /\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?/y;
const ID = /[A-Za-z_]\w*/y;
const BANNED: Record<string, string> = {
  '"': 'strings are not allowed', "'": 'strings are not allowed', '`': 'strings are not allowed',
  '.': 'member access is not allowed', '=': 'assignment is not allowed', ';': 'statements are not allowed',
  '[': 'indexing is not allowed', '{': 'blocks are not allowed',
};

export function lex(src: string): Token[] {
  if (!src.trim()) throw new ExprError('expression is empty');
  if (src.length > MAX_LENGTH) throw new ExprError(`expression is ${src.length} characters; the limit is ${MAX_LENGTH}`);
  const out: Token[] = [];
  for (let i = 0; i < src.length; ) {
    const c = src[i]!;
    NUM.lastIndex = ID.lastIndex = i;
    const m = NUM.exec(src) ?? ID.exec(src);
    if (m) {
      const num = /[\d.]/.test(c);
      const v = num ? Number(m[0]) : NaN;
      if (num && !Number.isFinite(v)) throw new ExprError(`number ${m[0]} is not finite (at ${i + 1})`);
      out.push({ t: num ? 'num' : 'id', s: m[0], v, at: i });
      i += m[0].length;
    } else if ('+-*/^(),'.includes(c)) {
      out.push({ t: 'op', s: c, v: NaN, at: i++ });
    } else if (/\s/.test(c)) i++;
    else throw new ExprError(`${BANNED[c] ?? `unexpected character "${c}"`} (at ${i + 1})`);
  }
  return out;
}
