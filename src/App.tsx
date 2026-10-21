import { useEffect, useRef } from 'react';
import { Footer } from './components/Footer.tsx';
import { Header } from './components/Header.tsx';
import { getDraft } from './components/UrlField.tsx';
import { GalleryPage } from './pages/GalleryPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { ResultPage } from './pages/ResultPage.tsx';
import { SamplePage } from './pages/SamplePage.tsx';
import { useRoute } from './router.ts';

export function App() {
  const route = useRoute();
  const key = route.name === 'sample' ? `sample:${route.slug}` : route.name === 'explain' ? `explain:${route.url}` : route.name;
  const shown = useRef(key);

  // After an in-app navigation, move focus to the new page's heading so
  // keyboard and screen-reader users land at the start of the content.
  useEffect(() => {
    if (shown.current === key) return;
    shown.current = key;
    // Back on the gallery with a draft (Cancel, "Edit the link", Back): land in the filled input.
    const target = route.name === 'gallery' && getDraft() ? '.url-row input' : 'main h1';
    document.querySelector<HTMLElement>(target)?.focus();
  }, [key, route.name]);

  return (
    <>
      {route.name !== 'gallery' && <Header />}
      {route.name === 'gallery' ? (
        <GalleryPage />
      ) : route.name === 'sample' ? (
        <SamplePage slug={route.slug} />
      ) : route.name === 'explain' ? (
        <ResultPage key={route.url} url={route.url} />
      ) : (
        <NotFoundPage />
      )}
      <Footer />
    </>
  );
}
