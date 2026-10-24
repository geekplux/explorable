import { useEffect } from 'react';
import { Explorable } from '../../skills/explorable/kit/react/Explorable.tsx';
import type { ExplorableDoc } from '@kit/doc/schema.ts';
import { EssayToc } from './EssayToc.tsx';

/** The essay with live figures (the kit's React wrapper) and its contents in the gutter. */
export function EssayView({ doc }: { doc: ExplorableDoc }) {
  // A deep link (/s/attention#divide-by-root-d): the browser looked for the id before the essay existed, so
  // jump there once it has rendered (instantly; this is arrival, not motion).
  const docId = doc.id;
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id && docId) document.getElementById(id)?.scrollIntoView({ behavior: 'instant' });
  }, [docId]);
  return (
    <div className="essay-col">
      <EssayToc doc={doc} />
      <Explorable doc={doc} className="essay-host" />
    </div>
  );
}
