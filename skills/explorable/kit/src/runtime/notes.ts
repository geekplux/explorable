/**
 * Notes behind a marker (docs/redesign/DESIGN.md §7), framework-free so a standalone skill page works without React.
 *
 * - Math: the Σ button toggles its panel under the paragraph (several may be open); Enter and Space toggle and focus
 *   stays on the button. The panel fades in and rises 4px in 250ms, not under reduced motion.
 * - Source: the label opens a small card on keyboard focus, on hover after 150ms (it stays while hovered or focused),
 *   and on click or tap (which pins it). Esc closes it and returns focus to the label; a click outside closes it.
 * Open panels and cards carry `is-open` (the print stylesheet prints only those).
 */
import { reducedMotion } from './motion.ts';

/** Hover delay before a source card opens (ms). */
export const HOVER_MS = 150;

const expanded = (button: Element) => button.getAttribute('aria-expanded') === 'true';
/** The `.xnote-cite` around a source label and its card (the label is its first child, the card its last). */
const cite = (el: EventTarget | null) => (el instanceof Element ? el.closest('.xnote-cite') : null);

function show(button: Element, panel: HTMLElement | null, open: boolean, animate: boolean) {
  button.setAttribute('aria-expanded', String(open));
  if (!panel) return;
  panel.hidden = !open;
  panel.classList.toggle('is-open', open);
  if (open && animate) {
    // From the start state to the resting one: the CSS transition runs when the attribute goes.
    panel.setAttribute('data-enter', '');
    void panel.offsetWidth;
    panel.removeAttribute('data-enter');
  }
  // Keep a card inside the viewport, 16px from either edge.
  if (open && panel.classList.contains('xnote-card')) {
    panel.style.removeProperty('--xnote-shift');
    const { left, right } = panel.getBoundingClientRect();
    const shift = Math.min(right - document.documentElement.clientWidth + 16, left - 16);
    if (shift > 0) panel.style.setProperty('--xnote-shift', `${-Math.round(shift)}px`);
  }
}

/** Wire every note marker inside `root`. Returns `destroy()` to remove the listeners. */
export function hydrateNotes(root: ParentNode, opts: { reducedMotion?: boolean } = {}): { destroy(): void } {
  const host = root as HTMLElement;
  const doc = host.ownerDocument;
  if (!doc || !host.addEventListener) return { destroy() {} };
  const animate = !(opts.reducedMotion ?? reducedMotion());
  const ac = new AbortController();
  const on = <K extends keyof DocumentEventMap>(t: EventTarget, type: K, fn: (e: DocumentEventMap[K]) => void) =>
    t.addEventListener(type, fn as EventListener, { signal: ac.signal });
  const hovered = new Set<Element>();
  const pinned = new Set<Element>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** A pointer is pressing a label: the focus it brings is left to the click. */
  let pointing = false;

  const card = (wrap: Element, open: boolean, pin = false) => {
    const label = wrap.firstElementChild!;
    if (open !== expanded(label)) show(label, wrap.lastElementChild as HTMLElement, open, animate);
    if (open && pin) pinned.add(wrap);
    if (!open) pinned.delete(wrap);
  };
  const openCards = () => [...root.querySelectorAll('.xnote-src[aria-expanded="true"]')].map((b) => b.parentElement!);

  on(host, 'click', (e) => {
    pointing = false;
    const el = e.target instanceof Element ? e.target : null;
    const mark = el?.closest('.xnote-mk');
    if (mark) {
      const id = mark.getAttribute('aria-controls') ?? '';
      show(mark, root.querySelector<HTMLElement>(`[id="${id}"]`), !expanded(mark), animate);
    }
    const wrap = el?.closest('.xnote-src') && cite(el);
    // A click opens and pins; a click on a pinned card closes it.
    if (wrap) card(wrap, !pinned.has(wrap), true);
  });
  on(host, 'pointerdown', (e) => (pointing = !!cite(e.target)));
  on(host, 'focusin', (e) => {
    const wrap = cite(e.target);
    if (wrap && !pointing) card(wrap, true, pinned.has(wrap));
  });
  on(host, 'focusout', (e) => {
    const wrap = cite(e.target);
    if (wrap && !wrap.contains(e.relatedTarget as Node | null) && !hovered.has(wrap)) card(wrap, false);
  });
  on(host, 'pointerover', (e) => {
    const wrap = cite(e.target);
    if (!wrap || e.pointerType === 'touch' || hovered.has(wrap)) return;
    hovered.add(wrap);
    clearTimeout(timer);
    timer = setTimeout(() => hovered.has(wrap) && card(wrap, true, pinned.has(wrap)), HOVER_MS);
  });
  on(host, 'pointerout', (e) => {
    const wrap = cite(e.target);
    if (!wrap || wrap.contains(e.relatedTarget as Node | null)) return;
    hovered.delete(wrap);
    clearTimeout(timer);
    if (!pinned.has(wrap) && !wrap.contains(doc.activeElement)) card(wrap, false);
  });
  on(doc, 'keydown', (e) => {
    pointing = e.key === 'Escape';
    if (!pointing) return;
    for (const wrap of openCards()) {
      card(wrap, false);
      hovered.delete(wrap);
      // Back on the label, without the focus reopening the card.
      if (wrap.contains(doc.activeElement)) (wrap.firstElementChild as HTMLElement).focus();
    }
    pointing = false;
  });
  on(doc, 'pointerdown', (e) => {
    for (const wrap of openCards()) if (wrap !== cite(e.target)) card(wrap, false);
  });
  return { destroy: () => ac.abort() };
}
