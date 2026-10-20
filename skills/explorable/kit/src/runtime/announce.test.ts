// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnnouncer } from './announce.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('createAnnouncer', () => {
  it('is a polite live region that changes at most once per 500 ms, latest text last', () => {
    vi.useFakeTimers();
    const el = document.createElement('p');
    const changes: string[] = [];
    new MutationObserver(() => changes.push(el.textContent ?? '')).observe(el, { childList: true, characterData: true, subtree: true });
    const a = createAnnouncer(el);
    expect(el.getAttribute('aria-live')).toBe('polite');
    a.say('one');
    expect(el.textContent).toBe('one');
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(20);
      a.say(`drag ${i}`);
    }
    expect(el.textContent).toBe('one');
    vi.advanceTimersByTime(100);
    expect(el.textContent).toBe('drag 19');
    a.say('next');
    vi.advanceTimersByTime(499);
    expect(el.textContent).toBe('drag 19');
    vi.advanceTimersByTime(1);
    expect(el.textContent).toBe('next');
    a.destroy();
  });
});
