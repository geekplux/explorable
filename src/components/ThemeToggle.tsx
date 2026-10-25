import { useEffect, useState } from 'react';
import { chooseTheme, currentTheme, onSystemTheme, type Theme } from '../lib/theme.ts';

const RAYS = 'M9 1.25V3.5M9 14.5v2.25M1.25 9H3.5M14.5 9h2.25M3.52 3.52l1.59 1.59M12.89 12.89l1.59 1.59M3.52 14.48l1.59-1.59M12.89 5.11l1.59-1.59';

/** The icon shows the theme a click switches to, as the name says: a moon in light, a sun in dark. */
function Icon({ to }: { to: Theme }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      {to === 'dark' ? (
        <path d="M9 2.25a4.5 4.5 0 0 0 6.75 6.75A6.75 6.75 0 1 1 9 2.25Z" fill="currentColor" />
      ) : (
        <>
          <circle cx="9" cy="9" r="3.25" fill="currentColor" />
          <path d={RAYS} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/** One button at the end of the header: switches between light and dark and remembers the choice (lib/theme.ts). */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());
  useEffect(() => onSystemTheme(() => setTheme(currentTheme())), []);
  const to: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Switch to ${to} theme`}
      onClick={() => {
        chooseTheme(to);
        setTheme(to);
      }}
    >
      <Icon to={to} />
    </button>
  );
}
