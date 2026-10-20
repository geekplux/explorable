/**
 * Motion rules (PLAN §4.4): drags are 1:1, keyboard steps ease with an
 * exponential follow (τ = 90 ms), one knob nudge as a hint. Under
 * `prefers-reduced-motion: reduce` callers skip all of it.
 */
export const FOLLOW_TAU = 90;
export const HINT_DELAY = 1200;
const HINT_MS = 600;
const HINT_PX = 8;

export const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const raf = (fn: FrameRequestCallback) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : 0);
const caf = (id: number) => typeof cancelAnimationFrame === 'function' && cancelAnimationFrame(id);

/** Run `frame(elapsedMs)` every animation frame until it returns false. Returns a cancel function. */
function loop(frame: (elapsed: number, dt: number) => boolean): () => void {
  let id = 0;
  let start: number | undefined;
  let last = 0;
  const tick = (now: number) => {
    start ??= last = now;
    const more = frame(now - start, now - last);
    last = now;
    if (more) id = raf(tick);
  };
  id = raf(tick);
  return () => caf(id);
}

/**
 * Ease `from` toward `to` with an exponential follow, calling `draw` each
 * frame (the first step runs synchronously, so the change shows on this frame).
 */
export function follow(from: number[], to: number[], draw: (v: number[]) => void, tau = FOLLOW_TAU): () => void {
  const cur = [...from];
  const step = (dt: number) => {
    const k = 1 - Math.exp(-dt / tau);
    let done = true;
    cur.forEach((v, i) => {
      const d = (to[i] ?? v) - v;
      cur[i] = Math.abs(d) < 1e-4 ? v + d : v + d * k;
      if (cur[i] !== to[i]) done = false;
    });
    draw(done ? [...to] : [...cur]);
    return !done;
  };
  if (!step(16) || typeof requestAnimationFrame !== 'function') {
    if (typeof requestAnimationFrame !== 'function') draw([...to]);
    return () => {};
  }
  return loop((_, dt) => step(dt));
}

/** The one-time hint: `draw(dx)` goes 0 → 8 px → 0 over 600 ms. */
export function nudge(draw: (dx: number) => void): () => void {
  return loop((t) => {
    const p = Math.min(1, t / HINT_MS);
    draw(HINT_PX * Math.sin(Math.PI * p));
    return p < 1;
  });
}
