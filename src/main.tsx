import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { saveState } from './lib/storage';
import { saveGame } from './lib/storage';
import type { ExportBundleData } from './lib/exportBuilder';
import { AppErrorBoundary } from './components/AppErrorBoundary';

async function init() {
  const embedded = (window as unknown as Record<string, unknown>).__EVERTRAIL_DATA__ as
    | ExportBundleData
    | undefined;

  if (embedded?.gameState) {
    try {
      await saveState(embedded.gameState);
      if (embedded.save) {
        await saveGame(embedded.save);
      }
    } catch (e) {
      console.error('Failed to load embedded Evertrail data:', e);
    }
    delete (window as unknown as Record<string, unknown>).__EVERTRAIL_DATA__;
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>,
  );
}

init();
