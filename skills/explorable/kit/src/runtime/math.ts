/** Figure text with variables set as in the essay (the same rules as `formatInline`, doc/inline.ts). */
import { mathHtml, mathRuns, type MathOptions } from '../doc/inline.ts';

const NS = 'http://www.w3.org/2000/svg';

/**
 * Set an element's text with italic variables and subscripts: tspans in SVG ("d_k" → italic d, a 12px k lowered 4px;
 * kit.css), `<i>` and `<span class="xsub">` in HTML. Built from text nodes and escaped runs, never from raw markup.
 */
export function setMath(el: Element, text: string, options?: MathOptions) {
  if (!(el instanceof SVGElement)) {
    el.innerHTML = mathHtml(text, options);
    return;
  }
  el.replaceChildren();
  let lowered = false;
  for (const { text: t, kind } of mathRuns(text, options)) {
    const span = document.createElementNS(NS, 'tspan');
    if (kind) span.setAttribute('class', kind === 'var' ? 'xfig-var' : 'xfig-sub');
    const dy = kind === 'sub' ? (lowered ? 0 : 4) : lowered ? -4 : 0;
    if (dy) span.setAttribute('dy', String(dy));
    lowered = kind === 'sub';
    span.textContent = t;
    el.append(span);
  }
}
