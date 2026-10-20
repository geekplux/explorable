// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { NotFoundPage } from './NotFoundPage.tsx';
import { SamplePage } from './SamplePage.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const host = document.createElement('div');
const root = createRoot(host);

afterEach(() => act(() => root.render(null)));

describe('page titles', () => {
  it('sets the sample title, then "Not found" for an unknown slug', () => {
    act(() => root.render(<SamplePage slug="attention" />));
    expect(document.title).toBe('Why attention divides by √d · explorable');
    act(() => root.render(<SamplePage slug="nope" />));
    expect(document.title).toBe('Not found · explorable');
  });

  it('sets "Not found" on the not-found page and hides the arrow from screen readers', () => {
    document.title = 'Some earlier page';
    act(() => root.render(<NotFoundPage />));
    expect(document.title).toBe('Not found · explorable');
    expect(host.querySelector('a [aria-hidden="true"]')?.textContent).toBe('← ');
  });
});
