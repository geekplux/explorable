import { useEffect } from 'react';
import { SampleCards } from '../components/SampleCard.tsx';
import { Wordmark } from '../components/Wordmark.tsx';

export function GalleryPage() {
  useEffect(() => {
    document.title = 'explorable: live, draggable explainers';
  }, []);

  return (
    <main className="page gallery shell">
      <h1 tabIndex={-1}>
        <Wordmark size="home" />
      </h1>
      <p className="pitch">The core idea of a paper or post, rebuilt as a short essay with figures you can drag.</p>
      <h2 className="kicker">Start with one of these</h2>
      <SampleCards />
    </main>
  );
}
