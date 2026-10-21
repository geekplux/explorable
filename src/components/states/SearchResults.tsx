import type { ExplorableDoc } from '@kit/doc/schema.ts';
import { MiniCards } from '../SampleCard.tsx';

/** Local matches for typed words; the count is announced politely. */
export function SearchResults({ results }: { results: readonly ExplorableDoc[] | null }) {
  // The live region stays mounted so the first result count is announced too.
  if (!results) return <output className="visually-hidden" />;
  const n = results.length;
  return (
    <section className="search-results" aria-labelledby="search-heading">
      <h2 id="search-heading" className="kicker">
        Built-in matches
      </h2>
      <output className="search-count">
        {n ? `${n} built-in ${n === 1 ? 'match' : 'matches'}. Open one, or paste a link.` : 'No built-in match: paste a link instead.'}
      </output>
      {n > 0 && <MiniCards docs={results} />}
    </section>
  );
}
