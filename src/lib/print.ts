/** The PDF of an essay (DESIGN §8): what the byline's PDF button does, and where a printed page points back to. */

/** The public host printed in the running head and in each figure's state line. */
export const SITE = 'explorable.geekplux.com';

/** A built-in sample downloads its pre-rendered PDF (`pnpm build:pdf`); any other essay opens the print dialog. */
export type PdfAction = { kind: 'download'; href: string; label: string } | { kind: 'print'; label: string };

export function pdfAction(sampleSlug: string | undefined): PdfAction {
  return sampleSlug ? { kind: 'download', href: `/pdf/${sampleSlug}.pdf`, label: 'Download PDF' } : { kind: 'print', label: 'Print or save as PDF' };
}

/** "explorable.geekplux.com/s/attention", or the result page's address with its link readable ("/x?url=https://…"). */
export function printLink(sampleSlug: string | undefined, pathname: string, search: string): string {
  if (sampleSlug) return `${SITE}/s/${sampleSlug}`;
  let query = search;
  try {
    query = decodeURIComponent(search);
  } catch {
    // a malformed escape stays as typed
  }
  return `${SITE}${pathname}${query}`;
}
