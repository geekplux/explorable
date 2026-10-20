import { describe, expect, it } from 'vitest';
import { escapeHtml, formatInline, safeHttpUrl } from './inline.ts';

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
      'a <em>query</em> and <strong>key</strong> with <code>q·k</code>',
    );
  });

  it('keeps code spans literal and escaped', () => {
    expect(formatInline('`a*b*c <b>`')).toBe('<code>a*b*c &lt;b&gt;</code>');
  });

  it('leaves unmatched or spaced markers as text', () => {
    expect(formatInline('2 * 3 = 6 and a `lone tick')).toBe('2 * 3 = 6 and a `lone tick');
  });

  it('escapes markup inside emphasis', () => {
    expect(formatInline('*<img src=x onerror=alert(1)>*')).toBe(
      '<em>&lt;img src=x onerror=alert(1)&gt;</em>',
    );
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
