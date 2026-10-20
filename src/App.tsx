import { useEffect, useRef } from 'react';
import { GalleryPage } from './pages/GalleryPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { SamplePage } from './pages/SamplePage.tsx';
import { useRoute } from './router.ts';

export function App() {
  const route = useRoute();
  const key = route.name === 'sample' ? `sample:${route.slug}` : route.name;
  const shown = useRef(key);

  // After an in-app navigation, move focus to the new page's heading so
  // keyboard and screen-reader users land at the start of the content.
  useEffect(() => {
    if (shown.current === key) return;
    shown.current = key;
    document.querySelector<HTMLElement>('main h1')?.focus();
  }, [key]);

  if (route.name === 'gallery') return <GalleryPage />;
  if (route.name === 'sample') return <SamplePage slug={route.slug} />;
  return <NotFoundPage />;
}
