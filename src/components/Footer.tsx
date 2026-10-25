import { REPO } from './Header.tsx';
import { MadeBy } from './MadeBy.tsx';
import { Wordmark } from './Wordmark.tsx';

/** Made by GeekPlux, then the bottom row: small wordmark, source, accessibility, licence (DESIGN §4). */
export function Footer() {
  return (
    <footer className="site-footer">
      <MadeBy />
      <div className="site-foot">
        <a href="/" className="site-home" aria-label="Explorable, home">
          <Wordmark size="footer" />
        </a>
        <ul>
          <li>
            <a href={REPO}>Source on GitHub</a>
          </li>
          <li>
            <a href={`${REPO}#accessibility`}>Accessibility</a>
          </li>
          <li>MIT licence</li>
        </ul>
      </div>
    </footer>
  );
}
