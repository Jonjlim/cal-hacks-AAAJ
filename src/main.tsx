import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyCssVariables } from './core/theme';
import './ui/styles.css';

applyCssVariables();

if (import.meta.env.DEV) {
  // Console access for debugging and scripted screenshots: __itm.app.getState(), __itm.playback...
  void import('./state').then(({ useAppStore, usePlaybackStore }) => {
    Object.assign(window, { __itm: { app: useAppStore, playback: usePlaybackStore } });
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
