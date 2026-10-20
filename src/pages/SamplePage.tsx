import { useEffect } from 'react';
import { EssayView } from '../components/EssayView.tsx';
import { getSample } from '../samples/index.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

export function SamplePage({ slug }: { slug: string }) {
  const doc = getSample(slug);

  useEffect(() => {
    document.title = doc ? `${doc.title} · explorable` : 'Not found · explorable';
  }, [doc]);

  if (!doc) return <NotFoundPage />;
  return (
    <main className="page essay-page">
      <nav aria-label="Breadcrumb">
        <a href="/" className="back">
          ← All explorables
        </a>
      </nav>
      <EssayView doc={doc} />
    </main>
  );
}
