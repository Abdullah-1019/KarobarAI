import { useEffect, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import { RouterProvider } from 'react-router-dom';

import { me, refresh } from '../features/auth/authApi';
import { queryClient } from '../lib/queryClient';
import { useAuthStore } from '../lib/authStore';
import { useLanguageStore } from '../lib/languageStore';
import { useLanguage } from '../hooks';
import './i18n';
import './global.css';
import { HealthIndicator } from './HealthIndicator';
import { router } from './router';
import { darkTheme, lightTheme } from './theme';

// Composes providers TRD §12 assigns to `app/`: routing, i18n (imported for its side-effect),
// theme (AntD ConfigProvider, direction driven by the active language), and query client.
export function AppProviders() {
  const { dir } = useLanguage();
  // Respects `prefers-color-scheme` on first load (UIUX doc); a manual Settings toggle that
  // persists to the user's profile is a later feature.
  const [prefersDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
  }, [prefersDark]);

  // Session restore (HO-F1-Auth.md: "use GET /me on app load / after refresh to restore session
  // state"). /refresh reads the karobarai_rt HttpOnly cookie automatically; if there's no valid
  // cookie this just fails and the user stays logged out — that's the normal first-visit case,
  // not an error to surface.
  //
  // Guarded with a ref, not just a cancelled-on-cleanup flag: React 18 StrictMode double-invokes
  // effects in dev (mount → cleanup → mount), and without this guard both invocations fire
  // refresh() with the *same* still-unrotated cookie. The backend's refresh tokens rotate with
  // reuse detection, so the second call is a replay of an already-rotated token — which revokes
  // *every* session for that user, including the one the first call just established. The ref
  // (unlike component state) survives StrictMode's simulated remount, so only the first
  // invocation ever actually runs the request.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      try {
        const { accessToken } = await refresh();
        const user = await me(accessToken);
        useAuthStore.getState().setSession(accessToken, user);
        // Restore the account's saved display language, not just the session — otherwise every
        // reload silently falls back to English regardless of what the user picked (Settings).
        useLanguageStore.getState().setLanguage(user.preferredLanguage);
      } catch {
        useAuthStore.getState().clearSession();
      }
    })();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={prefersDark ? darkTheme : lightTheme} direction={dir}>
        <RouterProvider router={router} />
        {import.meta.env.DEV && <HealthIndicator />}
      </ConfigProvider>
    </QueryClientProvider>
  );
}
