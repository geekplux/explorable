import { describe, expect, it } from 'vitest';
import { docVars, escapeHtml, formatInline, mathHtml, mathRuns, safeHttpUrl } from './inline.ts';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('leaves a <script> tag inert', () => {
    const out = formatInline('<script>alert(1)</script>');
    expect(out).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(out).not.toContain('<script');
  });
});

describe('formatInline', () => {
  it('renders em, strong and code', () => {
    expect(formatInline('a *query* and **key** with `q·k`')).toBe(
      'a <em>query</em> and <strong>key</strong> with <code><i>q</i>·<i>k</i></code>',
    );
  });

  it('keeps code spans literal and escaped', () => {
    expect(formatInline('`a*b*c <b>`')).toBe('<code><i>a</i>*<i>b</i>*<i>c</i> &lt;<i>b</i>&gt;</code>');
  });

  it('leaves unmatched or spaced markers as text', () => {
    expect(formatInline('2 * 3 = 6 and a `lone tick')).toBe('2 * 3 = 6 and a `lone tick');
  });

  it('escapes markup inside emphasis', () => {
    expect(formatInline('*<img src=x onerror=alert(1)>*')).toBe(
      '<em>&lt;img src=<i>x</i> onerror=alert(1)&gt;</em>',
    );
  });
});

const sub = (v: string, s: string) => `<i>${v}</i><span class="xsub">${s}</span>`;

describe('variables in italics', () => {
  it('sets d_k as an italic d with a subscript, in text, code and headings', () => {
    expect(formatInline('variance d_k and √d_k.')).toBe(`variance ${sub('d', 'k')} and √${sub('d', 'k')}.`);
    expect(formatInline('`softmax(QKᵀ / √d_k)`')).toBe(`<code>softmax(<i>Q</i><i>K</i>ᵀ / √${sub('d', 'k')})</code>`);
    expect(formatInline('Why attention divides by √d_k')).toBe(`Why attention divides by √${sub('d', 'k')}`);
    expect(mathHtml('x_(t−1) and β_t, d_model, x_0')).toBe(`${sub('x', 't−1')} and β<span class="xsub">t</span>, ${sub('d', 'model')}, ${sub('x', '0')}`);
    expect(mathHtml('two d_k-dimensional vectors')).toBe(`two ${sub('d', 'k')}-dimensional vectors`);
    expect(mathHtml('noise √(1−ᾱ_t)')).toBe('noise √(1−ᾱ<span class="xsub">t</span>)');
  });

  it('keeps _ plain inside words, formulas and addresses', () => {
    for (const text of ['H_2O', 'the max_len option and snake_case_name', 'mail a_b@c.com', 'x_ab1']) expect(mathHtml(text)).toBe(escapeHtml(text));
  });

  it('italicises a letter with a Unicode index anywhere', () => {
    expect(mathHtml('x₀ and wᵢ, then Kᵀ')).toBe('<i>x</i>₀ and <i>w</i>ᵢ, then <i>K</i>ᵀ');
  });

  it('italicises a lone letter in running text only beside a math symbol', () => {
    expect(formatInline('At T = 1, the dot product q·k, by √d, T/8, f(x + 1) and (s / T).')).toBe(
      'At <i>T</i> = 1, the dot product <i>q</i>·<i>k</i>, by √<i>d</i>, <i>T</i>/8, <i>f</i>(<i>x</i> + 1) and (<i>s</i> / <i>T</i>).',
    );
    expect(formatInline('k ≥ 1, x^2, 2 × T')).toBe('<i>k</i> ≥ 1, <i>x</i>^2, 2 × <i>T</i>');
    expect(formatInline('n < m')).toBe('<i>n</i> &lt; <i>m</i>');
    expect(formatInline('*T* = 1')).toBe('<em><i>T</i></em> = 1');
  });

  it('leaves bare letters, words and units roman', () => {
    for (const text of [
      'T cells and Mr. T',
      'the d in dog; type x and press n',
      'a speed in m/s or km/h',
      'a cat, I think, a T-shirt and an x-ray',
      'don’t, can\'t, it\'s, isn\'t, AT&T',
      'e.g. T.S. Eliot, U.S. data',
      'arXiv:1706.03762 and https://x.com/d_k?q=t&n=2 or www.t.co/k',
      'a 5 m rope, 2 x 3, 10 k steps',
      'f(x) and (a) and (or t)',
      'the answer is √2 and A = B',
      'Tom, Kim and Dmitri',
    ]) {
      expect({ text, html: formatInline(text) }).toEqual({ text, html: escapeHtml(text).replace('A = B', 'A = <i>B</i>') });
    }
  });

  it('italicises the document’s variables away from a symbol when told to', () => {
    const vars = docVars(['At T = 1, the weights', 'a key `k`', 'Dots `q·k`']);
    expect([...vars].toSorted()).toEqual(['T', 'k', 'q']);
    expect(formatInline('Drag T down; key k, word q, letter x', vars)).toBe('Drag <i>T</i> down; key <i>k</i>, word <i>q</i>, letter x');
  });

  it('italicises every single Latin letter in code except e, and two-letter runs only beside an operator', () => {
    expect(formatInline('`(1 − e^(−kn/m))^k`')).toBe('<code>(1 − e^(−<i>k</i><i>n</i>/<i>m</i>))^<i>k</i></code>');
    expect(formatInline('`Q K^T V`, `E = mc`, `ln(x)`, `kn`')).toBe(
      '<code><i>Q</i> <i>K</i>^<i>T</i> <i>V</i></code>, <code><i>E</i> = <i>m</i><i>c</i></code>, <code>ln(<i>x</i>)</code>, <code>kn</code>',
    );
    expect(formatInline('`wᵢ = exp(sᵢ / T)`, `qᵢkᵢ`')).toBe('<code><i>w</i>ᵢ = exp(<i>s</i>ᵢ / <i>T</i>)</code>, <code><i>q</i>ᵢ<i>k</i>ᵢ</code>');
    expect(formatInline('`softmax(x)` and `exp`')).toBe('<code>softmax(<i>x</i>)</code> and <code>exp</code>');
  });

  it('splits text into runs for SVG', () => {
    expect(mathRuns('signal √ᾱ_t')).toEqual([{ text: 'signal √ᾱ' }, { text: 't', kind: 'sub' }]);
    expect(mathRuns('with ÷√d_k')).toEqual([{ text: 'with ÷√' }, { text: 'd', kind: 'var' }, { text: 'k', kind: 'sub' }]);
  });

  it('stays escaped: no markup comes from the text', () => {
    expect(formatInline('<i>T</i>')).toBe('&lt;<i>i</i>&gt;<i>T</i>&lt;/<i>i</i>&gt;');
    expect(formatInline('`<b>x</b>`')).toBe('<code>&lt;<i>b</i>&gt;<i>x</i>&lt;/<i>b</i>&gt;</code>');
  });
});

describe('safeHttpUrl', () => {
  it('accepts http(s) and rejects other schemes', () => {
    expect(safeHttpUrl('https://arxiv.org/abs/1706.03762')).toBe('https://arxiv.org/abs/1706.03762');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,hi')).toBeNull();
    expect(safeHttpUrl('not a url')).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
  });
});
