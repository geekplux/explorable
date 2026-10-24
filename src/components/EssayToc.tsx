import { useEffect, useRef, type MouseEvent } from 'react';
import { formatInline } from '@kit/doc/inline.ts';
import type { ExplorableDoc } from '@kit/doc/schema.ts';

/** Scroll to a heading (smoothly unless motion is reduced) and set the hash without a route change. */
function jumpTo(event: MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  history.replaceState(null, '', `#${id}`);
}

/**
 * Contents in the left gutter (≥ 1160 px; DESIGN §6), ported from geekplux.com's Toc: the sections in view get
 * the indigo bracket on the track, shift 3px toward the text and turn to ink; the track fills with reading
 * progress by a CSS scroll timeline (app.css). Visibility is written to the DOM: no state, no re-render.
 */
export function EssayToc({ doc }: { doc: ExplorableDoc }) {
  const list = useRef<HTMLOListElement>(null);
  const bracket = useRef<HTMLSpanElement>(null);
  const entries = [...doc.sections.map((s) => [s.id, formatInline(s.heading)]), ['essay-takeaway', 'Takeaway']];
  const ids = entries.map(([id]) => id).join(' ');

  useEffect(() => {
    const ol = list.current;
    const mark = bracket.current;
    if (!ol || !mark || typeof IntersectionObserver !== 'function') return;
    const items = [...ol.children] as HTMLElement[];
    const sections = ids.split(' ').map((id) => document.getElementById(id)?.closest('section'));
    const on = new Set<number>();
    // A section counts as in view while it crosses the band from 10% to 80% of the viewport height.
    const io = new IntersectionObserver(
      (seen) => {
        for (const e of seen) on[e.isIntersecting ? 'add' : 'delete'](sections.indexOf(e.target as HTMLElement));
        const first = items[Math.min(...on)];
        const last = items[Math.max(...on)];
        items.forEach((li, i) => {
          li.classList.toggle('is-on', on.has(i));
          if (li === first) li.firstElementChild?.setAttribute('aria-current', 'true');
          else li.firstElementChild?.removeAttribute('aria-current');
        });
        mark.style.opacity = first && last ? '1' : '0';
        if (first && last) Object.assign(mark.style, { top: `${first.offsetTop}px`, height: `${last.offsetTop + last.offsetHeight - first.offsetTop}px` });
      },
      { rootMargin: '-10% 0px -20% 0px' },
    );
    for (const s of sections) if (s) io.observe(s);
    return () => io.disconnect();
  }, [ids]);

  return (
    <nav className="essay-toc" aria-label="Contents">
      <div className="essay-toc-rail">
        <ol ref={list}>
          {entries.map(([id, html]) => (
            <li key={id}>
              {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the heading HTML (escaped by formatInline) is the label */}
              <a href={`#${id}`} onClick={(e) => jumpTo(e, id!)} dangerouslySetInnerHTML={{ __html: html! }} />
            </li>
          ))}
        </ol>
        <span className="essay-toc-track" aria-hidden="true">
          <span />
        </span>
        <span className="essay-toc-bracket" ref={bracket} aria-hidden="true" />
      </div>
    </nav>
  );
}
