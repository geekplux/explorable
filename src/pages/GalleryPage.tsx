import { useEffect } from 'react';
import { samples, sourceChip } from '../samples/index.ts';

export function GalleryPage() {
  useEffect(() => {
    document.title = 'explorable: live, draggable explainers';
  }, []);

  return (
    <main className="page gallery">
      <header className="gallery-head">
        <h1 tabIndex={-1}>explorable</h1>
        <p className="pitch">The core idea of a paper or post, rebuilt as a short essay with figures you can drag.</p>
      </header>
      <h2 className="gallery-kicker">Start with one of these</h2>
      <ul className="cards">
        {samples.map((doc) => (
          <li key={doc.id} className="card">
            <h3 className="card-title">
              <a href={`/s/${doc.id}`}>{doc.title}</a>
            </h3>
            <p className="card-dek">{doc.dek}</p>
            <p className="card-source">{sourceChip(doc.source)}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
