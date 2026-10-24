import { useEffect, useMemo, useState } from 'react';
import { SampleCards } from '../components/SampleCard.tsx';
import { UrlField, getDraft } from '../components/UrlField.tsx';
import { OfflineBanner } from '../components/states/OfflineBanner.tsx';
import { SearchResults } from '../components/states/SearchResults.tsx';
import { classifyInput } from '../lib/input.ts';
import { searchSamples } from '../lib/search.ts';

const initialQuery = () => {
  const parsed = classifyInput(getDraft());
  return parsed.kind === 'text' ? parsed.query : '';
};

export function GalleryPage() {
  const [query, setQuery] = useState(initialQuery);
  const results = useMemo(() => (query ? searchSamples(query) : null), [query]);

  useEffect(() => {
    document.title = 'Explorable: live, draggable explainers';
  }, []);

  return (
    <main className="page gallery shell">
      <h1 tabIndex={-1} className="page-title">
        The core idea of a paper or post, rebuilt as a short essay with figures you can drag.
      </h1>
      <OfflineBanner />
      <UrlField onQuery={setQuery} />
      <SearchResults results={results} />
      <h2 id="essays" className="kicker">
        Or start with one of these
      </h2>
      <SampleCards />
    </main>
  );
}
