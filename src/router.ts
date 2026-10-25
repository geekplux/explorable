import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

export type Route =
  | { name: 'gallery' }
  | { name: 'sample'; slug: string }
  | { name: 'explain'; url: string }
  | { name: 'not-found' };

/** Map a pathname (and query) to a route. Slugs are lowercase letters, digits and dashes. */
export function matchRoute(pathname: string, search = ''): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { name: 'gallery' };
  const url = new URLSearchParams(search).get('url')?.trim();
  if (path === '/x' && url) return { name: 'explain', url };
  const sample = /^\/s\/([a-z0-9-]+)$/.exec(path);
  if (sample?.[1]) return { name: 'sample', slug: sample[1] };
  return { name: 'not-found' };
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

/**
 * Push a same-origin path and notify subscribers. Where view transitions run and motion is allowed, the page
 * cross-fades in 300 ms and `shared` (an index row's title) grows into the essay's h1 (app.css names both).
 */
export function navigate(to: string, shared?: HTMLElement | null): void {
  const go = () => {
    window.history.pushState(null, '', to);
    window.scrollTo(0, 0);
    flushSync(() => listeners.forEach((listener) => listener()));
    // "/#essays" from another page: scroll to the section once the new page has rendered.
    const hash = new URL(to, window.location.href).hash.slice(1);
    if (hash) requestAnimationFrame(() => document.getElementById(decodeURIComponent(hash))?.scrollIntoView());
  };
  const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };
  if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return go();
  if (shared) shared.style.viewTransitionName = 'essay-title';
  doc.startViewTransition(go);
}

/**
 * If a click should be handled by the router, return the in-app path,
 * otherwise null: modified clicks, other buttons, new-tab targets, downloads
 * and cross-origin links keep normal browser behaviour.
 */
export function internalPath(event: MouseEvent, origin: string): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return null;
  const url = new URL(anchor.href, origin);
  return url.origin === origin ? url.pathname + url.search + url.hash : null;
}

/** Document-level click handler that turns internal links into history navigations. */
export function interceptLinks(event: MouseEvent): void {
  const path = internalPath(event, window.location.origin);
  if (path === null) return;
  event.preventDefault();
  navigate(path, (event.target as Element).closest('a')?.querySelector<HTMLElement>('.essay-title'));
}

const getLocation = () => window.location.pathname + window.location.search;

export function useRoute(): Route {
  const location = useSyncExternalStore(subscribe, getLocation);
  const q = location.indexOf('?');
  return q < 0 ? matchRoute(location) : matchRoute(location.slice(0, q), location.slice(q));
}

/** The result route for a source URL: `/x?url=<encoded>`. */
export const explainPath = (url: string): string => `/x?url=${encodeURIComponent(url)}`;
