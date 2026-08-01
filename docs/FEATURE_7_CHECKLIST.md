# Feature 7 — Order Management: Sign-off Checklist

Backend scope only (`apps/backend`) — frontend screens (SCR-B07 Buyer Orders, SCR-S05/SCR-S06
Seller Orders, invoice view/print) are a separate, not-yet-started deliverable. Full narrative
contract: `docs/handoffs/F7-orders-backend.md`. Progress-log entry: `docs/DoneTillNow.md`.

## Task 1 — Module Extension Decision

- [x] Extends Feature 6's existing `order/` module (`checkout.service.ts` stays scoped to
      checkout-creation only; `order.service.ts` is new and owns everything after an order row
      exists) — no parallel module, per Task 1.1's explicit instruction.
- [x] No `order.repository.ts` — consistent with the no-repository-layer convention (catalog/
      cart/address/checkout).
- [x] Zero new Prisma models, zero new migrations — every table this feature writes to already
      existed from the Database feature.

## Task 2 — Order Retrieval

- [x] One shared `queryOrders(where, cursor, limit)` query builder, two thin role-scoped callers
      (`getOrdersForBuyer`/`getOrdersForSeller`) — not two separate SQL/Prisma bodies (tested:
      each list only ever returns the requester's own orders).
- [x] Canonical tab → status-group mapping (`ORDER_STATUS_TABS`, `packages/shared`) — imported by
      both callers, never redefined per role (tested per tab).
- [x] Cursor-based pagination (`cursor`/`limit`/`nextCursor`), matching Feature 4/5's exact list
      pattern (tested: 3 orders, `limit=2` → 2 items + `nextCursor`, page 2 → 1 item + `null`).
- [x] `GET /api/v1/orders/:id` — tri-mode ownership (Buyer OR Seller OR Admin/Support), the first
      non-single-owner check in this codebase (tested: owning buyer, owning seller, unrelated
      buyer 403, unrelated seller 403, Admin/Support 200).

## Task 3 — Return-Eligibility Gate

- [x] Read-only `returnEligible` flag on the buyer's list only — never on the seller's list
      (tested, `undefined` on seller items).
- [x] Batched (not N+1): one `Promise.all` combining `platform_config.return_window_days`, the
      existing-`returns`-row check, and `deliveredAt`, regardless of list page size.
- [x] Eligible only when `DELIVERED`/`COMPLETED`, within the window, and no existing `Return` row
      (tested: within-window+no-return → true; past-window → false; existing-return → false;
      non-delivered → false).

## Task 4 — List DTO Shape / Seller PII

- [x] Buyer list `counterpartyName` = seller's `storeName`; Seller list `counterpartyName` = the
      order's snapshotted recipient name only, never phone/full address (Task 4.3's "masked/
      summary" — this feature's own resolution, documented as an Assumption in the handoff doc).

## Task 5 — Order Detail / Commission Visibility

- [x] `commission: {rate, amount} | null` present only when the requester is the order's own
      Seller — never Buyer (tested), never Admin/Support either (literal reading of Task 5.1,
      tested).
- [x] Shipping `line1`/`line2`/`phone` decrypted server-side for an authorized viewer only, never
      returned as ciphertext (tested via direct plaintext-match on the response).

## Task 6 — Order Status Management

- [x] `core/state-machines/order.state-machine.ts` — the single canonical transition table
      (`canTransition`, `isCancellable`), imported by every caller, never redefined (TRD §3).
      Every valid edge and every adjacent-but-invalid non-edge tested explicitly
      (`tests/order/stateMachine.test.ts`).
- [x] `transitionOrderStatus` is the single write path for `orders.status` in the entire codebase
      — grep-audited (`tests/order/reuseAudit.test.ts`), not just asserted.
- [x] Entry actions wired in: `CANCELLED` restores stock via Feature 4's `restoreStock` (passed
      the transaction client, zero second increment implementation, tested: stock += quantity);
      `DELIVERED` on a `COD` order sets `payments.status = CONFIRMED` (Gap #4, tested); a non-COD
      `DELIVERED` leaves the payment row untouched (tested).
- [x] Every `tracking_events` row insert happens inside the same transaction as the status write
      (tested: event row exists with the correct status/description after a valid transition).
- [x] Invalid transitions rejected with `422 INVALID_STATUS_TRANSITION`, status left untouched
      (tested, including terminal-status and skip-a-step attempts).

## Task 7 — Courier Hand-off Stub *(replaces the original "Courier Booking & Tracking" per the
module doc's own mid-document patch)*

- [x] `confirmPayment(orderId)` transitions to `PAYMENT_CONFIRMED` and enqueues a **generic**
      BullMQ job (`courier-assignment-pending`, payload `{orderId}` only) — no scoring/adapter
      logic inside it (tested: queue `.add()` called once with the right payload).
- [x] **No consumer** reads this queue in this feature — Feature 8 owns writing it.
- [x] Explicitly confirmed absent (grep-audited): no `tracking.service.ts`, no `tracking/` module
      content beyond Feature 0's placeholder, no `courier_quotes` writes, no Socket.IO `/tracking`
      namespace, no BullMQ poll job, no `CourierAdapter` call in any of this feature's own files.

## Task 8 — Invoice

- [x] `invoice.service.ts` — reuses `getOrderById` entirely, zero direct Prisma calls of its own
      (grep-audited).
- [x] No `invoices` table/migration — a derived, on-demand render, not persisted state.
- [x] Rendered as print-friendly HTML (no PDF library added — none existed in this codebase, and
      the module doc's own fallback for exactly this situation is HTML + browser print-to-PDF).
- [x] Commission excluded from the invoice for every role, including the order's own Seller
      (tested) — stricter than Order Detail's seller-only visibility, flagged as this pass's own
      interpretation of Task 8.2.
- [x] Snapshotted text fields HTML-escaped before interpolation (tested with a malicious product
      title containing `<script>`).
- [x] Tri-mode ownership, same as Order Detail (tested: buyer/seller/admin 200, stranger 403).

## Task 9 — Validation & Testing

- [x] Integration suite: `tests/order/stateMachine.test.ts` (unit, no DB), `retrieval.test.ts`,
      `lifecycle.test.ts`, `invoice.test.ts`, `reuseAudit.test.ts` (static scan) — 84 new tests
      for this feature (12 pre-existing `checkout.test.ts` tests re-verified green, unmodified).
- [x] State-machine adversarial coverage — every valid edge, every adjacent invalid non-edge,
      both terminal statuses, tested explicitly.
- [x] Cross-role/cross-user ownership adversarial tests — Buyer-vs-Seller, Buyer-vs-Buyer,
      Seller-vs-Seller, unauthenticated, wrong-role, all rejected with the correct 401/403/404.
- [x] Happy-path lifecycle test: `confirmPayment` → cancel (stock restored) **and**, separately,
      a simulated full `DELIVERED` path with the COD payment-confirmation side effect → invoice
      download — since this feature has no real trigger past `PAYMENT_CONFIRMED`, the
      shipment-progress path is exercised by calling `transitionOrderStatus` directly, standing
      in for Feature 8's future poll-job caller (documented in the handoff doc, not hidden).
- [x] Courier-failure adversarial testing (retry/fallback/manual-logistics/poll-failure) —
      correctly **not** built here per Task 9's own correction; moved to Feature 8's Task 9.
- [x] Full reuse audit (grep-based, recorded below) — zero duplicate status-write paths, zero
      duplicate stock-increment implementations, zero `tracking/` module content, zero
      `CourierAdapter` calls in this feature's own files, zero new `invoices` table.
- [x] This checklist file.

### Reuse audit — grep results (verbatim, `tests/order/reuseAudit.test.ts`, 9/9 passing)

```
second `.order.update(...status:...)` write sites outside transitionOrderStatus: none found
second `stock: { increment` sites in order.service.ts: none — restoreStock (catalog.service.ts) reused as-is
modules/tracking content beyond the Feature-0 placeholder: none
CourierAdapter references in order.service.ts/invoice.service.ts/order.controller.ts/order.routes.ts: none
courier_quotes (CourierQuote) writes under modules/order: none
invoices table/model in schema.prisma: none; invoice.service.ts direct prisma.* calls: none
```

## Documentation Gaps — final status

| # | Item | Status |
|---|---|---|
| 1 | Gap #1 (payment-confirmation trigger) | Resolved as designed: this feature owns the state machine + `confirmPayment`/`transitionOrderStatus`; Feature 8 owns the webhook trigger |
| 2 | Gap #2 (Invoice as new entity?) | Resolved: derived/on-demand render, no new table |
| 3 | Gap #3 (seller-permitted manual transitions) | Resolved: cancel-only, seller-only, pre-shipment-only |
| 4 | Gap #4 (COD delivery confirms payment) | Resolved: wired as a `transitionOrderStatus` entry action; `cod_remittances` ledger row still deferred to Feature 8 |
| 5 | Courier scoring/booking/tracking (Task 7's original scope) | Deferred to Feature 8 per the module doc's own mid-document patch |

## Test results

Full backend suite, including this feature's 84 new tests plus the pre-existing 280 — see
`docs/DoneTillNow.md`'s Feature 7 entry for the exact final count, confirmed non-flaky across 2
consecutive full-suite runs.

## Sign-off

Backend scope: **complete**. Frontend scope (SCR-B07, SCR-S05/SCR-S06, invoice view/print
trigger): **not started** — a distinct, separate piece of work for whoever picks up this
feature's UI.
