import { useEffect, useRef } from 'react';
import { essayVars } from '@kit/doc/essay.ts';
import { formatInline } from '@kit/doc/inline.ts';
import { mountFigure } from '@kit/runtime/mount.ts';
import { getSample } from '../samples/index.ts';

/** The attention sample's first figure (softmax temperature), the same spec and kit model the essay runs. */
const doc = getSample('attention')!;
const spec = doc.sections.find((s) => s.figure)!.figure!;

/** The home page's live figure: the real model, keyboard-operable, with its spoken readout (DESIGN §5). */
export function HeroFigure() {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const live = stage.current ? mountFigure(stage.current, spec) : undefined;
    return () => live?.destroy();
  }, []);
  return (
    <figure className="hero-fig" id={spec.id} aria-labelledby={`${spec.id}-title`}>
      <p className="hero-fig-title" id={`${spec.id}-title`} dangerouslySetInnerHTML={{ __html: formatInline(spec.title, essayVars(doc)) }} />
      <div className="xfig-stage" ref={stage}>
        <p className="xfig-alt">{spec.alt}</p>
      </div>
      <figcaption>
        Drag <i>T</i>. The word “sat” spreads its attention over the sentence; a low temperature lets one word take it all. From{' '}
        <a href="/s/attention">
          Why attention divides by √<i>d</i>
        </a>.
      </figcaption>
    </figure>
  );
}
