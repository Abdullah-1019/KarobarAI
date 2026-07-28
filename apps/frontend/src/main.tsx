import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Root component lives inside app/ (not a top-level App.tsx) — a sibling `App.tsx` and `app/`
// folder resolve to the same path on Windows/macOS case-insensitive filesystems.
import { AppProviders } from './app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);
