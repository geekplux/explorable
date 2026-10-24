/**
 * Notes behind a marker (docs/redesign/DESIGN.md §7), framework-free so a standalone skill page works without React.
 *
 * - Math: the Σ button toggles its panel under the paragraph (several may be open); Enter and Space toggle and focus
 *   stays on the button. The panel fades in and rises 4px in 250ms, not under reduced motion.
 * - Source: the label opens a small card on keyboard focus, on hover after 150ms (it stays while hovered or focused),
 *   and on click or tap (which pins it). Esc closes it and returns focus to the label; a click outside closes it.
 * Open notes carry `is-open` (the print stylesheet prints only those).
 */
import { reducedMotion } from './motion.ts';

/** Hover delay before a source card opens (ms). */
export const HOVER_MS = 150;

const target = (root: ParentNode, button: Element) => {
  const id = button.getAttribute('aria-controls');
  return id ? root.querySelector<HTMLElement>(`[id="${id.replace(/"/g, '')}"]`) : null;
};

function show(button: Element, panel: HTMLElement | null, open: boolean, animate: boolean) {
  button.setAttribute('aria-expanded', String(open));
  if (!panel) return;
  panel.hidden = !open;
  panel.classList.toggle('is-open', open);
  if (open && animate) {
    // From the start state to the resting one: the CSS transition runs on the attribute's removal.
    panel.setAttribute('data-enter', '');
    void panel.offsetWidth;
    panel.removeAttribute('data-enter');
  }
}

/** Keep a source card inside the viewport (16px from either edge). */
function place(card: HTMLElement) {
  card.style.removeProperty('--xnote-shift');
  const box = card.getBoundingClientRect();
  const width = document.documentElement.clientWidth || window.innerWidth;
  const over = box.right - (width - 16);
  const shift = over > 0 ? Math.min(over, box.left - 16) : 0;
  if (shift > 0) card.style.setProperty('--xnote-shift', `${-Math.round(shift)}px`);
}

const cite = (el: EventTarget | null) => (el instanceof Element ? el.closest('.xnote-cite') : null);
const srcOf = (wrap: Element) => wrap.querySelector('.xnote-src');
const isOpen = (wrap: Element) => srcOf(wrap)?.getAttribute('aria-expanded') === 'true';

/** Wire every note marker inside `root`. Returns `destroy()` to remove the listeners. */
export function hydrateNotes(root: ParentNode, opts: { reducedMotion?: boolean } = {}): { destroy(): void } {
  const host = root as unknown as HTMLElement;
  const doc = (root as Node).ownerDocument ?? (root as unknown as Document);
  if (typeof host.addEventListener !== 'function' || !doc) return { destroy() {} };
  const animate = !(opts.reducedMotion ?? reducedMotion());
  const ac = new AbortController();
  const on = { signal: ac.signal };
  /** Source cards that are open, and whether a click pinned them. */
  const pinned = new WeakMap<Element, boolean>();
  const hovered = new WeakSet<Element>();
  const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
  let pointing = false;

  const setCard = (wrap: Element, open: boolean, pin = false) => {
    const button = srcOf(wrap);
    if (!button) return;
    const card = target(root, button);
    if (open !== isOpen(wrap)) show(button, card, open, animate);
    wrap.classList.toggle('is-open', open);
    pinned.set(wrap, open && pin);
    if (open && card) place(card);
  };
  const openCards = () => [...root.querySelectorAll('.xnote-cite.is-open')];

  host.addEventListener(
    'click',
    (event) => {
      pointing = false;
      const el = event.target instanceof Element ? event.target : null;
      const mark = el?.closest('.xnote-mk');
      if (mark && host.contains(mark)) {
        show(mark, target(root, mark), mark.getAttribute('aria-expanded') !== 'true', animate);
        return;
      }
      const src = el?.closest('.xnote-src');
      const wrap = src && cite(src);
      if (!wrap) return;
      // A click on an open card the hover opened pins it; a click on a pinned card closes it.
      if (isOpen(wrap) && pinned.get(wrap)) setCard(wrap, false);
      else setCard(wrap, true, true);
    },
    on,
  );
  host.addEventListener('pointerdown', (event) => {
    if (cite(event.target)) pointing = true;
  }, on);
  // Keyboard focus opens a card; focus from a click is left to the click.
  host.addEventListener(
    'focusin',
    (event) => {
      const wrap = cite(event.target);
      if (wrap && !pointing && !isOpen(wrap)) setCard(wrap, true);
      pointing = false;
    },
    on,
  );
  host.addEventListener(
    'focusout',
    (event) => {
      const wrap = cite(event.target);
      if (!wrap || wrap.contains(event.relatedTarget as Node | null)) return;
      if (!hovered.has(wrap)) setCard(wrap, false);
    },
    on,
  );
  host.addEventListener(
    'pointerover',
    (event) => {
      const wrap = cite(event.target);
      if (!wrap || event.pointerType === 'touch' || hovered.has(wrap)) return;
      hovered.add(wrap);
      clearTimeout(timers.get(wrap));
      timers.set(wrap, setTimeout(() => hovered.has(wrap) && setCard(wrap, true, pinned.get(wrap)), HOVER_MS));
    },
    on,
  );
  host.addEventListener(
    'pointerout',
    (event) => {
      const wrap = cite(event.target);
      if (!wrap || wrap.contains(event.relatedTarget as Node | null)) return;
      hovered.delete(wrap);
      clearTimeout(timers.get(wrap));
      if (!pinned.get(wrap) && !wrap.contains(doc.activeElement)) setCard(wrap, false);
    },
    on,
  );
  doc.addEventListener(
    'keydown',
    (event) => {
      pointing = false;
      if (event.key !== 'Escape') return;
      for (const wrap of openCards()) {
        const refocus = wrap.contains(doc.activeElement);
        setCard(wrap, false);
        hovered.delete(wrap);
        // Back on the label without reopening the card.
        if (refocus) {
          pointing = true;
          (srcOf(wrap) as HTMLElement | null)?.focus();
          pointing = false;
        }
      }
    },
    on,
  );
  doc.addEventListener(
    'pointerdown',
    (event) => {
      const inside = cite(event.target);
      for (const wrap of openCards()) if (wrap !== inside) setCard(wrap, false);
    },
    on,
  );
  return {
    destroy() {
      ac.abort();
    },
  };
}
