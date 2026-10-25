import { useEffect } from 'react';
import { EssayView } from '../components/EssayView.tsx';
import { getSample } from '../samples/index.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

export function SamplePage({ slug }: { slug: string }) {
  const doc = getSample(slug);

  // The not-found branch sets its own title in NotFoundPage.
  useEffect(() => {
    if (doc) document.title = `${doc.title} – Explorable`;
  }, [doc]);

  if (!doc) return <NotFoundPage />;
  return (
    <main className="page essay-page">
      <EssayView doc={doc} />
    </main>
  );
}
