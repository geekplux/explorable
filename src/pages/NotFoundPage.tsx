import { useEffect } from 'react';
import { EssayIndex } from '../components/EssayIndex.tsx';

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Not found – Explorable';
  }, []);

  return (
    <main className="page not-found shell">
      <svg viewBox="0 0 32 32" width="64" height="64" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true" focusable="false">
        <path d="M4 22H28" strokeWidth="2.5" />
        <path d="M4 27H28" strokeWidth="2" />
        <circle cx="20" cy="27" r="3.5" fill="var(--paper)" stroke="var(--live)" strokeWidth="2.5" />
      </svg>
      <h1 tabIndex={-1}>No explorable lives here</h1>
      <p>The link may be mistyped, or this explorable was never made. These ones work, offline too:</p>
      <h2 className="visually-hidden">Sample explorables</h2>
      <EssayIndex thumbs />
    </main>
  );
}
