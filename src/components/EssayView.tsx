import { useMemo } from 'react';
import { essayHtml } from '@kit/doc/essay.ts';
import type { ExplorableDoc } from '@kit/doc/schema.ts';

/**
 * Thin shell around the kit renderer. `essayHtml` escapes every piece of doc
 * text and emits only its own markup, so injecting it is safe. Live figures
 * hydrate into the shells from Phase 4 on.
 */
export function EssayView({ doc }: { doc: ExplorableDoc }) {
  const html = useMemo(() => essayHtml(doc), [doc]);
  return <div className="essay-host" dangerouslySetInnerHTML={{ __html: html }} />;
}
