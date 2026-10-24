// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UrlField, getDraft } from '../components/UrlField.tsx';
import attention from '../samples/attention.json';
import { ResultPage } from './ResultPage.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const host = document.createElement('div');
document.body.append(host);
const root = createRoot(host);
const URL_IN = 'https://arxiv.org/abs/1706.03762';
const reply = (body: unknown) => vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body)));

afterEach(() => {
  act(() => root.render(null));
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function show(fetchFn: unknown) {
  vi.stubGlobal('fetch', fetchFn);
  await act(async () => root.render(<ResultPage url={URL_IN} />));
}

describe('ResultPage', () => {
  it('shows the steps, then the essay with "Written by AI from the source." once, in the byline', async () => {
    let resolve!: (r: Response) => void;
    await show(vi.fn(() => new Promise<Response>((r) => (resolve = r))));
    expect(host.querySelectorAll('.loading-step')).toHaveLength(4);
    expect(host.querySelector('.skeleton, .kicker')).toBeNull();
    expect(host.querySelector('.loading-stage')?.textContent).toBe('Fetching the article…');
    expect(getDraft()).toBe(URL_IN);
    const doc = { ...attention, provenance: { mode: 'ai', model: 'm', generatedAt: '2026-10-21T00:00:00.000Z' } };
    await act(async () => resolve(new Response(JSON.stringify({ ok: true, doc, cache: 'miss', mode: 'ai' }))));
    expect(host.querySelector('.essay-byline p')?.textContent).toBe('Based on Attention Is All You Need, Vaswani et al., 2017. Written by AI from the source.');
    expect(host.textContent?.match(/Written by AI/g)).toHaveLength(1);
  });

  it('renders an error panel whose heading takes focus, with three samples', async () => {
    await show(reply({ ok: false, error: { code: 'NO_FIGURE', message: 'm', hint: 'h' } }));
    expect(document.activeElement?.id).toBe('error-heading');
    expect(host.querySelector('.error-panel')?.getAttribute('data-code')).toBe('NO_FIGURE');
    expect(host.querySelectorAll('.error-state a.essay-row')).toHaveLength(3);
  });

  it('does not fetch while offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fetchFn = vi.fn<typeof fetch>();
    await show(fetchFn);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(host.querySelector('.error-panel')?.getAttribute('data-code')).toBe('OFFLINE');
  });
});

describe('UrlField', () => {
  it('navigates to /x?url= for a link and reports words as a query', () => {
    const onQuery = vi.fn<(query: string) => void>();
    act(() => root.render(<UrlField onQuery={onQuery} />));
    const input = host.querySelector('input')!;
    const type = (value: string) =>
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    type('bloom');
    expect(onQuery).toHaveBeenLastCalledWith('bloom');
    type(URL_IN);
    act(() => host.querySelector('form')!.requestSubmit());
    expect(window.location.pathname + window.location.search).toBe('/x?url=https%3A%2F%2Farxiv.org%2Fabs%2F1706.03762');
  });
});
