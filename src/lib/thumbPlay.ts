import { softmax } from '@kit/models/softmax-temperature.ts';

/** One play of a thumbnail: out to the far end of the track and back (DESIGN Motion 04). */
export const SWEEP_MS = 600;
const easeOut = (s: number) => 1 - (1 - s) ** 3;

/** Track position at time fraction `t` (0 to 1) of a play that starts and ends at `rest`. */
export function sweepAt(rest: number, t: number): number {
  const far = rest > 0.5 ? 0 : 1;
  const u = t < 0.5 ? easeOut(t * 2) : 1 - easeOut(Math.min(1, (t - 0.5) * 2));
  return rest + (far - rest) * u;
}

/**
 * Draw a thumbnail (scripts/gen-thumbs.mjs) with its handle at track position `pos`. An attention thumbnail
 * (`data-scores`) also redraws its bars as the softmax at the temperature under the handle.
 */
export function drawThumb(svg: SVGSVGElement, pos: number): void {
  const d = svg.dataset;
  const [x0, x1] = [Number(d.x0), Number(d.x1)];
  const x = (x0 + (x1 - x0) * pos).toFixed(1);
  const handle = svg.querySelector('.th-handle');
  handle?.setAttribute('cx', x);
  svg.querySelector('.th-fill')?.setAttribute('d', `M${x0} ${handle?.getAttribute('cy') ?? 0}H${x}`);
  if (!d.scores || !d.t) return;
  const [t0 = 1, t1 = 1] = d.t.split(' ').map(Number);
  const w = softmax(d.scores.split(' ').map(Number), t0 * (t1 / t0) ** pos);
  const [top, base] = [Number(d.top), Number(d.base)];
  const lead = w.indexOf(Math.max(...w));
  svg.querySelectorAll<SVGRectElement>('rect.th-bar').forEach((bar, i) => {
    const h = Math.max(0.5, (w[i] ?? 0) * (base - top));
    bar.setAttribute('y', (base - h).toFixed(1));
    bar.setAttribute('height', h.toFixed(1));
    bar.classList.toggle('is-top', i === lead);
  });
}

/** Only where the pointer can hover and motion is welcome. */
export const canPlay = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;

const playing = new WeakSet<SVGSVGElement>();

/** Play a thumbnail once; a play already running is left to finish. */
export function playThumb(svg: SVGSVGElement): void {
  if (playing.has(svg)) return;
  playing.add(svg);
  const rest = Number(svg.dataset.at);
  const still = svg.innerHTML; // the generated drawing, put back exactly at the end
  const start = performance.now();
  const frame = (now: number) => {
    const t = (now - start) / SWEEP_MS;
    if (t < 1) {
      drawThumb(svg, sweepAt(rest, Math.max(0, t)));
      requestAnimationFrame(frame);
    } else {
      svg.innerHTML = still;
      playing.delete(svg);
    }
  };
  requestAnimationFrame(frame);
}
