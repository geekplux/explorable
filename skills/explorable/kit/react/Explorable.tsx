import { useEffect, useMemo, useRef } from 'react';
import { essayHtml, hydrateFigures } from '../src/doc/essay.ts';
import type { ExplorableDoc } from '../src/doc/schema.ts';
import type { MountOptions } from '../src/runtime/mount.ts';

/**
 * A thin React wrapper around the kit: the static, escaped essay HTML (safe to
 * inject: `essayHtml` escapes every piece of doc text) plus live figures
 * hydrated in an effect and torn down on unmount.
 */
export function Explorable({ doc, options, className }: { doc: ExplorableDoc; options?: MountOptions; className?: string }) {
  const html = useMemo(() => essayHtml(doc), [doc]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return hydrateFigures(ref.current, doc, options).destroy;
  }, [doc, options]);
  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
