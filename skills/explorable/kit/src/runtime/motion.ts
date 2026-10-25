/**
 * Motion rules (DESIGN, Motion): the knob follows a drag 1:1 while the drawing
 * settles in 250 ms ease-out; keyboard steps ease with an exponential follow
 * (τ = 90 ms). Nothing moves on its own. Under `prefers-reduced-motion: reduce`
 * callers skip all of it.
 */
export const FOLLOW_TAU = 90;
export const SETTLE_MS = 250;

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

/** Call `draw(e)` each frame for `ms`, with `e` eased out from 0 to 1 (cubic). Returns a cancel function. */
export function settle(draw: (e: number) => void, ms = SETTLE_MS): () => void {
  if (typeof requestAnimationFrame !== 'function') {
    draw(1);
    return () => {};
  }
  return loop((t) => {
    const p = Math.min(1, t / ms);
    draw(1 - (1 - p) ** 3);
    return p < 1;
  });
}
