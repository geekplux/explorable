const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape text for use in HTML content and in quoted attribute values. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

// Variables set as in a paper (DESIGN §6), on raw text; the HTML and SVG builders below escape what they emit.
//
// - `d_k`, `x_(t−1)`, `β_t`: a one-letter (Latin or Greek) base that is not part of a longer word or an address, with an
//   all-letter or all-digit subscript. `H_2O`, `max_len` and `a_b@c.com` stay as they are.
// - A letter with a Unicode index (`x₀`, `wᵢ`, `Kᵀ`) is a variable anywhere.
// - Code spans are math: every lone Latin letter is italic except the constant e; a two-letter run (`kn`, `QK`) is two
//   variables when it touches an operator, and never a function name (`ln`, `lg`).
// - Running text: a lone letter is italic only beside a math symbol (`T = 1`, `√d`, `q·k`, `T/8`, a parenthesised
//   expression), or when the caller says it is a variable of this document (`vars`, see `docVars`). "T cells", "Mr. T",
//   "type x and press n" and units ("5 m", "m/s") stay roman. "a", "A" and "I" are words in running text.
/** Letters that make a word (modifier letters such as ᵢ and ᵀ are indices, not letters). */
const LETTER = /[\p{Lu}\p{Ll}\p{Lt}\p{Lo}]/u;
/** Characters that glue a letter into a word, a number, an address or an abbreviation. */
const GLUE = /[\p{Lu}\p{Ll}\p{Lt}\p{Lo}\p{N}_'’@&]/u;
/** Superscript and subscript characters and modifier letters used as indices. */
const INDEX = /[\u00B2\u00B3\u00B9\u1D2C-\u1D6A\u2070-\u209F\u2C7C]/u;
const OPS = new Set('=<>+−×·/√^≈≤≥±÷∝≠∂∑Σ∞→∈'.split(''));
/** Names that are functions, not products of variables. */
const FUNCS = new Set(['ln', 'lg', 'lb', 'Pr', 'Im', 'Re']);
const CANDIDATE = /(\p{L})_(?:\(([^()\s]{1,8})\)|(\p{L}{1,8}|\p{N}{1,8}))|(?<![\p{Lu}\p{Ll}\p{Lt}\p{Lo}\p{N}])[A-Za-z]{1,2}(?![\p{Lu}\p{Ll}\p{Lt}\p{Lo}])/gu;

/** A run of text: plain, an italic variable, or a subscript. */
export interface MathRun {
  text: string;
  kind?: 'var' | 'sub';
}
export interface MathOptions {
  /** The text is a code span (math). */
  code?: boolean;
  /** Letters that are variables of this document, italic in running text even away from a symbol. */
  vars?: ReadonlySet<string>;
}

/** True when a parenthesised group starting (`open`) or ending (`close`) at `at` holds an operator. */
function groupHasOp(text: string, at: number, dir: 1 | -1): boolean {
  let depth = 0;
  for (let i = at; i >= 0 && i < text.length; i += dir) {
    const c = text[i]!;
    if (c === (dir > 0 ? '(' : ')')) depth++;
    else if (c === (dir > 0 ? ')' : '(') && --depth === 0) return false;
    else if (OPS.has(c)) return true;
  }
  return false;
}

/** Is the run text[start, end) beside a math symbol (one space allowed between)? */
function besideMath(text: string, start: number, end: number): boolean {
  if (INDEX.test(text[end] ?? '')) return true;
  // Emphasis markers are transparent ("*T* = 1"), then one space.
  let left = start - 1;
  while (text[left] === '*') left--;
  if (text[left] === ' ') left--;
  let right = end;
  while (text[right] === '*') right++;
  if (text[right] === ' ') right++;
  const l = text[left] ?? '';
  const r = text[right] ?? '';
  // "m/s", "km/h": a slash between letters with no spaces is a unit.
  const unit = (slash: number) => text[slash - 1] !== ' ' && text[slash + 1] !== ' ' && LETTER.test(text[slash - 1] ?? '') && LETTER.test(text[slash + 1] ?? '');
  if (OPS.has(l) && !(l === '/' && unit(left))) return true;
  if (OPS.has(r) && !(r === '/' && unit(right))) return true;
  if (l === '(' && groupHasOp(text, left, 1)) return true;
  if (r === ')' && groupHasOp(text, right, -1)) return true;
  return r === '(' && right === end && groupHasOp(text, right, 1);
}

/** Split text into plain runs, italic variables and subscripts (see the rules above). URLs are left alone. */
export function mathRuns(text: string, { code = false, vars }: MathOptions = {}): MathRun[] {
  const runs: MathRun[] = [];
  const plain = (t: string) => {
    if (!t) return;
    const last = runs[runs.length - 1];
    if (last && !last.kind) last.text += t;
    else runs.push({ text: t });
  };
  text.split(/(\S+:\/\/\S+|www\.\S+)/).forEach((part, n) => {
    if (n % 2) return plain(part);
    let at = 0;
    for (const m of part.matchAll(CANDIDATE)) {
      const [whole, base, paren, sub] = m;
      const start = m.index;
      const end = start + whole.length;
      const prev = part[start - 1] ?? '';
      const next = part[end] ?? '';
      // Glued into a word, a number, an address or an abbreviation ("T-shirt", "e.g.", "T.S.", "AT&T", "5 m").
      const glued =
        GLUE.test(prev) || prev === '-' || (prev === '.' && LETTER.test(part[start - 2] ?? '')) ||
        (GLUE.test(next) && !INDEX.test(next)) || (next === '.' && LETTER.test(part[end + 1] ?? '')) || (next === '-' && !base) ||
        (prev === ' ' && /\d/.test(part[start - 2] ?? '') && !OPS.has(part[end + 1] ?? ''));
      if (glued) continue;
      let out: MathRun[] | undefined;
      if (base) {
        out = [{ text: base, kind: /[A-Za-z]/.test(base) ? 'var' : undefined } as MathRun, { text: paren ?? sub!, kind: 'sub' }];
      } else if (whole.length === 1) {
        const italic = INDEX.test(next) || (code ? whole !== 'e' : !/[aAI]/.test(whole) && (vars?.has(whole) || besideMath(part, start, end)));
        if (italic) out = [{ text: whole, kind: 'var' }];
      } else if (code && !FUNCS.has(whole) && besideMath(part, start, end)) {
        out = [{ text: whole[0]!, kind: 'var' }, { text: whole[1]!, kind: 'var' }];
      }
      if (!out) continue;
      plain(part.slice(at, start));
      for (const r of out) {
        if (r.kind) runs.push(r);
        else plain(r.text);
      }
      at = end;
    }
    plain(part.slice(at));
  });
  return runs;
}

/** Variables as HTML: escaped text, `<i>` for a variable, `<span class="xsub">` for a subscript. */
export function mathHtml(text: string, options?: MathOptions): string {
  return mathRuns(text, options)
    .map(({ text: t, kind }) => (kind === 'var' ? `<i>${escapeHtml(t)}</i>` : kind === 'sub' ? `<span class="xsub">${escapeHtml(t)}</span>` : escapeHtml(t)))
    .join('');
}

/** Strip the inline markers and code ticks: the strings `docVars` reads. */
function proseParts(text: string): [string, boolean][] {
  return text.split(/(`[^`\n]+`)/).map((part, i) => (i % 2 ? [part.slice(1, -1), true] : [part.replace(/\*/g, ''), false]));
}

/**
 * The letters a document uses as variables: each lone letter it sets in math somewhere (beside a symbol, or in a code
 * span). Pass them to `formatInline` so "Drag T down" matches "At T = 1" in the same essay.
 */
export function docVars(texts: Iterable<string>): Set<string> {
  const vars = new Set<string>();
  for (const text of texts)
    for (const [part, code] of proseParts(text))
      for (const r of mathRuns(part, { code })) if (r.kind === 'var' && r.text.length === 1 && !/[aAIe]/.test(r.text)) vars.add(r.text);
  return vars;
}

/**
 * Render the tiny inline language used in doc prose: `*em*`, `**strong**`
 * and `` `code` ``. Everything else is escaped text, so the only markup in
 * the output is the markup produced here. Code spans are literal: no
 * emphasis inside them. Unmatched markers stay as plain characters.
 * Variables are set in italics (`mathRuns`), in code spans and in the text; `vars` are the document's
 * variables (`docVars`).
 */
export function formatInline(text: string, vars?: ReadonlySet<string>): string {
  return text
    .split(/(`[^`\n]+`)/)
    .map((part, i) => {
      if (i % 2 === 1) return `<code>${mathHtml(part.slice(1, -1), { code: true })}</code>`;
      return mathHtml(part, { vars })
        .replace(/\*\*(?=\S)([^*]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(?=\S)([^*]+?)\*/g, '<em>$1</em>');
    })
    .join('');
}

/** Return the URL if it is absolute http(s), otherwise null (no `javascript:` etc.). */
export function safeHttpUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}
