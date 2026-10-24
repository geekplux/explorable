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

// Variables set as in a paper (DESIGN §6). The text is already escaped, so the only `&` are entities: `&#39;` (an
// apostrophe) and `&amp;` join words ("can't", "AT&T"); `&lt;` and the like are math. A letter counts as lone when no
// letter, digit, `_`, apostrophe or hyphen touches it (so "T-shirt", "x-ray", "don't" and words stay as they are), it is
// not part of an abbreviation ("e.g.", "T.S.") and it does not follow a number ("5 m", "2 x 3").
// Letters here exclude modifier letters, so "wᵢ" and "QKᵀ" read as w and QK with an index.
const W = String.raw`\p{Lu}\p{Ll}\p{Lt}\p{Lo}\p{N}_'’`;
const L = String.raw`(?<![${W}\-]|&#39;|&amp;|\p{L}\.|\d )`;
const R = String.raw`(?![${W}\-]|&#39;|\.\p{L})`;
/** After a subscript a hyphen may follow ("d_k-dimensional"). */
const R_SUB = String.raw`(?![${W}]|&#39;|\.\p{L})`;
/** `d_k` → italic d, subscript k; `x_(t−1)` → italic x, subscript t−1. Then lone letters: in running text only the usual
 * names, inside code (math) any letter but the constant e. One pass, so no markup is matched again. */
const SUB = String.raw`${L}(\p{L})_(?:\(([^()\s]{1,8})\)|([\p{L}\p{N}]{1,8}))${R_SUB}`;
const VARS_TEXT = new RegExp(`${SUB}|${L}[Tqkdnmtx]${R}`, 'gu');
const VARS_CODE = new RegExp(`${SUB}|${L}[A-DF-Za-df-z]${R}`, 'gu');

/** Italicise the variables in escaped text (no tags in it). URLs are left alone. */
export function mathVars(text: string, code = false): string {
  return text
    .split(/(\S+:\/\/\S+|www\.\S+)/)
    .map((part, i) =>
      i % 2
        ? part
        : part.replace(code ? VARS_CODE : VARS_TEXT, (m, v?: string, paren?: string, sub?: string) =>
            v ? `${/[a-z]/i.test(v) ? `<i>${v}</i>` : v}<span class="sub">${paren ?? sub}</span>` : `<i>${m}</i>`,
          ),
    )
    .join('');
}

/**
 * Render the tiny inline language used in doc prose: `*em*`, `**strong**`
 * and `` `code` ``. Everything else is escaped text, so the only markup in
 * the output is the markup produced here. Code spans are literal: no
 * emphasis inside them. Unmatched markers stay as plain characters.
 * Variables are set in italics (`mathVars`), in code spans and in the text.
 */
export function formatInline(text: string): string {
  return escapeHtml(text)
    .split(/(`[^`\n]+`)/)
    .map((part, i) => {
      if (i % 2 === 1) return `<code>${mathVars(part.slice(1, -1), true)}</code>`;
      return mathVars(part)
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
