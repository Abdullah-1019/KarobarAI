# Handoff — F11 Analytics Dashboard (Frontend)

**Status:** Complete — 2026-08-09. Built against `F11-analytics-backend.md` (already real, 66/66
analytics tests, 591/591 full backend suite). `tsc --noEmit` and `vite build` both clean. Also
**verified end-to-end against a real running stack** this session (see "Verified" below), including
one real bug caught only once real data was on screen — not just typecheck/build.

## Screens built

| Route | Screen |
|---|---|
| `/seller/analytics` | SCR-S08 — Seller Analytics Dashboard: date-range filter (7d/30d/3m/custom), revenue cards, daily sales-trend chart, revenue-by-category chart, order-status widget, customer widget, top-products table |

AI Recommendation card [R1.1] and Export [Future] are explicitly out of scope per the module doc's
Feature Overview — not stubbed.

## Key files

`apps/frontend/src/features/analytics/`: `analyticsApi.ts` (query fns for all 6 endpoints, one
shared `AnalyticsRangeParams` type/query-key builder), `analyticsErrors.ts`, `DateRangeFilter.tsx`,
`RevenueCards.tsx`, `SalesTrendChart.tsx`, `CategoryBreakdownChart.tsx` (first `recharts` usage
anywhere in this app), `OrderAnalyticsCard.tsx`, `CustomerAnalyticsCard.tsx`, `TopProductsTable.tsx`,
`AnalyticsDashboardPage.tsx`. Plus a new `analytics` i18n namespace (`locales/en|ur/index.ts`,
registered in `app/i18n.ts`), an "Analytics" nav link in `features/seller/SellerLayout.tsx`, one new
route in `app/router.tsx` (replaces the `/seller/*` → `SellerPlaceholder` catch-all for this path),
and `dayjs` added as a **direct** frontend dependency (`apps/frontend/package.json`) — antd's
`DatePicker.RangePicker` needs it explicitly; it was previously only a transitive dep via antd
itself, which `tsc` wouldn't resolve.

## Two real design gaps found, resolved before building (not backend bugs — doc gaps)

1. **Per-product drill-through analytics screen doesn't exist.** App Flow's SCR-S08 names
   "click-through to product analytics," and `F11-analytics-backend.md` flags this as its own
   unresolved doc gap — `TopProductItemDTO.productId` is returned "sufficient for the frontend to
   navigate," but the actual per-product analytics endpoint/screen was never built. Resolved by
   linking Top Products rows to the existing product-edit screen (`/seller/products/:id/edit`)
   instead of fabricating a route to a screen that doesn't exist.
2. **The "Empty (new seller)" state is about lifetime order history, not the selected date range**
   (App Flow: "Your analytics will appear here once your first order is placed"), but no dedicated
   lifetime endpoint exists — every endpoint is range-scoped. Resolved by treating `3m` (the widest
   built-in preset) as a best-effort lifetime check: `AnalyticsDashboardPage` fires
   `getOrderAnalytics({range:'3m'})` once on mount purely to decide whether to show the empty state,
   and React Query dedupes it against the Orders widget's own query if the seller ever picks `3m`
   themselves — no extra endpoint, no duplicate fetch in that case.

## One real bug found once real data was on screen (not caught by typecheck/build)

**Double percentage multiplication on `cancelledRate` and `repeatRate`.** The backend
(`analytics.service.ts`) already computes both as 0–100 scale percentages (e.g. `100.00` for 2/2
cancelled) — confirmed by reading the service code. `OrderAnalyticsCard.tsx` and
`CustomerAnalyticsCard.tsx` were both written assuming a 0–1 ratio and multiplied by 100 again,
so 2/2 cancelled rendered as **10,000.0%** instead of 100.0%. Caught via a user screenshot against
a real seller account (`Alis mart`, 2/2 orders cancelled), reproduced, and traced to the DTO's
scale. Fixed by removing the extra `* 100` in both components — verified `pctChangeVsPrevious`
(revenue) and `pctOfTotal` (category breakdown) do **not** have the same bug (neither was
multiplied a second time in this codebase).

## Verified end-to-end this session (real backend, real data, not just build checks)

- Logged in directly via `curl` as `test-seller@karobarai.test` (Test Return Store, 3× `DELIVERED`
  orders, same buyer, all "Electronics") and pulled all 6 live endpoints, cross-checking every
  number against what the dashboard rendered: revenue correctly `0.00` (no `Settlement` rows exist
  — known backend gap, not a frontend issue), sales-trend spike on the correct day (Rs. 4,500 / 3
  orders), category breakdown 100% Electronics, order avgOrderValue Rs. 1,700, customers
  uniqueBuyers=1/newBuyers=1, top-products showing 3 rows.
  - Side finding, not an app bug: those 3 top-products rows have 3 **different** `productId`s —
    `scripts/seed-return-test.ts` (Feature 10's fixture) was run 3 separate times, creating 3
    near-identical products rather than one product ordered 3 times. Cosmetic only; all totals are
    still correct.
- Verified against a second real account (`Alis mart`: 4× `PAYMENT_PENDING` + 2× `CANCELLED`, zero
  `DELIVERED`) via the user's own browser screenshots: confirmed Sales Trend/Category
  Breakdown/Top Products correctly render **empty, not broken** (these are realized-sales-only per
  the backend's Task 3/6 Engineering Decision — `DELIVERED`/`COMPLETED` only), confirmed the default
  7-day range correctly excludes the older `PAYMENT_PENDING` orders while including the more recent
  `CANCELLED` ones, and confirmed `cancelledRate`/`avgOrderValue` math after the fix above.

## Environment notes (same as F10's handoff — not new this pass)

This dev machine has no Docker installed; Postgres (18) and Redis (via Memurai) run as native
Windows services. MinIO has no native-service registration active on this machine (an
`install-minio-service.ps1` exists at `C:\Users\rafia\minio\` but hasn't been run elevated), so it
was started as a plain background `minio.exe` process for this session only — it will not survive a
reboot. Worth deciding on a durable answer eventually rather than repeating this per session.

## Known limitations / not built

- AI Recommendation card [R1.1] and Export [Future] — out of scope per the module doc, not stubbed.
- No per-product analytics screen (see gap #1 above) — Top Products links to product-edit instead.
- No live/push updates — matches the backend's 60s-TTL-cache design (no Socket.IO channel for
  analytics); widgets only refetch on date-range change or manual reload.
- Revenue cards read Rs. 0.00 for every seller until a settlement engine exists (Feature 12+) —
  inherited from the backend's documented gap, not fixable from the frontend.
- `ANALYTICS_RANGE_TOO_LARGE` has a translated error string ready but the backend never enforces a
  max lookback (per its own Assumption #5), so the custom-range picker has no client-side upper
  bound either.
