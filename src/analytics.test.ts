// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { ANALYTICS_HOST, pagePath, resetAnalytics, startAnalytics, trackPageView } from './analytics.ts';

const live = { hostname: ANALYTICS_HOST, origin: `https://${ANALYTICS_HOST}`, pathname: '/' };
const entries = () => (window.dataLayer ?? []).map((args) => Array.from(args as ArrayLike<unknown>));

afterEach(() => {
  resetAnalytics();
  delete window.dataLayer;
  document.head.querySelectorAll('script').forEach((s) => s.remove());
});

describe('pagePath', () => {
  it('keeps the gallery, sample paths and /x, and folds anything else into /not-found', () => {
    expect(pagePath('/')).toBe('/');
    expect(pagePath('/s/attention/')).toBe('/s/attention');
    expect(pagePath('/x')).toBe('/x');
    expect(pagePath('/someone@example.com')).toBe('/not-found');
  });
});

describe('startAnalytics', () => {
  it('stays off without a measurement id, and off any other host', () => {
    expect(startAnalytics(live, '')).toBe(false);
    expect(startAnalytics({ ...live, hostname: 'localhost' }, 'G-TEST')).toBe(false);
    expect(window.dataLayer).toBeUndefined();
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });

  it('on the live host loads gtag.js and sends one page view without the query string', () => {
    expect(startAnalytics({ ...live, pathname: '/x' }, 'G-TEST')).toBe(true);
    expect(document.querySelector('script[src*="googletagmanager"]')?.getAttribute('src')).toBe(
      'https://www.googletagmanager.com/gtag/js?id=G-TEST',
    );
    const config = entries().find(([cmd]) => cmd === 'config');
    expect(config?.[2]).toMatchObject({ send_page_view: false, allow_google_signals: false, page_location: `${live.origin}/x` });
    const views = entries().filter(([cmd, name]) => cmd === 'event' && name === 'page_view');
    expect(views).toEqual([['event', 'page_view', { page_location: `${live.origin}/x`, page_title: 'Explorable' }]]);
  });

  it('sends one page view per change of route', () => {
    startAnalytics(live, 'G-TEST');
    trackPageView({ ...live, pathname: '/' });
    trackPageView({ ...live, pathname: '/s/attention' });
    const views = entries().filter(([cmd, name]) => cmd === 'event' && name === 'page_view');
    expect(views.map((v) => (v[2] as { page_location: string }).page_location)).toEqual([`${live.origin}/`, `${live.origin}/s/attention`]);
  });
});
