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

  it('with an idle time, speaks only once input has rested that long', () => {
    vi.useFakeTimers();
    const el = document.createElement('p');
    const a = createAnnouncer(el);
    for (let i = 0; i < 10; i++) {
      a.say(`drag ${i}`, 600);
      vi.advanceTimersByTime(300);
    }
    expect(el.textContent).toBe('');
    vi.advanceTimersByTime(299);
    expect(el.textContent).toBe('');
    vi.advanceTimersByTime(1);
    expect(el.textContent).toBe('drag 9');
    a.destroy();
  });
});
