import { useEffect } from 'react';
import { EssayIndex } from '../components/EssayIndex.tsx';

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Not found – Explorable';
  }, []);

  return (
    <main className="page essay-page">
      <div className="essay-col not-found">
        <h1 tabIndex={-1}>No explorable lives here</h1>
        <p>The link may be mistyped, or this explorable was never made. These ones work, offline too.</p>
        <h2 className="visually-hidden">Sample explorables</h2>
        <EssayIndex />
      </div>
    </main>
  );
}
