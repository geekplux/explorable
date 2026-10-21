import type { ExplorableDoc } from '@kit/doc/schema.ts';
import { searchModels } from '@kit/index.ts';
import { samples } from '../samples/index.ts';

const words = (s: string): string[] => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/**
 * Local search over the built-in samples (D11: no network, no model). Words in
 * a sample's title, dek or source score directly; registry keyword hits score
 * for every sample whose figures use that model. Best first; empty if none.
 */
export function searchSamples(query: string, docs: readonly ExplorableDoc[] = samples): ExplorableDoc[] {
  const q = words(query).filter((w) => w.length > 1);
  if (!q.length) return [];
  const ranked = searchModels(q.join(' ')).map((m) => m.id);
  const score = (doc: ExplorableDoc) => {
    const text = words(`${doc.id} ${doc.title} ${doc.dek} ${doc.source.title}`);
    let s = 0;
    for (const w of q) s += text.includes(w) ? 3 : text.some((t) => t.startsWith(w)) ? 2 : 0;
    for (const section of doc.sections) {
      const rank = section.figure ? ranked.indexOf(section.figure.model.id) : -1;
      if (rank >= 0) s = Math.max(s, s + 4 - Math.min(rank, 3));
    }
    return s;
  };
  return docs
    .map((doc) => ({ doc, s: score(doc) }))
    .filter((r) => r.s > 0)
    .toSorted((a, b) => b.s - a.s)
    .map((r) => r.doc);
}
