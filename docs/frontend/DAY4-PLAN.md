# Day 4 — plan (Batch 5 buyer after-purchase + Batch 6 admin + QA)

Work goes phase by phase. After each phase: stop, report the URL plus 3–4 lines in Roman Urdu, and wait for Rafia to say "next".
Nothing starts until Rafia says so.

## Ground rules (same as Days 1–3)

- Frontend only. The backend and `prisma/seed.ts` belong to Abdullah. Backend needs go into BACKEND-NOTES.md.
- No git commits. Rafia commits.
- Lean mode: no screenshots or reviewer agents. Rafia checks in the browser.
- Studio Light only. Don't make it generic; match the existing pages (see `seller.css`, `orders.css`, `returns.css`).
- No invented numbers, ratings or names. No raw IDs or UUIDs in the UI. No duplicate links.
- Logic and API calls stay unchanged unless a bug needs fixing.
- Never run backend DB tests.

## Phase 1 — Buyer returns: wizard + status

- **Return wizard** `/orders/:id/return` (`ReturnWizardPage.tsx`, 196 lines; `ReturnImageUploader.tsx`)
  - Step tracker (reuse the `slSteps` look, buyer version): item → reason → photos → review.
  - Product card at the top (photo, title, order number, days left in the 14-day window).
  - Reason as selectable tiles, not a dropdown.
  - Photo drop zone in lilac with the "at least 3 photos" counter (Next stays disabled until there are 3); camera on touch.
  - Sticky glass action bar with Back / Next / Submit.
  - Calm success state that leads into the status page.
- **Return status** `/orders/:id/return/status` (`ReturnStatusPage.tsx`, 285 lines)
  - Reuse the seller detail pieces: lilac journey band (`ReturnJourney`), the reason quote, and the buyer's photos.
  - One "what happens next" card: waiting for the seller / appeal / courier pickup / refund.
  - Appeal form inside that card when it applies.
  - Show the AI gauge to buyers only in a soft form, if the data is present (no technical details).
- Check: `BuyerReturnsPage` → status links, the order detail "Request a return" path, empty/error states.

## Phase 2 — Public tracking + buyer profile check

- **Public tracking** `/t/:publicToken` (`PublicTrackingPage.tsx`, 113 lines). No login is needed, so it gets a minimal header and the logo.
  - Status band and journey (reuse `OrderJourney` / `TrackingTimeline`), map, courier card.
  - Friendly "link not valid / expired" state.
  - Small "Shop on KarobarAI" footer (one link only).
- **Buyer profile / settings sweep**: these pages are shared with the seller, so only fix gaps on the buyer side (cards, shortcut tiles, Urdu).
- **Buyer tracking** `/orders/:id/track`: check it looks the same as the seller version.

## Phase 3 — Admin shell + Dashboard + Users

- **AdminLayout** (91 lines): own admin shell in the seller-shell family, but **compact density** (smaller paddings, 40px rows, denser tables). Use an ink/neutral accent so admin feels like "control room" rather than a copy of seller.
- **Dashboard** `/admin` (144 lines): header band with platform KPIs (real API numbers only), and cards for "needs attention" (returns in appeal, products pending moderation, reports).
- **Users** `/admin/users` (298 lines): toolbar (search + role/status pills), compact table rows with avatar initial, role chip and status chip, and actions in a ⋯ menu. Turns into cards on phones.
- `AdminPlaceholder` for `/admin/*`: a designed "not here yet" state.

## Phase 4 — Admin Moderation, Reports, Returns, Config

- **Product moderation** `/admin/moderation` (202 lines): queue with product photo, seller, AI flags, and approve/reject in a side panel or row actions.
- **Reports** `/admin/reports` (223 lines): reuse the analytics chart style (load the `dataviz` skill first) and the shared `DateRangeFilter`.
- **Admin returns** list and detail (88 + 188 lines): reuse `returns.css` rows and the detail layout. The admin decision goes in the `odNext` card. Move the admin side off the old `ReturnSimilarityScale` and onto `ReturnSimilarityGauge` if it fits.
- **Config** `/admin/config` (231 lines): grouped `slFormCard`-style sections, toggles with hints, sticky save bar, and the adapter-mode (mock/live) indicator.

## Phase 5 — QA sweep (whole app)

- Every screen at 375px: no horizontal scroll, sticky bars don't cover content.
- Urdu/RTL on every screen: Nastaliq titles, logical CSS, icons that flip correctly. EN and UR strings both present.
- Empty, loading and error states on every data page.
- Keyboard focus rings visible; touch targets 44px.
- `prefers-reduced-motion` respected.
- Sweep for raw IDs, duplicate links and leftover old-style pages.
- Update the DAILY-LOG "Status at a glance" table (it is stale), then write the Day 4 entry.

## Checks before each report

1. `npx tsc --noEmit -p ..` and `npx eslint <changed folders>`, run from `apps/frontend/src`.
2. `npx vitest run` when shared or tested files changed.
3. EN and UR strings in both `locales/en/index.ts` and `locales/ur/index.ts`.
4. Phone width and RTL thought through.
5. Short DAILY-LOG line, then the URL + 3–4 lines in Roman Urdu.
