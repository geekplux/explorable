// @vitest-environment happy-dom
import { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { getSample } from '../samples/index.ts';
import { EssayView } from './EssayView.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('EssayView', () => {
  it('hydrates attention Fig 1 once (StrictMode-safe), keeps Fig 2 static, and cleans up on unmount', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => root.render(<StrictMode><EssayView doc={getSample('attention')!} /></StrictMode>));
    expect(host.querySelectorAll('#fig-temperature .xfig-knob[role="slider"]')).toHaveLength(1);
    expect(host.querySelectorAll('#fig-temperature rect.xfig-bar')).toHaveLength(6);
    expect(host.querySelector('#fig-temperature .xfig-readout')?.textContent).toBe('top weight 0.51 · entropy 2.05 bits');
    expect(host.querySelector('#fig-scaling .xfig-drawing')).toBeNull();
    expect(host.querySelector('#fig-scaling .xfig-alt')?.textContent?.length).toBeGreaterThan(40);
    act(() => root.unmount());
    expect(host.innerHTML).toBe('');
  });
});
