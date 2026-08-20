# E4 Report — Seller Experience

**Date:** 2026-08-19
**Status:** ✅ Complete

---

## 1. E4 Overview

E4 covers the Seller Experience: Dashboard, Product Management (list/Add/Edit), Seller Orders/Order Details, Customers (checked — doesn't exist), Analytics, Profile/Settings (already redesigned in E1, verified not re-touched), and Seller Navigation (desktop sidebar + mobile bottom tabs).

The single biggest structural finding: **there is no separate `/seller/dashboard` route** — `SellerLayout.tsx`'s own existing code comment documents this as a deliberate Phase C decision ("Products doubles as the Seller's dashboard/landing item"), not an oversight. Rather than reverse that decision by inventing a new route (a much bigger structural change than "smallest necessary"), the "at a glance" dashboard summary the brief asks for was added to the top of the existing `/seller` landing page (`SellerProductsPage.tsx`), above the product table.

A real, crashing bug was found and fixed during implementation (a React Query cache-key collision — see §8) — caught by live browser testing, not type-checking, and confirms why the brief's "verify functionality" step matters beyond a clean `tsc` run.

---

## 2. Screens Covered

| Screen ID | Screen Name | Route | File |
|---|---|---|---|
| — | Seller Dashboard | `/seller` | `features/catalog/SellerProductsPage.tsx` — **same file/route as Products**, no separate dashboard route exists (see §1) |
| SCR-S01/S02 | Seller Products | `/seller` | `features/catalog/SellerProductsPage.tsx` |
| SCR-S02 | Add Product | `/seller/products/new` | `features/catalog/AddProductPage.tsx` |
| SCR-S03/S04 | Edit Product | `/seller/products/:productId/edit` | `features/catalog/EditProductPage.tsx` |
| SCR-S05 | Seller Orders | `/seller/orders` | `features/orders/SellerOrdersPage.tsx` → shared `OrderListPage.tsx` (`scope="seller"`) — refined in E3 |
| SCR-S06 | Seller Order Details | `/seller/orders/:id` | `features/orders/SellerOrderDetailPage.tsx` → shared `OrderDetailPage.tsx` (`scope="seller"`) — refined in E3 |
| — | Customers / Customer Details | — | **Does not exist anywhere in the codebase** — confirmed via full-repo search (only a `CustomerAnalyticsCard` inside Analytics, not a management screen). Out of scope per your own brief's conditional wording. |
| SCR-S08 | Seller Analytics | `/seller/analytics` | `features/analytics/AnalyticsDashboardPage.tsx` (+6 widget components) |
| — | Seller Profile / Settings | `/seller/profile`, `/seller/profile/settings` | shared `ProfilePage.tsx`/`SettingsPage.tsx`/`StoreBrandTab.tsx` — already redesigned in E1, verified still correct, not re-touched |
| — | Seller Navigation | wraps all above | `features/seller/SellerLayout.tsx` (Sidebar desktop, BottomTabBar mobile — built in Phase C) |

---

## 3. Changes Made

**Seller Dashboard / Products (`SellerProductsPage.tsx`)** — the centerpiece of this batch:
- Added a "Welcome back, {store name}" header (reuses the already-fetched `getProfile` data used elsewhere in the app).
- Added a 3-tile metric row (Total products, Live, Out of stock) computed from product data. **Deliberately shown only once the full unfiltered catalog is confirmed loaded** (`!nextCursor`) — there's no dedicated count endpoint, so a count next to "Load more" would risk understating it; correctness was prioritized over always showing a number.
- Added a "Recent orders" card (up to 3, reusing the exact `listSellerOrders` call `SellerOrdersPage` already makes) with its own empty state, linking to the full Orders list.
- Added a quick-actions row (Add product / Orders / View analytics).
- **Deliberately no revenue metric** — `RevenueCards.tsx`'s own code comment documents that revenue reads "Rs. 0" for every real seller until a settlement engine exists; surfacing it on the dashboard would look like a bug.
- Replaced the hand-rolled title+button row with the new `PageHeader` component.
- Added a mobile card-list view for the product table (same table/card CSS toggle pattern E3 built for Orders) — the existing table had no horizontal-scroll containment or mobile alternative at all.

**Add Product (`AddProductPage.tsx`)**:
- Replaced `BackLink`+title with `PageHeader`.
- Added `id`/`htmlFor` to the category and tags fields (previously plain `<label>` with no programmatic association — same accessibility gap pattern closed elsewhere in E1).
- Grouped price/stock/condition into a titled "Pricing & inventory" `Card` — previously three ungrouped fields floating below the AI-generated fields with no visual separation.

**Edit Product (`EditProductPage.tsx`)**:
- Replaced the hand-rolled back-link+title+status row with `PageHeader` (status chip as a trailing action).
- Added `id`/`htmlFor` to price/stock/condition/category/tags fields.
- Grouped the same five fields into the same "Pricing & inventory" `Card`, for consistency with Add Product.
- **Visually de-emphasized the Delete action**: previously a `danger`-styled bordered button sitting at equal visual weight directly beside "Unpublish"/"Add product." Now Publish/Unpublish and Add-product stay grouped and prominent on the leading side; Delete is a `type="text"` (no border/fill) red link, separated to the trailing edge — matching your brief's "make destructive actions less easy to trigger accidentally" without touching the existing confirm-modal safeguard, which was already correct and untouched.

**Analytics (`TopProductsTable.tsx`)**: added `scroll={{ x: true }}` — the table had no horizontal-scroll containment and could overflow the page on a narrow phone. Everything else in Analytics (`RevenueCards`, `SalesTrendChart`, `CategoryBreakdownChart`, `OrderAnalyticsCard`, `CustomerAnalyticsCard`, `DateRangeFilter`) was reviewed and found already token-correct and well-composed from Phase D4 — no changes needed.

**Seller Orders / Order Details**: not modified in E4 — both are the shared `OrderListPage`/`OrderDetailPage` components E3 already gave the responsive table/card toggle and the reordered detail hierarchy. Reviewed the seller-specific branches (`CourierRecommendationCard`, the cancel action, the commission line) — all unchanged and functioning correctly for `scope="seller"`.

**Profile / Settings**: reviewed, confirmed still correct from E1's work. Not modified.

---

## 4. Seller Navigation Changes

**No changes made** — reviewed `SellerLayout.tsx`'s existing `Sidebar` (desktop: Products, Orders, Returns, Analytics, Wallet, Settings) and `BottomTabBar` (mobile: same 5, minus Wallet, per UIUX §15's "5 max") and found it already matches your brief's own priority list (Dashboard/Products, Orders, Analytics as the top items) and already handles desktop-vs-mobile as an intentional pattern (icon+label sidebar → 5-item bottom tabs), not a naive shrink — this was built deliberately in Phase C. Verified via screenshots at every breakpoint tested (see §9) that it renders correctly, including full RTL mirroring (sidebar relocates to the right, active-state accent bar follows).

---

## 5. Components Created / Updated

**Created:**
- `components/PageHeader.tsx` — page-level title row (optional back-link + title + trailing actions/status). Named explicitly as a candidate reusable component in your brief ("Seller page header"). Used in `SellerProductsPage`, `AddProductPage`, `EditProductPage`.
- `components/MetricCard.tsx` — a plain-count tile (label + large tabular number, optional warning tone) distinct from `RevenueCards`' AntD `Statistic` (which carries its own currency-specific formatting). Used 3× in the new dashboard summary.

**Updated:** `components/index.ts` (exports only). `PriceDisplay`, `ProductThumbnail`, `StatusTag`, `EmptyState`, `SkeletonLoader`, `ProductStatusTag`, `OrderStatusTag` were all reused as-is — no changes needed, confirming E1–E3 picked durable abstractions.

---

## 6. Responsive Improvements

- `SellerProductsPage`'s product table now has a mobile card-list alternative (CSS-toggled at 767px, same pure-CSS pattern as every other responsive toggle in the app — no JS viewport state).
- The new dashboard metric row uses `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))` — 3 columns on desktop, wraps to 2 on a narrow phone, verified via screenshot.
- Quick-action buttons wrap cleanly (`flex-wrap`) rather than overflowing on mobile.
- `TopProductsTable` (Analytics) now contains its horizontal scroll instead of risking a page-level overflow.
- Verified at 1280px (desktop) and 375px (mobile) for Dashboard/Products, Orders, Analytics, Add Product; no horizontal overflow found at either width.

---

## 7. Accessibility Improvements

- `AddProductPage`/`EditProductPage`: every previously-unassociated `<label>` (category, tags, price, stock, condition) now has a real `id`/`htmlFor` pair.
- `MetricCard`'s warning tone (out-of-stock count) uses both color *and* the existing label text — never color alone.
- `PageHeader`'s back-link reuses the existing `BackLink` component, which already mirrors its icon correctly under RTL and carries its own accessible label — not reimplemented.
- Touch targets, focus rings, and reduced-motion handling are all inherited from the existing app-wide foundations (Phase B) — nothing new needed for the elements added this batch.

---

## 8. Functional Verification

Verified against a **live backend with real interaction**: registered a real Seller account, completed the Store Setup Wizard through the real UI, and confirmed the dashboard/product list, Add Product flow, Edit Product flow, Orders (empty state), and Analytics (new-seller empty state) all render against real fetched data.

**A real bug was found and fixed**: the new dashboard-summary `useQuery` was given the exact same query key as the existing `useInfiniteQuery` powering the product table (both resolved to `sellerProductsQueryKey(undefined)`). React Query caches purely by key — since an infinite query's cache entry has a different shape (`{pages, pageParams}`) from a plain query's (`{items, nextCursor}`), the dashboard summary's `useQuery` was reading back the *infinite query's* cached shape and crashing on `.items` being `undefined`. This is not something `tsc` can catch (it's a runtime cache collision, not a type error) — it was caught by live browser testing, exactly the kind of problem the brief's "run the application" step exists to catch. Fixed by giving the summary query a distinct key (`[...sellerProductsQueryKey(undefined), 'summary']`) and re-verified with a clean screenshot afterward.

**Environment limitation, not a code bug**: object storage (MinIO) was not running in this environment (had to restart the backend itself this session too — it wasn't running at session start). This meant the real AI Store Builder image-upload step in Add Product fails server-side (confirmed: a 500 from the upload endpoint). This is the same class of limitation already documented in E1/E2/E3. Worked around it for verification purposes by seeding 3 draft products directly through the existing `POST /seller/products` endpoint (no new app code — a real, already-existing API, called with a real captured session token) so the *populated* dashboard/product-list/edit-product states could be verified rather than only ever seeing empty states. The upload-failure state itself was verified for real (a genuine error path, not faked) and confirmed to degrade gracefully with the existing error `Alert`.

No routing, authentication, product/order business logic, or analytics calculations were changed. Verified the existing publish-requirements gate (title + image + category) is unchanged and still correctly blocks publishing without an image.

Type-check: clean after every change. Production build: clean (2m54s, same pre-existing >500kB chunk-size warning as every prior phase). Lint: no lint configuration exists for this app (unchanged from prior phases).

---

## 9. Visual QA

Rendered via Playwright against the live dev server and real backend, across light/dark/desktop/mobile, plus a Urdu/RTL pass, for: Dashboard/Products (empty and populated), Add Product (empty and upload-failure states), Edit Product, Seller Orders (empty), Seller Analytics (new-seller empty state).

Confirmed: consistent spacing/typography/card treatment between the new Dashboard summary and the rest of the app; `StatusTag` "Draft" chips render correctly in both themes (the dark-mode soft-tint token fix from E3 covers these too — verified, no regression); product titles in the table render as clean designed links, not raw underlined hyperlinks (the anchor-style pattern fixed in E2 for Marketplace); the sidebar's active-state highlight and RTL mirroring both work correctly with zero new RTL-specific code, same logical-property architecture as every prior phase.

No inconsistencies requiring further fixes were found in this pass.

---

## 10. Remaining Issues

- **Product images could not be visually verified anywhere in this environment** — MinIO (object storage) is not running, so every product thumbnail shown in this batch's screenshots is the fallback icon (from E2's `ProductThumbnail` fix), not a real photo.
- **The full AI Store Builder generate→publish flow was not exercised end-to-end** this session — only the upload-failure state was verified for real. `EditProductPage`'s "Generate with AI" and both pages' Publish flow are unchanged code (not touched by E4) and were already verified working in D2's original implementation; this is a re-verification gap specific to this environment's object storage being unavailable, not a new risk introduced by E4.
- **Seller Order Detail's populated state** (with a real order, courier recommendation card, cancel action) was not re-screenshotted in E4 — it wasn't touched by E4's changes and was already thoroughly verified in E3 (same shared component). Seeding a real seller-side order would have required a full buyer purchase against a *live* (published) product, which requires an image — blocked by the same MinIO limitation above.
- **"Wallet" sidebar item still resolves to the placeholder route** — pre-existing, documented Phase C decision (no dedicated screen exists yet), not something E4 was asked to build.

---

## 11. Recommendations for Next Phase

- Whenever object storage is available in a future session, the Add Product → Generate with AI → Publish → populated-with-a-real-photo path should get a full live re-verification pass — this batch could only verify it via code review plus the upload-failure state.
- If a future phase adds a `sellerProductsQueryKey`-style count or summary endpoint, the dashboard's product-count metrics should switch to it — the current "only show counts once the full catalog is loaded" guard is honest but would stop showing numbers at all for a seller with a large enough catalog to paginate.
- E5 (AI Features) should treat `AIStatus`/`AIRevealPanel`/`BilingualField`/`AIHint` (used in Add/Edit Product) as already-finished, brand-correct components per D2 — E4 deliberately did not touch the AI reveal mechanism itself, per your explicit "AI features are not E4" instruction.
