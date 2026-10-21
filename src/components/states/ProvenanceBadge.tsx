import type { ExplorableDoc } from '@kit/doc/schema.ts';

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * How this essay was made, in one line under the back link. The kit's essay
 * header already labels AI prose next to the source link; this adds the detail.
 */
export function ProvenanceBadge({ doc, cache }: { doc: ExplorableDoc; cache: 'hit' | 'miss' }) {
  const p = doc.provenance;
  const how =
    p.mode === 'ai'
      ? `Prose and figure choices written by ${p.model ?? 'a language model'}; the figures compute from tested models.`
      : 'Your link matched a built-in explainer: the essay is the curated one, cited to your source.';
  return (
    <p className="provenance-note" data-mode={p.mode}>
      <span className="provenance-tag">{p.mode === 'ai' ? 'AI-generated' : 'Matched'}</span> {how}{' '}
      <span className="provenance-when">
        Made {date(p.generatedAt)}
        {cache === 'hit' ? ', saved copy' : ''}.
      </span>
    </p>
  );
}
