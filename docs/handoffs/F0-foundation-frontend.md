# Handoff — F0 Frontend Foundation

**Status:** Done — 2026-07-29. Standalone shell only — no backend calls wired yet (that's Day 2).
Verified: `tsc --noEmit` clean, `vite build` clean (PWA manifest/service worker generate),
`vite dev` boots and was driven headless (Playwright) — routes render, zero console errors,
UIUX §5 color/type tokens visibly applied (warm paper background, brand text color, IBM Plex
Sans).

## What shipped

- **Design tokens** (`src/app/global.css`, `src/app/theme.ts`) — UIUX §5/§11 color, radius,
  shadow, and motion tokens as CSS custom properties (`:root` light, `[data-theme="dark"]`
  override), plus the matching AntD `ConfigProvider` token object (light + a
  `theme.darkAlgorithm` dark variant). Dark mode currently follows `prefers-color-scheme` on
  first load only — a persisted Settings toggle is a later feature, per the UIUX doc's own
  scoping.
- **i18n** (`src/app/i18n.ts`, `src/locales/{en,ur}`) — `react-i18next`, one `common` namespace
  seeded with nav/action/state strings in both languages. `src/lib/languageStore.ts` (Zustand)
  drives `i18n.changeLanguage`, `<html lang/dir>`, and AntD's `direction` prop together, so a
  future language-switcher control just calls `setLanguage('UR' | 'EN')` — **no visible switcher
  UI exists yet** (that's a nav/header component, not part of the Day-1 scaffold), so RTL
  flipping is wired but hasn't been eyeballed in a browser yet. Worth a manual check the first
  time a header component calls it.
- **Fonts** — IBM Plex Sans + IBM Plex Sans Arabic loaded via Google Fonts `<link>` in
  `index.html` (preconnect + preload), Noto Nastaliq Urdu loaded lazily (`media="print"` swap
  trick) and scoped to a `.font-nastaliq` utility class — never applied globally, per the UIUX
  doc's "Nastaliq clips at tight leading" warning.
- **Routing** (`src/app/router.tsx`) — `react-router-dom`, one placeholder route per feature area
  (`/auth`, `/buyer`, `/seller`, `/admin`), `/` redirects to `/buyer`, catch-all 404. No route
  guards/protected routes — those arrive with Feature 1's role-based redirect.
- **Providers** (`src/app/AppProviders.tsx`, wired from `src/main.tsx`) — composes
  `QueryClientProvider`, AntD `ConfigProvider` (theme + dynamic direction), and the router.
- **API client structure** (`src/api/client.ts`) — one shared axios instance
  (`VITE_API_URL`, defaults to `http://localhost:4000/api/v1`), `withCredentials: true`
  (needed for the refresh-token cookie per `HO-F1-Auth.md`), and an `ApiEnvelope<T>` type +
  `unwrap()` helper mirroring the backend's response envelope (`core/http/envelope.ts`). No auth
  interceptor yet — token attachment lands with Feature 1.
- **Shared component shells** (`src/components/`) — `SkeletonLoader`, `toast`, `Modal`,
  `EmptyState`, each a thin themed wrapper over the matching AntD primitive.

## Folder-structure decisions

- No structural changes to the TRD §12 layout — filled in the existing empty stubs
  (`app/`, `components/`, `hooks/`, `lib/`, `api/`, `locales/en`, `locales/ur`) as-is.
- **Root `App.tsx` was removed.** A sibling `App.tsx` file and an `app/` folder resolve to the
  same path on case-insensitive filesystems (Windows/macOS), so `App.tsx` couldn't import from
  `./app` without a circular-alias error. The root component now lives at `src/app/AppProviders.tsx`
  and is exported from `src/app/index.ts`; `main.tsx` imports it directly. Keep this in mind if a
  future feature is tempted to reintroduce a top-level `App.tsx`.
- Added `@karobarai/shared` as a real dependency in `apps/frontend/package.json` (was previously
  only wired for the backend) — used today for the `Language` type; expect more shared
  enums/DTOs to be pulled in from Feature 1 onward.
- Added `apps/frontend/.env.example` (`VITE_API_URL`) — didn't exist before; Vite reads app-level
  `.env`, not the repo-root one.

## Left incomplete / for Day 2

- App shell → `/health` connectivity check (Day 2's first task) not done — no live backend calls
  yet at all.
- No visible language switcher, so EN⇄UR RTL flip is implemented but not yet manually verified
  in a browser — do that as part of whichever screen first adds a language control.
- Login/Register screens not started.
- `dist/assets/index-*.js` is ~580KB (AntD, mostly) with a Vite chunk-size warning — not
  addressed today, flagged for whenever code-splitting becomes worth it (not a Day-1 concern).
