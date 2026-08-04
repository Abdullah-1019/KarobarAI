# Feature 11 — Analytics Dashboard: Sign-off Checklist

Backend scope only (`apps/backend`) — SCR-S08 frontend screen is a separate, not-yet-started
deliverable. Full narrative contract: `docs/handoffs/F11-analytics-backend.md`.
Progress-log entry: `docs/DoneTillNow.md`.

## Task 1 — Analytics Foundation

- [x] `analytics/` module scaffolded per TRD §12 layout.
- [x] `analytics.dateRange.ts` — shared date-range resolver (`resolveDateRange`,
      `previousPeriod`, `yearToDateRange`, `enumerateDays`), reused by every metric task, never
      redefined per-metric. Presets `7d`/`30d`/`3m`/`custom` (Zod-validated start<=end for custom).
- [x] `analytics.cache.ts` — TTL-based Redis caching (`getOrCompute`, 60s), documented Engineering
      Decision vs. the module doc's literal per-metric event-driven design (see handoff doc).
      Read/write failures logged, non-fatal.
- [x] Seller-only ownership guard: every handler resolves the caller's own internal `sellerId`
      and threads it into every repository query's `where` clause (no separate guard class — this
      codebase has no class-based middleware anywhere).
- [x] `ANALYTICS_ERROR_CODES` (`INVALID_DATE_RANGE`, `ANALYTICS_RANGE_TOO_LARGE`) registered in
      `packages/shared`.

## Task 2 — Revenue Aggregation

- [x] `sumSettledRevenue()` — `settlements.net WHERE status=SETTLED AND settledAt BETWEEN`,
      exactly as specified.
- [x] `GET /revenue` — `current`/`previous`/`ytd`/`pctChangeVsPrevious`, `null` (not a
      divide-by-zero crash) when the previous period has zero revenue (tested).
- [x] **Real gap found and resolved (not hidden)**: no code anywhere creates `Settlement` rows —
      confirmed `0.00` output is the correct, honest behavior of the spec as written, not a bug.
      Tested with synthetic seeded rows (`createTestSettlement`) to prove the aggregation itself
      is correct, independent of that gap. See handoff doc for the full reasoning and the decision
      to build Task 2 exactly as specified rather than substitute a structurally different number.
- [x] Ownership isolation tested: seller A never sees seller B's settlements.
- [ ] **Frontend not built**: SCR-S08's revenue cards.

## Task 3 — Sales Analytics

- [x] `GET /sales-trend` — zero-filled continuous daily series across the full range (tested: no
      orders → every point `0.00`/`0` count), realized (`DELIVERED`/`COMPLETED`) orders only,
      anchored on `deliveredAt`.
- [x] `GET /category-breakdown` — groups by category, synthetic `Uncategorized` bucket for null
      `category_id` (Task 3's own flagged gap, resolved — not silently excluded; tested with
      `pctOfTotal` correctness across both buckets).
- [x] `ChartDataDTO` (`labels`/`series`) populated correctly and positionally matches the
      underlying data points (tested).
- [x] **Real bug found and fixed by this feature's own tests**: `toISOString().slice(0, 10)`
      applied to local-midnight dates silently rolled back a day on this (PKT/UTC+5) machine —
      see handoff doc. Fixed with a `toLocalDateKey()` helper, regression-tested directly.
- [ ] **Frontend not built**: SCR-S08's trend chart.

## Task 4 — Order Analytics

- [x] `GET /orders` — status breakdown across **all** `OrderStatus` values (including zero
      counts, tested), `placed_at`-anchored (includes in-flight/cancelled, unlike Task 3).
- [x] `cancelledRate` divide-by-zero guard: `0` (not `NaN`) when `totalOrders` is 0 (tested).
- [x] `avgOrderValue` excludes `CANCELLED` orders from the average (tested).
- [x] Ownership isolation tested: seller A never sees seller B's orders.
- [ ] **Frontend not built**: SCR-S08's order-status widget.

## Task 5 — Customer Analytics

- [x] `GET /customers` — unique/new/repeat buyer counts, `repeatRate` divide-by-zero guard (`0`
      when `uniqueBuyers` is 0, tested).
- [x] New-vs-repeat classified against the buyer's **lifetime** order history with this seller,
      not range-bounded — the module doc's own flagged miscalculation risk, directly
      regression-tested: a buyer whose first-ever order predates the range start, with a second
      order inside the range, is correctly counted as repeat, not new.
- [x] Zero PII in the response — aggregate counts only (matches Doc 5 §9).
- [ ] **Frontend not built**: SCR-S08's customer widget.

## Task 6 — Top Products

- [x] `GET /top-products` — ranked by realized revenue descending (tested), realized-sales basis
      same as Task 3.
- [x] Soft-deleted products excluded even if they had realized sales in range (tested).
- [x] `thumbnailUrl` resolved from the position-0 product image, `null` when none exists (tested
      for both cases).
- [x] `?limit=` respected (tested), default 10, Zod-capped at 50.
- [x] Ownership isolation tested: seller A never sees seller B's products.
- [ ] **Frontend not built**: SCR-S08's top-products table.

## Task 7 — Validation & Testing

- [x] Integration suite: `tests/analytics/dateRange.test.ts`, `revenue.test.ts`,
      `salesTrend.test.ts`, `orders.test.ts`, `customers.test.ts`, `topProducts.test.ts`,
      `rbac.test.ts`, `caching.test.ts`, `reuseAudit.test.ts` — 66 new tests (see
      `docs/DoneTillNow.md` for the exact final count).
- [x] RBAC adversarial, uniform across all 6 endpoints: no token → 401, Buyer → 403, Admin → 403
      (platform-wide KPIs live at the separate SCR-AD01, not here), onboarded Seller → 200.
- [x] Caching behavior tested with a repository spy: a repeated call within the 60s TTL does not
      re-hit Postgres; a different range or a different seller is correctly a cache miss (never
      serves another seller's cached figures).
- [x] Full reuse audit (grep-based, recorded below) — read-only guarantee, no class-based
      repository, no `seller_daily_stats` writer, no cache-bust hook leaked into other features'
      files, every metric goes through the shared cache helper, zero new Prisma models.
- [x] This checklist file.

### Reuse audit — grep results (verbatim, `tests/analytics/reuseAudit.test.ts`, all passing)

```
write to orders/order_items/settlements/products/categories anywhere in the analytics module: none found (read-only)
class-based AnalyticsRepository: none — plain exported functions, consistent with every other module
seller_daily_stats/seller_recommendations writer: none — Task 3 computed live, deliberately deferred
analytics.cache imported from order/tracking/returns/notification modules: none — TTL caching is self-contained
getOrCompute() call sites in analytics.service.ts: 6 — every metric endpoint goes through the shared cache helper
new Prisma model added for this feature: none — Settlement/Order/Product/Category all pre-existing
```

## Documentation Gaps — final status

| # | Item | Status |
|---|---|---|
| 1 | "Feature 10 (Payments)" dependency line names a settlement source that was never built (numbering mismatch — this codebase's Feature 10 is Returns & Refunds) | Resolved by decision: build Task 2 exactly as specified against `settlements`; `0.00` output is correct until a settlement engine exists (Feature 12+) |
| 2 | Products with `category_id = NULL` (module doc's own flagged gap) | Resolved this pass — synthetic "Uncategorized" bucket |
| 3 | New-vs-repeat miscalculation risk (module doc's own Common Errors warning) | Resolved and directly regression-tested — lifetime-history classification |
| 4 | `seller_daily_stats`/`seller_recommendations` pre-aggregation tables, unused | Deliberately deferred — no documented population trigger exists; flagged for Feature 12/optimization |
| 5 | Per-metric event-driven cache invalidation (module doc's literal design) | Deviated by Engineering Decision — flat 60s TTL, avoids cross-feature coupling into Features 7/8/10 |
| 6 | `ANALYTICS_RANGE_TOO_LARGE` max-range enforcement | Unresolved — carried forward per the module doc's own Assumption #5 (no limit specified) |
| 7 | Local-timezone date-key bug (`toISOString().slice(0,10)` on local-midnight dates) | Found and fixed this pass, before it ever reached a chart — not a doc gap, a bug caught by this feature's own tests |

## Test results

**66/66 new Feature 11 tests pass. Full backend suite: 591/591 tests, 61/61 suites**, confirmed
non-flaky across 2 consecutive full-suite runs. See `docs/DoneTillNow.md`'s Feature 11 entry for
the breakdown.

## Sign-off

Backend scope: **complete**. Frontend scope (SCR-S08): **not started**.
