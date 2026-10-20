import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { interceptLinks } from './router.ts';
import './styles/tokens.css';
import './styles/base.css';
import '@kit/styles/kit.css';
import './styles/app.css';

document.addEventListener('click', interceptLinks);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
