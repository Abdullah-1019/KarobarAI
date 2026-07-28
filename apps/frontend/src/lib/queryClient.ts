import { QueryClient } from '@tanstack/react-query';

// TanStack Query (TRD §4) — caching/retry defaults tuned for a 3G-first audience; per-domain
// query hooks land alongside each feature's API calls.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
