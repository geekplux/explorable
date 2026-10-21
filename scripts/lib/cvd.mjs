// Simulate colour-vision deficiency on a page: the kit's Machado 2009 matrices
// (severity 1.0) as an SVG feColorMatrix in linearRGB, applied to <html>.
import { MACHADO } from '../../skills/explorable/kit/src/color/cvd.ts';

/**
 * Apply ('protan' | 'deutan' | 'tritan') or remove (null) the simulation.
 * @param {import('playwright-core').Page} page
 * @param {'protan' | 'deutan' | 'tritan' | null} vision
 */
export async function cvd(page, vision) {
  const values = vision ? MACHADO[vision].map((row) => `${row.join(' ')} 0 0`).join(' ') + ' 0 0 0 1 0' : null;
  await page.evaluate((matrix) => {
    document.getElementById('cvd-sim')?.remove();
    document.documentElement.style.filter = '';
    if (!matrix) return;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.id = 'cvd-sim';
    svg.setAttribute('aria-hidden', 'true');
    // CSSOM, not a style attribute: the standalone page's CSP blocks inline style attributes.
    svg.style.cssText = 'position:absolute;width:0;height:0';
    svg.innerHTML = `<filter id="cvd-filter" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="${matrix}"/></filter>`;
    document.body.append(svg);
    document.documentElement.style.filter = 'url(#cvd-filter)';
  }, values);
}
