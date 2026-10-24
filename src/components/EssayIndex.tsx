import type { ExplorableDoc } from '@kit/doc/schema.ts';
import { canPlay, playThumb } from '../lib/thumbPlay.ts';
import { essayMeta, samples, sourceChip } from '../samples/index.ts';

/** Thumbnails inline (scripts/gen-thumbs.mjs), so they take the theme's colours and can play. */
const THUMBS = import.meta.glob<string>('../samples/thumbs/*.svg', { eager: true, query: '?raw', import: 'default' });

/** Hover or focus plays the row's thumbnail once. */
function play(e: { currentTarget: HTMLElement }) {
  const svg = e.currentTarget.querySelector<SVGSVGElement>('svg.thumb');
  if (svg && canPlay()) playThumb(svg);
}

/**
 * The essays as a numbered list of rows, each row one link: number, title, dek, source and size, and (with
 * `thumbs`, desktop only) the first figure at rest, which plays once on hover or focus. The row's text is its
 * accessible name, so the visible label is part of it. `compact` keeps the title and the meta line only
 * (search matches, error state).
 */
export function EssayIndex({ docs = samples, thumbs = false, compact = false }: { docs?: readonly ExplorableDoc[]; thumbs?: boolean; compact?: boolean }) {
  return (
    <ol className={compact ? 'essay-index is-compact' : 'essay-index'}>
      {docs.map((doc, i) => {
        const thumb = thumbs ? THUMBS[`../samples/thumbs/${doc.id}.svg`] : undefined;
        return (
          <li key={doc.id}>
            <a className="essay-row" href={`/s/${doc.id}`} onPointerEnter={play} onFocus={play}>
              <span className="essay-no" aria-hidden="true">
                {String((samples.indexOf(doc) + 1 || i + 1)).padStart(2, '0')}
              </span>
              <span className="essay-body">
                <span className="essay-title">
                  {doc.title}
                </span>
                {!compact && (
                  <span className="essay-dek">
                    {doc.dek}
                  </span>
                )}
                <span className="essay-meta">
                  <span className="essay-src">{sourceChip(doc.source)}</span>
                  <span>{essayMeta(doc)}</span>
                </span>
              </span>
              {thumb && <span className="essay-thumb" dangerouslySetInnerHTML={{ __html: thumb }} />}
            </a>
          </li>
        );
      })}
    </ol>
  );
}
