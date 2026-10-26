/**
 * Google Analytics, on the live site only. It counts page views: the app sends no events of its
 * own, and nothing a visitor pastes or reads (the link, the essay's title, its figures) reaches it.
 *
 * - Only on {@link ANALYTICS_HOST}, and only once {@link MEASUREMENT_ID} is set: local dev, tests
 *   and branch Previews never load it.
 * - A page view names the origin and the route ({@link pagePath}), never the query string, so
 *   `/x?url=<link>` reports as `/x`; the title is fixed, not `document.title`.
 * - Google signals and ad personalisation are off.
 */

export const ANALYTICS_HOST = 'explorable.geekplux.com';
/** The GA4 web stream for {@link ANALYTICS_HOST}; empty keeps analytics off. */
export const MEASUREMENT_ID = '';
const PAGE_TITLE = 'Explorable';

type Where = Pick<Location, 'hostname' | 'origin' | 'pathname'>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

let gtag: ((...args: unknown[]) => void) | null = null;
let lastPath: string | null = null;

/** The path a page view reports: the gallery, a sample's own path, `/x` for any link, else `/not-found`. */
export function pagePath(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/x' || /^\/s\/[a-z0-9-]+$/.test(path)) return path;
  return '/not-found';
}

/** Starts Google Analytics when the page is on the live site and sends the first page view. Returns whether it did. */
export function startAnalytics(where: Where = window.location, id = MEASUREMENT_ID): boolean {
  if (gtag || !id || where.hostname !== ANALYTICS_HOST) return false;

  const dataLayer = (window.dataLayer ??= []);
  // gtag.js reads `arguments` objects off the data layer, not arrays.
  gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
  };
  gtag('js', new Date());
  gtag('config', id, {
    send_page_view: false,
    page_location: `${where.origin}${pagePath(where.pathname)}`,
    page_title: PAGE_TITLE,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.append(script);

  window.addEventListener('popstate', () => trackPageView());
  trackPageView(where);
  return true;
}

/** Sends a page view for the current route, once per change of route; a no-op until analytics has started. */
export function trackPageView(where: Where = window.location): void {
  if (!gtag) return;
  const path = pagePath(where.pathname);
  if (path === lastPath) return;
  lastPath = path;
  const page = { page_location: `${where.origin}${path}`, page_title: PAGE_TITLE };
  gtag('set', page);
  gtag('event', 'page_view', page);
}

/** Tests only: forget a started session. */
export function resetAnalytics(): void {
  gtag = null;
  lastPath = null;
}
