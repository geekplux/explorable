/** Mark (src/assets/mark.svg, inlined so it follows the tokens) + the word "explorable". */
export function Wordmark({ size }: { size: 'home' | 'header' }) {
  return (
    <span className={size === 'home' ? 'wordmark wordmark-home' : 'wordmark'}>
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true" focusable="false">
        <path d="M4 22C10 22 12 8 16 8S22 22 28 22" strokeWidth="2.5" />
        <path d="M4 27H28" strokeWidth="2" />
        <path d="M20 21.5V14.5" strokeWidth="1.5" strokeDasharray="0 3.5" />
        <circle cx="20" cy="12.5" r="2" fill="currentColor" stroke="none" />
        <circle cx="20" cy="27" r="3.5" fill="var(--paper)" stroke="var(--live)" strokeWidth="2.5" />
      </svg>
      explorable
    </span>
  );
}
