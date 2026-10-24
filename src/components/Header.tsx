import { Wordmark } from './Wordmark.tsx';

export const REPO = 'https://github.com/geekplux/explorable';

export function Header() {
  return (
    <header className="site-header">
      <a href="/" className="site-home" aria-label="Explorable, home">
        <Wordmark size="header" />
      </a>
      <nav className="site-nav" aria-label="Site">
        <a href="/#essays">Essays</a>
        <a href="/#how">How it works</a>
        <a href={REPO}>GitHub</a>
      </nav>
    </header>
  );
}
