import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Explorable } from '../../skills/explorable/kit/react/Explorable.tsx';
import type { ExplorableDoc } from '@kit/doc/schema.ts';
import { pdfAction, printLink } from '../lib/print.ts';
import { getSample } from '../samples/index.ts';
import { EssayToc } from './EssayToc.tsx';
import { PdfButton } from './PdfButton.tsx';

/** The essay with live figures (the kit's React wrapper), its contents in the gutter and the PDF button in the byline. */
export function EssayView({ doc }: { doc: ExplorableDoc }) {
  // A deep link (/s/attention#divide-by-root-d): the browser looked for the id before the essay existed, so
  // jump there once it has rendered (instantly; this is arrival, not motion).
  const docId = doc.id;
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id && docId) document.getElementById(id)?.scrollIntoView({ behavior: 'instant' });
  }, [docId]);
  const slug = getSample(docId) === doc ? docId : undefined;
  const link = printLink(slug, window.location.pathname, window.location.search);
  const options = useMemo(() => ({ link }), [link]);
  // The running head's address (app.css, @page): a CSS string set through the CSSOM, which the CSP allows.
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--print-url', JSON.stringify(link));
    return () => void root.removeProperty('--print-url');
  }, [link]);
  // The PDF button goes into the slot the kit leaves at the end of the byline row (a new doc renders a new slot).
  const col = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<Element | null>(null);
  useLayoutEffect(() => setSlot(col.current?.querySelector(`[data-doc="${CSS.escape(doc.id)}"] .essay-byline-end`) ?? null), [doc]);
  return (
    <div className="essay-col" ref={col}>
      <EssayToc doc={doc} />
      <Explorable doc={doc} options={options} className="essay-host" />
      {slot && createPortal(<PdfButton action={pdfAction(slug)} />, slot)}
    </div>
  );
}
