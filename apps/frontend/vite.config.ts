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
        // UIUX §5.1 — brand primary (karobar green) for installed-PWA chrome/splash, warm paper
        // canvas as the splash background, replacing the generic white placeholder.
        theme_color: '#1a6b49',
        background_color: '#fbf8f3',
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
  },
});
