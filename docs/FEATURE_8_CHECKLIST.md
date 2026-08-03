# Feature 8 — Courier & Tracking: Sign-off Checklist

Backend scope only (`apps/backend`) — frontend screens (SCR-S06's courier card/booking/override,
SCR-B08 authenticated tracking, SCR-B09 public tracking) are a separate, not-yet-started
deliverable. Full narrative contract: `docs/handoffs/F8-courier-tracking-backend.md`.
Progress-log entry: `docs/DoneTillNow.md`.

## Task 1 — Courier Foundation

- [x] `tracking/` module scaffolded: `tracking.repository.ts`, `tracking.service.ts`,
      `tracking.controller.ts`, `tracking.routes.ts`, `tracking.dto.ts` — matches TRD §12's
      folder layout, no `*.repository.ts` naming deviation (this module is the one legitimate
      exception to the no-repository-layer convention, per the module doc's own explicit
      Engineering Decision reconfirming Feature 7's original boundary call).
- [x] Zero new Prisma models/migrations — `courier_quotes`/`tracking_events` already existed
      complete from the Database feature.
- [x] Route groups mounted: `/api/v1/orders/:id/courier-quotes` (GET), `/api/v1/orders/:id/
      refresh-rates` (POST), `/api/v1/orders/:id/book-courier` (POST), `/api/v1/tracking/:orderId`
      (GET, authenticated), `/api/v1/t/:publicToken` (GET, public — no prior stub route actually
      existed to "fill"; registered fresh).
- [x] Public `/t/:publicToken` route carries **no** authenticate middleware, verified with a
      bare (no-header) request returning 200.
- [x] Grep-confirmed: `tracking.repository.ts` never writes `orders.status`; all status changes
      route through Feature 7's `transitionOrderStatus` (imported, not reimplemented).

## Task 2 — Shipment Initialization

- [x] `initializeShipment(orderId)` — consumes the exact `courier-assignment-pending` job Feature
      7's `confirmPayment()` already enqueues (`startCourierAssignmentConsumer`, wired at process
      bootstrap only, never during tests).
- [x] Reuses Feature 7's order fetch pattern (no second order-repository query implementation).
- [x] Gap #4 eligibility guard: only proceeds if `status = PAYMENT_CONFIRMED` and `courier IS
      NULL`; a redelivered job against an order that's already moved on is a safe, logged no-op
      (tested).
- [x] Destination/COD-flag correctly extracted from the order's own frozen `ship_*` snapshot, not
      the buyer's current address book.

## Task 3 — Courier Selection

- [x] `scoreCouriers()` — COD-coverage filter applied **before** scoring (never wastes a
      `getQuote()` call on a non-covering courier), parallel `getQuote()` calls, weighted scoring
      read fresh from `platform_config.courier_weights` every time (never hardcoded — tested by
      changing the config value directly and confirming the resulting top-scored courier changes
      without a code deploy).
- [x] `courier_quotes` rows written once per order (Gap #2's idempotency — tested: re-processing
      an already-scored order does not duplicate rows).
- [x] `GET /orders/:id/courier-quotes` — Seller-only, ownership-checked, `422
      COURIER_QUOTES_NOT_READY` before scoring completes (tested).
- [x] `POST /orders/:id/refresh-rates` — explicit re-score, **replaces** (delete+recreate in one
      transaction) rather than appending (tested: quote count stays constant, not doubled).

## Task 4 — Shipment Booking

- [x] `bookCourier()` — retry×3 spaced by `config.courier.retryDelayMs` (30s in production,
      env-overridable for tests) against the requested courier, then falls back to the
      **next-best-scored** remaining candidate (never random/first-remaining — tested explicitly:
      forcing the top-scored courier's `book()` to fail 3× routes booking to the 2nd-ranked
      courier by score, not an arbitrary one).
- [x] On success: `orders.courier`/`tracking_no` + the winning `courier_quotes.selected` set in one
      transaction, then `transitionOrderStatus(orderId, 'PROCESSING')` — grep-confirmed no direct
      `orders.status` write alongside it.
- [x] All-couriers-exhausted path: `transitionOrderStatus(orderId, 'PENDING_MANUAL_LOGISTICS')` +
      one Seller notification enqueued (tested via a queue-add spy, not real delivery).
- [x] Seller override: booking a non-top-scored courier from the same ranked list sets
      `courier_overridden = true` automatically (tested); booking the top-scored courier leaves it
      `false` (tested).
- [x] `409 COURIER_ALREADY_BOOKED` for a re-booking attempt; `422
      ORDER_NOT_COURIER_ELIGIBLE`/`INVALID_COURIER_SELECTION` for the other guarded cases (tested).
- [ ] **Frontend not built**: SCR-S06's "Confirm & Book Courier" button + override dropdown.

## Task 5 — Tracking Registration

- [x] `orders.tracking_token` reused as-is (Feature 6/Schema §4.10, already unique-indexed) — no
      new token field or generation logic.
- [x] `GET /t/:publicToken` — deliberately minimal, no-PII DTO (adversarially tested: raw response
      body never contains the order's known recipient name/phone/address strings); `404
      TRACKING_TOKEN_INVALID` for an unknown/malformed token, never a 500.
- [x] `GET /tracking/:orderId` — authenticated, tri-mode ownership reusing Feature 7's
      `getOwnedOrderRow` directly (owning Buyer/Seller/Admin all `200`, unrelated party `403`).
- [ ] **Frontend not built**: SCR-B09 (public tracking page), SCR-B08 shell (authenticated
      tracking page).

## Task 6 — Shipment Timeline

- [x] 5-minute recurring BullMQ job (`startTrackingPollJob`, wired at process bootstrap only) —
      candidate query corrected to include `PROCESSING` alongside `PICKED_UP`/`IN_TRANSIT`/
      `OUT_FOR_DELIVERY` (a real gap found and fixed — see handoff doc; the module doc's literal
      candidate list would have left every booked order permanently stuck in `PROCESSING`).
- [x] Only a genuine milestone change appends a `tracking_events` row (tested: an unchanged poll
      result is a no-op, no duplicate row, no re-transition).
- [x] Every poll-driven status advance goes through `transitionOrderStatus` exclusively — extended
      with an optional `location` parameter (this feature's own addition to Feature 7's function,
      avoiding a second, duplicate `tracking_events` insert path — a real bug this feature's own
      tests caught and fixed, see handoff doc).
- [x] Socket.IO emit (`order_status_update`, `tracking_location_update`) on every new
      `tracking_events` row, on the existing (now real, previously unbuilt) `/tracking` namespace.
- [x] 3-consecutive-poll-failure alert enqueued once at the threshold; a subsequent success resets
      the counter so a later 3-failure streak alerts again (tested explicitly — proves the reset
      actually happens, not just that the counter is capped).
- [ ] **Frontend not built**: SCR-B08's live map-down text-only degradation UI.

## Task 7 — Delivery Status Synchronization

- [x] The poll job's own candidate query naturally excludes an order the moment it reaches
      `DELIVERED` (no separate stop-flag needed) — tested.
- [x] Verified as an **integration** test, not re-implemented: a poll-driven `DELIVERED` transition
      on a COD order flips `payments.status` to `CONFIRMED`, exactly via Feature 7's own existing
      entry action.
- [x] Final delivery notification enqueued once, immediately after the `DELIVERED` transition
      succeeds (tested).
- [x] Zero `tracking_events` deletion/archival code anywhere in this feature (REQ-F-Track007's
      ≥12-month retention — grep-confirmed).
- [x] `COMPLETED` is correctly **not** invented as an automatic transition anywhere in this feature
      (grep-confirmed) — flagged as a carried-forward gap for Feature 12, per the module doc.

## Task 8 — Validation & Testing

- [x] Integration suite: `tests/tracking/scoring.test.ts`, `booking.test.ts`, `pollJob.test.ts`,
      `tracking.test.ts`, `reuseAudit.test.ts` — new tests for this feature (see
      `docs/DoneTillNow.md` for the exact count).
- [x] Courier-failure adversarial set: single-courier-fails-then-fallback (booking still
      succeeds), all-couriers-exhausted (`PENDING_MANUAL_LOGISTICS` + notification), 3-consecutive
      poll failures (alert + reset-and-realert verified) — all three pass.
- [x] Cross-role/cross-user ownership adversarial set: non-owning Seller blocked from quotes/
      booking (`403`), Buyer blocked from Seller-only routes (`403`), unrelated Buyer/Seller
      blocked from authenticated tracking (`403`), unauthenticated blocked everywhere except the
      public route (`401`).
- [x] Public-tracking PII adversarial test: response body scanned for the order's own known PII
      strings (recipient name, phone) and known PII field names — zero matches.
- [x] Full reuse audit (grep-based, recorded below) — zero second `CourierAdapter`/Socket.IO/
      `orders.status`-write mechanism, zero new Prisma models, zero `tracking_events`
      deletion code.
- [x] This checklist file.
- [x] Cross-checked against Feature 7's own reuse audit (Task 8.7) — updated two of Feature 7's
      tests whose literal assertions ("nothing exists under `modules/tracking`/no socket.io
      anywhere") were only ever meant to guard *Feature 7's own scope*, not forbid this feature
      from existing; re-scoped to check Feature 7's own files specifically, which remain clean.

### Reuse audit — grep results (verbatim, `tests/tracking/reuseAudit.test.ts`, all passing)

```
second CourierAdapter implementation (index/mock/live only): none found
second Socket.IO server construction site outside core/socket/index.ts: none found
tracking.repository.ts writing orders.status: none — only courier/trackingNo/courierOverridden
transitionOrderStatus(..., 'COMPLETED') anywhere in this feature: none found
tracking_events deletion/archival code: none found
new Prisma model added for this feature: none — CourierQuote/TrackingEvent pre-existing
Feature 7's own files referencing modules/tracking, CourierAdapter, or socket.io: none found
```

## Documentation Gaps — final status

| # | Item | Status |
|---|---|---|
| 1 | Checkout-time estimate vs. booked-courier actual cost divergence (Feature 6/7 Gap #1) | Resolved by decision (not reconciliation): `orders.shipping_fee`/`total_amount` stand as checkout set them; `courier_quotes.cost` holds the actual figure for reference only |
| 2 | `DELIVERED → COMPLETED` transition trigger | Explicitly flagged, not invented — carried forward to Feature 12 |
| 3 | Real courier provider integration | Explicitly deferred — Feature 16 |
| 4 | Webhook verification, payment retry, settlement engine, `cod_remittances` ledger | Explicitly deferred (unchanged from Feature 7) — Feature 12 |
| 5 | Notification dispatch internals (actual SMS/WhatsApp/in-app delivery) | Explicitly deferred — this feature only enqueues; Feature 9 owns the consumer |
| 6 | No automated re-booking path from `PENDING_MANUAL_LOGISTICS` | This feature's own documented Assumption — a deliberate scope boundary, not an oversight |

## Test results

See `docs/DoneTillNow.md`'s Feature 8 entry for the exact final pass/fail counts, confirmed
non-flaky across 2 consecutive full-suite runs.

## Sign-off

Backend scope: **complete**. Frontend scope (SCR-S06's courier card/booking UI, SCR-B08, SCR-B09):
**not started** — a distinct, separate piece of work for whoever picks up this feature's UI.
