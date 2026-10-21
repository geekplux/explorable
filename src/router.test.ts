// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { explainPath, internalPath, interceptLinks, matchRoute } from './router.ts';

describe('matchRoute', () => {
  it('matches the gallery with or without a trailing slash', () => {
    expect(matchRoute('/')).toEqual({ name: 'gallery' });
    expect(matchRoute('')).toEqual({ name: 'gallery' });
  });

  it('matches sample slugs', () => {
    expect(matchRoute('/s/attention')).toEqual({ name: 'sample', slug: 'attention' });
    expect(matchRoute('/s/bloom-filter/')).toEqual({ name: 'sample', slug: 'bloom-filter' });
  });

  it('matches /x?url= and round-trips explainPath', () => {
    const path = explainPath('https://arxiv.org/abs/1706.03762');
    expect(path).toBe('/x?url=https%3A%2F%2Farxiv.org%2Fabs%2F1706.03762');
    expect(matchRoute('/x', path.slice(2))).toEqual({ name: 'explain', url: 'https://arxiv.org/abs/1706.03762' });
    expect(matchRoute('/x', '?url=%20')).toEqual({ name: 'not-found' });
    expect(matchRoute('/x')).toEqual({ name: 'not-found' });
  });

  it('sends everything else to not-found', () => {
    for (const path of ['/s', '/s/', '/s/a/b', '/s/Bad_Slug', '/whatever', '/s/%3Cscript%3E']) {
      expect(matchRoute(path)).toEqual({ name: 'not-found' });
    }
  });
});

function clickOn(html: string, init: MouseEventInit = {}): MouseEvent {
  document.body.innerHTML = html;
  const target = document.querySelector('[data-t]') ?? document.body;
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

describe('internalPath and interceptLinks', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const origin = window.location.origin;

  it('returns the path for plain clicks on same-origin links, including nested targets', () => {
    expect(internalPath(clickOn('<a href="/s/attention"><span data-t>x</span></a>'), origin)).toBe('/s/attention');
  });

  it('ignores modified clicks, new tabs, downloads and other origins', () => {
    expect(internalPath(clickOn('<a data-t href="/s/a">x</a>', { metaKey: true }), origin)).toBeNull();
    expect(internalPath(clickOn('<a data-t href="/s/a">x</a>', { button: 1 }), origin)).toBeNull();
    expect(internalPath(clickOn('<a data-t href="/s/a" target="_blank">x</a>'), origin)).toBeNull();
    expect(internalPath(clickOn('<a data-t href="/s/a" download>x</a>'), origin)).toBeNull();
    expect(internalPath(clickOn('<a data-t href="https://arxiv.org/abs/1">x</a>'), origin)).toBeNull();
    expect(internalPath(clickOn('<p data-t>no link</p>'), origin)).toBeNull();
  });

  it('pushes history for internal links', () => {
    const event = clickOn('<a data-t href="/s/diffusion">x</a>');
    interceptLinks(event);
    expect(event.defaultPrevented).toBe(true);
    expect(window.location.pathname).toBe('/s/diffusion');
  });
});
