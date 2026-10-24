// @vitest-environment happy-dom
import { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
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
    act(() => root.unmount());
    expect(host.innerHTML).toBe('');
    const bloom = createRoot(host);
    act(() => bloom.render(<EssayView doc={getSample('bloom-filter')!} />));
    expect(host.querySelector('#fig-bits .xfig-readout')?.textContent).toBe('bits set 20 / 32 predicted FPR 14.7% observed FP 10 / 50');
    expect(host.querySelector('#fig-fpr-curve .xfig-readout')?.textContent).toBe('items inserted n 8 false-positive rate 14.7%');
    expect(host.querySelectorAll('figure[data-live]')).toHaveLength(2);
    act(() => bloom.unmount());
  });
});
