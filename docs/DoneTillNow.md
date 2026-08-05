# KarobarAI — Progress Log

**Purpose:** a running, human-readable record of what has actually been built, verified, and
decided — so either developer (or a fresh AI session) can pick up context without re-deriving it
from chat history. Updated at the end of each feature/phase, not line-by-line.

Format per entry: what shipped, how it was verified (not just "written"), and anything assumed
or flagged for follow-up. Newest entries at the top.

---

## Feature: Admin Panel (Implementation Plan Phase 15 / Feature 12)

**Status:** Done — 2026-08-04. New `admin/` module (`dashboard/`, `users/`, `moderation/`,
`reports/`, `config/` submodules, plus shared `admin.middleware.ts`/`admin.mutation.ts`). Full
backend suite green: **701/701 tests, 70/70 suites** (95 new to this feature), confirmed
non-flaky across 2 consecutive full-suite runs. Zero new Prisma models, zero new migrations —
every table this feature touches already existed. Full contract in
`docs/handoffs/F12-admin-panel-backend.md`, sign-off in `docs/FEATURE_12_CHECKLIST.md`.

**Its own module doc's completeness was verified by reading the whole file this time** — a direct
lesson from the Feature 10→11 mistake logged further down this file: confirmed all 6 tasks +
Validation + Consistency Review genuinely present (3 appended "Response" batches), not just the
stale "Draft" header at the top.

**Real gaps found and resolved, the now-familiar pattern for this project:**
- **No adapter/dependency-uptime counter infrastructure exists anywhere** — the module doc's
  Task 2 claims "TRD §24 adapter/health counters... already implemented"; confirmed false (zero
  hits grepping for uptime/success/failure counters). Building real per-adapter instrumentation
  would mean touching every mock adapter across Features 6/7/8/9/10's already-signed-off files —
  disproportionate for one KPI tile. Resolved by extracting `/ready`'s existing Postgres+Redis
  check into `core/health/checkDependencies.ts` (now shared by both `/ready` and the dashboard),
  reporting `adapterUptime` as an **instantaneous reachability snapshot**, not a true rolling
  percentage — documented as a known limitation, not passed off as the real thing.
- **`AuditedMutation` and session revocation needed almost no new code** — Feature 10's
  `createAuditLog()` already accepted an optional transaction client (built as exactly this kind
  of reusable helper), and `revokeAllRefreshTokensForUser()` already existed in `auth.tokens.ts`,
  literally comment-flagged "admin suspend/ban later" since Auth (Phase 3). The only genuinely
  new piece was the small `requireAdminWrite()` writeGuard, for a distinct `403
  ADMIN_WRITE_REQUIRED` code Support gets on write routes vs. the generic `FORBIDDEN` a
  Buyer/Seller gets for the surface entirely.
- **`gmv-trend`'s `groupBy=category` mixes two incompatible revenue bases — a real gap in the
  module doc itself**, not an implementation shortcut: `Settlement` has no per-item breakdown (one
  row per order), so a category split of *settled net GMV* isn't representable in the schema.
  Implemented on Feature 11's realized-order-item-revenue basis instead, with an explicit
  `basisNote` field so the mismatch is never silent.
- **A real, previously-undiscovered gap**: `platform_config.commission_rate_default` is seeded
  and now admin-editable via this feature's new config endpoint, but **no code anywhere in this
  codebase actually reads it** — `checkout.service.ts`'s commission comes from `seller_profiles.
  commission_rate` (a per-seller column) instead. Changing it via this feature's endpoint
  currently has zero live effect. Documented, not fixed here (would mean touching Auth's
  already-signed-off seller-activation flow, outside this feature's scope) — Task 6.4's own
  "confirm a config change is visible to a live consumer" requirement was satisfied instead using
  `return_window_days` (a real, tested, live-read consumer via Feature 10).
- **Product-report/flag mechanism (Task 4.1) doesn't exist** — no table, no buyer-facing "report
  this listing" flow anywhere. The moderation queue is exactly what's real: all products,
  filterable by status only, no `reported` filter exposed (would silently do nothing).
- **Seller-ban-with-open-orders** (Task 3.6) is a non-blocking `openOrdersCount` warning, not a
  blocking reconciliation workflow — no source document defines what one would consist of.

**A real test-isolation bug found by this feature's own tests, fixed:**
- `tests/helpers/reset.ts` never truncated `audit_logs` — every prior feature's audit-row tests
  scoped by a fresh bigint `entityId` per test run, so stale rows never mattered. Feature 12's
  `CONFIG_CHANGE` audits are the first with `entityId: null` (`platform_config`'s PK is a string),
  so old rows from earlier suite runs leaked into later assertions. Fixed by adding
  `prisma.auditLog.deleteMany()` to `resetDb()`.

**Verified (not just written):**
- `tsc --noEmit` clean.
- 95 new tests: RBAC parity across all 8 read endpoints + every write route's `ADMIN_WRITE_
  REQUIRED` behavior, `AuditedMutation` rollback-on-failure, GMV/active-users/alert-feed
  correctness, blind-index user search, the full suspend→reactivate→ban lifecycle with live
  session revocation, ban-with-open-orders warning, product takedown/restore (incl. the
  DRAFT-restores-to-DRAFT edge case and live storefront exclusion), all three report endpoints
  (incl. BR-006's WARNING/AUTO_SUSPEND fraud-flag tiers), and config validation/write-protection.
- Full backend suite run twice consecutively: 701/701 tests, 70/70 suites both times, zero
  flakiness.

**Known limitations / assumptions:** see `docs/handoffs/F12-admin-panel-backend.md`'s full list —
in short: `adapterUptime` is a snapshot not a rolling percentage, "active users" definition
unconfirmed, product-report mechanism doesn't exist, seller-ban reconciliation is a warning only,
`groupBy=category` GMV uses a different basis (flagged via `basisNote`),
`commission_rate_default` has zero live consumers, no frontend (SCR-AD01/AD02/AD05/AD06 not
started).

---

## Gap Closure: Settlement Engine (unblocks Feature 11 Task 2 / Feature 12 Task 2 GMV)

**Status:** Done — 2026-08-04. New `settlement/` module (`settlement.repository.ts`,
`settlement.service.ts`). Full backend suite green: **606/606 tests, 63/63 suites** (15 new to
this gap closure), confirmed non-flaky across 2 consecutive full-suite runs. Zero new Prisma
models — `settlements` already existed complete; this is the first code path that ever writes to
it. Full contract in `docs/handoffs/F-settlement-engine-gap-closure.md`.

**Why this exists:** not a numbered Implementation Plan feature — no feature in the entire
16-feature module list (0–15) owns "Payments/Settlement Engine" as its own deliverable, yet both
Feature 11's Task 2 (Revenue Aggregation) and Feature 12's Task 2 (Dashboard GMV) specify
`SUM(net) OVER settlements WHERE status=SETTLED` as their literal data source. Feature 11 shipped
with this flagged as a known, honest limitation (correctly returning `0.00` for every seller).
Rather than let Feature 12 hit the same gap a second time, built the missing piece now, before
starting Feature 12, so its own Dashboard work lands against real numbers.

**What it does:** a daily BullMQ poll job (`startSettlementPollJob`, structurally identical to
Feature 8's `startTrackingPollJob` — `createQueue`/`createWorker`, only started from `server.ts`'s
process-startup guard, never from a request handler) that finds orders where the return window
has closed (`deliveredAt + platform_config.return_window_days <= now`, config-driven, never
hardcoded) with nothing left to refund (no `Return` filed, or one that ended `CLOSED` — a `Return`
still active holds the order back, one that reached `REFUND_ISSUED` excludes it permanently), and
creates a `Settlement` row: `gross = order.subtotal`, `commission = gross *
commissionRateSnapshot` (rounded 2dp `ROUND_HALF_UP` before subtracting, so it's exactly
self-consistent with the `chk_settlements_net` CHECK constraint regardless of DB-side rounding),
`net = gross - commission`, `status = SETTLED` immediately (no `PENDING` staging — no real
payout/banking gateway exists anywhere in this codebase to gate that on, mock-only like every
other adapter this session). `Settlement.orderId`'s existing unique constraint doubles as the
idempotency guard against a poll cycle re-processing an already-settled order.

**Deliberately not built:** actual payout/bank-transfer execution, `cod_remittances`
reconciliation, or an admin manual-settlement override (`SettlementStatus.ON_HOLD` stays unused) —
all remain Feature 12+/Feature 16 (External APIs) concerns. A `Settlement` reaching `SETTLED`
means "this revenue is finalized and no longer at refund risk," not "money has moved."

**Verified:** `tsc --noEmit` clean; 15 new tests (correct gross/commission/net math,
window-not-closed exclusion, config-driven cutoff, open-return exclusion, `REFUND_ISSUED`
exclusion, `CLOSED`-return inclusion, idempotency, non-delivered exclusion, one-order-failure
isolation via a mocked throw, and a grep-based reuse audit); full suite run twice consecutively,
606/606 both times; Feature 11's existing `revenue.test.ts` (built against synthetic seeded
settlements) re-run unchanged and still green — this addition is purely additive.

---

## Feature: Analytics Dashboard (Implementation Plan Phase 14 / Feature 11)

**Status:** Done — 2026-08-04. New `analytics/` module (repository/service/dto, plus
`analytics.dateRange.ts`/`analytics.cache.ts` utilities). Full backend suite green:
**591/591 tests, 61/61 suites** (66 new to this feature), confirmed non-flaky across 2
consecutive full-suite runs. Zero new Prisma models, zero new migrations — `settlements`,
`orders`, `order_items`, `products`, `categories` already existed. Full contract in
`docs/handoffs/F11-analytics-backend.md`, sign-off in `docs/FEATURE_11_CHECKLIST.md`.

**The one real, still-open gap — confirmed with the project owner before building, not
discovered after:**
- Task 2 (Revenue Aggregation) sources `current`/`previous`/`ytd` from `settlements.net WHERE
  status=SETTLED`. **No code path anywhere in this codebase has ever created a `Settlement`
  row** — confirmed via `grep -rln "settlement.create\|prisma.settlement" apps/backend/src`
  returning zero hits outside this feature's own tests. The module doc's dependency line names
  "Feature 10 (Payments)" as already providing this — a numbering mismatch, since this
  codebase's actual Feature 10 is Returns & Refunds. Decision made before writing any code:
  build Task 2 exactly as specified against `settlements` (tested correct with synthetic seeded
  rows), rather than substituting `orders.total_amount` (would produce a structurally different,
  wrong number — includes commission/shipping/unsettled orders) or inventing an undocumented
  settlement-creation trigger. `GET /seller/analytics/revenue` correctly returns all-zero output
  for every real seller until a settlement engine exists (Feature 12+) — this is the honest
  output of the spec as written, not a bug, and needs zero code changes here once one exists.

**A real bug found and fixed by this feature's own tests:**
- `enumerateDays()` and `dailyRevenueSeries()` originally built date-bucket keys with
  `date.toISOString().slice(0, 10)` applied to local-midnight `Date` objects — reads the UTC
  calendar day, which silently rolls back one day on any positive-UTC-offset machine (confirmed:
  this dev environment is PKT/UTC+5, and KarobarAI's target market is Pakistan, so production
  will be too). Would have zero-filled the wrong calendar days in the sales-trend chart and
  misattributed early-morning-delivered orders to the previous day's revenue. Fixed with a
  `toLocalDateKey()` helper (`getFullYear()`/`getMonth()`/`getDate()`, never `toISOString()`),
  used consistently in both places; regression-tested directly.

**Other decisions made this pass:**
- **Caching is TTL-based (60s Redis), not the module doc's literal per-metric event-driven
  design.** Wiring four separate cache-bust hooks into Features 7/8/10's already-signed-off
  files would be disproportionate cross-feature coupling for a performance optimization when the
  only real requirement is "<3s reload" (Doc 5 §7) — a flat TTL fully satisfies that. Grep-
  audited: no other module imports `analytics.cache`.
- **`seller_daily_stats`/`seller_recommendations` (Schema §15.1/§15.2) intentionally left
  unpopulated.** These are clearly the intended pre-aggregation mechanism at scale, but have zero
  writers anywhere in this codebase, and populating them requires an undefined batch-job trigger
  no source document specifies — same "don't invent unspecified business logic" reasoning as
  Features 7/8's `DELIVERED → COMPLETED` gap. Task 3's daily trend is computed live from
  `orders`/`order_items` instead (fast enough under the 60s cache). Flagged as a real Feature
  12/optimization opportunity, not an oversight.
- **`analytics.repository.ts` is plain exported functions, not a class hierarchy** the module
  doc's literal "AnalyticsRepository base class" wording implies — matches every other
  repository in this codebase (none are class-based).
- **Products with `category_id = NULL`** (Task 3's own flagged gap) bucket into a synthetic
  "Uncategorized" category rather than being silently excluded, which would make every other
  category's `pctOfTotal` misrepresent the period's real total.
- **New-vs-repeat customer classification** (Task 5) is checked against the buyer's *lifetime*
  order history with this seller, not range-bounded — the module doc's own flagged
  miscalculation risk. Directly regression-tested: a buyer whose first-ever order predates the
  range start, with a second order inside the range, is correctly counted as repeat, not new.

**Verified (not just written):**
- `tsc --noEmit` clean across `packages/shared` and `apps/backend`.
- 66 new tests: date-range pure-function unit tests, all 6 metric endpoints (happy path + edge
  cases: zero-data, divide-by-zero guards, ownership isolation per endpoint), uniform RBAC
  adversarial tests (401/403/403/200) across all 6 endpoints, caching behavior (spy-verified
  cache hit/miss on TTL/range/seller boundaries), and a grep-based reuse audit.
- Full backend suite run twice consecutively: 591/591 tests, 61/61 suites both times, zero
  flakiness. (`tests/helpers/reset.ts` extended with `settlement.deleteMany()` — `Settlement.
  orderId` is `onDelete: Restrict` — and an `analytics:*` Redis-key sweep, both needed since this
  is the first feature to create `Settlement` rows or write `analytics:*` cache keys at all.)

**Known limitations / assumptions:** see `docs/handoffs/F11-analytics-backend.md`'s full list —
in short: Task 2 reads zero until a settlement engine exists (above), `seller_daily_stats`
unpopulated (above), `ANALYTICS_RANGE_TOO_LARGE` registered but not enforced (module doc's own
Assumption #5, no limit specified), no frontend (SCR-S08 not started), Admin's platform-wide KPIs
(SCR-AD01) are explicitly out of scope — Feature 12 composes this module's repository functions
with the ownership filter removed rather than duplicating the aggregation logic.

---

## Feature: Returns & Refunds (Implementation Plan Phase 13 / Feature 10)

**Status:** Done — 2026-08-04. New `returns/` module (repository/service/decision-service, plus
`seller/` and `admin/` submodules per the module doc's own literal artifact structure). Full
backend suite green: **525/525 tests, 52/52 suites** (82 new to this feature), confirmed
non-flaky across 2 consecutive full-suite runs. Zero new Prisma models, zero new migrations —
`returns`/`return_images`/`disputes` already existed complete. Full contract in
`docs/handoffs/F10-returns-refunds-backend.md`, sign-off in `docs/FEATURE_10_CHECKLIST.md`.

**Real gaps found and resolved, the now-familiar pattern for this project:**
- **No "Payments Feature" refund-trigger interface existed anywhere in this codebase** — the
  module doc's dependency line names an "already implemented" Payments Feature; in reality
  `PaymentAdapter` (Feature 6) only ever had `charge()`. Extended it with a mock-only `refund()`
  method, same D2 shape, synchronous/immediate like every other mock adapter in this codebase
  (courier `book()`/`track()`, sms/email `send()`) rather than modeling a webhook confirmation
  step nothing here has ever built.
- **`audit_logs` had never been written to by any prior feature**, despite the module doc's claim
  that this feature "reuses the existing audit_logs write pattern from Feature 1/Admin
  foundation." Built the first writer (`core/audit/index.ts`'s `createAuditLog()`), accepting an
  optional transaction client so a caller can log in the same transaction as the mutation it
  audits — generic enough for any future privileged-action feature to reuse as-is.
- **No task in the module doc's own 7-task breakdown builds the buyer-appeal endpoint**
  (REJECTED → UNDER_DISPUTE), despite the doc's own Flow diagram showing it and Task 5's
  Dependencies assuming disputed cases exist to review. Built as `POST /returns/:id/appeal`.
- **COD "nominated wallet" refund path** (Task 6.3) has no schema support anywhere (no column on
  `BuyerProfile`/`Address`/`Return` to capture one, and the schema is frozen) — resolved
  behaviorally: the refund call passes `order.paymentMethod` to the mock adapter, no wallet data
  model needed since real money movement is out of scope for a mock regardless.
- **This is the first feature to gate a route by `authorize('ADMIN', 'SUPPORT')` at the router
  level** — every prior Admin/Support access (Feature 7's Order Detail) checked role inside the
  service instead, since those routes were also Buyer/Seller-reachable.

**A real bug this feature's own tests caught:** `decideReturn()` (the function shared by seller
and admin decisions) originally inferred "is this case disputed?" from `row.status ===
'UNDER_DISPUTE'` rather than checking the actual `Dispute` row. In real usage the pairing always
holds (`appealReturn()` creates the row and sets the status together), but the service shouldn't
assume an invariant it can just check — fixed to `row.dispute !== null`.

**What shipped:**
- `core/state-machines/return.state-machine.ts` — mirrors `order.state-machine.ts`'s exact shape.
- Full return lifecycle: `INITIATED → IMAGES_SUBMITTED → MANUAL_REVIEW → {APPROVED →
  PICKUP_BOOKED → REFUND_ISSUED} | {REJECTED → (buyer appeal) → UNDER_DISPUTE → admin-final}`.
- `ReturnDecisionService` (`decision.service.ts`) — the single `decideReturn()` function both
  Seller and Admin decision endpoints call, per Task 5's Engineering Decision; differs only in
  whether a rejection auto-closes (Admin only, BR-008) and which parties get notified.
- Image upload/delete/submit reusing Feature 4's validation utility and the existing
  `StorageAdapter` — zero new upload/storage code.
- Refund sync (`triggerRefund`) — idempotent by construction (only proceeds from
  `PICKUP_BOOKED`, no idempotency-key table needed), zero direct `payments`/`settlements` writes.
- Four new notification template registry entries (`RETURN_INITIATED`, `RETURN_UNDER_REVIEW`,
  `RETURN_DECISION`, `REFUND_ISSUED`) — the latter two using Feature 9's own pre-reserved
  canonical names, zero changes to Feature 9's dispatch logic.
- One shared `ReturnListItemDTO`/query builder reused across buyer/seller/admin list **and**
  history endpoints (Task 7).

**Known limitations / assumptions (see the handoff doc for full detail):**
- Return-pickup booking has no retry/fallback (unlike Feature 8's order-booking flow) — the mock
  always succeeds and no source document asks for return-specific retry logic.
- Admin history/list endpoints don't inline the full audit trail per row (would need N+1
  queries) — only the detail endpoint does.
- No frontend for any of this — SCR-B10, SCR-B11, SCR-S07, SCR-AD04 all remain separate,
  not-yet-started work.

---

## Feature: Notifications (Implementation Plan Phase 12 / Feature 9)

**Status:** Done — 2026-08-03. New `notification/` module (repository/service/consumer/
controller/routes/dto) — the consumer/dispatch side of every notification job Features 1/6/7/8
were supposed to enqueue. Full backend suite green: **443/443 tests, 44/44 suites** (39 new to
this feature, including a same-session follow-up — see below), confirmed non-flaky across 2
consecutive full-suite runs. Zero new Prisma models, zero new migrations. Full contract in
`docs/handoffs/F9-notifications-backend.md`, event-by-event producer audit in
`docs/FEATURE_9_EVENT_INVENTORY.md`, sign-off in `docs/FEATURE_9_CHECKLIST.md`.

**The single most important finding this feature surfaced, closed the same session:** the module
doc claims Feature 6 (checkout) enqueues order-placed/payment notification jobs and Feature 7
(orders) enqueues status-milestone jobs. **Neither was true in this codebase** — a direct search
of `modules/order/`, `modules/cart/`, and `modules/address/` showed zero calls to
`enqueueNotification` anywhere; Feature 8's `tracking.service.ts` was the *only* real producer,
for 3 of the 10 canonical event types. Initially logged as a named, carried-forward gap in
`FEATURE_9_EVENT_INVENTORY.md` rather than silently patched (per Task 2.3/2.4's explicit
instruction) — then, at the user's explicit request immediately after Feature 9's own sign-off,
actually closed: `checkout.service.ts` now enqueues `ORDER_PLACED` after the order-creation
transaction commits (once per created order, not once per idempotent-replay request); Feature 7's
`transitionOrderStatus` now enqueues `ORDER_PAYMENT_CONFIRMED`/`ORDER_CANCELLED`/
`ORDER_PICKED_UP`/`ORDER_IN_TRANSIT`/`ORDER_OUT_FOR_DELIVERY`/`ORDER_DELIVERED` via a
`STATUS_NOTIFICATION_EVENTS` map — living inside the single source of truth for status changes,
not scattered across every caller. Feature 8's `pollOneOrder` had its own now-redundant explicit
`ORDER_DELIVERED` enqueue removed to avoid double-notifying the buyer. `FEATURE_9_EVENT_INVENTORY.md`
updated to reflect all 10 non-reserved event types now have a real, tested producer.

**A second, smaller mismatch was fixed directly** (not just flagged), since it was an integration
bug within the same body of work rather than a cross-team boundary: Feature 8's own
`NotificationPayload` originally carried a pre-rendered, English-only `message` string —
incompatible with this feature's bilingual, per-recipient-language template rendering (Task 2.5/
REQ-F-Notif003). Fixed by changing the payload to carry `vars: Record<string, unknown>` instead
and updating `tracking.service.ts`'s three call sites accordingly; also renamed Feature 8's ad hoc
`COURIER_TRACKING_FAILURE` to this feature's canonical `TRACKING_POLL_FAILURE`. Feature 8's full
test suite re-verified clean afterward.

**What shipped:**
- `adapters/whatsapp/` — built fresh (index/mock/live), filling in Feature 0's placeholder, same
  D2 shape as sms/email/courier/payment.
- `notification/templates.ts` — a single typed EN/UR registry (one pair per canonical event type,
  `{{var}}` interpolation), decoupled from dispatch logic.
- `notification.service.ts` — `dispatchInApp`/`dispatchEmail`/`dispatchSms`/`dispatchWhatsApp`,
  structurally identical gating (critical-event allowlist overrides the preference check, never
  the reverse), each independently try/caught so one channel's failure never blocks another.
  `processNotificationEvent()` is the single consumer entry point: validates the job envelope,
  resolves the recipient once, fans out to all four channels via `Promise.allSettled`.
- `notification.consumer.ts` — the first real BullMQ `Worker` in this codebase (Feature 7/8 only
  ever produced into queues; this is the first actual consumer).
- Notification Center: `GET /api/v1/notifications` (cursor-paginated, IN_APP rows only), `GET
  /api/v1/notifications/unread-count`, `PATCH /api/v1/notifications/:id/read` (ownership-checked).
  Each item carries the related order's publicId for click-through into Feature 7/8's existing
  routes — no new navigation scheme invented.
- Confirmed Feature 2's `GET/PATCH /profile/me/settings` (already reading/writing
  `notification_preferences`) is **not** duplicated — this feature's own critical-event allowlist
  (specific events override any channel's preference) and Feature 2's channel-level "SMS + in-app
  always on" rule are complementary, both hold simultaneously, neither was changed.

**Known limitations / assumptions (see the handoff doc for full detail):**
- Feature 1's OTP dispatch remains a direct, synchronous call, deliberately never rerouted through
  this feature's async consumer (OTP must not wait on a queue round-trip); `OTP_REQUESTED` is
  registered in the template registry for documentation consistency only.
- Email is the "optional, no traced requirement" channel (TRD §28) — safest to cut under schedule
  pressure. WhatsApp is PRD R1.1, consciously pulled forward per explicit instruction, not scope
  creep — real Meta Cloud API integration needs Business approval, deferred to Feature 16 anyway.
- No frontend for any of this — the shared bell-icon component and full Notification Center screen
  remain separate, not-yet-started work.

---

## Feature: Courier & Tracking (Implementation Plan Phase 11 / Feature 8)

**Status:** Done — 2026-08-03. New `tracking/` module (repository/service/controller/routes/dto),
exactly where Feature 7's own mid-document patch deferred this scope to. Full backend suite
green: **404/404 tests, 38/38 suites** (136 new to this feature), confirmed non-flaky across 2
consecutive full-suite runs. Zero new Prisma models, zero new migrations — `courier_quotes`/
`tracking_events` already existed complete from the Database feature. Full contract in
`docs/handoffs/F8-courier-tracking-backend.md`, sign-off in `docs/FEATURE_8_CHECKLIST.md`.

**Two real infrastructure gaps found and resolved before writing any of the actual scoring/
booking/tracking logic** (the module doc's own "Pre-Generation Reuse Review" claimed both already
existed from an earlier "architecture phase" — neither did, the same class of gap Feature 6 found
with `PaymentAdapter`/`CourierAdapter`):
- **A Socket.IO `/tracking` gateway.** `socket.io` was an installed dependency with zero wiring
  anywhere in the codebase. Built now (`core/socket/index.ts`): `server.ts` now creates an
  explicit `http.Server` (previously a bare `app.listen()`) so Socket.IO has something to attach
  to; one `/tracking` namespace, clients join a per-order room. Initialized unconditionally at
  module load (not gated behind process bootstrap) so tests get a working, emit-capable instance
  for free — emitting to zero connected sockets is a harmless no-op.
- **A Notification producer/enqueue interface**, claimed "reserved earlier in TRD §12" —
  `modules/notification/` was, and otherwise still is, Feature 0's empty placeholder. Built only
  the minimal producer contract this feature needs (`notification.producer.ts`, a generic BullMQ
  queue) — the same "build the contract now, no consumer yet" pattern Feature 7 used for the
  `courier-assignment-pending` queue. Feature 9 owns the real dispatch consumer.

**A real pipeline gap found and fixed, not just a documentation gap:** Task 6.1's literal wording
lists the poll job's candidate orders as PICKED_UP/IN_TRANSIT/OUT_FOR_DELIVERY only. Feature 7's
state machine's only edge out of PROCESSING is PROCESSING → PICKED_UP, and nothing else in either
feature ever fires that transition — taken literally, every booked order would sit in PROCESSING
forever with no path forward at all. Fixed by including PROCESSING in the poll job's candidate
query, flagged as this feature's own correction to the doc's literal wording, not a bug report
against a spec that was actually correct.

**A real bug this feature's own tests caught: a duplicate `tracking_events` row per milestone.**
Feature 7's `transitionOrderStatus` already inserts its own `tracking_events` row on every
transition; the poll job's first pass also called a separate repository insert (carrying location
data) *before* calling `transitionOrderStatus` — two rows per genuine milestone, one with location
data and one without. Fixed by extending `transitionOrderStatus` itself with an optional
`location?: {lat, lng}` parameter (the same "add an optional param, old callers unaffected"
pattern Feature 6 used for `decrementStock`/`restoreStock`'s transaction client) and removing the
standalone insert entirely.

**What shipped:**
- `CourierAdapter` extended from Feature 6's single `getRate()` call to the full interface:
  `checkCoverage()`, `getQuote()`, `book()`, `track()`, `cancel()` — deterministic mock (three
  couriers, fixed cost/ETA/reliability, a couple of deliberate COD/general coverage gaps for
  adversarial testing, a fixed 4-step milestone progression).
- `tracking.service.ts` — `initializeShipment` (consumes Feature 7's `courier-assignment-pending`
  job, Gap #2's idempotent-scoring guard), `scoreCouriers` (COD-coverage pre-filter, parallel
  `getQuote()` calls, weighted scoring read fresh from `platform_config.courier_weights`),
  `bookCourier` (retry×3@30s per courier, fallback to next-best-scored — never random — seller
  override flagged automatically, all-fail → `PENDING_MANUAL_LOGISTICS` + notification),
  `runPollCycle` (5-min recurring job, milestone-driven `tracking_events` + Socket.IO push,
  3-consecutive-failure alert with verified reset-and-realert behavior), public/authenticated
  tracking reads (deliberately minimal, no-PII DTO, adversarially tested).
- New endpoints: `GET/POST /api/v1/orders/:id/courier-quotes`, `refresh-rates`, `book-courier`
  (Seller-only), `GET /api/v1/tracking/:orderId` (authenticated, tri-mode), `GET /api/v1/t/
  :publicToken` (public, no auth).
- `core/queue`'s `createWorker()` — this feature's first BullMQ `Worker`/consumer in the codebase
  (Feature 7 only ever produced into queues).

**Known limitations / assumptions (see the handoff doc for full detail):**
- No automated re-booking path from `PENDING_MANUAL_LOGISTICS` — Gap #4's eligibility rule is read
  literally (`PAYMENT_CONFIRMED` + `courier IS NULL` only); that status requires human (Admin/
  Support) intervention, not an automatic retry seam this feature builds.
- The 3-consecutive-poll-failure counter is in-memory, per-process — no schema column exists for
  it (would violate zero-new-migrations), and resets on a process restart.
- Coverage score is uniform among candidates already past the binary coverage pre-filter — no
  source document specifies a finer-grained signal.
- No frontend for any of this — SCR-S06's courier card/booking UI, SCR-B08, SCR-B09 all remain
  separate, not-yet-started work.

---

## Feature: Order Management (Implementation Plan Phase 10 / Feature 7)

**Status:** Done — 2026-08-02. Extends Feature 6's existing `order/` module (no parallel module) —
order retrieval, the status state machine, seller cancellation, a generic courier hand-off
enqueue, and an on-demand invoice. Full backend suite green: **364/364 tests, 33/33 suites** (84
new to this feature), confirmed non-flaky across 2 consecutive full-suite runs. Zero new Prisma
models, zero new migrations. Full contract in `docs/handoffs/F7-orders-backend.md`, sign-off in
`docs/FEATURE_7_CHECKLIST.md`.

**A real, sourced scope correction found and followed, not invented:** the module doc contains a
mid-document patch that supersedes its own original "Task 7 — Courier Booking & Tracking" section
with "Task 7 — Courier Hand-off Stub." Courier scoring, booking + retry/fallback, COD-coverage
filtering, the tracking poll job, WebSocket push, and the tracking screens are **not** this
feature's scope — deferred to Feature 8, per the doc's own correction. This also means the
previous entry's "Next" footer (written before that patch existed) was wrong to say Feature 7
would own "the full parallel courier-scoring/booking flow" — corrected below.

**The actual handoff contract to Feature 8:** this feature owns the state machine and every
transition function; Feature 8 owns the triggers. `confirmPayment(orderId)` transitions
`PAYMENT_PENDING → PAYMENT_CONFIRMED` and enqueues a generic BullMQ job with no consumer written
here. `transitionOrderStatus` is the single write path for `orders.status` in the entire
codebase (grep-audited) — Feature 8's courier-booking/poll-job code should call it directly for
every later transition, never write `orders.status` a second way.

**What shipped:**
- `core/state-machines/order.state-machine.ts` — the single canonical transition table
  (`canTransition`, `isCancellable`), imported by every caller, never redefined (TRD §3). Every
  valid edge and every adjacent invalid non-edge tested explicitly.
- `order.service.ts` — `getOrdersForBuyer`/`getOrdersForSeller` (one shared `queryOrders` builder,
  two thin role-scoped callers), tri-mode ownership on `getOrderById` (Buyer OR Seller OR
  Admin/Support — the first non-single-owner check in this codebase), commission visible only to
  the order's own Seller, shipping fields decrypted server-side for an authorized viewer only.
  `transitionOrderStatus` wraps the status write + a `tracking_events` insert + entry actions
  (`CANCELLED` restores stock via Feature 4's `restoreStock`, reused as-is; `DELIVERED` on a `COD`
  order confirms the payment as a side effect) in one transaction. `cancelOrder` — Seller-only,
  pre-shipment-only.
- A read-only return-eligibility gate on the buyer's list (`returnEligible`), batched (one query
  set per page, not N+1), gated on `platform_config.return_window_days` and no existing `returns`
  row.
- `invoice.service.ts` — an on-demand, print-friendly HTML render reusing `getOrderById` entirely
  (zero direct Prisma calls of its own); no PDF library added (none existed in this codebase); no
  `invoices` table. Commission excluded for every role, stricter than Order Detail.
- New endpoints: `GET /api/v1/orders` (Buyer), `GET /api/v1/orders/:id`, `POST
  /api/v1/orders/:id/cancel`, `GET /api/v1/orders/:id/invoice`, `GET /api/v1/seller/orders`. Role
  is always derived from the JWT, never a client-supplied `?role=` param.

**A real bug found and fixed during this feature's own closing verification, not by the user:**
the generic courier hand-off `Queue` (`bullmq`) was constructed **eagerly**, at module load, as a
top-level `const`. Since `order.service.ts` is pulled in (via `server.ts`) by nearly every test
file, and Jest gives each test file its own isolated module registry, this opened one new Redis
connection per test file — none of them ever closed. The first full-suite run after implementation
passed all 364 tests but the process never exited (`Jest did not exit one second after the test
run has completed`), the exact same class of bug the Auth feature's `redis.quit()` gap caused
earlier in this project. Fixed by making the queue **lazily constructed** (only the one test that
actually calls `confirmPayment` ever opens a connection) and exposing a `closeCourierHandoffQueue()`
for that test's `afterAll`, mirroring the existing `redis.quit()` convention. Verified fixed: a
targeted re-run exited cleanly, then 2 consecutive full-suite runs both exited cleanly.

**Not a bug, flagged for the record:** the very first full-suite confirmation run (before the fix
above was verified a second time) showed 5 failures, all `beforeEach` hook timeouts on the shared
`resetDb`/`resetRedis` test helpers, with Jest reporting a nonsensical ~13,000-second suite
duration. This was the dev machine sleeping mid-run, not a code defect — confirmed by two
subsequent clean runs (219s and 233s, both fully green) with no code changes in between.

**Known limitations / assumptions (see the handoff doc for full detail):**
- Cancel is Seller-only, not Buyer-triggerable — Gap #3's literal phrasing and App Flow SCR-S06
  both point the same way; a Buyer-initiated cancel/cancellation-request flow would be new scope.
- Seller's order list shows only the snapshotted recipient name, never phone/full address — this
  feature's own resolution of Task 4.3's vague "masked/summary" wording.
- No real trigger drives `PROCESSING → ... → DELIVERED` in this feature — only
  `transitionOrderStatus` called directly in tests, standing in for Feature 8's future poll job.
  `courierStatus` in Order Detail is always the literal `"not_booked"` until Feature 8 adds real
  courier-assignment data.
- `queryOrders` takes a fully-formed `Prisma.OrderWhereInput`, not the module doc's literal
  `{ownerColumn, ownerId}` shape — avoids losing type-safety against Prisma's strict where-clause
  typing, while keeping "one shared builder, two thin callers" in spirit.

---

## Feature: Cart & Checkout (Implementation Plan Phase 9 / Feature 6)

**Status:** Done — 2026-07-31. Backend only. First feature since Feature 4 to introduce genuinely
new domain modules (`cart/`, `address/`, `order/`'s checkout-creation slice) rather than a
composition layer. Full backend suite green: **280/280 tests, 28/28 suites** (44 new to this
feature), confirmed non-flaky across 2 consecutive full-suite runs. Module coverage: cart 98.2%,
address 98.7%, order 97.8% statements. Full contract in
`docs/handoffs/F6-cart-checkout-backend.md`, sign-off in `docs/FEATURE_6_CHECKLIST.md`.

**Three real gaps found and resolved before writing any code** (the module doc's own
"Pre-Generation Reuse Review" claimed these already existed from an "architecture phase" — they
didn't):
- **`PaymentAdapter`/`CourierAdapter`** were empty placeholders explicitly marked "implemented in
  Feature 12/8," not built at all. Built now as mock-only (same D2 shape as sms/email/storage) —
  the same "mock stub for now" resolution already used for Feature 4's AI-integration gap.
- **No idempotency-key mechanism existed anywhere.** Implemented directly in
  `checkout.service.ts` (Redis-cached full response, keyed by buyer + client key, 24h TTL).
- **`orders.ship_name` (NOT NULL) had no upstream data source** — neither `addresses` nor
  `users`/`buyer_profiles` has a name field anywhere in the base Schema Doc. Closed with a small
  migration: `addresses.recipient_name` (required at the API layer). Related:
  `addresses.contact_phone` is nullable in the DB but `orders.ship_phone` is NOT NULL — validation
  requires it even though the column itself still permits null.

**A real architectural fix this feature required, not new functionality:** Feature 4's
`decrementStock`/`restoreStock` each opened their own independent transaction — but Task 7.4
requires the stock decrement to happen inside the **same** transaction as order creation (Schema
§0's ACID guarantee). Both functions now accept an optional `Prisma.TransactionClient` parameter:
omitted, unchanged behavior (Feature 4's own tests re-verified green); passed, they participate in
the caller's transaction instead of silently opening a separate one. This was the only change to
any Feature 4 file.

**What shipped:**
- `cart/` — persisted cart, get-or-create-lazily semantics (never eagerly provisioned), add/
  update/remove line items (never a duplicate row for the same product), per-seller-grouped
  totals previewing D4's checkout split, stock-conflict flagging (item stays visible, never
  silently dropped), per-seller-group minimum-order enforcement reading `platform_config` fresh
  every call (never hardcoded).
- `address/` — this feature's first claim on `addresses` (Schema §4.4): full CRUD, field
  encryption reused from Feature 1 (never reimplemented), first-address auto-default, soft-delete
  with a last-address guard, explicit default-*change* left to Feature 2's existing endpoint
  (not duplicated).
- `order/` (checkout-creation slice) — `POST /checkout` splits the cart's eligible seller groups
  into one order per seller in a single all-or-nothing transaction: final stock re-validation,
  order + order_items snapshot creation, per-seller shipping estimate (one mock
  `CourierAdapter.getRate()` call per group, never full parallel scoring), one payment row per
  order (JazzCash/Easypaisa via the mock `PaymentAdapter.charge()`, COD with no adapter call),
  commission-rate snapshot from the seller's own override (never the platform default).
- `decrementStock`/`restoreStock` (Feature 4) now consumed by a real caller for the first time,
  exactly as documented as a forward cross-feature contract.

**Real bugs found and fixed during implementation (via this feature's own adversarial tests, not
found by the user):**
- **Own test-factory bug**: `createAddress()` wrote `line1`/`contactPhone` as plaintext directly
  via Prisma (bypassing the real encrypting service), causing every checkout test touching an
  address to 500 with "Invalid encrypted field payload" the moment `decryptField` ran. Fixed by
  encrypting in the factory too, matching what the real service always does.
- **`resetDb()`'s shared test helper would have broken on the very next test after any order was
  created**: `orders.buyer_id`/`seller_id` and `order_items.product_id` are all `onDelete:
  Restrict` (append-only order history), and `payments.order_id` is Restrict too — the existing
  delete order (product/sellerProfile/buyerProfile first) would throw a foreign-key violation the
  moment any Order row existed. Fixed by deleting `payment` then `order` (cascades `order_items`)
  before `product`/`sellerProfile`/`buyerProfile` — the same class of gap Feature 4 hit with
  `products.seller_id`, now recurring one layer deeper.
- **Own test-assertion bug, not a service bug**: the concurrent-oversell test initially asserted
  the losing request always gets exactly `409` — but if the winner's transaction fully commits
  before the loser's own pre-transaction cart-eligibility read runs, the loser correctly sees the
  depleted stock earlier and gets `422 CHECKOUT_NOT_ELIGIBLE` instead. Both are correct outcomes
  depending on legitimate timing; the test now accepts either.

**Known limitations / assumptions (see the handoff doc for full detail):**
- Shipping estimate is a single mock rate per seller group — may diverge from the eventual booked
  courier's real rate at Feature 7's Order Detail stage; flagged, not reconciled (Gap #1).
- Payment processing stops at charge()-initiation; a `PENDING` payments row is a valid terminal
  state here — retry/webhook/settlement is Feature 8 (Gap #2).
- No `cod_remittances` row is written for COD orders — Feature 8/a dedicated reconciliation
  concern.
- Checkout applies one address + one payment method to every order created in a single call —
  matches App Flow SCR-B05's one-action-→ -N-orders model, not a per-group override.

---

## Feature: Buyer Marketplace (Implementation Plan Phase 8 / Feature 5)

**Status:** Done — 2026-07-31. Backend only. Per the module doc's own central claim, this feature
is almost entirely a **thin composition layer over Feature 4** — confirmed via a grep-level reuse
audit (Task 7.4), not just asserted. Full backend suite green: **241/241 tests, 25/25 suites** (16
new to this feature), confirmed non-flaky across 2 consecutive full-suite runs. Zero new Prisma
models, zero new migrations. Full contract in `docs/handoffs/F5-marketplace-backend.md`.

**What's genuinely new (everything else is Feature 4's existing endpoints, unmodified):**
- `GET /marketplace/home` — aggregates featured + new-arrivals (both proxied by recency, no
  merchandising field exists anywhere in the schema — an explicitly documented Assumption) +
  Feature 4's own cached category tree, via `Promise.all`. Lives in a new
  `marketplace.controller.ts` file inside `modules/catalog/` (per the module doc's explicit
  Engineering Decision: no parallel `modules/marketplace/` folder, no second repository —
  everything shares `catalog.service.ts`).
- `GET /categories/:slug` — resolves a category's natural key to its id/names for the
  `/category/:slug` route, `404 CATEGORY_NOT_FOUND` for an unknown slug.

**Confirmed via direct testing, not just documentation, that zero Feature 4 backend changes were
needed:** `GET /products/search?categoryId=X` (no `q`) already worked correctly before this
feature touched anything — category-browse and text-search are genuinely one data-layer
mechanism, exactly as the module doc's Assumption states.

**Guest-access sweep (this feature's primary guarantee, since it's the platform's first fully
public-facing read surface):** every endpoint touched by this feature — new and reused — verified
`200` with zero `Authorization` header at all.

**Confirmed exclusions (per explicit direction, not oversights):** Wishlist is not built or
stubbed in any form (Future, F17); Add to Cart/Buy Now are frontend-only inert stubs (Cart &
Checkout feature's future responsibility); the seller-rating filter/sort stub is unchanged from
Feature 4.

**Known limitations / assumptions:** Homepage content is identical for Guest and authenticated
Buyer (no personalization in MVP scope); "Featured" has no real merchandising rule behind it yet.

**Frontend note (not this entry's own work, logged here for shared visibility):** the frontend
side of Features 3 and 4 (Store Setup Wizard, Store/Brand settings tab, seller product list/add/
edit screens) landed since the last entry in this log — see
`docs/handoffs/F3-Frontend-store-management.md` and `docs/handoffs/F4-Frontend-product-management.md`.

---

## Feature: Product Management (Implementation Plan Phase 7 / Feature 4)

**Status:** Done — 2026-07-30. Backend only (`apps/backend`'s catalog module +
`apps/ai-service`'s mock `/generate-listing`) — frontend screens (AddProduct/ProductEdit/
Products-list/SearchResults) are out of scope, same split as Features 1–3. Full backend suite
green: **225/225 tests, 24/24 suites** (108 belong to this feature), confirmed non-flaky across 2
consecutive full-suite runs. Catalog module coverage: 96.0% statements / 96.8% lines. Full
contract in `docs/handoffs/F4-catalog-backend.md`.

**Explicit scope decision (confirmed with the user before starting):** the AI Store Builder (Task
3) needs a real GPT-4 Vision → GPT-3.5 fallback LLM integration, which requires actual OpenAI API
keys — a different kind of work than anything built so far. Per the user's choice, this pass
implements a **mock stub**: `apps/ai-service`'s `/generate-listing` always returns a fixed,
schema-conformant listing rather than calling a real provider. The orchestration contract on the
backend side (validate → call → persist-on-success, never touch the row on failure) is exactly
what the real integration will run under later, unchanged.

**What shipped:**
- Catalog module (`modules/catalog/`): categories (read-only, tree-shaped, Redis-cached),
  product Draft creation, AI-listing orchestration, publish gating (title + image + category),
  public product detail with owner-Draft-preview, multi-image upload/remove/reorder (position
  re-sequencing, two-phase reorder to avoid unique-constraint collisions), atomic stock
  decrement/restore with system-derived `LIVE ↔ OUT_OF_STOCK` transitions, seller product list/
  edit/unpublish/soft-delete, and full bilingual tsvector search + autocomplete.
- `apps/ai-service`: new `/generate-listing` route + Pydantic schema (`app/routers/listing.py`,
  `app/schemas/listing.py`, `app/llm/client.py`) — mock-only per the scope decision above; `black`/
  `flake8`/`mypy` clean, 4/4 pytest passing.
- New reusable core pieces: `core/middleware/requireActiveSeller.ts` (composes Feature 3's
  hasStore + account-ACTIVE guarantees into one chain, applied once at the seller router-group
  level), `core/middleware/optionalAuthenticate.ts` (never 401s — lets the public product-detail
  route recognize an owning Seller previewing their own Draft without requiring a token from
  everyone else), `core/upload/imageValidation.ts` (magic-byte validation extracted out of
  `profile.service.ts` so avatar/logo/banner/product-image uploads all share one validation path
  instead of near-duplicate copies), `validateQuery` middleware (query-string counterpart to the
  existing `validateBody`, needed for the feature's first GET-with-filters endpoints).
- `decrementStock`/`restoreStock` — a documented **cross-feature contract** for the not-yet-built
  Cart & Checkout feature: fully implemented and tested (including concurrency) but has no HTTP
  route or caller yet, matching the module doc's explicit instruction to build this now since it
  operates on `products`, owned by this module.

**Real bugs found and fixed during implementation (via this feature's own adversarial tests, not
found by the user):**
- **`GET /products/:publicId` initially hid `OUT_OF_STOCK` products from everyone but the owning
  Seller** — wrong: REQ-F-Inv-003's "hidden from default results" only ever applied to search/
  listing pages, never the direct detail page. Fixed to gate only `DRAFT`/`REMOVED`.
- **Soft-delete never actually set `status: REMOVED`**, leaving that enum value permanently dead
  and undermining the fix above (the `DRAFT`/`REMOVED` distinction is meaningless if delete never
  sets `REMOVED`). Fixed to set `deletedAt` and `status: REMOVED` together.
- **`resetDb()`'s shared test helper would have started failing the moment any test created a
  product**: `products.seller_id → seller_profiles` is `onDelete: Restrict`, not `Cascade` — the
  existing teardown order (delete `sellerProfile` before touching `product`) would throw a
  foreign-key violation. Fixed by deleting `product` rows first, closing a latent gap that every
  prior feature's tests happened never to expose (none of them ever created a product row).

**Real documentation gaps found and closed:**
- **Schema §7 specifies `unaccent` for query-time diacritic-insensitive search, but the Database
  feature's original migration never created the Postgres extension.** Closed with a small
  additive migration this session.
- **`titleEn` AND `price` are both NOT NULL with no DB default** on `products` — the module doc's
  "upload a photo first" framing doesn't hold literally; Draft creation requires a minimal
  title + price upfront (Assumption, documented in the handoff doc), with AI generation later
  overwriting every AI-owned field except price.
- `product_images (product_id, position)`'s unique constraint (Task 1.2 in the module doc) was
  already present from the Database feature — no migration needed for that specific item, despite
  being listed as an expected deliverable.

**Known limitations / assumptions (see the handoff doc for full detail):**
- No `catalog.repository.ts` layer — kept consistent with `auth`/`profile`'s established
  convention of one `*.service.ts` per module, including raw search queries.
- Autocomplete uses substring/`ILIKE`-equivalent matching, not tsquery-prefix — an Engineering
  Decision the module doc explicitly permits either way.
- AI-guessed category is matched by exact slug only, no fuzzy matching.

---

## Feature: Store Management (Implementation Plan Phase 6 / Feature 3)

**Status:** Done — 2026-07-30. Extends Feature 2's profile module (no parallel store module
built — per the module doc's explicit boundary decision). Full backend suite green: **117/117
tests, 17/17 suites** (confirmed non-flaky across 3 consecutive clean runs, including the
concurrent-onboarding race test), coverage 87.45% statements / 65.83% branches / 80.74% functions
/ 89.29% lines overall (profile module: 90.68% stmts / 94.59% lines). Full contract in
`docs/handoffs/F3-store-management-backend.md`.

**Real design conflict found and reconciled before writing any code:** the module doc's Task 2
("Create Store") assumed `seller_profiles` doesn't exist until this feature creates it — insert,
catch a unique-constraint violation for race-safety. That's not true in this system: Feature 1's
`auth.service.ts` already creates a **placeholder** `seller_profiles` row the moment a Seller
account activates (`onboardingStep: 0`), exactly per the handoff contract F1 documented for this
feature. So "Create Store" is actually "**complete onboarding**" — a guarded `UPDATE ... WHERE
onboarding_completed_at IS NULL`, not an `INSERT`, with race-safety coming from the affected-row
count instead of a unique-violation catch. `hasStore` was redefined accordingly: **not** "does a
row exist" (always true post-activation) but "has onboarding actually completed"
(`onboardingCompletedAt !== null`).

**What shipped:**
- `banner_url` added to `seller_profiles` (Feature-3 schema addition, mirrors Feature 2's
  `avatar_url` precedent) via a clean hand-created migration (the recurring `search_vector`
  spurious-diff trap struck again on this migration too, stripped as always).
- **Payout wallets, previously entirely unimplemented** despite the `payout_wallets` table
  existing since the Database feature: `POST /profile/me/store` now captures ≥1 wallet
  (JazzCash/Easypaisa account number, REQ-F-Auth005), encrypted at rest via Feature 1's generic
  `encryptField` (built specifically to be reusable by exactly this kind of later feature).
- **Onboarding-step tracking, previously initialized but never advanced**: completing `POST
  /store` now sets `onboardingStep: 3` and `onboardingCompletedAt`, closing the gap between what
  Feature 1 initialized and what nothing ever completed.
- `POST`/`DELETE /profile/me/store/logo` and `/banner` — same validated-upload mechanism as
  Feature 2's avatar (magic-byte checked, 10MB ceiling), targeting `seller_profiles.logoUrl`/
  `bannerUrl` instead of `users.avatarUrl`. Both guarded by a new `requireOnboardedSeller` check.
- `GET /profile/me/store/status` — read-only, derived from `users.status`; no mutation path
  exists anywhere (tested adversarially, permanently, per the module doc's Task 6.2/7.4).
- **Correction to Feature 2's already-shipped `PATCH /profile/me`:** removed `logoUrl` as a
  directly-settable field. It previously accepted an arbitrary client-supplied URL with no
  validation; now that a real validated upload endpoint exists for logos, leaving that bypass
  open would have undercut the validation entirely. `logoUrl`/`bannerUrl` are now exclusively
  settable via the upload endpoints — a deliberate tightening, not a silent regression (Feature
  2's own test for this was updated to assert the old field is now rejected).
- `SellerProfileDTO` extended with `bannerUrl`/`hasStore`; new `StoreStatusDTO`.

**Real bugs found and fixed during this feature (not all new — some pre-existing, surfaced by
this feature's heavier test load):**
- **Pre-existing test-suite hang, present since Feature 1, only now surfaced**: no test file
  anywhere in the suite ever called `redis.quit()` — only `prisma.$disconnect()` in `afterAll`.
  Since Jest gives every test file its own isolated module registry, each file that touches Redis
  creates a brand-new `ioredis` client that's never torn down. With enough test files/connections
  accumulated, the process stopped exiting cleanly after all tests finished, hanging indefinitely
  (piped output never flushed, looked identical to a real deadlock until confirmed otherwise via
  `pg_stat_activity`, an isolated ioredis connectivity check, and process CPU-time sampling
  showing zero progress). Fixed by adding `await redis.quit()` to all 14 test files that touch
  Redis (13 already had a `prisma.$disconnect()` afterAll to extend; `rbac.test.ts` had no afterAll
  at all and needed one added).
- **Own test bug, not a service bug**: `store.test.ts`'s logo-removal test used an arbitrary
  `mock://storage/...` URL that didn't match `extractStorageKey()`'s real expected prefix
  (`config.storage.publicBaseUrl`/`bucket`), so the delete-on-remove assertion failed even though
  the actual service code was correct — same gotcha `avatar.test.ts` had already correctly worked
  around. Fixed by constructing the mock URL with the real config prefix, matching that precedent.
- **Suspicious file corruption caught before it shipped**: mid-session, `profile.controller.ts`
  was found with a nonsensical line of text appended after its last valid statement (not
  something introduced by any edit made here) — flagged to the user as a possible injection
  rather than silently "fixed and forgotten," then removed once confirmed to be corrupted,
  non-functional content. Full suite re-verified clean afterward.

**Known limitations / assumptions (see the handoff doc for full detail):**
- Wallet editing after onboarding (add/remove/change default) is out of scope — a separate
  Wallet & Payout feature (SCR-S09). Wallets are captured once, at `POST /store`, only.
- Task 6.4's "block writes when `status !== ACTIVE`" cross-check was deliberately not built as a
  separate gate — the module doc itself calls it largely defensive, since a suspended/banned
  account's sessions are already immediately revoked by Auth's existing mechanism
  (REQ-F-Auth006); a suspended Seller's token stops working at `authenticate` before it ever
  reaches a store endpoint.
- Wizard step-by-step progress is frontend-only state — the server only ever sees the final
  `POST /store` submission (no draft/partial persistence anywhere, matching the schema).

---

## Feature: User Profiles (Implementation Plan Phase 5 / Feature 2)

**Status:** Done — 2026-07-29. Full backend test suite green: **76/76 tests, 16/16 suites**,
coverage 87.1% statements / 65.3% branches / 78.6% functions / 88.8% lines overall (profile
module itself: 91.6% stmts / 95.8% lines). Full contract in
`docs/handoffs/F2-profiles-backend.md`.

**What shipped:**
- **New storage adapter** (`adapters/storage/`) — approved by the user before building, since it
  wasn't in the original module doc. Same D2 shape as `sms`/`email` (interface + mock + live) but
  deliberately **not** gated by `ADAPTER_MODE` — always live, since there's no meaningful mock
  beyond an in-memory test stub. `LiveStorageAdapter` wraps `@aws-sdk/client-s3`, works against
  MinIO (dev) or real S3 (prod) purely via env config, with an idempotent `ensureBucket()`
  (create + public-read policy) run on first use.
- `users.avatar_url` column added (Feature-2 addition, not in the base Schema Doc) via a clean
  hand-created migration (the recurring `search_vector` spurious-diff issue struck again and was
  stripped, as documented in the Auth entry below).
- Full profile module (`modules/profile/`): `GET /me` (role-branched `ProfileDTO` — Buyer/Seller/
  Admin each get a distinct shape, Admin intentionally minimal per confirmed App Flow check),
  `PATCH /me` (Seller store/brand fields), `PATCH /me/default-address` (Buyer, transactional
  swap), `POST`/`DELETE /me/avatar` (multer + magic-byte validation, never trusts client
  mimetype), `POST /me/password` (re-auth, reuses Auth's exact bcrypt/revocation utilities —
  nothing reimplemented), `GET`/`PATCH /me/settings` (notification channels + language,
  server-enforced non-disableable critical channels per REQ-F-Notif004).
- Password-complexity validation on change-password imported directly from Auth's
  `passwordSchema` — confirmed assumption, never redefined.
- Swagger/OpenAPI wired up for the first time (`core/swagger/`, `swagger-jsdoc` +
  `swagger-ui-express`, mounted at `/api-docs`) — every profile endpoint documented via JSDoc
  `@swagger` blocks directly on `profile.routes.ts`, reusable pattern for all future modules.
- Dedicated adversarial test sweep (Task 7): every protected route checked for 401 with no/garbage
  token, plus explicit 403 checks for role violations (Buyer hitting Seller-only routes and vice
  versa) and address-ownership violations.

**Real bugs found and fixed during implementation (via the Task 7 adversarial tests, not found by
the user):**
- **Session-revocation timing race** — the most significant bug this feature surfaced. Comparing
  the standard JWT `iat` claim (whole-second precision) against a millisecond-precision Redis
  mass-revocation timestamp was wrong in *both* directions: truncated to seconds, a genuinely-
  revoked "other device" session issued in the same wall-clock second could wrongly survive, while
  change-password's revoke-then-immediately-reissue-a-fresh-token-for-this-device flow could
  wrongly reject its own brand-new token. Fixed by adding a custom millisecond-precision `iatMs`
  claim to the access token (`core/jwt/index.ts`) and comparing real millisecond timestamps on
  both sides (`core/middleware/authenticate.ts`). Verified non-flaky via 3 consecutive clean full
  test-suite runs.
- **Garbage refresh cookie caused a 500, not a 401** — a malformed `jti` (not UUID-shaped) reached
  a Prisma query against a `@db.Uuid` column and Postgres rejected it as invalid input syntax,
  surfacing as an unhandled 500. Fixed with a `UUID_PATTERN` check in `auth.tokens.ts`'s
  `parseCookieValue` before any DB query runs.
- **`MulterError` (oversized avatar upload) was unhandled**, would have been a 500 — added
  explicit handling in `core/middleware/errorHandler.ts` mapping `LIMIT_FILE_SIZE` → 400
  `AVATAR_TOO_LARGE`, other Multer errors → 400 `VALIDATION_ERROR`.
- A `core → modules` import-direction violation was introduced (and caught before it shipped)
  while extracting cookie-session helpers — fixed by creating `core/http/session.ts` as the true
  owner of `REFRESH_COOKIE_NAME`/`RefreshMeta`, with `auth.tokens.ts` re-exporting from it instead
  of the reverse.

**Known limitations / assumptions (see `docs/handoffs/F2-profiles-backend.md` for the
frontend-facing detail):**
- No editable phone/email/display-name anywhere in this feature — neither App Flow screen
  (SCR-S10, SCR-B12) lists one.
- Admin/Support `GET /me` returns identity fields only — confirmed against App Flow AD01-AD08
  (none is a self-profile screen); flagged as something to revisit if that changes later.
- Full address CRUD (add/edit/delete) is out of scope — only default-address selection exists,
  against the already-seeded `addresses` table.
- Avatar URLs are public-read, non-expiring links (not presigned) — a deliberate call, confirmed
  with the user, since there's no privacy requirement for avatar images and presigned URLs going
  stale would just produce broken images later.

---

## Feature: Frontend Foundation (Day 1, Feature 0)

**Status:** Done — 2026-07-29. Standalone shell only, no backend calls wired yet. Full contract
in `docs/handoffs/F0-foundation-frontend.md`.

**What shipped:** design tokens (UIUX §5/§11, light+dark, CSS vars + AntD `ConfigProvider`
theme), i18n (`react-i18next`, EN/UR `common` bundle, Zustand-driven language/direction switch),
IBM Plex Sans/Plex Sans Arabic + lazy Noto Nastaliq Urdu fonts, routing skeleton
(`react-router-dom`, one placeholder per feature area, no guards yet), provider composition
(`QueryClientProvider` + `ConfigProvider` + router), a shared axios client typed to the backend's
`ApiEnvelope`, and four shared component shells (`SkeletonLoader`, `toast`, `Modal`,
`EmptyState`).

**Real bug found and fixed:** a top-level `src/App.tsx` importing from the `src/app/` folder
hit `TS2303: Circular definition of import alias` — on case-insensitive filesystems (Windows,
this dev machine) `./app` and `./App.tsx` resolve to the same path. Fixed by moving the root
component into `app/AppProviders.tsx` and deleting the top-level `App.tsx`; `main.tsx` now
imports directly from `./app`.

**Verified:** `pnpm install` (via `npx pnpm@9`, corepack couldn't write to `Program Files` in
this sandbox — documented as a possible one-off environment quirk, not a repo issue), `tsc
--noEmit` clean, `vite build` clean, dev server booted and driven headless with Playwright
(Chromium) — all four placeholder routes render, zero console errors, UIUX color/type tokens
visibly applied in the screenshot.

**Known limitations:** RTL/Urdu flip is wired (i18n + AntD `direction` + `<html dir>`) but not
yet manually eyeballed, since no header/nav component with a language switcher exists yet — first
feature to add one should do that check. `@karobarai/shared` added as a real frontend dependency
for the first time (just the `Language` type today).

---

## Feature: Authentication (Implementation Plan Phase 3)

**Status:** Done — 2026-07-28. Memurai installed, full suite verified end-to-end; every endpoint
also manually smoke-tested via Thunder Client. Code pushed to GitHub once all endpoints confirmed
working.

**What shipped:**
- `core/crypto/fieldCipher.ts` — AES-256-GCM field encryption + HMAC-SHA256 blind indexing, keys
  HKDF-derived from `FIELD_ENCRYPTION_KEY`. Reusable by later features (addresses, wallets), not
  auth-only.
- `core/jwt/` — pure RS256 sign/verify, split out from the refresh-token lifecycle specifically
  so `core/middleware` never has to import from `modules/` (would've inverted the intended
  core←modules layering).
- `modules/auth/auth.tokens.ts` — refresh-token issue/rotate/revoke. Refresh tokens are **not**
  JWTs (an opaque `<jti>.<secret>` pair, DB-lookupable, hash-only storage). Two Redis denylist
  mechanisms: `denylist:jti:<jti>` (single-session kill — logout, superseded rotation) and
  `denylist:user:<publicId>` (mass revoke — password reset, future admin suspend/ban). Refresh
  rotation includes reuse detection (replaying an already-rotated token mass-revokes the user).
- `modules/auth/auth.otp.ts` — 6-digit OTP, Redis-only, `GETDEL`-based single-use on success,
  wrong guesses restore the code (5 attempts against one code) rather than burning it on a typo.
- `modules/auth/auth.lockout.ts` — 5 fails/15 min → 30-min lock (REQ-F-Auth007), keyed on
  `blindIndex(normalized identifier)` so phone and email logins share one bucket type.
- `adapters/sms/` — first real D2 adapter implementation (interface + mock + live-stub),
  previously just a placeholder. `adapters/email/` — new, needed for password-reset delivery to
  email-registered accounts (no REQ-ID for this; added because forgot-password needs *a*
  delivery channel for non-phone accounts).
- Full endpoint set: register (mobile+OTP / email+password), otp/verify, otp/resend, login,
  refresh, logout, forgot-password, reset-password, `/me`. Contract fully documented in
  `docs/handoffs/HO-F1-Auth.md`.
- `authenticate` + `authorize` middleware (`core/middleware/`) — structurally split so any token
  problem is 401 and any role problem is 403, per App Flow's global UI-state requirement.
- `/ready` endpoint (`modules/health/health.routes.ts`) — added alongside Auth since it's the
  first real Redis dependency; checks Postgres + Redis with a **2-second bounded timeout**.
- `packages/shared` enums (`UserRole`/`UserStatus`/`Language`) and error codes
  (`AUTH_ERROR_CODES`) populated for frontend reuse.

**Real bugs found and fixed during implementation (not just written blind):**
- **`/ready` itself hung indefinitely** the first time it was tested — ioredis retries connection
  attempts forever by default (required elsewhere for BullMQ), so a bare `redis.ping()` never
  rejects when Redis is down. Fixed with a `Promise.race` timeout wrapper. Exactly the kind of
  "confusing mid-request hang" this endpoint exists to prevent, so it was worth catching in the
  endpoint meant to prevent it.
- **Schema bug: `users.phone`/`phone_bidx` were `NOT NULL`**, which made email-only registration
  literally impossible (TRD §7 requires mobile+OTP *or* email+password). Found while writing
  `register()`, fixed with a proper new migration (`make_phone_optional`) making both nullable
  plus a `chk_users_has_identifier` CHECK requiring at least one of phone/email.
- **That same migration's auto-generated SQL tried to `DROP INDEX idx_products_search`** and
  drop a phantom "default" on the generated `search_vector` column — Prisma's diff engine doesn't
  understand `GENERATED ALWAYS AS ... STORED` columns (declared as `Unsupported("tsvector")` in
  schema.prisma) and treated the real generated column as unexplained drift it wanted to strip.
  Removed both statements by hand before applying. **This will resurface on every future
  migration that touches `products`** — always re-check generated migration SQL before applying.
- `RateLimitError`/`ValidationError`/etc. in `core/errors/AppError.ts` only supported a fixed
  per-class error code; extended all subclasses to accept an optional `code` override so
  endpoint-specific codes (`OTP_RESEND_LIMIT`, `ACCOUNT_LOCKED`, etc.) could be surfaced at the
  same HTTP status without inventing new status codes outside TRD §9's enumerated list.

**Known limitations / assumptions (see `docs/handoffs/HO-F1-Auth.md` for the frontend-facing ones):**
- No IP-based rate limiting on `/login`/OTP endpoints — per-identifier lockout only. Conscious
  scope decision (confirmed with the user), not an oversight; TRD §18's general IP-rate-limit
  middleware is cross-cutting and wasn't built in Phase 2 either.
- `SellerProfile` is created with a placeholder store name at activation time, not deferred to
  the (out-of-scope) store-setup wizard — see the explicit handoff contract in
  `docs/handoffs/HO-F1-Auth.md`.
- Password-reset tokens live in Redis only (30-min TTL), no `password_reset_tokens` table —
  consistent with Schema Doc §11's stated principle for short-lived auth state.
- RS256 keys and `FIELD_ENCRYPTION_KEY` are dev-only, generated via a one-off `node -e` command;
  `.env.example` flags that production needs secrets-manager-issued values instead.

---

## Feature: Database (Implementation Plan Phase 4)

**Status:** Done — 2026-07-28

**What shipped:**
- Complete `apps/backend/prisma/schema.prisma`: 25 base tables from `docs/KarobarAI-05-Schema.md`
  §4, plus 3 tables added by the binding addenda — `payout_wallets` (§14.1), `seller_daily_stats`
  (§15.1), `seller_recommendations` (§15.2). 19 enums. All FK/cascade rules per §5.
- All 6 corrections from addenda §14/§15 applied: wallet columns moved off `seller_profiles` into
  `payout_wallets`; `settlements.gross` defined as `orders.subtotal` (never `shipping_fee`);
  `orders.ship_*` fields split per the explicit encryption spec (city/province/postal stay plain
  for courier-coverage queries); `returns` has no `deleted_at` (status enum is the lifecycle,
  per §14.5); `returns.seller_id` denormalized (§15.5); `seller_profiles.onboarding_step` /
  `onboarding_completed_at` added (§15.6).
- Constraints Prisma's schema DSL can't express, added by hand-editing the generated migration
  SQL (`prisma/migrations/20260728160924_init/migration.sql`) instead of being silently dropped:
  - `products.search_vector` as a real `GENERATED ALWAYS AS (...) STORED` tsvector column
    (`'simple'` config, EN+UR bilingual) + GIN index (§7)
  - Partial unique indexes (`WHERE deleted_at IS NULL`) on `users.phone_bidx`, `users.email_bidx`,
    `payout_wallets(seller_id, type, account_number)`
  - Partial index `idx_products_live`
  - 6 CHECK constraints incl. `chk_settlements_net` (`net = gross - commission`, §14.2)
- `prisma/seed.ts`: seeds the 5 `platform_config` keys from §4.25 (commission rate, courier
  weights, return window, min order value, returns confidence threshold) and 8 starter bilingual
  categories (EN/UR).
- Local Postgres set up: native PostgreSQL 18 (not Docker) on the dev machine, dedicated
  `karobarai` role/database created (matches `.env.example` — only the host differs:
  `localhost` for native, `postgres` for Docker Compose).
- Fixed a real bug this surfaced: env-loading was CWD-dependent, so running commands from
  `apps/backend` vs the repo root picked up `.env` differently (or not at all). Fixed in two
  places: `apps/backend/src/core/config/index.ts` now walks up to find the repo root
  (`pnpm-workspace.yaml`) regardless of CWD; Prisma CLI scripts (`prisma:generate`,
  `prisma:migrate`, `prisma:seed`, `prisma:studio`) use `dotenv-cli` pointed at the root `.env`.

**Verified (not just written):**
- `prisma migrate dev` applied the hand-edited migration cleanly; `prisma migrate status` reports
  "up to date" (no drift) afterward.
- `prisma generate` succeeds (previously failed with the Feature-0 model-free schema — see below).
- `\d products` confirms `search_vector` is a genuine generated column; direct SQL confirms all 6
  CHECK constraints and all partial indexes exist.
- Seed ran; verified via direct `psql` query that `platform_config` and `categories` rows are
  correct, including Urdu rendering.
- A Prisma Client smoke script queried real rows end-to-end (`category.count()`,
  `platformConfig.count()`, a `findUnique` by slug).
- Backend `tsc --noEmit` and Jest suite still green after all schema/config changes.

**Known limitations / assumptions:**
- `prisma migrate dev`'s shadow-database step required granting the `karobarai` role `CREATEDB`
  and `pg_signal_backend` locally — one-time, documented in README for the second developer.
- Local dev Postgres is native (v18) on this machine, not the Docker Compose `postgres` service
  (v16) — nobody has actually booted the Docker stack yet (no Docker installed in this sandbox).
  The `.env` here points at `localhost`; the committed `.env.example` still defaults to the Docker
  service hostname for whoever runs `docker compose up`.
- `tracking_events` and `product_images`/`cart_items` skip a couple of doc-listed plain indexes
  where a composite unique index already leads with the same column (avoids redundant indexes) —
  called out inline in `schema.prisma` comments where this decision was made.

---

## Feature: Project Foundation (Implementation Plan Phase 1, partial Phase 2)

**Status:** Done — 2026-07-28

**What shipped:**
- Monorepo: `apps/frontend` (React 18 + TS + Vite + PWA scaffold), `apps/backend` (Express + TS),
  `apps/ai-service` (FastAPI), `packages/shared` (placeholder types/errors/enums), `infra/`
  (Docker Compose + Nginx config + a Dockerfile per service).
  - Renamed from the TRD's literal `apps/web` / `apps/api` to `apps/frontend` / `apps/backend`
    per explicit user request (package names, workspace config, Dockerfiles, compose, README all
    updated to match).
- Root `package.json` (pnpm workspaces), `.env.example` (every TRD §27 variable), `.gitignore`,
  `.nvmrc` (20) / `.python-version` (3.11), `tsconfig.base.json` (strict TS).
- `apps/backend`: typed error hierarchy (`AppError` → `ValidationError`/`AuthError`/etc, TRD §14),
  central error middleware, response envelope (`{success, data, error, timestamp}`, TRD §9), pino
  logger, config loader, Redis/BullMQ connection stubs, `/health` endpoint, empty
  `schema.prisma` (datasource/generator only, at this stage), folder stubs for every module
  (`auth/`, `catalog/`, `cart/`, ...) and adapter (`payment/`, `courier/`, `sms/`, ...).
- `apps/ai-service`: FastAPI `/health`, folder stubs for `llm/`, `vision/`, `cnn/`, `schemas/`.
- Docker Compose: web/api/ai-service/postgres/redis/minio/nginx, ai-service has no host port
  (TRD §8 — internal-only), Nginx routes `/api` → api, `/` → the Vite dev server with HMR
  websocket upgrade.

**Verified (not just written):**
- `pnpm install` succeeds across the workspace.
- `apps/backend`: `tsc --noEmit` clean, Jest passes (`/health` returns the correct envelope),
  `tsc` production build compiles, and the compiled `dist/server.js` was actually booted and
  curled — real 200 response. Also verified booting via plain `cd apps/backend && npm run dev`
  (not just `pnpm` from the root) since the user wanted that exact workflow to work.
- `apps/frontend`: `tsc --noEmit` clean, `vite build` succeeds (service worker + manifest
  generated). Fixed a real bug found here: a `tsc -b`/`noEmit` conflict and a missing
  `skipLibCheck` that broke on `vite-plugin-pwa`'s type declarations.
- `apps/ai-service`: `pytest` passes, `black`/`flake8`/`mypy` all clean.
- `packages/shared`: typechecks clean.
- `infra/docker-compose.yml`: valid YAML (checked with a Python parser) — **not** run through
  actual `docker compose up`, since Docker isn't installed in this sandbox. Flagged to the user
  as something to verify on their own machine.

**Known limitations / assumptions:**
- Docker was never actually run here — compose file is syntactically valid but unverified live.
- Dependency versions are pinned but were not checked against the live npm registry for latest
  patch releases.
- Jest coverage gate temporarily set to 0% (can't hit the TRD's 80% target with zero features
  built yet) — needs ratcheting up as real modules land.
- Sandbox has Node 24 / Python 3.13 installed vs. the TRD's Node 20 LTS / Python 3.11 — everything
  tested fine on the newer versions, but `.nvmrc`/`.python-version` pin the TRD's versions.
- Did not touch: GitHub repo creation, branch protection, CI workflows, PR templates (Playbook
  Tasks 1/12) — out of scope for "runs locally," not requested.

---

*Next: Feature 12 (Admin Panel) is done — Feature 13 (AI Store Builder) is next per the
day-by-day plan. Its module doc (`docs/modules/13_ AI Store Builder.md`, 613 lines) was checked
for completeness before writing this line (same discipline established after the Feature 10→11
mistake): the header shows a stale "Draft — Response 1 of 3," but the doc's own last "Response 3
of 3" status line near the end confirms Tasks 1–6 + Validation & Consistency Review are all
present — not yet read in full otherwise, so no claims about its actual task content or
dependencies beyond that completeness check. **Carried-forward gaps for whoever starts Feature
13 or any later feature:** `cod_remittances` (the ledger row itself), the `DELIVERED → COMPLETED`
transition trigger, and real courier/payment-gateway integrations remain open (Feature 8's
original list). `platform_config.commission_rate_default` has zero live consumers anywhere in
this codebase (Feature 12's own finding, above) — `SellerProfile.commissionRate` is set only by
its Prisma schema default (`0.0500`) at account-activation time, never from this config key;
worth fixing in Auth's seller-activation flow whenever that file is next touched, not urgent on
its own. `SettlementStatus.ON_HOLD` exists in the schema and is written by no code path — a
natural fit for a future Admin manual settlement-hold/override action, not built anywhere yet.*
