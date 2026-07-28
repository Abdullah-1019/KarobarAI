import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Foundation-level PWA wiring only — service worker registers, offline caching strategy is R1.1.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'KarobarAI',
        short_name: 'KarobarAI',
        theme_color: '#ffffff',
        icons: [],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
