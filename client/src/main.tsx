import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { loadPrefs, PrefsProvider } from './lib/prefs';
import './index.css';

// Service worker: προ-αποθήκευση όλων των αρχείων ώστε το solo να παίζει offline.
if ('serviceWorker' in navigator && import.meta.env.PROD) registerSW({ immediate: true });

void loadPrefs().then((prefs) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PrefsProvider initial={prefs}>
        <App />
      </PrefsProvider>
    </StrictMode>,
  );
});
