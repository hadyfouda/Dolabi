import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// Service worker: autoUpdate — new versions activate silently on next launch.
registerSW({ immediate: true });

// Ask the browser to keep IndexedDB (the whole wardrobe) permanently, not "best effort".
void navigator.storage?.persist?.().catch(() => false);

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
