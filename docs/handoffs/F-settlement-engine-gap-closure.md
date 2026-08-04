# Handoff — Settlement Engine Gap Closure (unblocks Feature 11 Task 2 / Feature 12 Task 2 GMV)

**Status:** Done — 2026-08-04. New `settlement/` module (`settlement.repository.ts`,
`settlement.service.ts`, `index.ts`). Full backend suite green: **606/606 tests, 63/63 suites**,
confirmed non-flaky across 2 consecutive full-suite runs. Zero new Prisma models/migrations —
`settlements` already existed complete from the Database feature; this is the first code path
that ever writes to it.

## Why this exists

Not a numbered Implementation Plan feature — **no feature in the entire 16-feature module list
(0–15) owns "Payments/Settlement Engine" as its own deliverable.** Feature 11's Task 2 (Revenue
Aggregation) and Feature 12's Task 2 (Dashboard GMV) both specify `SUM(net) OVER settlements
WHERE status=SETTLED` as their literal data source, and both module docs' dependency lines assume
this table is already populated by some prior feature. It never was — confirmed via
`grep -rln "settlement.create\|prisma.settlement" apps/backend/src` returning zero hits before
this pass. Flagged as a known limitation in both `docs/handoffs/F11-analytics-backend.md` and
`docs/DoneTillNow.md`'s Feature 11 entry; built now, before starting Feature 12, so Feature 12's
own Dashboard KPI work lands against real numbers instead of another documented zero.

## The trigger: return-window closed, not delivery itself

An order becomes settlement-eligible once `deliveredAt + platform_config.return_window_days` has
passed **and** there is nothing left that could still turn into a refund. Settling immediately at
`DELIVERED` was rejected — a buyer can file a return any time inside the window, and settling
before that would misstate the seller's revenue the moment a refund followed. Concretely, an
order qualifies when:
- `status IN (DELIVERED, COMPLETED)` and `deliveredAt <= now - return_window_days`,
- no `Settlement` row exists yet (`Settlement.orderId` is unique — this doubles as the
  idempotency guard against a poll cycle re-processing an already-settled order), and
- either no `Return` was ever filed for the order, **or** the one that was ended in `CLOSED`
  (rejected/abandoned, no refund paid). A `Return` still active in any other status holds the
  order back until it resolves; a `Return` that reached `REFUND_ISSUED` **excludes the order
  permanently** — it must never be settled.

`return_window_days` is read from `platform_config` each cycle, never hardcoded — same discipline
Features 6/7/10 already established for `min_order_value_pkr`/the return-eligibility check
itself. (This is the third independent copy of the same 3-line `platformConfig.findUnique({...
'return_window_days' })` read, after `order.service.ts` and `returns.service.ts` — a conscious,
minimal duplication, same call `returns.service.ts` already made rather than introducing a new
cross-module shared helper for a 3-line predicate.)

## Settlement math

`gross = order.subtotal` (never `shippingFee`, per Schema §14.2's own comment on the model).
`commission = gross * order.commissionRateSnapshot`, rounded to 2dp with `ROUND_HALF_UP` before
computing `net = gross - commission` — done explicitly in JS rather than relying on Postgres's
column-scale rounding, so the values handed to `prisma.settlement.create()` are already exactly
self-consistent with the `chk_settlements_net` CHECK constraint (`net = gross - commission`)
regardless of DB-side rounding behavior. `status` is set to `SETTLED` immediately, `settledAt =
now` — there is no `PENDING`→`SETTLED` staged transition, because no real payout/banking gateway
exists anywhere in this codebase to gate that on (mock-only, same reasoning as every other
adapter this session: `PaymentAdapter.charge()/refund()`, courier `book()`/`track()`).

## Poll job — mirrors Feature 8's tracking poll job exactly

`startSettlementPollJob()` is structurally identical to `tracking.service.ts`'s
`startTrackingPollJob()`: a BullMQ repeatable job (`createQueue`/`createWorker` from
`core/queue`), only ever invoked from `server.ts`'s `require.main === module` bootstrap guard —
never during tests, and never reachable from any request handler (grep-audited). Tests call
`runSettlementCycle()` directly, the same pattern `tracking`'s own tests use for `runPollCycle()`.
Interval is 24h (`POLL_INTERVAL_MS`), not tracking's 5 minutes — settlement eligibility only
changes once return-window day-boundaries are crossed, not in near-real-time, so a daily cadence
is enough and avoids unnecessary DB load. One order's creation failure (e.g. two overlapping
cycles racing into `Settlement.orderId`'s unique constraint) is caught per-order and logged, never
failing the whole cycle for every other order — tested directly with a mocked one-time throw.

## What this does **not** do

- No `PayoutWallet` disbursement, no bank transfer, no `cod_remittances` reconciliation — a
  `Settlement` row reaching `SETTLED` means "this seller's revenue for this order is finalized
  and no longer at refund risk," not "money has moved." Real payout execution remains a
  Feature 12+/Feature 16 (External APIs) concern, unchanged.
- No admin-facing override/manual-settlement endpoint — if this needs to be forced early or held
  (`ON_HOLD`, the third `SettlementStatus` value, currently unused by any code path) for a
  specific order, that is Admin Panel (Feature 12) surface, not built here.
- Does not touch `Return`/`Order`/`Product` tables — grep-audited read-only over everything except
  `settlements` itself.

## Verified

- `tsc --noEmit` clean.
- 15 new tests (`tests/settlement/settlementCycle.test.ts`, `reuseAudit.test.ts`): correct
  gross/commission/net computation, window-not-closed exclusion, config-driven cutoff (not
  hardcoded), open-return exclusion, `REFUND_ISSUED`-return exclusion, `CLOSED`-return inclusion,
  idempotency (a second cycle never double-creates), non-`DELIVERED`/`COMPLETED` exclusion,
  one-order-failure isolation, and the reuse-audit grep checks above.
- Full backend suite run twice consecutively: 606/606 tests, 63/63 suites both times.
- Feature 11's `tests/analytics/revenue.test.ts` (already using synthetic `createTestSettlement`
  rows) was re-run unchanged and still passes — this gap closure is purely additive, no existing
  test needed to change.
