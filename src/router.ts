import { useSyncExternalStore } from 'react';

export type Route = { name: 'gallery' } | { name: 'sample'; slug: string } | { name: 'not-found' };

/** Map a pathname to a route. Slugs are lowercase letters, digits and dashes. */
export function matchRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { name: 'gallery' };
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

/** Push a same-origin path and notify subscribers. */
export function navigate(to: string): void {
  window.history.pushState(null, '', to);
  window.scrollTo(0, 0);
  for (const listener of listeners) listener();
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
  navigate(path);
}

const getPathname = () => window.location.pathname;

export function useRoute(): Route {
  return matchRoute(useSyncExternalStore(subscribe, getPathname));
}
