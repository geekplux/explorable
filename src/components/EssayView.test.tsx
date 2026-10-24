// @vitest-environment happy-dom
import { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSample } from '../samples/index.ts';
import { EssayView } from './EssayView.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('EssayView', () => {
  it('hydrates both attention figures once (StrictMode-safe), keeps Bloom Fig 2 static, and cleans up on unmount', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => root.render(<StrictMode><EssayView doc={getSample('attention')!} /></StrictMode>));
    expect(host.querySelectorAll('#fig-temperature .xfig-knob[role="slider"]')).toHaveLength(1);
    expect(host.querySelectorAll('#fig-temperature rect.xfig-bar')).toHaveLength(6);
    expect(host.querySelector('#fig-temperature .xfig-readout')?.textContent).toBe('top weight 0.51 entropy 2.05 bits');
    expect(host.querySelectorAll('#fig-scaling [role="switch"]')).toHaveLength(1);
    expect(host.querySelector('#fig-scaling .xfig-readout')?.textContent).toBe('score SD 2.02 top weight 0.57 entropy 1.85 bits');
    // Contents: the section headings plus "Takeaway", linked to their headings, with no visible "Contents" label.
    const toc = host.querySelector('nav.essay-toc[aria-label="Contents"]');
    expect([...(toc?.querySelectorAll('a') ?? [])].map((a) => [a.getAttribute('href'), a.textContent])).toEqual([
      ['#scores-to-weights', 'From scores to weights'],
      ['#sharp-or-soft', 'Sharp or soft is a matter of scale'],
      ['#where-scale-comes-from', 'Where the scale comes from'],
      ['#divide-by-root-d', 'The fix: divide by √dk'],
      ['#essay-takeaway', 'Takeaway'],
    ]);
    expect(toc?.querySelector('a[href="#divide-by-root-d"]')?.innerHTML).toBe('The fix: divide by √<i>d</i><span class="xsub">k</span>');
    expect(toc?.textContent).not.toContain('Contents');
    act(() => root.unmount());
    expect(host.innerHTML).toBe('');
    const bloom = createRoot(host);
    act(() => bloom.render(<EssayView doc={getSample('bloom-filter')!} />));
    expect(host.querySelector('#fig-bits .xfig-readout')?.textContent).toBe('bits set 20 / 32 predicted FPR 14.7% observed FP 10 / 50');
    expect(host.querySelector('#fig-fpr-curve .xfig-readout')?.textContent).toBe('items inserted n 8 false-positive rate 14.7%');
    expect(host.querySelectorAll('figure[data-live]')).toHaveLength(2);
    act(() => bloom.unmount());
  });

  afterEach(() => {
    history.replaceState(null, '', '/');
    vi.restoreAllMocks();
  });

  it('jumps to a deep link (#section) once the essay has rendered', () => {
    history.replaceState(null, '', '/s/attention#divide-by-root-d');
    const seen: string[] = [];
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element) {
      seen.push(this.id);
    });
    const host = document.body.appendChild(document.createElement('div'));
    const root = createRoot(host);
    act(() => root.render(<EssayView doc={getSample('attention')!} />));
    expect(seen).toEqual(['divide-by-root-d']);
    act(() => root.unmount());
    host.remove();
  });

  it('a contents link moves focus to its heading', () => {
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    const host = document.body.appendChild(document.createElement('div'));
    const root = createRoot(host);
    act(() => root.render(<EssayView doc={getSample('attention')!} />));
    act(() => host.querySelector<HTMLAnchorElement>('.essay-toc a[href="#sharp-or-soft"]')!.click());
    expect(document.activeElement?.id).toBe('sharp-or-soft');
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
    expect(location.hash).toBe('#sharp-or-soft');
    act(() => root.unmount());
    host.remove();
  });
});
