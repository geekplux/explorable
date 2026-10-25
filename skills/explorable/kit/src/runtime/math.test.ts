// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { setMath } from './math.ts';

describe('setMath', () => {
  it('draws SVG variables and subscripts as tspans, lowered and raised back', () => {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    setMath(text, 'with ÷√d_k now');
    expect([...text.children].map((t) => [t.getAttribute('class'), t.getAttribute('dy'), t.textContent])).toEqual([
      [null, null, 'with ÷√'],
      ['xfig-var', null, 'd'],
      ['xfig-sub', '4', 'k'],
      [null, '-4', ' now'],
    ]);
  });

  it('writes escaped HTML for HTML elements, with the variables passed in', () => {
    const el = document.createElement('span');
    setMath(el, 'step t <tag>', { vars: new Set(['t']) });
    expect(el.innerHTML).toBe('step <i>t</i> &lt;tag&gt;');
  });
});
