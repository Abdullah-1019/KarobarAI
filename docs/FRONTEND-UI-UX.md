# KarobarAI Frontend UI/UX — Implementation Tracking

**Status:** Living document. Updated after every approved UI/UX implementation phase.
**Primary specification:** [`docs/KarobarAI-04-UIUX.md`](./KarobarAI-04-UIUX.md) — the single source of truth for KarobarAI's visual identity, design tokens, and component/layout specs. This document does **not** duplicate that spec; it tracks *implementation progress against it*: what's been built, what's pending, what deviates, and what needs a decision.

---

## 1. Approved Visual Identity (summary — see UIUX doc for full detail)

- **Design philosophy:** Hybrid Minimalism + Agentic + Conversational. Warm, paper-toned, bazaar-rooted identity — karobar green (`#1A6B49`) + marigold (`#F4A024`) — deliberately not generic SaaS blue/grey (UIUX §0–§1).
- **Signature:** the bilingual AI generation reveal — EN ⇄ اردو duality is the brand's visual fingerprint (UIUX §0, §22).
- **Typography:** IBM Plex Sans / IBM Plex Sans Arabic for all UI/body text (both scripts, one shared voice); Noto Nastaliq Urdu reserved for headings/brand/celebratory moments only (UIUX §6).
- **Component library:** Ant Design 5, themed entirely through tokens via `ConfigProvider` — no hardcoded colors in components (UIUX §33, §24).
- **Navigation structure (confirmed 2026-08-15, built in Phase C, UIUX doc remains authoritative — not amended):**
  - Buyer: top navigation + mobile bottom tab bar.
  - Seller: left sidebar (desktop/tablet, collapsing appropriately) + bottom tab bar (mobile).
  - Admin: left sidebar (desktop/tablet) + bottom tab bar (mobile).
- **Accessibility floor:** WCAG 2.1 AA — never color alone, 2px focus ring, 44×44px touch targets, `prefers-reduced-motion` support (UIUX §23).
- **RTL:** bilingual-by-construction; logical CSS properties throughout so mirroring is automatic, not hand-maintained (UIUX §2, §10, §31).

---

## 2. Design-System Architecture

```
app/
  global.css     → single source of design tokens: color (light/dark), spacing, radius,
                    shadow, motion/z-index, chart palette. All values trace to UIUX doc §5/§9/§11/§18.
  theme.ts        → AntD ConfigProvider token mapping, derived from the same palette as global.css.
components/       → shared, brand-level primitives built on AntD (Modal, EmptyState, SkeletonLoader,
                    Toast, StatusTag, BackLink, AppShell, AppHeader, Sidebar, BottomTabBar, etc.) —
                    the "thin in-house layer" UIUX §33 calls for.
features/*/       → feature-owned layouts/pages. The 3 role layouts (StorefrontLayout, SellerLayout,
                    AdminLayout) are now thin configuration over components/AppShell — role-specific
                    nav items/labels only, no duplicated header/sidebar/tab-bar markup.
```

Principle: **no hardcoded colors/spacing in feature code — tokens only.** Where this is currently violated, it's tracked below per phase.

---

## 3. Implementation Phases

| Phase | Scope | Status |
|---|---|---|
| **A** | Design tokens (spacing, chart palette, fix broken token references, PWA manifest, install Lucide) | ✅ **Complete** (2026-08-15) |
| **B** | Shared & reusable UI components (consolidate status tags, accessibility foundation, icon system, PWA icon asset, review of the 8 shared components) | ✅ **Complete** (2026-08-15) |
| **C** | Shared layouts/navigation (Buyer top-nav+bottom-tabs, Seller/Admin sidebar+bottom-tabs, per confirmed direction above) | ✅ **Complete** (2026-08-15) |
| **D** | Feature-level UI implementation, in 5 controlled batches: D1 Buyer/Marketplace, D2 Seller/AI Store Builder, D3 Orders/Tracking/Returns/Notifications, D4 Analytics/Admin, D5 global polish | ✅ **Complete** — D1, D2 (2026-08-15), D3, D4, D5 (2026-08-16) |
| **E** | Screen-by-screen visual refinement, in controlled batches: E1 Authentication + Profile (2026-08-16), E2 Buyer/Marketplace (2026-08-16), E3 Cart/Checkout/Orders, E4 Seller, E5 AI Features, E6 Tracking/Returns/Notifications, E7 Admin/Analytics, E8 final cross-screen QA | ⏳ E1–E2 complete, E3–E8 not started |

---

## 4. Phase A — Design Tokens ✅ Complete (2026-08-15)

### Objective
Fix the token foundation everything else depends on. Plumbing only — no visual layout changes, no navigation/component rebuilds, no business logic changes.

### Completed tasks
1. Added the full `--sp-1` … `--sp-16` spacing scale to `global.css` (UIUX §9 values, matching what components already assumed via fallback defaults — no spacing change).
2. Added chart palette tokens `--chart-1..4`, aliased to existing brand tokens (`--brand-primary`, `--accent-marigold`, `--text-secondary`, `--info`) rather than new hex values, so dark mode and any future palette change stay automatically in sync.
3. Audited and fixed every non-existent/incorrect CSS variable reference found in the codebase (`--bg-secondary`, `--border-color`, `--color-primary`, `--color-success`, `--color-bg-secondary`) — repointed to the correct real tokens (`--bg-sunken`, `--border`, `--brand-primary`, `--success`) across 14 files.
4. Fixed PWA manifest: `theme_color` → brand primary green (`#1a6b49`), added `background_color` (warm paper canvas `#fbf8f3`) — previously plain white with no background color set.
5. Installed `lucide-react` (no icon usage changed yet — that's Phase B/D).

### Files modified
- `apps/frontend/src/app/global.css` — spacing + chart tokens added.
- `apps/frontend/vite.config.ts` — PWA manifest `theme_color`/`background_color`.
- `apps/frontend/package.json` — added `lucide-react` dependency.
- `apps/frontend/src/components/ImageUploader.tsx`
- `apps/frontend/src/features/cart/CartPage.tsx`
- `apps/frontend/src/features/catalog/AddProductPage.tsx`
- `apps/frontend/src/features/catalog/SellerProductsPage.tsx`
- `apps/frontend/src/features/catalog/EditProductPage.tsx`
- `apps/frontend/src/features/catalog/ProductImageManager.tsx`
- `apps/frontend/src/features/marketplace/ProductCard.tsx`
- `apps/frontend/src/features/marketplace/ProductDetailPage.tsx`
- `apps/frontend/src/features/profile/SettingsPage.tsx`
- `apps/frontend/src/features/returns/ReturnImageUploader.tsx`
- `apps/frontend/src/features/tracking/TrackingMap.tsx`
- `apps/frontend/src/features/admin/ReportsPage.tsx`
- `apps/frontend/src/features/analytics/SalesTrendChart.tsx`
- `apps/frontend/src/features/analytics/CategoryBreakdownChart.tsx`

### Known follow-on effect (not a bug)
Fixing broken token references means several elements that previously rendered an arbitrary fallback color (e.g. AntD default blue `#1677ff` in charts, generic grey `#f5f5f5` placeholders, off-brand green `#2f8f5b`) now render the actual brand token value. This is a small, real color shift on: chart lines/bars in Analytics and Admin Reports, image-placeholder backgrounds (cart, product cards, image uploader), the AI Store Builder dropzone border/highlight, and a few border/hairline colors. No layout, spacing, or component structure changed — only these previously-undefined colors now resolve correctly.

### Explicitly out of scope for Phase A (deferred to later phases)
- Raw hardcoded hex colors *not* behind a `var()` reference at all (e.g. delta indicators in `RevenueCards.tsx`/`AdminDashboardPage.tsx`, the Leaflet marker HTML string in `TrackingMap.tsx`, header background/border fallbacks in `SellerLayout.tsx`/`AdminLayout.tsx`/`StorefrontHeader.tsx` that already reference the *correct* token name, just with a stale fallback hex) — tracked as Phase D work.
- Any icon replacement (Lucide is installed, not yet used).
- Any layout/navigation change (Phase C).
- Chart *semantic* recoloring (which token each data series should use) — Phase A only made the tokens real and brand-correct; deciding the right series-to-token mapping per chart is Phase D.

---

## 5. Phase B — Shared & Reusable UI Components ✅ Complete (2026-08-15)

### Objective
Build the reusable component layer the 36 screens will all draw from — "build once → reuse everywhere → one source of truth" — per the UIUX doc's §33 "thin in-house layer." No navigation/layout rebuilds (Phase C), no feature-screen redesigns (Phase D/E), no route/API/business-logic changes.

### Completed tasks

**1. Consolidated status components.** `StatusChip`, `ProductStatusTag`, `OrderStatusTag`, `ReturnStatusTag` were four independent components, each with its own AntD-raw-color map (`'gold'`, `'volcano'`, `'geekblue'`, …) and no icon. Replaced with:
- **`components/StatusTag.tsx`** (new) — the one presentational primitive. Takes `variant` (`success | warning | error | info | neutral`) + `label` (+ optional icon override), renders semantic-token colors, an icon (never color alone, UIUX §23), pill shape (`--radius-pill`), spacing-scale padding via **logical properties** (`paddingInlineStart`/`paddingInlineEnd`, so the icon-side padding stays correct under RTL flex-row mirroring, not just the AntD-managed parts of the page), `--fs-xs` type.
- The four original files were kept (same names, same `status` prop, same call sites — zero edits needed at any of the 12 usage sites across catalog/orders/returns/tracking/admin/profile) but rewritten as thin adapters: each maps its own domain enum (`ProductStatus`, `OrderStatus`, etc. — genuinely different business data) to a `StatusVariant` and renders `<StatusTag>`. This keeps the domain mapping (business data) separate from the chip's presentation (now single-sourced), rather than either duplicating render logic four times or cramming four unrelated enums into one file.
- Added four semantic soft-tint background tokens to `global.css` needed to render the chips (`--success-soft`, `--warning-soft`, `--error-soft`, `--info-soft`) — not in the doc's token table, so derived using the same method as the existing `--brand-primary-soft`/`--accent-marigold-soft` (light tint of the base hue; `--success-soft` aliases `--brand-primary-soft` since §5.2 gives success and brand-primary identical values).

**2. Accessibility foundation**, added centrally to `global.css` so every current and future component inherits it with no opt-in:
- `:focus-visible { outline: 2px solid var(--brand-primary); outline-offset: 2px; }` — UIUX §23's 2px focus ring, app-wide.
- `@media (prefers-reduced-motion: reduce)` — collapses all animation/transition durations to near-zero app-wide (UIUX §25). This also transitively fixes `SkeletonLoader`'s shimmer for reduced-motion users without touching that file.

**3. Icon system.** Re-verified the Phase A audit note about "`@ant-design/icons` used directly in 2 files" — that was a **false positive** (grep matched the literal string inside code comments, not real imports); there are, and were, **zero** real `@ant-design/icons` imports anywhere in the app, so there was no AntD-icon replacement to do. The actual gap was two shared components using plain text/emoji as pseudo-icons:
- `components/QuantityStepper.tsx` — `−`/`+` text glyphs → Lucide `Minus`/`Plus`, plus `aria-label`s (optional props, English defaults, fully backward-compatible — no call site needed changes).
- `features/notifications/NotificationBell.tsx` — 🔔 emoji → Lucide `Bell`.
- New **`components/BackLink.tsx`** — a "← back to list" pattern was duplicated verbatim as a raw `←` text glyph in two catalog screens. Consolidated into one shared component using Lucide `ArrowLeft`/`ArrowRight`, **mirrored by direction** (`ArrowRight` in RTL) since a back-arrow is directional, unlike the status icons above (UIUX §7).

No AntD icons were replaced (none exist to replace); no icon-only control elsewhere was touched without a clear reusable pattern behind it (see §7 below for one deliberately deferred case).

**4. Reviewed the 8 named shared components** (`Modal`, `EmptyState`, `SkeletonLoader`, `Toast`, `PasswordStrengthMeter`, `ImageUploader`, `QuantityStepper`, `StatusChip`):
- **Modal** — two real UIUX §28 gaps found and fixed: (a) radius was inheriting AntD's global `borderRadiusLG` token (12, i.e. `--radius-md`) but §28 specifies modals at `--radius-lg` (16) — fixed with a *component-scoped* AntD token override (`components: { Modal: { borderRadiusLG: 16 } }` in `theme.ts`) so only Modal changes, not every other `borderRadiusLG` consumer (Card was already correct by coincidence); (b) §28 calls for "centered (desktop) / bottom sheet (mobile)" — the app had centered-only. Added a `global.css` block (targeting AntD's own `.ant-modal-*` classes, since every modal already renders through the one shared `Modal.tsx`) that pins modals to the bottom edge, full-width, top-corners-only radius, under a `max-width: 575px` media query. Also fixed the scrim color (AntD's neutral-black default → the warm-toned `rgba(33,29,23,.5)` §28 specifies) and applied `--shadow-lg`.
- **EmptyState, SkeletonLoader, Toast** — already token-correct (Toast's colors come from AntD `ConfigProvider`'s `colorSuccess`/`colorError`/etc., which are already the brand semantic tokens). No changes needed beyond what Phase A already fixed.
- **PasswordStrengthMeter, ImageUploader, QuantityStepper** — already/now token-correct. `QuantityStepper` got the icon treatment above.
- **StatusChip** — see #1.

**5. PWA icons.** Investigated the environment for an image-rasterization tool (checked for ImageMagick, Inkscape, `rsvg-convert`, `sharp`/`svg2png`/`puppeteer` in `node_modules`) — **none is available**, so raster PNG/maskable icons genuinely cannot be produced here. Rather than leave `icons: []` or fabricate a broken reference, created a real, on-brand, hand-authored SVG mark:
- **`public/pwa-icon.svg`** — karobar-green rounded-square background, a simple bazaar-stall silhouette (awning + counter) in warm paper cream, a marigold accent at the peak — directly pulled from the brand thesis's own language (UIUX §0: "the warmth of a Pakistani bazaar," "the marigold garlands of celebration"), not an arbitrary placeholder. Three flat shapes only, chosen to stay legible at small sizes.
- Wired into `vite.config.ts`'s manifest `icons` array (`purpose: 'any'`, `type: 'image/svg+xml'`) and added as the browser-tab favicon in `index.html` (which had no favicon at all before).
- **What's still missing:** true cross-platform coverage needs raster PNG exports — a maskable 512×512 PNG with safe-zone padding for Android adaptive icons, and a 180×180 `apple-touch-icon` PNG for iOS home-screen (iOS doesn't support SVG there). `public/pwa-icon.svg` is the source of truth to export those from once a rasterization tool/design pass is available; see §6 below.

### Files created
- `apps/frontend/src/components/StatusTag.tsx`
- `apps/frontend/src/components/BackLink.tsx`
- `apps/frontend/public/pwa-icon.svg`

### Files modified
- `apps/frontend/src/app/global.css` — soft-tint status tokens, `:focus-visible` ring, `prefers-reduced-motion` block, Modal chrome CSS (scrim, shadow, mobile bottom-sheet).
- `apps/frontend/src/app/theme.ts` — Modal-scoped `borderRadiusLG: 16` override (light + dark).
- `apps/frontend/src/components/StatusChip.tsx` — rewritten as a `StatusTag` adapter.
- `apps/frontend/src/features/catalog/ProductStatusTag.tsx` — rewritten as a `StatusTag` adapter.
- `apps/frontend/src/features/orders/OrderStatusTag.tsx` — rewritten as a `StatusTag` adapter.
- `apps/frontend/src/features/returns/ReturnStatusTag.tsx` — rewritten as a `StatusTag` adapter.
- `apps/frontend/src/components/QuantityStepper.tsx` — Lucide `Minus`/`Plus` + `aria-label`s.
- `apps/frontend/src/features/notifications/NotificationBell.tsx` — Lucide `Bell`.
- `apps/frontend/src/features/catalog/AddProductPage.tsx` — uses `BackLink`; unused `Link` import removed.
- `apps/frontend/src/features/catalog/EditProductPage.tsx` — uses `BackLink` (kept `Link` import — still used for a second, unrelated link on that page).
- `apps/frontend/src/components/index.ts` — exports `StatusTag`, `StatusVariant`, `BackLink`.
- `apps/frontend/vite.config.ts` — manifest `icons` array wired to `pwa-icon.svg`.
- `apps/frontend/index.html` — added the missing favicon `<link>`.

### Decisions made without waiting for approval (flagging for visibility)
- Added the 4 new soft-tint tokens (`--success-soft` etc.) to `global.css` — additive, needed to build `StatusTag` itself per your own spec ("semantic KarobarAI tokens... accessible contrast"), not a re-opening of Phase A's scope.
- Corrected the Phase A tracking doc's claim that 2 files "import `@ant-design/icons` directly" — that was a grep false-positive on comment text; corrected above and in §7.
- Built `BackLink` as a new shared component even though it wasn't explicitly named — it was a verbatim-duplicated pattern (a raw `←` glyph link) across 2 catalog screens, which is exactly what you asked me to consolidate rather than leave scattered.

### Deliberately left untouched (documented, not silently skipped)
- `features/catalog/ProductImageManager.tsx`'s inline image-reorder buttons (`←`/`→` text glyphs, no `aria-label`) — single-file, not a pattern duplicated elsewhere, so it didn't meet the "shared/reusable" bar for a new component in this phase. Left as a Phase D candidate (tracked in §7).
- `PasswordStrengthMeter`'s strength labels ("Too weak," "Strong," etc.) are hardcoded English, not run through i18n — a content/i18n gap, not a styling one; left alone to avoid touching locale files (which currently have your own unrelated in-progress edits) and to avoid scope creep from "component styling" into "content coverage."
- `ImageUploader`/cart/product-card thumbnails use a recurring `borderRadius: 4` that isn't on the documented radius scale (`sm`=8/`md`=12/`lg`=16). It's consistently applied (not a bug), but standardizing it would be a deliberate, visible radius change across several screens — left for a Phase D/E decision rather than changed unasked.

---

## 6. Phase C — Shared Layouts & Navigation ✅ Complete (2026-08-15)

### Objective
Build the shared application shell — header, sidebar, mobile bottom navigation, and the page-content layout that wraps them — once per pattern, configured per role (Buyer/Seller/Admin), not duplicated. No screen-content redesign, no route/API/auth/business-logic changes.

### Reusable components created
- **`components/AppShell.tsx`** — composes header + optional sidebar + content + optional bottom tabs into one consistent page structure. All three role layouts now render through this instead of each hand-building its own `<div>` tree.
- **`components/AppHeader.tsx`** — the one header shell (was three separately hand-rolled headers: `StorefrontHeader`, plus inline header markup duplicated inside `SellerLayout` and `AdminLayout`). Takes slots (`search`, `actions`, `notificationSlot`, `accountSlot`, `guestActions`) so role differences are props, not copies; builds the language switcher internally since it was byte-for-byte identical in all three originals.
- **`components/Sidebar.tsx`** — shared Seller/Admin left sidebar, configured via an `items: NavItem[]` prop. One component for both roles, not two.
- **`components/BottomTabBar.tsx`** — shared mobile bottom navigation for all three roles, same `items` pattern, with an optional numeric `badge` (used for the Buyer cart count).
- **`components/navTypes.ts`** — the `NavItem` type and one `isNavItemActive()` match rule shared by `Sidebar` and `BottomTabBar`, so "what counts as active" is defined once.

`PageHeader`/`NavigationGroup` (listed as *potential* components in your brief) weren't built — nothing in this phase needed them yet (no grouped/collapsible sidebar sections, no in-page title row being touched), and building them unused would violate "don't create unnecessary components." Revisit if Phase D/E surfaces a real need.

### Navigation architecture — "shared component → role configuration → pages"
Each role's layout file is now a thin **configuration** layer: it builds a small `NavItem[]` (`key`, `to`, `label`, `icon`, optional `badge`/`exact`) using real, already-existing routes and `common:nav.*` translation keys, and passes that array into the shared `Sidebar`/`BottomTabBar`. No markup is duplicated between roles — only data.

- **Buyer** (`StorefrontLayout.tsx`) — `AppHeader` with search + cart button + language + (bell/account or guest CTAs); `BottomTabBar` with 5 tabs: Home, Search, Cart (badged), Orders, Account. No sidebar (per the confirmed direction).
- **Seller** (`SellerLayout.tsx`) — `AppHeader` (branding + language + bell + account-dropdown only — the old inline Dashboard/Orders/Returns/Analytics header buttons were removed now that the Sidebar owns that navigation, so it isn't duplicated in two places); `Sidebar` with 6 items (Products, Orders, Returns, Analytics, Wallet, Settings); `BottomTabBar` with the same 5 minus Wallet (§15's "5 max").
- **Admin** (`AdminLayout.tsx`) — same shape; `Sidebar` with 8 items (Overview, Users, Payments, Disputes, Moderation, Reports, Configuration, Audit); `BottomTabBar` with 5 (Overview, Users, Moderation, Disputes, Config).

**Route-reality decisions, flagged for visibility (not silently invented):**
- **Seller "Dashboard" vs. "Products":** the app has no separate Seller dashboard route — `/seller` *is* `SellerProductsPage`. The doc's sidebar lists both; this app only has one real destination, so the sidebar has one item ("Products") rather than two links to the same page.
- **"Wallet" (Seller), "Payments" and "Audit" (Admin):** no dedicated screens exist yet. These resolve through the existing `/seller/*` and `/admin/*` wildcard routes (`SellerPlaceholder`/`AdminPlaceholder`, already built for exactly this "not built yet" case) rather than 404ing or being invented as fake real screens.
- **"Disputes" (Admin):** mapped onto the existing `/admin/returns` route (already titled "Returns Management"; its status enum includes `UNDER_DISPUTE`) rather than a separate screen.
- **"Reports"** isn't in the prompt's Admin list but is a real, already-built screen the old header exposed — kept in the sidebar so nothing already reachable regresses (per "make sure every existing route continues to work").
- **Mobile 5-item selection** for Seller/Admin is a judgment call (documented above) — trivial to change since it's one array per layout file, not markup.

### Responsive behavior
Pure CSS media queries against fixed breakpoints (§30: mobile <768px, tablet 768–991px, desktop ≥992px) — no JS viewport state, nothing to fall out of sync with the real viewport:
- **Sidebar:** 240px icon+label at desktop; 72px icon-only at tablet (label visually hidden via `display:none`, but the link still carries `aria-label` so it stays screen-reader accessible); `display:none` entirely below 768px.
- **BottomTabBar:** `display:none` at ≥768px; fixed to the viewport bottom, full-width, below that.
- **Content area** (`.karobarai-content-area`, applied by `AppShell` to every page automatically): `max-width: 1200px` centered per §8 — previously **completely unimplemented**, pages stretched edge-to-edge on wide screens; `padding: var(--sp-6)` desktop, `var(--sp-4)` + extra bottom clearance for the fixed tab bar on mobile.
- **Sidebar↔content relationship:** a plain flex row with the sidebar as a normal (non-fixed) flex child and content as `flex: 1` — the content area resizes itself automatically as the sidebar's width changes across breakpoints; no manual margin/width math anywhere.
- **A real bug found and fixed during verification:** `AppHeader` at mobile width originally still rendered search + cart button + guest Login/Register, overflowing a 375px viewport (confirmed via screenshot — button text was visibly clipped). Fixed by CSS-hiding the search bar and the Buyer cart button at <768px (the BottomTabBar's Search/Cart tabs already cover both, cart badge included) and splitting the header's `accountSlot` prop into `accountSlot` (always visible — logout lives only there) vs. a new `guestActions` prop (hidden at mobile, since the BottomTabBar's Account tab already routes a guest to `/login`). Re-verified clean after the fix.

### RTL implementation
No LTR/RTL branching anywhere in the new components. The app already sets the real `dir` attribute on `<html>` (`lib/languageStore.ts`, pre-existing, confirmed working) — not just an AntD-internal direction context — so plain CSS mirrors for free:
- Sidebar/content is a flex row with the sidebar as the *first* DOM child; under `dir="rtl"` the row's inline-start moves to the right, so the sidebar relocates there automatically.
- All new spacing/border uses logical properties (`padding-inline-start/end`, `border-inline-start`, `inset-inline`) — e.g. the sidebar's active-state accent bar stays on the correct (start) edge in both directions.
- Directional vs. non-directional icons follow §7: `BackLink` (Phase B) flips `ArrowLeft`↔`ArrowRight`; every icon used in `Sidebar`/`BottomTabBar` (Package, ClipboardList, Users, Settings, etc.) is deliberately non-directional and does not flip.
- **Verified visually** (Playwright screenshots, English vs. Urdu, desktop + mobile): the entire header reorders correctly (brand/search/language/account swap sides), the bottom tab bar mirrors correctly (icon order reverses, active-state styling follows the correct tab), and Urdu text in the search input right-aligns — all with zero RTL-specific code in the new components.

### Accessibility
- Every nav link carries `aria-label` (not relying on visually-hidden text alone) and `aria-current="page"` when active — active state is never color-only.
- `Sidebar`/`BottomTabBar` are `<nav>` landmarks with a distinct, translated `aria-label` per role (`common:landmarks.buyerNav/sellerNav/adminNav` — new keys, so a screen-reader user navigating by landmark can tell them apart instead of hearing "navigation" three times with no distinction).
- Focus rings are inherited for free from Phase B's centralized `:focus-visible` rule — nothing new needed here.
- Touch targets: sidebar links are `min-height: 44px`; bottom tabs are `min-height: 56px` and (at 5 tabs across any real phone width) comfortably wider than 44px.
- Animation: sidebar hover/active-state transitions reuse the existing `--dur-fast`/`--ease` tokens and are automatically stripped by Phase B's `prefers-reduced-motion` rule — nothing new to add there.

### Files created
- `apps/frontend/src/components/AppShell.tsx`
- `apps/frontend/src/components/AppHeader.tsx`
- `apps/frontend/src/components/Sidebar.tsx`
- `apps/frontend/src/components/BottomTabBar.tsx`
- `apps/frontend/src/components/navTypes.ts`

### Files deleted
- `apps/frontend/src/features/marketplace/StorefrontHeader.tsx` — folded into `StorefrontLayout.tsx` (its only caller); kept as a separate file it would just be a redundant pass-through now that `AppShell`/`AppHeader` do the actual composition.

### Files modified
- `apps/frontend/src/features/marketplace/StorefrontLayout.tsx` — rebuilt on `AppShell`/`AppHeader`/`BottomTabBar`; carries the (unchanged) role-branched account-menu logic and guest cart-merge hook that used to live partly in `StorefrontHeader`.
- `apps/frontend/src/features/seller/SellerLayout.tsx` — rebuilt on `AppShell`/`AppHeader`/`Sidebar`/`BottomTabBar`; inline header nav buttons removed (now in `Sidebar`).
- `apps/frontend/src/features/admin/AdminLayout.tsx` — same, for Admin's 8-item nav.
- `apps/frontend/src/components/AppHeader.tsx` — mid-phase fix: split `accountSlot`/`guestActions`, hid search/cart/guest-CTAs at mobile (see "responsive behavior" above).
- `apps/frontend/src/app/global.css` — all new `.karobarai-sidebar*`, `.karobarai-bottom-tabs*`, `.karobarai-content-area`, and `.karobarai-app-header-*` (mobile-hide) rules.
- `apps/frontend/src/components/index.ts` — exports the 4 new components + `NavItem` type.
- `apps/frontend/src/locales/en/index.ts`, `apps/frontend/src/locales/ur/index.ts` — additive only: 4 new `common.nav.*` keys (`search`, `wallet`, `payments`, `audit`) and a new `common.landmarks.*` block (3 keys) for the nav `aria-label`s.

### Verification performed
No project skill existed for running this app, so a one-off Playwright driver was used (browser already cached locally) against the Vite dev server: desktop guest storefront, mobile guest storefront (375px), Urdu/RTL at both widths, and `/login`+`/register` sanity. This is how the mobile header overflow bug above was actually caught — build/typecheck passing does not catch a CSS layout overflow. `console --errors` was checked on every page; the only errors were `ERR_CONNECTION_REFUSED` from the backend not running (expected — only the frontend dev server was started), unrelated to this phase's changes. Seller/Admin sidebar could not be visually verified end-to-end (routes are login-gated and no seeded credentials were available in this environment) — verified by code review instead (same `Sidebar`/`AppShell` components already proven to render and mirror correctly for Buyer).

### Decisions made without waiting for approval (flagging for visibility)
- Removed the Seller/Admin headers' inline nav buttons (Dashboard/Orders/Returns/Analytics etc.) now that `Sidebar` owns that navigation — same destinations, reached one way instead of two redundant ones.
- Added 4 new `common.nav.*` keys and a `common.landmarks.*` block to both locale files (additive only, placed away from your in-progress `cart.*` edits in the same files) — necessary to keep new nav labels bilingual rather than hardcoding English into primary navigation.
- Mid-phase `AppHeader` prop change (`accountSlot`/`guestActions` split) — driven directly by the overflow bug found during verification, not a speculative redesign.

---

## 7. Phase D — Feature-Level UI Implementation (in batches)

Phase D applies the KarobarAI visual identity to actual feature screens, one controlled batch at a time (D1–D5), each requiring separate approval before the next starts.

### D1 — Buyer / Marketplace ✅ Complete (2026-08-15)

**Objective:** Close the gap between the buyer-facing marketplace/cart/checkout screens and UIUX §4/§6.1/§12/§13/§19 (hierarchy, price prominence, card composition, empty states) without touching routes, APIs, or business logic.

**Repeated patterns found and consolidated:**
- Product grid layout (`display:grid; auto-fill minmax(180px,1fr)`) was duplicated 3× (HomePage's featured + new-arrivals sections, `SearchResultsGrid`) → **`features/marketplace/ProductGrid.tsx`** (new, feature-scoped — tightly coupled to `ProductCard`/`ProductDetailDTO`, so it stays in `features/marketplace/` rather than `components/`, per the "feature-specific is fine when the pattern genuinely belongs to one feature" rule).
- `Rs. {Number(x).toLocaleString()}` price formatting was repeated 8+ times with inconsistent typography (plain `div`, `Typography.Text`, `Typography.Title`, no consistent size hierarchy) across `ProductCard`, `ProductDetailPage`, `CartPage`, `CheckoutPage`, `CheckoutConfirmationPage` → **`components/PriceDisplay.tsx`** (new, truly shared — D3/D4 will need it too for order/GMV totals). Uses `font-variant-numeric: tabular-nums` per §6.1's "Data/numerals... tabular figures."
- An image-or-placeholder thumbnail box was hand-rolled 5× (`ProductCard`, `CartPage` ×2, `ProductDetailPage`) with inconsistent radius (`0` in one place, raw `4px` in others) and no enforced aspect ratio → **`components/ProductThumbnail.tsx`** (new, shared — `fill` mode for the §13-mandated 1:1 product-card image, fixed `size` mode for list rows like cart items).
- **`EmptyState`** (flagged as a gap back in Phase B, deferred) — added a default `PackageSearch` Lucide icon so every empty state gets the "calm line illustration" §19 requires without each call site remembering to pass one. Directly affects the Cart-empty and Search-empty states this batch touches.

**Visual identity gaps closed globally (not just in buyer files, since these are token/theme-level):**
- **§12 "Secondary" button** (outline green border/text) didn't exist anywhere — every non-primary button was AntD's generic grey default, the single biggest "reads as templated AntD" tell in the app. Fixed via `theme.ts`'s `components.Button` token override (`defaultColor`/`defaultBorderColor`/hover/active, separately per light/dark theme since the green values differ) — this is a **global** fix, so it also elevates every secondary button in Seller/Admin screens (D2–D4) automatically, not just buyer ones.
- **Card baseline depth** (§13: `shadow-sm` default, lift to `shadow-md` on hover) — AntD Cards had no shadow at all. Added two scoped rules to `global.css` (`.ant-card`, `.ant-card-hoverable:hover`) — again global, benefits every Card in the app.
- **§13 "product card image 1:1"** — `ProductCard` was a non-square `height:160` image. Now uses `ProductThumbnail fill` (real 1:1 `aspect-ratio`).
- **§13 "product card... status chip"** — a buyer previously had no way to tell a listing was unavailable without opening it. `ProductCard` now shows a `StatusTag` "Out of stock" chip when `stock<=0` or `status!=='LIVE'`; `ProductDetailPage`'s plain red text was upgraded to the same `StatusTag` for consistency (icon+label+color, never color alone).
- Replaced AntD's raw `Empty` component in `SearchResultsGrid` with the shared `EmptyState` (was the one place still bypassing it).
- Removed now-redundant per-page `maxWidth`/`padding` wrapper divs on `HomePage`, `SearchPage`, `CategoryPage` — `AppShell`'s content area (Phase C) already provides `max-width:1200px` centered + padding, so these were duplicating it. `ProductDetailPage`/`CartPage`/`CheckoutPage`/`CheckoutConfirmationPage` keep their own **narrower** `maxWidth` (960/720/640) since a checkout form stretching to 1200px would look wrong, but dropped their now-redundant padding.
- Replaced arbitrary pixel spacing (`gap: 16`, `marginTop: 32`, `padding: '12px 0'`, etc.) with the `--sp-*` scale throughout every file touched this batch.
- Cart's "below minimum order value" warning was a bare colored text line — upgraded to an `Alert type="warning" showIcon` banner, consistent with how every other warning/error surfaces in the app.

**A small bug found and fixed (not styling — a mislabeled value):** `CheckoutPage`'s per-seller order-summary row displayed `group.subtotal` next to the label `t('checkout.orderSummary')` — i.e., the row was labeled with the *section's own title* ("Order summary") instead of "Subtotal". Since this was the exact line already being touched for `PriceDisplay`, fixed it to `t('sellerGroup.subtotal')` (an existing, correct key already used identically in `CartPage`). No other functional changes.

**Files created:**
- `apps/frontend/src/components/PriceDisplay.tsx`
- `apps/frontend/src/components/ProductThumbnail.tsx`
- `apps/frontend/src/features/marketplace/ProductGrid.tsx`

**Files modified:**
- `apps/frontend/src/components/EmptyState.tsx` — default icon.
- `apps/frontend/src/components/index.ts` — new exports.
- `apps/frontend/src/app/theme.ts` — `Button` component tokens (secondary/default = green outline).
- `apps/frontend/src/app/global.css` — Card shadow baseline + hover.
- `apps/frontend/src/features/marketplace/ProductCard.tsx`, `CategoryGrid.tsx`, `HomePage.tsx`, `SearchPage.tsx`, `SearchResultsGrid.tsx`, `CategoryPage.tsx`, `FilterPanel.tsx`, `ProductDetailPage.tsx`
- `apps/frontend/src/features/cart/CartPage.tsx`, `CheckoutPage.tsx`, `CheckoutConfirmationPage.tsx`, `AddressPicker.tsx`, `AddressForm.tsx`

**Verification:** type-check clean, production build clean (2m14s, same pre-existing >500kB chunk-size warning, unrelated to this batch). Visually verified via Playwright against the Vite dev server (backend not running, so data states show skeleton/error — sufficient to verify the shell/tokens/components themselves): desktop + mobile (375px), light + dark (`prefers-color-scheme` emulation), English + Urdu/RTL, on Home and Cart (including Cart's empty state, which is the state actually reachable without a seeded backend). No horizontal overflow, no console errors beyond the expected `ERR_CONNECTION_REFUSED` (backend not running — unrelated to this batch). Secondary-button green-outline and Card shadow changes confirmed visible in both light and dark screenshots. RTL mirroring confirmed correct (header, bottom tabs) with zero RTL-specific code added — same logical-property architecture proven in Phase C. Product grid/detail data states (populated cards, stock badges, price hierarchy) were **not** visually exercised against real data — no backend/seed data available in this environment — verified by code review instead.

**Decisions made without waiting for approval (flagging for visibility):**
- The Button and Card theme changes are global (affect Seller/Admin too, not just buyer screens) — done deliberately since they're token-level fixes with no per-screen risk, and doing them once in `theme.ts`/`global.css` is the correct "one reusable implementation" approach rather than repeating inline overrides in every D-batch.
- Fixed the `checkout.orderSummary`-mislabeled-as-row-label bug (see above) rather than leaving it, since it was the exact line already being edited for `PriceDisplay`.

---

### D2 — Seller UI / AI Store Builder ✅ Complete (2026-08-15)

**Objective:** Close the gap between the seller-facing screens (dashboard/products, forms, AI Store Builder) and UIUX §22 (the flagship AI reveal), §14 (bilingual fields), §33 (`BilingualField`/`AIRevealPanel` — named explicitly in the spec but never built until now).

**The AI Store Builder reveal — the batch's centerpiece.** `AddProductPage.tsx` (SCR-S02, the flagship screen) previously showed a plain AntD `Alert`+`Spin` while generating, then populated the form instantly via `reset()` with zero animation, no marigold accent anywhere, and no "Generated by AI" hint — none of §22's signature moment existed. Rebuilt against the doc's own 10-point description:
- **`components/AIStatus.tsx`** (new) — the "AI is working" state: marigold-soft background, marigold inline-start border, a single spinning `Loader2` icon (not AntD's `Spin`, so the color could actually be marigold instead of the theme's green). Marigold is spent *only* here and in the hint below — nowhere else in the flow.
- **`components/AIRevealPanel.tsx`** (new, **named explicitly in UIUX §33**) — wraps the AI-touched fields and gives each a short staggered fade+rise (60ms apart) using the existing `--dur-slow`/`--ease` tokens, replayed on every successful generation via a `revealKey` that forces remount. Deliberately wraps **only** the fields AI actually populates (title, description, category, tags) — price/stock/condition are never AI-generated (a real backend decision, not an oversight), so animating them as part of "the reveal" would have been motion attached to nothing that changed.
- **`components/BilingualField.tsx`** (new, **also named explicitly in UIUX §33**) — the EN/UR paired layout §14 calls for ("each independently editable, each labelled by script"), side by side on desktop with a small `ArrowLeftRight` connector icon between them — a literal, minimal expression of the brand's own stated signature (§0: "the EN ⇄ اردو duality... the brand's visual fingerprint"), not a generic AI motif. Stacks (icon hidden) below 576px. Used for both the title pair and description pair, on both `AddProductPage` and `EditProductPage`.
- **`components/AIHint.tsx`** (new) — the exact "Generated by AI — edit anything" concept from §22, one small marigold `Sparkles` icon, shown once per screen.
- Same treatment applied to `EditProductPage.tsx`'s **"Generate with AI" regenerate action** — it's the same signature moment, re-triggerable on an existing product, so it gets the same `AIStatus`/`AIRevealPanel`/`AIHint`/`BilingualField` components rather than a second, cheaper implementation.
- AI failure still falls back to a fully manual, editable form exactly as before (§22's "AI failure degrades to manual entry, never a dead end") — that behavior was already correct and wasn't touched.

**A real, pre-existing bug found and fixed while rebuilding this exact code:** `EditProductPage.tsx`'s Urdu title/description inputs were missing `dir="rtl"` (present on `AddProductPage.tsx`'s equivalent fields, absent here — an inconsistency between the two forms, not a deliberate choice). Fixed as part of moving both onto `BilingualField`.

**Other seller-screen work:**
- `ProductImageManager.tsx`'s move-earlier/move-later buttons — flagged as a known deviation back in Phase B (raw `←`/`→` text glyphs, no `aria-label`) — replaced with Lucide `ArrowLeft`/`ArrowRight`, **direction-mirrored** (like `BackLink`) since reordering a visual strip is genuinely directional, plus real `aria-label`s (new `moveEarlier`/`moveLater` locale keys — previously these icon-only buttons had no accessible name at all).
- `SellerProductsPage.tsx` — table thumbnail and price cell now use `ProductThumbnail`/`PriceDisplay`; raw AntD `Empty` replaced with the shared `EmptyState` (now with a working "Add product" action — it was being passed an `actionLabel` with no `onAction`, which silently didn't render at all; wired it to navigate to the add-product screen, matching the doc's own example copy for this exact empty state).
- `StoreSetupWizard.tsx` (a seller form, explicitly in scope) — spacing tokens, redundant padding removed (shell already provides it).
- Removed redundant per-page `padding` on `AddProductPage`/`EditProductPage`/`SellerProductsPage` (kept their existing narrower `maxWidth`, same reasoning as D1).
- Fixed a `marginLeft: 'auto'` on `EditProductPage`'s trailing "Add product" link to the logical `marginInlineStart` while touching that line anyway.
- Card/Button theming from D1 (global) already applied here automatically — confirmed visually (see below) rather than assumed.

**Files created:**
- `apps/frontend/src/components/BilingualField.tsx`, `AIStatus.tsx`, `AIHint.tsx`, `AIRevealPanel.tsx`

**Files modified:**
- `apps/frontend/src/components/index.ts`, `apps/frontend/src/app/global.css` (reveal/spin keyframes, bilingual-connector mobile hide)
- `apps/frontend/src/features/catalog/{AddProductPage,EditProductPage,ProductImageManager,SellerProductsPage}.tsx`
- `apps/frontend/src/features/seller/StoreSetupWizard.tsx`
- `apps/frontend/src/locales/en/index.ts`, `apps/frontend/src/locales/ur/index.ts` — 4 new keys (`aiWizard.editAnythingHint`, `editProduct.moveEarlier`/`moveLater`), additive only.

**Verification — a real constraint, handled deliberately:** every seller route is behind `ProtectedRoute allowedRoles={['SELLER']}` plus `RequireStore`, and this environment has no backend/seeded credentials (same limitation noted in Phase C for the Seller/Admin sidebar). Since the AI reveal is this batch's centerpiece and a code-only review felt insufficient for a new CSS animation, a **temporary, self-contained preview route** (`app/__preview.tsx`, mounting `AIStatus`/`AIRevealPanel`/`BilingualField`/`AIHint` directly with mock data, no auth/API dependency) was added, screenshotted at desktop/mobile, light/dark, and LTR/RTL, then **fully deleted** before finishing — confirmed by re-running type-check and build, which reproduced the exact same output file hashes as before the preview existed. What the screenshots confirmed: the marigold `AIStatus` panel and spinner render correctly in both themes; the reveal animation and staggered entrance work; `BilingualField`'s connector icon and the whole paired layout **mirror correctly under RTL with zero RTL-specific code** (English column moves to the visual right, hint icon flips sides) — the same logical-property/flex-mirroring architecture proven in Phase C and D1, now proven a third time on a genuinely new interaction pattern; mobile stacks the EN/UR pair cleanly with the connector icon correctly hidden, no overflow. `SellerProductsPage`/`ProductImageManager`/`StoreSetupWizard`'s actual rendering (with real data) was **not** visually verified — no backend/seed data available — reviewed by code inspection instead, consistent with how D1's populated-grid states were handled.

**Decisions made without waiting for approval (flagging for visibility):**
- Added a temporary preview route to verify the AI reveal, then removed it completely — flagging the technique in case you'd rather it *not* be used again (e.g., if you'd prefer waiting for seeded credentials instead).
- `AIRevealPanel` only wraps AI-populated fields, not the whole form (see above) — a deliberate reading of "honest" motion, not a shortcut.
- Fixed the `EditProductPage` missing-`dir="rtl"` bug and the `SellerProductsPage` empty-state dead button, both on lines already being rewritten for this batch.

---

### D3 — Orders / Tracking / Returns / Notifications ✅ Complete (2026-08-16)

**Objective:** Apply the same treatment D1/D2 gave buyer/seller screens to the order lifecycle — order lists/detail, live tracking, the return wizard, and notifications — making money/status "visually obvious" (§4) and closing two hardcoded-color deviations tracked since Phase A/B.

**No new shared components this batch** — everything needed (`PriceDisplay`, `ProductThumbnail`, `StatusTag`, `EmptyState`, `BackLink`) already existed from D1/D2, which is itself a signal the earlier batches picked the right abstractions. The only additions were two small, reusable **exports** from existing files:
- **`STATUS_VARIANT_COLOR`** (in `components/StatusTag.tsx`) — the same fg color a `StatusTag` variant would use, exposed so other status-driven visuals can key off it without a second color mapping.
- **`ORDER_STATUS_VARIANT`** (in `features/orders/OrderStatusTag.tsx`) — the order-status→variant mapping, exported so `OrderDetailPage` can color its timeline dots by the same rule its own `OrderStatusTag` chip already uses.

**Consolidated a third near-duplicate of the same Timeline block.** `OrderDetailPage.tsx` had its own ~15-line inline `Timeline` render, byte-for-byte the same pattern `TrackingTimeline.tsx` (features/tracking) already encapsulated. `TrackingTimeline` now takes an optional `deliveryStageLabel` (its own call sites keep their heading; `OrderDetailPage` omits it since its `Card` already has a `title`) and an optional `colorForStatus` callback — `OrderDetailPage` passes one, coloring each timeline dot by its semantic status color (confirmed working via preview — AntD's `Timeline` `color` prop accepts a `var(--info)`-style string directly). **Deliberately passed as a prop rather than importing `ORDER_STATUS_VARIANT` directly into `TrackingTimeline`** — `TrackingTimeline` lives in `features/tracking`, which `features/orders` already imports from (for `CourierRecommendationCard`); having `features/tracking` import back from `features/orders` would create a circular feature dependency. The callback keeps the color-selection *policy* in `features/orders` (which owns it) while the *rendering* stays generic in `features/tracking`.
- Also gave each timeline entry's status text real emphasis (`Typography.Text strong`) — previously plain text, hard to scan at a glance.

**Closed two hardcoded-color deviations tracked since Phase A/B:**
- `TrackingMap.tsx`'s Leaflet marker was AntD's default blue (`#1677ff`), not the brand green — now `var(--brand-primary)` (works correctly since Leaflet inserts this HTML string into the app's real DOM, where the custom property still resolves). The white marker border stays a literal `#fff` deliberately — it needs to read against arbitrary map-tile imagery, not an app surface, so a token wouldn't be the right fix there.
- `ReturnImageUploader.tsx`'s image-count indicator used a raw `rgba(0,0,0,0.45)` — now `var(--text-secondary)`.

**Applied `PriceDisplay`/`ProductThumbnail`/`EmptyState`/`StatusTag` across the batch:**
- `OrderDetailPage`'s payment card (subtotal/shipping/commission/total — 4 rows) and item rows.
- `OrderListPage`'s total column, and its "pending manual logistics" inline `Tag color="orange"` → `StatusTag variant="warning"`.
- `CourierRecommendationCard`'s "Recommended" badge (`Tag color="blue"` → `StatusTag variant="info"` — a plain color-consistency fix, not a new "AI insight card" pattern; that's a distinct, not-yet-built feature per UIUX §22's own `[R1.1]` tag) and its per-quote cost figure.
- `ReturnWizardPage`'s review-step photos, `SellerReturnDetailPage`'s evidence photos.
- Raw AntD `Empty` → shared `EmptyState` in `OrderListPage`, `SellerReturnsPage`, `NotificationCenterPage`.

**A discovered issue, flagged rather than fixed:** `NotificationCenterPage` is the one page in the entire app not nested under any of the three role `AppShell`s (confirmed in the router — reachable by any authenticated role from the bell icon, with no single natural shell to place it in). Before this batch it had **no navigation chrome at all** — no header, no back link, nothing but the browser's own back button. Restructuring where it sits in the route tree is a Phase C-level navigation decision, out of scope for "feature-level UI polish" and risky to decide unilaterally — but leaving it a literal dead end felt worse than a minimal, contained fix, so a role-aware `BackLink` (Buyer→`/`, Seller→`/seller`, Admin/Support→`/admin`) was added, using the same already-built shared component, touching only this one file.

**Files modified** (no new files this batch):
- `apps/frontend/src/components/StatusTag.tsx`, `apps/frontend/src/components/index.ts` — `STATUS_VARIANT_COLOR` export.
- `apps/frontend/src/features/orders/{OrderDetailPage,OrderListPage,OrderStatusTag,index}.tsx`
- `apps/frontend/src/features/tracking/{TrackingTimeline,AuthenticatedTrackingPage,PublicTrackingPage,TrackingMap,CourierRecommendationCard,index}.tsx`
- `apps/frontend/src/features/returns/{ReturnWizardPage,ReturnImageUploader,ReturnStatusPage,SellerReturnsPage,SellerReturnDetailPage}.tsx`
- `apps/frontend/src/features/notifications/NotificationCenterPage.tsx`

**Verification:** type-check and build clean. Every genuinely-authenticated page in this batch (buyer/seller orders, tracking, returns, notifications) is behind login, same constraint as D2 — the one truly novel visual risk (`TrackingTimeline`'s CSS-variable-as-Timeline-color) was verified with the same temporary, fully self-deleting preview-route technique as D2 (composited `StatusTag` variants, `PriceDisplay`, `ProductThumbnail`, and a mock `TrackingTimeline` with `colorForStatus`), confirmed correct in both light and dark, then removed — build output hashes identical before/after. Populated list/detail/timeline states against real order/return data were not visually exercised (no backend/seed data), consistent with D1/D2.

**Decisions made without waiting for approval (flagging for visibility):**
- Added the `BackLink` to `NotificationCenterPage` (see above) — a UI-only fix using an existing component, not a routing change, but flagging since it touches a page whose real issue (no shell) is arguably Phase C's domain.
- `CourierRecommendationCard`'s "Recommended" badge uses `info`, not a marigold/AI treatment — a deliberate reading that this isn't the same thing as UIUX §22's distinct (and not-yet-built) `[R1.1]` AI recommendation card feature.

---

### D4 — Analytics / Admin ✅ Complete (2026-08-16)

**Objective:** Close the last "series-to-token" chart deviation tracked since Phase A, and bring Seller Analytics + the Admin Console's KPIs/reports/tables up to the same standard as D1–D3 — hierarchy, `PriceDisplay`/`StatusTag` reuse, no redundant containers.

**Fixed the chart semantic-mapping deviation (open since Phase A):** tokens were real (`--chart-1..4`) but which token each series used hadn't been reconsidered. Two real fixes, not just token swaps:
- `CategoryBreakdownChart` (single revenue series) was using `--chart-2` (marigold) — marigold means celebration/highlight (§5.1, §12), not "the only series on an ordinary revenue chart." Changed to `--chart-1` (green), matching `SalesTrendChart`'s already-correct single-series convention.
- `ReportsPage`'s Orders-vs-Returns chart had `returnCount` on `--chart-2` (marigold) alongside `orderCount` on `--chart-1` (green). A returns count isn't a "highlight" — changed to `--chart-3` (neutral), which is exactly what §18 assigns neutral grey to: "comparison/baseline" against the primary series.
- Net effect: marigold isn't used in any analytics/admin chart right now, because none of the four charts in this batch actually has a genuine celebration/highlight secondary series — using it somewhere anyway just to "use the token" would have been decoration, not signal.

**Consolidated a duplicated status implementation:** `UserManagementPage.tsx` had its own hand-rolled `STATUS_COLOR`/raw `Tag` map for `UserStatus` — the exact enum `components/StatusChip.tsx` already owns. **Did not** just swap in `<StatusChip>` verbatim, though: `StatusChip` is hardwired to `profile:status.*` wording ("Suspended — contact support," written for the account owner), while this admin screen already had its own, more appropriate `admin:userDetail.status.*` wording (plain "Suspended," correct for someone reviewing *another* user's account). Used the `StatusTag` primitive directly with a local variant map + the existing admin-specific label, preserving correct wording while still eliminating the duplicate color-mapping/raw-`Tag` implementation. Same fix applied to `ReportsPage`'s `SellerFraudFlag` "Tag color mapping" → `StatusTag`.

**Applied `PriceDisplay`/`ProductThumbnail`/`EmptyState` throughout:** `TopProductsTable`, `ReportsPage`'s GMV column, `ProductModerationPage`'s price field; return-evidence photos in `AdminReturnDetailPage`; raw AntD `Empty` → `EmptyState` in `UserManagementPage`, `ProductModerationPage`, `AdminReturnsPage`.

**Cleaned up stale token fallbacks:** `RevenueCards`/`AdminDashboardPage`'s pct-change indicators referenced `var(--success, #3f8600)`/`var(--error, #cf1322)` — the real tokens have existed since Phase A, so the AntD-default fallback hex was dead weight, not a functional bug. Simplified to `var(--success)`/`var(--error)`.

**Removed redundant containers more aggressively than D1–D3:** several pages here used `maxWidth: 1200` or `1100`, which either exactly equals or is close to `AppShell`'s own 1200px cap — for these (data-dense dashboards/tables that benefit from the full width the shell already gives them), the wrapper was dropped entirely rather than kept at a narrower value, the same call D1 made for `HomePage`/`SearchPage`.

**Files modified** (no new files — same signal as D3, the right primitives already exist):
- `apps/frontend/src/features/admin/{AdminDashboardPage,ReportsPage,UserManagementPage,ProductModerationPage,ConfigPanelPage,AdminReturnsPage,AdminReturnDetailPage}.tsx`
- `apps/frontend/src/features/analytics/{AnalyticsDashboardPage,CategoryBreakdownChart,DateRangeFilter,OrderAnalyticsCard,RevenueCards,TopProductsTable}.tsx`

**Verification:** type-check and build clean (one real type error caught and fixed along the way — `AdminUserDetailDTO.status` is typed `string`, not `UserStatus`, on the shared DTO, so the new `StatusTag` lookup needed an explicit cast). Every screen in this batch is behind Seller or Admin/Support auth — same constraint as D2/D3. Unlike D2/D3, **no temporary preview route was used this time**: every component reused here (`PriceDisplay`, `ProductThumbnail`, `StatusTag`, `EmptyState`) was already visually verified in earlier batches, and the chart changes are new *values* referencing the same already-proven `--chart-N` alias mechanism (confirmed rendering correctly since Phase A/D1) rather than a new rendering mechanism — reviewed by code instead, consistent with reserving the preview-route technique for genuinely novel visual mechanics.

**Decisions made without waiting for approval (flagging for visibility):**
- Leaving marigold out of every analytics/admin chart (see above) rather than forcing it onto a series for the sake of using the token — a judgment call about what "secondary/highlight" means, not a spec violation.
- `UserManagementPage` keeping its own admin-specific status wording instead of reusing `StatusChip` verbatim.

---

### D5 — Global Feature Polish ✅ Complete (2026-08-16)

**Objective:** Sweep whatever D1–D4 didn't reach — chiefly the auth screens (Login/Register/OTP/Forgot/Reset) and profile screens (Profile/Settings/Change Password/Store-Brand/Avatar), neither touched by any prior D-batch — plus the handful of app-wide deviations only fixable centrally: Nastaliq headings, toast duration, and `PasswordStrengthMeter`'s localization.

**A codebase-wide audit came first**, not just the auth/profile sweep: grepped the *entire* `src/` tree for raw hex colors, `rgba()`, physical-direction properties (`marginLeft/Right`, `paddingLeft/Right`, `left:`/`right:`), and un-tokenized pixel spacing. Results: **two** raw hex/rgba instances left anywhere in the app (both the same deliberate white-on-dark-overlay image badge pattern already justified in D2/D3 — left alone), **zero** physical-direction properties left (D1–D4 already caught every real one), and a small, findable set of un-tokenized spacing in files no batch had reached yet. This confirms D1–D4 already did most of the real work; D5's job was closing the last gaps, not re-doing it.

**Turned on the brand's own signature typography, app-wide, in one place.** UIUX §6 reserves Noto Nastaliq Urdu for headings — the font has been loaded since Phase A but was never actually applied anywhere. Rather than touching 30+ files' `Typography.Title` instances individually, added **one** global CSS rule: `[dir='rtl'] h1/h2/h3.ant-typography` (AntD's `Typography.Title` levels 1–3 render as literal heading tags) get Nastaliq + the required 1.9–2.0 line-height; levels 4–5 (card/section sub-headers) and all body text are untouched, matching the doc's "headings only, never body text" rule exactly. **Verified visually** via a temporary preview (since this had never been rendered anywhere before) — confirmed the rule fires only under `dir="rtl"` (LTR stays in IBM Plex Sans Arabic), h4 and body paragraphs correctly stay out of Nastaliq, no clipping, correct in both light and dark — then deleted.

**Partial fix for Toast's error-persistence gap** (§27: "errors should persist until dismissed or offer Retry"): AntD's `message` API has no true persist-until-click mode — it's always click-to-dismiss-early plus a timer, and replacing the API app-wide (40+ existing `toast.*` call sites) to get a fully persistent option was judged too large/risky for this batch. Extended `toast.error`/`toast.warning` to 6s (from AntD's 3s default) instead — a real, contained improvement, not the complete fix. The top-trailing-desktop placement half of this deviation is still open (unchanged from D1–D4's assessment — no placement option exists in AntD's `message` API at all).

**Closed the `PasswordStrengthMeter` localization gap:** was hardcoded English ("Too weak," "Strong," etc.) since Phase B. Added a `common.passwordStrength.*` block (5 keys, additive) and wired the component to `useTranslation`.

**Found and fixed one additional hardcoded-English string while sweeping auth:** `OtpVerifyPage.tsx`'s "no phone number to verify" guard message bypassed `t()` entirely — added `auth:otp.noPhoneToVerify` and wired it in.

**Revised an assumption from an earlier tracking-doc entry:** D3's deviations table had flagged `ImageUploader.tsx` as needing to "adopt `ProductThumbnail`." On actually opening the file, that's wrong — `ImageUploader`'s rect mode renders a 160×72 wide banner preview, and `ProductThumbnail` is 1:1-square-only by design (§13's product-card spec). Forcing it in would have broken banner previews. Fixed the real, narrower issue instead (a raw `borderRadius: 4` → `var(--radius-sm)`) and corrected the tracking-doc note rather than carrying the wrong plan forward.

**Auth/profile sweep:** tokenized spacing across all 5 auth screens and all 5 profile screens; removed now-redundant padding on the profile screens (`ProfilePage`, `ChangePasswordPage`, `SettingsPage` — all shell-wrapped, same reasoning as D1–D4) while *keeping* the auth screens' own padding (Login/Register/OTP/Forgot/Reset are top-level routes outside any `AppShell`, same as `PublicTrackingPage` — their padding is load-bearing, not redundant). Also fixed the dev-only `HealthIndicator` badge's one remaining physical `right:` property while already sweeping for exactly that pattern.

**Files modified** (no new files):
- `apps/frontend/src/app/global.css` (Nastaliq rule), `apps/frontend/src/app/HealthIndicator.tsx`
- `apps/frontend/src/components/{Toast,PasswordStrengthMeter,ImageUploader}.tsx`
- `apps/frontend/src/features/auth/{LoginPage,RegisterPage,OtpVerifyPage,ForgotPasswordPage,ResetPasswordPage}.tsx`
- `apps/frontend/src/features/profile/{ProfilePage,ChangePasswordPage,SettingsPage,StoreBrandTab,AvatarUpload}.tsx`
- `apps/frontend/src/locales/en/index.ts`, `apps/frontend/src/locales/ur/index.ts` (6 new additive keys: 5 `passwordStrength.*` + 1 `otp.noPhoneToVerify`)

**Verification:** type-check and build clean, both before and after the temporary Nastaliq preview was added and removed. Auth/profile screens' actual rendering wasn't visually re-verified against real data (same backend/auth constraint as every other batch) — the changes there are mechanical (spacing tokens, padding removal) and low-risk, consistent with how D1/D4 treated similarly mechanical changes.

**Decisions made without waiting for approval (flagging for visibility):**
- Scoped Nastaliq to `Typography.Title` levels 1–3 only, not 4–5 — a judgment call about where "heading" stops and "UI text" begins, explained above.
- 6s toast duration for errors/warnings as a partial fix, not the full "persist until dismissed" — a deliberate scope-vs-risk tradeoff, not an oversight.
- Revised the `ImageUploader`/`ProductThumbnail` plan from D3's tracking-doc note after actually checking the aspect ratios — flagging that a prior batch's own forward-looking note turned out to be wrong.

**With D5 complete, all of Phase D (D1–D5) is done.**

---

## 7a. Phase E — Screen-by-Screen Visual Refinement (in batches)

Phase D applied the design system to features in bulk; Phase E goes screen-by-screen to check each one genuinely looks polished against the spec, one controlled batch (role area) at a time, each requiring approval before the next starts.

### E1 — Authentication + Profile ✅ Complete (2026-08-16)

**Screen → file → route mapping** (reported before any file was touched, per the batch's own instructions):

| Screen | File | Route(s) |
|---|---|---|
| Login | `features/auth/LoginPage.tsx` | `/login` |
| Register | `features/auth/RegisterPage.tsx` | `/register` |
| OTP Verification | `features/auth/OtpVerifyPage.tsx` | `/verify-otp` |
| Forgot Password | `features/auth/ForgotPasswordPage.tsx` | `/forgot-password` |
| Reset Password | `features/auth/ResetPasswordPage.tsx` | `/reset-password?token=` |
| Profile view (Buyer & Seller) | `features/profile/ProfilePage.tsx` (embeds `AvatarUpload.tsx`) | `/buyer/profile`, `/seller/profile` |
| Settings (Buyer & Seller) | `features/profile/SettingsPage.tsx` — Buyer gets a flat notifications list; Seller gets that list plus a "Store/Brand" tab (`StoreBrandTab.tsx`) | `/buyer/profile/settings`, `/seller/profile/settings` |
| Change password (Buyer & Seller) | `features/profile/ChangePasswordPage.tsx` | `/buyer/profile/change-password`, `/seller/profile/change-password` |

`ProfilePage`/`SettingsPage`/`ChangePasswordPage` are shared components mounted under two route prefixes, not six separate screens. No admin self-profile screen exists (by design, per F2-profiles-backend.md).

**Audit finding driving this batch:** D5 (2026-08-16) had already swept auth/profile for spacing tokens, but that was mechanical only. A full screen-level look found the 5 auth screens each hand-rolling an identical `maxWidth:420, margin:'0 auto', padding:'var(--sp-6)'` div — repeated **11 times** across the 5 files for their various success/error sub-states — with **no Card surface at all** (a real gap against §13, since every other detail/settings screen in the app wraps content in a `Card`), no brand mark, and a language switcher that existed only on Register (built ad hoc, inline) — every other auth screen had no way to switch languages, a real gap against §15 ("language switch always reachable"). Profile/Settings/StoreBrandTab similarly bypassed the app's own established "wrap each section in a `Card`" convention (already used throughout `OrderDetailPage`, `ConfigPanelPage`) — they were bare `Typography.Title` + `<div>` sections. Labels across every touched form were plain `<label>` tags with no `htmlFor`/`id`, failing §23's "labels programmatically associated."

**What changed:**
- **New `features/auth/AuthLayout.tsx`** — the one shared chrome for all 5 auth routes: brand wordmark (`KarobarAI`, linking home, same treatment as `AppHeader`'s — these routes render outside `AppShell`/`AppHeader` entirely, App Flow's literal top-level auth paths), a language switcher (now always reachable, not just on Register), and a `Card` surface (`--radius-md`, `--shadow-sm` via the app's existing `.ant-card` global rule) wrapping the form content. Replaces all 11 duplicated wrapper divs. `title`/`subtitle` are optional props so success/error/edge-case sub-states (already-used-token invalid, missing token, no-phone-to-verify, etc.) get the same consistent chrome instead of a bare canvas.
- **Login/Register/OTP/Forgot/Reset Password** rebuilt on `AuthLayout`. Register's ad hoc inline language `Segmented` removed (now provided once by `AuthLayout` for all 5 screens, not duplicated). Footer links (Forgot password?, Register/Login cross-links) moved below the Card, matching how a bounded form + below-card links reads in a typical auth pattern rather than everything floating inside one undifferentiated block.
- **`ProfilePage`** — Avatar + `Descriptions` now wrapped in a `Card`, matching the convention already established elsewhere (`OrderDetailPage`, `ConfigPanelPage`). Removed a stale `padding: 'var(--sp-6, 24px)'` fallback (this page is `AppShell`-wrapped; the content area already provides padding — D5's note that profile padding was already cleaned up didn't fully catch this one line).
- **`SettingsPage`** — the notifications list (language + 4 toggle rows) now renders inside a single `Card` (used both for Buyer's flat layout and inside the Seller's "Notifications & Language" tab pane). Removed the trailing border on the last row.
- **`StoreBrandTab`** — the 4 logical sections (Business information, Logo, Banner, Store status) each now get their own `Card` with a `title`, exactly matching `ConfigPanelPage`'s per-section-`Card` pattern, instead of bare `Typography.Title level={5}` + `<div>` blocks with no surface.
- **`ChangePasswordPage`** — form wrapped in a `Card` (this page lives inside `AppShell`, so it does *not* use `AuthLayout`, which is for the 5 top-level, shell-less auth routes only).
- **Accessibility: every touched text/password input** (auth's 5 screens + `ChangePasswordPage` + `StoreBrandTab`'s 2 fields) now has a real `id`, a `<label htmlFor>` pointing at it, and `aria-invalid`/`aria-describedby` wired to the error text's own `id` when a validation error is present — closing a real §23 gap ("labels programmatically associated... errors announced") that existed since these screens were first built. The OTP 6-box input also gained an `aria-label`.
- No auth/business logic, API calls, routing, validation, i18n architecture, or Zustand/TanStack Query behavior changed — every edit is presentational (JSX structure/wrapping + `id`/`aria-*` attributes only).

**Reusable components:**
- **`AuthLayout`** (new) — see above. The batch's one new shared component; everything else needed (`Card`, `PasswordStrengthMeter`, existing spacing/color tokens) already existed.

**Visual improvements:** the 5 auth screens go from an unstyled form floating on bare canvas to a bounded, elevated Card with a visible brand identity and a consistently reachable language switcher — the single biggest "doesn't look like a finished KarobarAI screen yet" gap this batch found. Profile/Settings/Store-Brand read as a coherent set of sections instead of a flat list of headings, consistent with the rest of the app's settings-style screens (`ConfigPanelPage`).

**Files created:**
- `apps/frontend/src/features/auth/AuthLayout.tsx`

**Files modified:**
- `apps/frontend/src/features/auth/{LoginPage,RegisterPage,OtpVerifyPage,ForgotPasswordPage,ResetPasswordPage}.tsx`
- `apps/frontend/src/features/profile/{ProfilePage,SettingsPage,ChangePasswordPage,StoreBrandTab}.tsx`

No locale keys added or changed — no new copy was introduced (Urdu parity re-confirmed 1:1 against the English `auth`/`profile` namespaces before starting).

**Verification:**
- Type-check: clean (`tsc --noEmit`).
- Build: clean, same pre-existing >500kB chunk-size warning as every prior phase, unrelated to this batch.
- Lint: no lint rules configured yet for `apps/frontend` (unchanged from prior phases).
- **Browser rendering:** unlike every prior phase, a real backend was reachable in this environment (`localhost:4000`, confirmed via the dev-only `HealthIndicator` badge and `netstat`), so this batch was verified against **real authenticated data**, not just guest-reachable states. Used a temporary Playwright driver (installed to a scratch directory, not the repo — no `package.json`/lockfile changes) to: register a real Buyer and a real Seller (email method, which issues a session immediately), complete the Seller's store-setup wizard via the real UI form, then log in and screenshot every E1 screen. Two script-only bugs were found and fixed during this process (both in the test driver, not the app): (1) `waitForLoadState('networkidle')` after a login click doesn't wait for the SPA's client-side redirect, so an immediate `page.goto()` was cancelling the in-flight login request before the session cookie was set; (2) the in-memory language store resets to the account's saved language on every full-page navigation, so Urdu had to be re-selected per screen, not once after login.
- **Desktop** (1280px) and **Mobile** (375px): both clean, no horizontal overflow, no clipped content, full-width primary buttons and appropriately sized cards on mobile.
- **Light mode** and **Dark mode** (`prefers-color-scheme` emulation): both correct — dark uses the lightened brand green/warm near-black tokens as specified, no hardcoded colors.
- **English** and **Urdu/RTL**: confirmed on all 8 E1 screens — header/sidebar/card content mirrors correctly, `Typography.Title` headings render in Nastaliq under `dir="rtl"` (the existing global rule, unchanged), form rows and Segmented controls right-align correctly, all with zero new RTL-specific code (the same logical-property/token architecture proven since Phase C).
- **Accessibility:** every touched label is now programmatically associated with its input; verified via code (real `id`/`htmlFor` pairs, `aria-invalid`/`aria-describedby` wired to conditionally-rendered error text). Full screen-reader/keyboard-nav testing wasn't performed (no such tooling available in this environment) — same limitation as prior phases.
- One screenshot-tooling artifact, not an app bug: on a page taller than one mobile viewport, a full-page (stitched) screenshot captures the `position: fixed` `BottomTabBar` at its single on-screen location, which can appear to "float" mid-image in the composite. A shorter page (e.g. `ChangePasswordPage`) confirms the tab bar is correctly pinned to the viewport bottom in the live app — this is purely how full-page screenshot stitching handles fixed-position elements, not a real layout defect.

**Issues / remaining gaps:**
- OTP-with-a-real-phone-number and Reset-Password-with-a-valid-token are the only two E1 states that couldn't be exercised end-to-end (they need a real SMS OTP / a real emailed reset token, neither obtainable in this environment). Both routes' *reachable* states (no-phone-to-verify, missing-token, token-invalid, and the form itself before submission) were verified; the two unreachable states are unchanged by this batch (no logic touched) and were previously verified by code review only, same as prior phases.

**Decisions made without waiting for approval (flagging for visibility):**
- Building `AuthLayout` as feature-scoped (`features/auth/`, not `components/`) — it composes the brand wordmark + language switcher + Card specifically for the 5 shell-less auth routes' layout problem, not a general-purpose primitive other features would reach for (same reasoning D1 used for `ProductGrid`).
- Adding `id`/`htmlFor`/`aria-invalid`/`aria-describedby` to every touched form field — not explicitly named in the brief, but directly required by the batch's own audit checklist ("labels associated with inputs") and by UIUX §23; scoped only to files this batch already touches, not applied app-wide.
- Wrapping `ProfilePage`/`SettingsPage`/`StoreBrandTab` sections in `Card` — inferred from the app's own existing convention (`ConfigPanelPage`, `OrderDetailPage`) rather than the UIUX doc naming Profile/Settings explicitly; flagging in case a different section-grouping is preferred.

---

### E2 — Buyer / Marketplace ✅ Complete (2026-08-16)

Root-caused and fixed the Marketplace's "generic Ant Design template" problem (an anchor-style reset missing from `ProductCard`/`CategoryGrid`'s links, causing every product/category title to render as a raw underlined hyperlink), rebuilt `ProductCard`/`CategoryGrid` with real hierarchy and category icons, closed a UIUX §20 loading-state gap with a new grid-shaped `ProductGridSkeleton`, and fixed a genuine dark-mode regression (`ProductThumbnail`'s fallback icon) found during this batch's own verification. Full detail, screen mapping, before/after analysis, and verification records live in the dedicated report: **[`docs/PHASE-E2-MARKETPLACE-REPORT.md`](./PHASE-E2-MARKETPLACE-REPORT.md)**.

---

## 8. Decisions Requiring Approval

| Decision | Context | Status |
|---|---|---|
| PWA app icons — raster PNG/maskable/apple-touch-icon exports | A real on-brand SVG (`public/pwa-icon.svg`) is now wired in and functional for Chrome/Android install + browser favicon. Full cross-platform coverage (Android maskable adaptive icon, iOS `apple-touch-icon`) needs PNG exports, which no tool in this environment can produce (checked ImageMagick/Inkscape/rsvg-convert/sharp — none installed). | **Open** — needs either an image-rasterization tool made available, or PNGs exported externally from the provided SVG. |
| Seller/Admin nav: sidebar vs. top-bar | Resolved 2026-08-15 — build the documented sidebar + bottom-tabs system; do not amend the spec. | ✅ Decided and built in Phase C. |
| Seller "Dashboard"/"Products" merge, "Wallet"/"Payments"/"Audit" routing to placeholders, "Disputes"→`/admin/returns` mapping | See Phase C write-up above — all driven by real route availability, not invented screens. | Flagged for your review; easy to adjust (one array per layout file) once real screens exist. |
| Mobile bottom-tab 5-item selection for Seller/Admin | A judgment call where the doc didn't fully specify (Admin mobile set especially). See Phase C write-up. | Flagged for your review. |

---

## 9. Known UI/UX Deviations from `KarobarAI-04-UIUX.md` (tracked, not yet fixed)

| Deviation | Spec reference | Target phase |
|---|---|---|
| Toast (AntD `message`) is top-center only — §27 calls for top-trailing on desktop (flipping in RTL); AntD's `message` API has no placement option at all (a hard library limitation, not something any batch skipped) | §27 | Open — would need a custom toast implementation to fully close; not a screen-level fix, so not naturally E's job either |
| Toast duration/persistence doesn't fully match "persist until dismissed" — errors/warnings now get 6s (up from AntD's 3s default) rather than AntD's default, which is a real improvement but still auto-dismisses eventually | §27 | Open — same API constraint as above |
| Seller "Dashboard"/"Products" merged into one nav item (no separate dashboard route exists); "Wallet"/"Payments"/"Audit" resolve to placeholder screens (no dedicated screens exist yet) | §15 | Once real screens exist, point the nav at them |
| `NotificationCenterPage` isn't nested under any of the three role `AppShell`s — got a minimal `BackLink` fix in D3, but the underlying "which shell should this page use" question is unresolved | §10 (nav structure) | Needs a decision — see D3 write-up |
| Seller/Admin sidebar/bottom-tabs, and every batch's populated-data states (product grids, order/return lists, AI reveal, tracking timelines, analytics/admin dashboards), not end-to-end visually verified against real data (no seeded backend was available during Phase D) — verified by code review, and for genuinely novel visual mechanics (D2's reveal, D3's Timeline coloring, D5's Nastaliq rule), a temporary isolated preview (see D2/D3/D5 write-ups). **Exception:** auth/profile screens *were* verified against real registered-account data in E1 (2026-08-16), once a backend became reachable in this environment — removed from this row for that screen set. | §10, §13, §15, §22 | Verify Seller/Admin populated-data states once credentials/seed data are available |

**Fixed in E1** (removed from this table): the 5 auth screens had no `Card` surface at all (bare canvas) and only Register had a language switcher — consolidated into the new shared `AuthLayout`; `ProfilePage`/`SettingsPage`/`StoreBrandTab` bypassed the app's own established per-section `Card` convention; every touched form's `<label>` had no `htmlFor`/`id` association (§23 gap since these screens were first built).
**Fixed in D5** (removed from this table): `.font-nastaliq`/Nastaliq headings were defined and loaded but never applied anywhere — now live app-wide via one global rule; logical-CSS-properties sweep confirmed zero remaining physical-direction properties anywhere in the app; `PasswordStrengthMeter`'s hardcoded English labels; `ImageUploader.tsx`'s raw `borderRadius: 4` (not merged into `ProductThumbnail` as an earlier note assumed — that assumption was wrong, see D5 write-up); an additional hardcoded-English string found in `OtpVerifyPage.tsx` while sweeping.
**Fixed in D4** (removed from this table): chart series were using the marigold token for non-highlight series (`CategoryBreakdownChart`'s single revenue series, `ReportsPage`'s returns line) — reassigned to green/neutral per §18; `RevenueCards`/`AdminDashboardPage`'s stale AntD-default hex fallbacks on already-real tokens; `UserManagementPage`'s hand-rolled `STATUS_COLOR`/raw `Tag` duplicating `StatusChip`'s job; `ReportsPage`'s fraud-flag `Tag` likewise.
**Fixed in D3** (removed from this table): `TrackingMap.tsx`'s marker was AntD default blue, not brand green; `ReturnImageUploader.tsx` had a raw `rgba()` text color; `OrderDetailPage.tsx` duplicated `TrackingTimeline`'s rendering inline instead of reusing it; `CourierRecommendationCard`'s "Recommended" badge and `OrderListPage`'s "pending logistics" tag used raw AntD colors instead of `StatusTag`.
**Fixed in D2** (removed from this table): AI Store Builder had no reveal animation, no marigold accent, no "Generated by AI — edit anything" hint (§22); no `BilingualField`/`AIRevealPanel` existed despite being named in §33; `ProductImageManager.tsx`'s reorder buttons were raw `←`/`→` glyphs with no `aria-label`; seller-side thumbnails (`SellerProductsPage`, `ProductImageManager`, `AddProductPage`'s staged-image preview) used ad hoc raw radius instead of `ProductThumbnail`.
**Fixed in D1** (removed from this table): no §12 "Secondary" outline-green button anywhere in the app (global fix via `theme.ts`); Card had no shadow at all (global fix via `global.css`); `ProductCard` wasn't 1:1 and showed no out-of-stock indicator; `EmptyState` had no default illustration icon; redundant per-page width/padding wrappers duplicating `AppShell`'s content area.
**Fixed in Phase C** (removed from this table): no sidebar for Seller/Admin, no bottom tab bar for any role, three duplicated hand-rolled headers, and the content area having no max-width/centering at all (§8).
**Fixed in Phase B** (removed from this table): the four duplicated status-tag components, missing `:focus-visible` ring, missing `prefers-reduced-motion` handling, `lucide-react` installed-but-unused, Modal's radius/scrim/shadow/mobile-bottom-sheet gap, missing PWA/favicon icon.

---

## 10. Change Log

- **2026-08-16** — Phase E batch E2 (Buyer/Marketplace) completed. Full detail in the dedicated [`PHASE-E2-MARKETPLACE-REPORT.md`](./PHASE-E2-MARKETPLACE-REPORT.md), not duplicated here — summary: fixed the anchor-style bug behind the Marketplace's "generic template" look, rebuilt `ProductCard`/`CategoryGrid`, added `SectionHeader` + `ProductGridSkeleton`, fixed a dark-mode `ProductThumbnail` regression and a `HomePage` duplicate-CTA bug, tightened mobile grid density. 2 new files, 10 modified. Verified against real seeded backend data across light/dark/desktop/mobile/EN/Urdu-RTL.
- **2026-08-16** — Phase E batch E1 (Authentication + Profile) completed — **Phase E's first batch.** Closed the biggest visual gap found in the whole app so far: the 5 auth screens (Login/Register/OTP/Forgot/Reset) each hand-rolled an identical wrapper div 11 times across the 5 files with no `Card` surface at all and a language switcher that only existed on Register — consolidated into a new shared `features/auth/AuthLayout.tsx` (brand wordmark + always-reachable language switcher + `Card`). `ProfilePage`/`SettingsPage`/`StoreBrandTab` brought into the app's own established per-section `Card` convention (already used by `ConfigPanelPage`/`OrderDetailPage`), which they'd bypassed since first built. Added real `id`/`htmlFor`/`aria-invalid`/`aria-describedby` to every touched form field, closing a §23 accessibility gap. Verified against **real authenticated data** for the first time in any phase — a backend was reachable in this environment, so a temporary Playwright driver registered real Buyer/Seller test accounts, completed store setup, and screenshotted all 8 E1 screens across light/dark, desktop/mobile, and English/Urdu-RTL (two script-only bugs found and fixed in the test driver along the way, not the app). 1 new file, 9 modified, 0 new locale keys. Type-check/build verified green.
- **2026-08-16** — Phase D batch D5 (Global Feature Polish) completed — **Phase D (D1–D5) is now fully complete.** Audited the entire codebase for raw colors/physical-direction CSS/un-tokenized spacing (confirmed D1–D4 had already caught nearly everything; only two deliberate, already-justified overlay-badge colors and zero physical-direction properties remained anywhere). Turned on the brand's Nastaliq heading typography app-wide via one global CSS rule (`[dir='rtl'] h1/h2/h3.ant-typography`) instead of touching 30+ files individually — verified via temporary preview that it fires correctly under RTL only, stays out of h4/body text, and doesn't clip, in both themes. Extended toast error/warning duration to 6s (partial fix for §27's persistence gap — full fix would need replacing AntD's `message` API, judged too large for this batch). Localized `PasswordStrengthMeter` (hardcoded English since Phase B) and one additional hardcoded string found in `OtpVerifyPage`. Swept and tokenized all 5 auth screens and all 5 profile screens (neither touched by any prior D-batch), correcting an earlier tracking-doc assumption about `ImageUploader`/`ProductThumbnail` along the way (they don't actually fit — different aspect ratios). 0 new files, 17 modified, 6 new additive locale keys. Build/typecheck verified green before and after the temporary preview.
- **2026-08-16** — Phase D batch D4 (Analytics/Admin) completed: closed the chart series-to-token deviation open since Phase A (`CategoryBreakdownChart`'s single series and `ReportsPage`'s returns line were on the marigold token meant for celebration/highlight, not ordinary metrics — reassigned to green/neutral per §18; net effect, marigold isn't used in any analytics/admin chart because none has a genuine highlight series, a deliberate reading rather than a gap). Consolidated `UserManagementPage`'s hand-rolled user-status color map into the `StatusTag` primitive (kept its own correct admin-specific wording rather than reusing `StatusChip` verbatim, which carries buyer/seller-facing copy) and `ReportsPage`'s fraud-flag tag likewise. Applied `PriceDisplay`/`ProductThumbnail`/`EmptyState` throughout. Cleaned up stale AntD-default hex fallbacks on tokens that have been real since Phase A. Removed redundant page-width wrappers that duplicated `AppShell`'s own cap. No new files — every primitive needed already existed, verified by code review since everything reused here was already visually proven in earlier batches. 0 new files, 13 modified. Build/typecheck verified green (one real type error found and fixed: a shared DTO types `status` as plain `string`, needing an explicit cast for the new `StatusTag` lookup).
- **2026-08-16** — Phase D batch D3 (Orders/Tracking/Returns/Notifications) completed: applied `PriceDisplay`/`ProductThumbnail`/`EmptyState`/`StatusTag` across order lists/detail, tracking, the return wizard, and notifications — no new components needed, confirming D1/D2 picked the right abstractions. Consolidated a third duplicate of the order-timeline rendering (`OrderDetailPage`'s inline block → reuses `TrackingTimeline`, now with optional heading + per-status dot coloring via a new `colorForStatus` prop, deliberately prop-injected rather than importing `features/orders` into `features/tracking` to avoid a circular feature dependency). Fixed two hardcoded-color deviations tracked since Phase A/B (`TrackingMap`'s AntD-blue marker → brand green; `ReturnImageUploader`'s raw `rgba()` text). Added two small reusable exports (`STATUS_VARIANT_COLOR`, `ORDER_STATUS_VARIANT`). Discovered and partially addressed (flagged, not fully resolved) that `NotificationCenterPage` has no navigation shell at all — added a role-aware `BackLink` as a minimal fix, left the underlying "which shell" question for a decision. Verified the one genuinely novel visual mechanic (CSS-variable Timeline coloring) via the same temporary self-deleting preview technique as D2. 0 new files, 18 modified. Build/typecheck verified green.
- **2026-08-15** — Phase D batch D2 (Seller UI / AI Store Builder) completed: built the UIUX §22 signature AI reveal on both `AddProductPage` (first generation) and `EditProductPage` (regenerate) — `AIStatus` (marigold working-state panel), `AIRevealPanel` (staggered entrance, replayed per generation via a remount key), `BilingualField` (paired EN⇄UR layout with a connector icon), `AIHint` ("Generated by AI — edit anything"); `AIRevealPanel`/`BilingualField` are both named explicitly in UIUX §33 but hadn't been built until now. Fixed a real bug found while rebuilding this code (`EditProductPage`'s Urdu fields were missing `dir="rtl"`, unlike `AddProductPage`'s). Replaced `ProductImageManager`'s raw `←`/`→` reorder glyphs (a deviation flagged back in Phase B) with direction-mirrored Lucide icons + real `aria-label`s. Applied `ProductThumbnail`/`PriceDisplay`/`EmptyState` to `SellerProductsPage`'s table (also fixing a dead empty-state action button found in the process). Verified the reveal animation/RTL mirroring via a temporary, fully self-cleaning preview route (seller screens are auth-gated and this environment has no backend/seed data) — confirmed correct in light/dark and LTR/RTL, then deleted, with build output hashes identical before/after to confirm no residue. 4 new files, 9 modified. Build/typecheck verified green both before and after cleanup.
- **2026-08-15** — Phase D batch D1 (Buyer/Marketplace) completed: consolidated 3 duplicated product-grid layouts into `ProductGrid`, 8+ duplicated price-formatting call sites into `PriceDisplay`, and 5 duplicated image-or-fallback boxes into `ProductThumbnail`; added a default illustration icon to `EmptyState`; closed the §12 "Secondary button" and §13 "Card shadow"/"1:1 product image"/"status chip" gaps, the last two globally via `theme.ts`/`global.css` so Seller/Admin benefit too; removed per-page width/padding wrappers now redundant with `AppShell`'s content area; fixed a mislabeled checkout summary row found while editing the same line. 3 new files, 15 modified. Build/typecheck verified green; visually verified (Playwright) at desktop/mobile, light/dark, EN/Urdu-RTL — no overflow, no unexpected console errors, secondary-button and card-shadow changes confirmed in both themes.
- **2026-08-15** — Phase C completed: built the shared application shell — `AppShell`, `AppHeader`, `Sidebar`, `BottomTabBar`, `navTypes` — replacing three separately hand-rolled headers/layouts with one configurable set. Buyer gets top-nav + 5-tab mobile bar; Seller/Admin get a left sidebar (icon-only at tablet, hidden on mobile in favor of their own 5-tab bars). Added the §8 content-area max-width/centering that didn't exist before. Verified RTL mirroring end-to-end via Playwright screenshots (no JS RTL branching needed — the app's existing `dir="rtl"` on `<html>` plus logical CSS properties handle it automatically); found and fixed a real mobile header overflow bug in the process. Deleted `StorefrontHeader.tsx` (folded into `StorefrontLayout.tsx`). 5 new files, 1 deleted, 8 modified, 4 new bilingual nav/landmark locale keys. Build/typecheck verified green.
- **2026-08-15** — Phase B completed: consolidated 4 duplicated status-tag components into one shared `StatusTag` primitive (+4 new soft-tint tokens); added centralized `:focus-visible` ring and `prefers-reduced-motion` handling; introduced Lucide icons in `QuantityStepper`/`NotificationBell` and a new shared `BackLink` component; reviewed all 8 existing shared components and fixed Modal's radius/scrim/shadow/mobile-bottom-sheet gaps against UIUX §28; created an on-brand SVG app icon and wired it into the PWA manifest + favicon (PNG/maskable exports still pending — no rasterization tool available). Build/typecheck verified green. 2 new files, 12 modified.
- **2026-08-15** — Phase A completed: spacing + chart design tokens added; 5 categories of broken/incorrect CSS variable references fixed across 14 files; PWA manifest brand colors fixed; `lucide-react` installed. Build/typecheck verified green. This document created.
