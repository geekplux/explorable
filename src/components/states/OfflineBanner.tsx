import { useSyncExternalStore } from 'react';

function subscribe(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

/** `navigator.onLine`, live. */
export const useOnline = (): boolean => useSyncExternalStore(subscribe, () => navigator.onLine);

/** Always mounted (empty when online) so the change is announced. */
export function OfflineBanner() {
  const online = useOnline();
  return <output className="offline-slot">{!online && <Banner />}</output>;
}

function Banner() {
  return (
    <span className="offline-banner">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
        <path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 20h.01M3 3l18 18" />
      </svg>
      You’re offline. The samples below still work.
    </span>
  );
}
