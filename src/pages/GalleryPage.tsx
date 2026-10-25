import { useEffect, useMemo, useState } from 'react';
import { EssayIndex } from '../components/EssayIndex.tsx';
import { HeroFigure } from '../components/HeroFigure.tsx';
import { UrlField, getDraft } from '../components/UrlField.tsx';
import { OfflineBanner } from '../components/states/OfflineBanner.tsx';
import { SearchResults } from '../components/states/SearchResults.tsx';
import { classifyInput } from '../lib/input.ts';
import { searchSamples } from '../lib/search.ts';

const initialQuery = () => {
  const parsed = classifyInput(getDraft());
  return parsed.kind === 'text' ? parsed.query : '';
};

export const SKILL_INSTALL = 'npx degit geekplux/explorable/skills/explorable ~/.claude/skills/explorable';

/** Home (DESIGN §5): the promise and the one input beside a live figure, the essays, how it works. */
export function GalleryPage() {
  const [query, setQuery] = useState(initialQuery);
  const results = useMemo(() => (query ? searchSamples(query) : null), [query]);

  useEffect(() => {
    document.title = 'Explorable: hard ideas, made clear with figures you can drag';
  }, []);

  return (
    <main className="page home">
      <section className="hero shell">
        <div className="hero-text">
          <h1 tabIndex={-1}>Hard ideas, made clear with figures you can drag.</h1>
          <p className="hero-lede">
            Paste a link to a paper or a blog post. You get a short read in plain words about its one big idea, with figures to play with. No math
            required.
          </p>
          <OfflineBanner />
          <UrlField onQuery={setQuery} />
          <SearchResults results={results} />
        </div>
        <HeroFigure />
      </section>
      <section className="home-section shell" id="essays" aria-labelledby="essays-h">
        <h2 id="essays-h">Essays</h2>
        <EssayIndex thumbs />
      </section>
      <section className="home-section shell" id="how" aria-labelledby="how-h">
        <h2 id="how-h">How it works</h2>
        <ol className="steps">
          <li>
            <span aria-hidden="true">1</span>
            <p>
              <b>Read.</b> Explorable fetches the page and keeps only the text: a paper’s abstract and body, or a post’s article.
            </p>
          </li>
          <li>
            <span aria-hidden="true">2</span>
            <p>
              <b>Explain.</b> One model call finds the one big idea and explains it in plain words, for a curious reader with no background. Formulas and
              sources wait behind a click.
            </p>
          </li>
          <li>
            <span aria-hidden="true">3</span>
            <p>
              <b>Show.</b> Each figure comes from a kit of tested components, so what you drag runs a real model of the idea, not an animation.
            </p>
          </li>
        </ol>
        <div className="skill-row">
          <p>
            <b>In your coding agent.</b> The same kit ships as the <code>/explorable</code> skill.
          </p>
          <p className="cmdbox">
            <code>{SKILL_INSTALL}</code>
          </p>
        </div>
      </section>
    </main>
  );
}
