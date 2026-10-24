// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { GalleryPage } from './GalleryPage.tsx';
import { NotFoundPage } from './NotFoundPage.tsx';
import { SamplePage } from './SamplePage.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const host = document.createElement('div');
const root = createRoot(host);

afterEach(() => act(() => root.render(null)));

describe('page titles', () => {
  it('sets the sample title, then "Not found" for an unknown slug', () => {
    act(() => root.render(<SamplePage slug="attention" />));
    expect(document.title).toBe('Why attention divides by √d – Explorable');
    act(() => root.render(<SamplePage slug="nope" />));
    expect(document.title).toBe('Not found – Explorable');
  });

  it('shows the not-found message with the three sample cards', () => {
    document.title = 'Some earlier page';
    act(() => root.render(<NotFoundPage />));
    expect(document.title).toBe('Not found – Explorable');
    expect(host.querySelector('h1')?.textContent).toBe('No explorable lives here');
    expect([...host.querySelectorAll('.card h3 a')].map((a) => a.getAttribute('href'))).toEqual(['/s/attention', '/s/bloom-filter', '/s/diffusion']);
    expect(host.querySelector('.card img')?.getAttribute('alt')).toBe('');
  });

  it('gives the gallery one h1 and leaves the way home to the header (no back link)', () => {
    act(() => root.render(<GalleryPage />));
    expect(document.title).toBe('Explorable: live, draggable explainers');
    expect(host.querySelectorAll('h1')).toHaveLength(1);
    expect(host.querySelector('h1')?.textContent).toMatch(/^The core idea of a paper or post/);
    act(() => root.render(<SamplePage slug="attention" />));
    expect(host.querySelector('a.back, nav[aria-label="Back"]')).toBeNull();
    expect(host.textContent).not.toContain('All explorables');
  });
});
