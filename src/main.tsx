import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { startAnalytics } from './analytics.ts';
import { interceptLinks } from './router.ts';
import '@kit/styles/tokens.css';
import './styles/fonts.css';
import './styles/base.css';
import '@kit/styles/kit.css';
import './styles/app.css';

document.addEventListener('click', interceptLinks);
startAnalytics();

// Production builds only: dist/client/sw.js comes from scripts/gen-sw.mjs and
// makes the app and samples reload offline (O2). Registered after load so it
// never competes with first paint.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is an extra; the app works without it.
    });
  });
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
