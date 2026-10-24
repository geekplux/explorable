import { Explorable } from '../../skills/explorable/kit/react/Explorable.tsx';
import type { ExplorableDoc } from '@kit/doc/schema.ts';
import { EssayToc } from './EssayToc.tsx';

/** The essay with live figures (the kit's React wrapper) and its contents in the gutter. */
export function EssayView({ doc }: { doc: ExplorableDoc }) {
  return (
    <div className="essay-col">
      <EssayToc doc={doc} />
      <Explorable doc={doc} className="essay-host" />
    </div>
  );
}
