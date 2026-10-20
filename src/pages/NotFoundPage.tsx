import { useEffect } from 'react';

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Not found · explorable';
  }, []);

  return (
    <main className="page not-found">
      <h1 tabIndex={-1}>Not found</h1>
      <p>No explorable lives here.</p>
      <p>
        <a href="/">
          <span aria-hidden="true">← </span>All explorables
        </a>
      </p>
    </main>
  );
}
