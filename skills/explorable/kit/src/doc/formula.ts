/**
 * Does body text read like a formula? (docs/redesign/DESIGN.md §9: plain words first; formulas go into math notes.)
 * Shared by the tests, the skill audit and the Worker's post-process.
 *
 * The text is cut into runs of math tokens (one-letter variables such as `T`, `d_k`, `wᵢ`; numbers; operators;
 * brackets) that words of two or more letters interrupt. A run is a formula when it has
 * - a big operator with an operand: Σ, ∑, ∂, ∫, ∏, ∇;
 * - two or more binary operations (+ − × · / ^, a power such as ³ or ᵀ, a product written by juxtaposition such as
 *   `qᵢkᵢ` or `wᵢ(…)`), with a variable in it;
 * - a relation (= ≈ ≤ ≥ < > ≠ ∝) with an operation on a side that holds a variable: `k ≈ (m/n)·ln 2`;
 * - LaTeX: `\frac`, `^{`, `_{`.
 * Σ is a letter to Unicode, so big operators are matched before letters.
 * A code span is math throughout: two letters are a product, and the variable rule is dropped (`(20/32)³ ≈ 24%`).
 *
 * Allowed in prose: one variable or setting ("the temperature T", "at T = 1", "d_k = 64", "T = 1/8", "T = √d_k"), a
 * root of one variable ("divided by √d_k"), and one operation ("q·k", "1/√d_k", "the k·n hashes").
 */

const SUP = /[²³¹⁰-ⁿᴬ-ᵡᵸ-ᶿ]/u;
const SUB = /[₀-ₜᵢ-ᵪⱼ]/u;
const LETTER = /[\p{L}\p{M}]/u;
const BIN = new Set('+−×·/^÷±∓*'.split(''));
const REL = new Set('=≈≤≥<>≠∝≃≅≡'.split(''));
const BIG = new Set('Σ∑∂∫∏∇'.split(''));
const ROOT = new Set('√∛∜'.split(''));
/** Function names that keep a run going, as `exp(x)` or `ln 2`. */
const FUNCS = new Set(['exp', 'log', 'ln', 'lg', 'sin', 'cos', 'tan', 'tanh', 'max', 'min', 'softmax', 'sigmoid', 'argmax', 'argmin', 'det', 'var', 'Var', 'Pr']);

/** Units written with a power ("5 km²") are not products. */
const UNITS = new Set(['km', 'cm', 'mm', 'nm', 'dm', 'ms', 'kg', 'Hz']);

type Tok = { t: 'num' | 'var' | 'fn' | 'bin' | 'rel' | 'big' | 'root' | 'open' | 'close' | 'sup' | 'sep'; s: string; space: boolean; at: number; end: number };
/** Operators that make a short word right after them a product ("−kt"); not "/", as in "and/or". */
const TIGHT = new Set('+−×·^=≈≤≥<>√'.split(''));

/** Tokens of one segment; `sep` ends a run (a word, a comma, a full stop, a quote). */
function tokenize(text: string, code: boolean): Tok[] {
  const toks: Tok[] = [];
  // ‖ and | come in pairs: the first opens (a norm, an absolute value), the next closes.
  const bars = new Set<string>();
  let space = false;
  let start = 0;
  const push = (t: Tok['t'], s: string, end = start + s.length) => {
    toks.push({ t, s, space, at: start, end });
    space = false;
  };
  for (let i = 0; i < text.length; ) {
    const c = text[i]!;
    start = i;
    if (/\s/.test(c)) {
      space = true;
      i++;
    } else if (/\d/.test(c)) {
      const m = /^\d+(?:[.,]\d+)*%?/.exec(text.slice(i))![0];
      push('num', m);
      i += m.length;
    } else if (BIG.has(c)) {
      push('big', c);
      i++;
    } else if (LETTER.test(c) && !SUP.test(c) && !SUB.test(c)) {
      let j = i;
      while (j < text.length && LETTER.test(text[j]!) && !SUP.test(text[j]!) && !SUB.test(text[j]!)) j++;
      const word = text.slice(i, j);
      // Indices and a `_k`, `_(t−1)` subscript belong to the variable.
      while (j < text.length && SUB.test(text[j]!)) j++;
      if (text[j] === '_') {
        const paren = text[j + 1] === '(' ? text.indexOf(')', j) : -1;
        const m = paren > 0 ? null : /^_[\p{L}\p{N}]+/u.exec(text.slice(j));
        if (paren > 0) j = paren + 1;
        else if (m) j += m[0].length;
      }
      const letters = word.replace(/\p{M}/gu, '');
      // A short run of letters with an index or a power is a product of variables ("mc²"), as is any run in code.
      const short = letters.length <= 3 && !UNITS.has(word);
      const product = code || (short && (SUP.test(text[j] ?? '') || SUB.test(text[i + word.length] ?? '') || TIGHT.has(text[i - 1] ?? '')));
      if (letters.length === 1) push('var', text.slice(i, j), j);
      else if (FUNCS.has(word)) push('fn', word);
      else if (product) [...letters].forEach((ch, n) => push('var', ch, n === letters.length - 1 ? j : start + 1));
      else push('sep', word);
      i = j;
    } else if (SUP.test(c)) {
      let j = i;
      while (j < text.length && SUP.test(text[j]!)) j++;
      push('sup', text.slice(i, j));
      i = j;
    } else {
      // An ASCII hyphen is a minus in code or between spaces; in prose it joins words ("2.58-bit").
      const minus = c === '-' && (code || (/\s/.test(text[i - 1] ?? '') && /\s/.test(text[i + 1] ?? '')));
      if (BIN.has(c) || minus) push('bin', c);
      else if (REL.has(c)) push('rel', c);
      else if (BIG.has(c)) push('big', c);
      else if (ROOT.has(c)) push('root', c);
      else if (c === '(' || c === '[') push('open', c);
      else if (c === ')' || c === ']') push('close', c);
      else if (c === '‖' || c === '|') {
        push(bars.has(c) ? 'close' : 'open', c);
        if (!bars.delete(c)) bars.add(c);
      } else push('sep', c);
      i++;
    }
  }
  return toks;
}

const OPERAND = new Set<Tok['t']>(['num', 'var', 'close', 'sup']);
const STARTS = new Set<Tok['t']>(['num', 'var', 'fn', 'open', 'root', 'big']);

/** Runs of math tokens: a `sep` ends a run, except a comma inside brackets (`f(x, y)`). */
function runs(toks: Tok[]): Tok[][] {
  const out: Tok[][] = [[]];
  let depth = 0;
  for (const tok of toks) {
    if (tok.t === 'open') depth++;
    if (tok.t === 'close') depth = Math.max(0, depth - 1);
    if (tok.t === 'sep' && !(tok.s === ',' && depth > 0)) {
      if (out[out.length - 1]!.length) out.push([]);
      depth = 0;
    } else if (tok.t !== 'sep') out[out.length - 1]!.push(tok);
  }
  return out.filter((r) => r.length > 1);
}

/** Binary operations in a run: explicit operators between operands, powers, and products by juxtaposition. */
function operations(run: Tok[]): number {
  let n = 0;
  run.forEach((tok, i) => {
    const prev = run[i - 1];
    const next = run[i + 1];
    if (!prev) return;
    if (tok.t === 'bin' && OPERAND.has(prev.t) && next && (STARTS.has(next.t) || next.t === 'bin')) n++;
    else if (tok.t === 'sup' && (prev.t === 'var' || prev.t === 'close' || prev.t === 'num')) n++;
    else if (!tok.space && (tok.t === 'var' || tok.t === 'open' || tok.t === 'fn' || tok.t === 'root') && (prev.t === 'var' || prev.t === 'close') && !(tok.t === 'open' && prev.t === 'var' && /^[A-Z]$/.test(prev.s))) n++;
  });
  return n;
}

const hasVar = (run: Tok[]) => run.some((t) => t.t === 'var' || t.t === 'fn');

function runIsFormula(run: Tok[], code: boolean): boolean {
  if (run.some((t, i) => t.t === 'big' && run.slice(i + 1).some((u) => STARTS.has(u.t)))) return true;
  const vars = code || hasVar(run);
  if (vars && operations(run) >= 2) return true;
  if (!run.some((t) => t.t === 'rel')) return false;
  const sides: Tok[][] = [[]];
  for (const tok of run) {
    if (tok.t === 'rel') sides.push([]);
    else sides[sides.length - 1]!.push(tok);
  }
  return sides.some((side) => (code || hasVar(side)) && operations(side) >= 1);
}

const LATEX = /\S*(?:[_^]\{|\\[a-zA-Z]{2,})\S*/;

/** True when `text` holds LaTeX (`\frac`, `^{`, `_{`) or a `$` math delimiter. */
export const hasLatex = (text: string): boolean => LATEX.test(text) || text.includes('$');

/** The first stretch of `text` that reads like a formula, or null. Note markers and emphasis are ignored. */
export function findFormula(text: string): string | null {
  const latex = LATEX.exec(text);
  if (latex) return latex[0];
  const parts = text.replace(/\[\[[^[\]\n]*\]\]/g, ' ').split(/(`[^`\n]+`)/);
  for (const [i, part] of parts.entries()) {
    const code = i % 2 === 1;
    const body = code ? part.slice(1, -1) : part.replace(/\*/g, '');
    for (const run of runs(tokenize(body, code))) {
      if (runIsFormula(run, code)) return code ? part : body.slice(run[0]!.at, run[run.length - 1]!.end);
    }
  }
  return null;
}

/** True when body text (a paragraph or the takeaway) shows a formula that belongs in a math note. */
export function bodyHasFormula(text: string): boolean {
  return findFormula(text) !== null;
}
