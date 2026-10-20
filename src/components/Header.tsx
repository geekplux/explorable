import { Wordmark } from './Wordmark.tsx';

export function Header() {
  return (
    <header className="site-header shell">
      <a href="/" className="hit" aria-label="explorable, home">
        <Wordmark size="header" />
      </a>
    </header>
  );
}
