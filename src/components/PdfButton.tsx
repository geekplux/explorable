import type { PdfAction } from '../lib/print.ts';

/** A download glyph: an arrow onto a line, 14px, in currentColor. */
const glyph = (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
    <path d="M7 2v7M3.5 5.5L7 9l3.5-3.5M2.5 12h9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** "PDF" at the end of the byline row: a sample's file, or the print dialog (Save as PDF) for any other essay. */
export function PdfButton({ action }: { action: PdfAction }) {
  return action.kind === 'download' ? (
    <a className="essay-pdf" href={action.href} download aria-label={action.label}>
      {glyph}PDF
    </a>
  ) : (
    <button className="essay-pdf" type="button" onClick={() => window.print()} aria-label={action.label}>
      {glyph}PDF
    </button>
  );
}
