import { useEffect, useState } from 'react';
import type { ExplorableDoc } from '@kit/doc/schema.ts';
import { EssayIndex } from '../EssayIndex.tsx';

/** How long typing must pause before the match count is announced. */
export const COUNT_DELAY_MS = 500;

export const countText = (n: number): string =>
  n === 1 ? '1 match. Open it, or paste a link.' : n ? `${n} matches. Open one, or paste a link.` : 'No match: paste a link instead.';

/**
 * Local matches for typed words. The visible count updates at once; screen
 * readers hear it from one polite `<output>` that stays mounted at all times and
 * only changes its text, debounced, so the first count is announced and fast
 * typing does not queue a stream of counts.
 */
export function SearchResults({ results }: { results: readonly ExplorableDoc[] | null }) {
  const text = results ? countText(results.length) : '';
  const [said, setSaid] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSaid(text), text ? COUNT_DELAY_MS : 0);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <section className={results ? 'search-results' : undefined} aria-labelledby={results ? 'search-heading' : undefined}>
      <output className="visually-hidden search-live">{said}</output>
      {results && (
        <>
          <h2 id="search-heading">Built-in matches</h2>
          <p className="search-count" aria-hidden="true">
            {text}
          </p>
          {results.length > 0 && <EssayIndex docs={results} compact />}
        </>
      )}
    </section>
  );
}
