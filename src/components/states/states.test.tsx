// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import attention from '../../samples/attention.json';
import type { ExplorableDoc } from '@kit/doc/schema.ts';
import { LoadingEssay } from './LoadingEssay.tsx';
import { COUNT_DELAY_MS, SearchResults } from './SearchResults.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const host = document.createElement('div');
document.body.append(host);
const root = createRoot(host);

afterEach(() => {
  act(() => root.render(null));
  vi.useRealTimers();
});

describe('LoadingEssay', () => {
  it('focuses its h1 on mount and names only the host there', () => {
    act(() => root.render(<LoadingEssay url="https://arxiv.org/abs/1706.03762?x=1" stage={0} onCancel={() => {}} />));
    const h1 = host.querySelector('h1');
    expect(document.activeElement).toBe(h1);
    expect(h1?.textContent).toBe('Reading arxiv.org');
    expect(host.querySelector('.loading-url')?.textContent).toBe('https://arxiv.org/abs/1706.03762?x=1');
  });
});

describe('SearchResults', () => {
  it('keeps one live region mounted and announces the count after a pause', () => {
    vi.useFakeTimers();
    act(() => root.render(<SearchResults results={null} />));
    const live = host.querySelector('output.search-live');
    expect(live?.textContent).toBe('');
    act(() => root.render(<SearchResults results={[attention as unknown as ExplorableDoc]} />));
    expect(host.querySelector('.search-count')?.textContent).toBe('1 built-in match. Open one, or paste a link.');
    expect(host.querySelector('output.search-live')).toBe(live);
    expect(live?.textContent).toBe('');
    act(() => vi.advanceTimersByTime(COUNT_DELAY_MS));
    expect(live?.textContent).toBe('1 built-in match. Open one, or paste a link.');
    act(() => root.render(<SearchResults results={null} />));
    act(() => vi.advanceTimersByTime(0));
    expect(host.querySelector('output.search-live')).toBe(live);
    expect(live?.textContent).toBe('');
  });
});
