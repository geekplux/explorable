/**
 * A polite live region that changes at most once per `gap` ms, so a drag
 * never floods a screen reader. The latest text always lands (trailing edge).
 * `say(text, idle)` instead waits until no new text has come for `idle` ms
 * (used while a pointer drag is active, so only the resting value is spoken).
 */
export function createAnnouncer(el: HTMLElement, gap = 500) {
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  let last = -Infinity;
  let pending: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    timer = undefined;
    if (pending === undefined) return;
    if (el.textContent !== pending) el.textContent = pending;
    pending = undefined;
    last = Date.now();
  };
  return {
    say(text: string, idle?: number) {
      pending = text;
      if (idle !== undefined) {
        clearTimeout(timer);
        timer = setTimeout(flush, idle);
        return;
      }
      const wait = last + gap - Date.now();
      if (wait <= 0 && !timer) flush();
      else timer ??= setTimeout(flush, Math.max(0, wait));
    },
    destroy() {
      clearTimeout(timer);
    },
  };
}
