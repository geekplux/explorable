import { describe, expect, it } from 'vitest';
import { escapeHtml, formatInline, mathVars, safeHttpUrl } from './inline.ts';

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

const sub = (v: string, s: string) => `<i>${v}</i><span class="sub">${s}</span>`;

describe('mathVars: variables in italics', () => {
  it('sets d_k as an italic d with a subscript, in text, code and headings', () => {
    expect(formatInline('variance d_k and √d_k.')).toBe(`variance ${sub('d', 'k')} and √${sub('d', 'k')}.`);
    expect(formatInline('`softmax(QKᵀ / √d_k)`')).toBe(`<code>softmax(QKᵀ / √${sub('d', 'k')})</code>`);
    expect(formatInline('Why attention divides by √d_k')).toBe(`Why attention divides by √${sub('d', 'k')}`);
    expect(mathVars('x_(t−1) and β_t, d_model')).toBe(`${sub('x', 't−1')} and β<span class="sub">t</span>, ${sub('d', 'model')}`);
    expect(mathVars('two d_k-dimensional vectors')).toBe(`two ${sub('d', 'k')}-dimensional vectors`);
  });

  it('italicises lone variables in running text', () => {
    expect(formatInline('At T = 1, a vector q, and k·n hashes over m bits; drag n (or t).')).toBe(
      'At <i>T</i> = 1, a vector <i>q</i>, and <i>k</i>·<i>n</i> hashes over <i>m</i> bits; drag <i>n</i> (or <i>t</i>).',
    );
    expect(formatInline('by √d, T/8 and “T”')).toBe('by √<i>d</i>, <i>T</i>/8 and “<i>T</i>”');
    expect(formatInline('*T*')).toBe('<em><i>T</i></em>');
  });

  it('italicises any lone letter inside code, except the constant e', () => {
    expect(formatInline('`(1 − e^(−kn/m))^k`')).toBe('<code>(1 − e^(−kn/<i>m</i>))^<i>k</i></code>');
    expect(formatInline('`wᵢ = exp(sᵢ / T)`, `QKᵀ`, `qᵢkᵢ`')).toBe('<code><i>w</i>ᵢ = exp(<i>s</i>ᵢ / <i>T</i>)</code>, <code>QKᵀ</code>, <code><i>q</i>ᵢ<i>k</i>ᵢ</code>');
    expect(formatInline('`w = f(s) &lt; V`')).toBe('<code><i>w</i> = <i>f</i>(<i>s</i>) &amp;lt; <i>V</i></code>');
  });

  it('leaves ordinary words alone', () => {
    for (const text of [
      'a cat, I think, a T-shirt and an x-ray',
      'don’t, can\'t, it\'s, isn\'t, AT&T',
      'e.g. T.S. Eliot, U.S. data',
      'arXiv:1706.03762 and https://x.com/d_k?q=t&n=2 or www.t.co/k',
      'a 5 m rope, 2 x 3, 10 k steps',
      'the max_len option and snake_case_name',
      'Tom, Kim and Dmitri',
    ]) {
      expect(formatInline(text)).toBe(escapeHtml(text));
    }
  });

  it('stays escaped: no markup comes from the text', () => {
    expect(formatInline('<i>T</i>')).toBe('&lt;i&gt;<i>T</i>&lt;/i&gt;');
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
