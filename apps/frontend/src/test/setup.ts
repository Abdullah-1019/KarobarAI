import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest runs with `globals: false` (see vitest.config.ts), so React Testing Library can't
// auto-register its own cleanup hook — do it explicitly, or unmounted DOM leaks across tests and
// queries like getByRole match multiple elements.
afterEach(() => {
  cleanup();
});
