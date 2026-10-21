import { Explorable } from '../../skills/explorable/kit/react/Explorable.tsx';
import type { ExplorableDoc } from '@kit/doc/schema.ts';

/** The essay with live figures, rendered by the kit's React wrapper. */
export function EssayView({ doc }: { doc: ExplorableDoc }) {
  return <Explorable doc={doc} className="essay-host" />;
}
