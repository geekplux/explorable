import type { DocSource, ExplorableDoc } from '@kit/doc/schema.ts';
import attention from './attention.json';
import bloomFilter from './bloom-filter.json';
import diffusion from './diffusion.json';

/** Built-in samples, bundled with the app (no network, no key). Gallery order. */
export const samples: readonly ExplorableDoc[] = [attention, bloomFilter, diffusion] as ExplorableDoc[];

export function getSample(slug: string): ExplorableDoc | undefined {
  return samples.find((doc) => doc.id === slug);
}

/** Short source chip for cards: "arXiv 1706.03762", or the host name. */
export function sourceChip(source: DocSource): string {
  const arxiv = source.url && /arxiv\.org\/(?:abs|pdf|html)\/([\w.-]+?)(?:v\d+)?(?:\.pdf)?$/.exec(source.url);
  if (arxiv?.[1]) return `arXiv ${arxiv[1]}`;
  if (source.url) {
    try {
      return new URL(source.url).hostname.replace(/^www\./, '');
    } catch {
      // fall through to the title
    }
  }
  return source.title;
}
