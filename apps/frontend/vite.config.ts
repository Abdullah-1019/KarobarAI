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
        // Studio Light (docs/frontend/DESIGN-CONSULT.md): installed-PWA chrome and splash use the
        // warm-white page colour, matching <meta name="theme-color"> in index.html.
        theme_color: '#faf9f7',
        background_color: '#faf9f7',
        // Hand-authored on-brand SVG mark (public/pwa-icon.svg) — Chrome/Android install icon.
        // `purpose: 'any'` only: proper cross-platform coverage (a maskable PNG with safe-zone
        // padding for Android adaptive icons, a raster apple-touch-icon for iOS) needs PNG
        // exports, which this environment has no image-rasterization tool to produce (checked
        // for ImageMagick/Inkscape/rsvg-convert/sharp — none available). Tracked as a pending
        // item in docs/FRONTEND-UI-UX.md; the SVG here is the source of truth to export from.
        icons: [{ src: '/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    watch: { usePolling: true },
  },
});
