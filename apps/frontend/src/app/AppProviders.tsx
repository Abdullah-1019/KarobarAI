import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import { RouterProvider } from 'react-router-dom';

import { queryClient } from '../lib/queryClient';
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

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={prefersDark ? darkTheme : lightTheme} direction={dir}>
        <RouterProvider router={router} />
        {import.meta.env.DEV && <HealthIndicator />}
      </ConfigProvider>
    </QueryClientProvider>
  );
}
