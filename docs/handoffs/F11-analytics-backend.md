# Handoff — F11 Analytics Dashboard (Backend → Frontend, and Backend → Feature 12)

**Status:** Backend complete — 2026-08-04. New `analytics/` module (repository/service/dto,
`analytics.dateRange.ts`/`analytics.cache.ts` utilities). Full backend suite green — see
`docs/DoneTillNow.md`'s Feature 11 entry for the exact final count. Zero new Prisma models/
migrations — `settlements`, `orders`, `order_items`, `products`, `categories` already existed.

**This feature's own module doc assumes more prior infrastructure exists than actually does —
read the whole doc before building against it, not just the endpoint list. Same pattern as every
prior feature this session.**

---

## The one real, still-open gap: Task 2's revenue figures will read 0.00 in production

Task 2 (Revenue Aggregation) is specified to source `current`/`previous`/`ytd` from
`settlements.net WHERE status = SETTLED`. **No code path anywhere in this codebase has ever
created a `Settlement` row** — `PaymentAdapter.charge()`/`refund()` (Features 6/10) never write
one, and no dedicated settlement/payout-engine feature has been built yet. The module doc's own
dependency line names "Feature 10 (Payments)" as already providing this data — a numbering
mismatch, since this codebase's actual Feature 10 is Returns & Refunds.

**Decision made and confirmed with the project owner before building:** implement Task 2 exactly
as specified against `settlements` (correct, fully tested with synthetic seeded rows — see
`tests/analytics/revenue.test.ts`), rather than substituting `orders.total_amount` or inventing an
undocumented settlement-creation trigger. Substituting order totals would produce a structurally
different (and wrong) number — it would include commission, shipping, and unsettled/in-flight
orders, which is not "revenue" in the sense Task 2 defines it. `GET /seller/analytics/revenue`
will correctly return `{current: "0.00", previous: "0.00", ytd: "0.00", pctChangeVsPrevious:
null}` for every real seller until a settlement engine exists — this is the correct, honest
output of the spec as written, not a bug. **Whoever builds the settlement engine (Feature 12/
Payments, or a dedicated later feature) does not need to touch this module** — the moment
`Settlement` rows exist with `status=SETTLED`, this endpoint starts returning real numbers with
zero code changes.

## A real bug found and fixed by this feature's own tests: local-timezone date-key drift

`enumerateDays()` (`analytics.dateRange.ts`) and `dailyRevenueSeries()`
(`analytics.repository.ts`) originally built each day's bucket key with
`date.toISOString().slice(0, 10)` applied to **local**-midnight `Date` objects. On any
positive-UTC-offset machine — this dev environment is PKT/UTC+5, and KarobarAI is a
Pakistan-market platform, so production will be too — that reads the **UTC** calendar day, which
is one day behind the intended local day for any local time before ~05:00. Two independent bugs
from the same root cause:
1. `enumerateDays()`'s zero-fill labels were all shifted back one day from the actual local
   calendar days they were meant to represent.
2. `dailyRevenueSeries()` would attribute an order delivered locally between midnight and ~5am to
   the *previous* day's revenue bucket.
Fixed by adding `toLocalDateKey()` (uses `getFullYear()`/`getMonth()`/`getDate()`, never
`toISOString()`) and routing both call sites through it. Caught by
`tests/analytics/dateRange.test.ts`'s regression test before this ever reached a seller-facing
chart — worth flagging because this exact `toISOString().slice(0, 10)` pattern is easy to
reach for and looks correct in a UTC dev/CI environment; it is **not** correct for this
project's target market.

## Caching — TTL, not the module doc's literal event-driven design (Engineering Decision)

`analytics.cache.ts`'s `getOrCompute()` wraps every one of the 6 metric services in a 60-second
Redis TTL cache (`analytics:{sellerId}:{metric}:{rangeHash}`), read/write failures logged and
non-fatal (never blocks a request on a Redis hiccup). The module doc's own design calls for
per-metric event-driven invalidation (settlement-confirmed busts revenue, order-delivered busts
sales-trend/top-products, order-status-changed busts orders, new-order-placed busts customers).
**Not built that way**: wiring four separate cache-bust hooks into Features 7/8/10's
already-signed-off files would be a disproportionate amount of cross-feature coupling for a
performance optimization, when the only actual requirement (Doc 5 §7 / REQ-F-Analytics-005) is
"<3s reload" — a flat 60s TTL trivially satisfies that with zero cross-feature file touches.
Grep-audited (`tests/analytics/reuseAudit.test.ts`): no `analytics.cache` import exists anywhere
outside the `analytics/` module.

## Plain-function repository, not a class hierarchy

The module doc's literal wording ("AnalyticsRepository base class other analytics repos extend")
is OOP-inheritance-flavored. `analytics.repository.ts` is a set of exported functions, same shape
as every other repository in this codebase (`order.repository.ts`, `returns.repository.ts`, ...)
— this codebase has never used class-based repositories anywhere. Same practical reuse goal
(shared query helpers, no per-metric duplication), consistent shape with the rest of the code.

## `seller_daily_stats`/`seller_recommendations` — real tables, deliberately left unpopulated

Schema §15.1/§15.2's `SellerDailyStat`/`SellerRecommendation` Prisma models are clearly the
intended pre-aggregation mechanism for the `<3s reload` requirement at scale, and currently have
**zero writers anywhere in this codebase**. Not built this pass: populating `seller_daily_stats`
requires an undefined batch-job trigger (daily cron? on-settlement? on-delivery?) that no source
document specifies timing for — inventing one would be exactly the kind of unspecified-business-
logic guess this project has consistently declined to make (see Features 7/8's identical
reasoning for the undocumented `DELIVERED → COMPLETED` trigger). Task 3's daily trend is instead
computed live from `orders`/`order_items` each request, which the 60s TTL cache already makes
fast enough. **Flagged as a real Feature 12/optimization opportunity**, not an oversight — a
scheduled job that upserts `seller_daily_stats` and switches `dailyRevenueSeries()` to read from
it (falling back to live computation for `statDate`s not yet aggregated) is a clean, additive
follow-up that needs zero changes to this feature's API contract.

## Uncategorized-products bucket (Task 3's own flagged gap, resolved here)

`products.category_id` may be `NULL`. `categoryRevenue()` buckets these into a synthetic
`{categoryId: null, categoryNameEn: "Uncategorized", categoryNameUr: "غیر درجہ بند"}` entry rather
than silently excluding that revenue — silent exclusion would make every other category's
`pctOfTotal` lie about the period's real total.

## Endpoints (`GET /api/v1/seller/analytics/*`, all `authenticate + authorize('SELLER')`)

| Path | Returns | Notes |
|---|---|---|
| `/revenue` | `RevenueSummaryDTO` | Sourced from `settlements` — see the known-limitation section above |
| `/sales-trend` | `SalesTrendDTO` | Zero-filled daily points, realized (`DELIVERED`/`COMPLETED`) orders, local-calendar-day anchored on `deliveredAt` |
| `/category-breakdown` | `CategoryBreakdownDTO` | Same realized-sales basis as sales-trend; `Uncategorized` bucket for null `category_id` |
| `/orders` | `OrderAnalyticsDTO` | `placed_at`-anchored, **all** statuses including in-flight/cancelled; `avgOrderValue` excludes `CANCELLED` |
| `/customers` | `CustomerAnalyticsDTO` | New-vs-repeat classified against the buyer's **lifetime** order history with this seller, not range-bounded (see the miscalculation-risk test below) |
| `/top-products` | `TopProductsDTO` | Realized-sales basis, soft-deleted products excluded, `?limit=` (default 10, max 50) |

All six accept `?range=7d\|30d\|3m\|custom&startDate=&endDate=` (custom requires both, validated
`start<=end`) — resolved server-side (`analytics.dateRange.ts`), never trusts client-computed
boundaries.

## The new-vs-repeat classification's own flagged risk — tested directly

The module doc's Common Errors section explicitly warns: classifying a buyer as "new" just
because their *only order visible in this range* is their first one *in the query window* is
wrong if they ordered before the range started. `getCustomerAnalytics` classifies against
`firstOrderDates` (lifetime `MIN(placed_at)` per buyer, not range-bounded) precisely to avoid
this. `tests/analytics/customers.test.ts` has a dedicated regression test: a buyer whose
first-ever order predates the range start, with a second order inside the range, must be counted
as repeat — confirmed passing.

## Known limitations / assumptions (in addition to the Task 2 gap above)

1. `seller_daily_stats`/`seller_recommendations` unpopulated (see above) — live computation only.
2. Caching is TTL-based, not event-driven (see above) — data can be up to 60s stale, well within
   the `<3s reload` requirement's intent (reload speed, not data freshness).
3. `ANALYTICS_RANGE_TOO_LARGE` error code is registered in `packages/shared` but not enforced —
   matches the module doc's own Assumption #5 (no max-range limit specified).
4. No frontend for any of this — SCR-S08 (Seller Analytics Dashboard) remains separate,
   not-yet-started work.
5. Admin's platform-wide KPIs (SCR-AD01) are explicitly out of scope here — Feature 12 (Admin
   Panel) composes/reuses this module's repository functions with the seller-ownership filter
   removed, per that module's own doc; it does not duplicate this feature's aggregation logic.
