# Handoff — F8 Courier & Tracking (Backend → Frontend, and Backend → Feature 9)

**Status:** Backend complete — 2026-08-03. New `tracking/` module (repository/service/controller/
routes/dto), matching TRD §12's folder layout exactly where Feature 7's own patch always intended
it. Full backend suite green — see `docs/DoneTillNow.md`'s Feature 8 entry for the exact final
count, confirmed non-flaky across 2 consecutive full-suite runs. Zero new Prisma models, zero new
migrations — `courier_quotes` and `tracking_events` both already existed complete from the
Database feature.

**This is the feature that actually implements courier scoring/booking/tracking that Feature 7's
own mid-document patch deferred here — read the whole doc, not just the endpoint list, since two
real infrastructure gaps surfaced before any of that logic could be built.**

---

## Two real gaps found before writing any of Tasks 2–7 (flagged, then resolved — not silently patched)

The module doc's own "Pre-Generation Reuse Review" claimed two pieces of infrastructure already
existed from an earlier "architecture phase." Neither did — the exact same class of gap Feature 6
found with `PaymentAdapter`/`CourierAdapter`:

1. **A Socket.IO `/tracking` gateway.** `socket.io` was an installed dependency
   (`package.json`) with **zero wiring anywhere** in the codebase — no `Server` instantiation, no
   namespace, nothing. Built now (`core/socket/index.ts`): `initSocketServer(httpServer)` attaches
   a Socket.IO server to the same `http.Server` `server.ts` now creates explicitly (previously a
   bare `app.listen()`), with one `/tracking` namespace; clients `subscribe` to a per-order room
   (`order:<orderId>`) so a viewer only receives that order's own updates. `initSocketServer()` is
   called **unconditionally** at `server.ts` module load (not inside the `require.main` guard) so
   tests importing `app` get a working, emit-capable instance too — emitting to zero connected
   sockets is a harmless no-op, verified via a spy in the poll-job tests rather than a real
   WebSocket client.
2. **A Notification producer/enqueue interface.** The doc claims this was "reserved earlier in
   TRD §12" — `modules/notification/index.ts` was, and otherwise still is, Feature 0's empty
   placeholder (`export {}`). Built only the minimal producer contract this feature needs
   (`notification.producer.ts`: `enqueueNotification()`, a generic BullMQ queue
   `notifications-pending`) — same "build the contract now, no consumer yet" pattern Feature 7
   used for the `courier-assignment-pending` queue. Feature 9 owns the actual consumer (real SMS/
   in-app/WhatsApp dispatch) and the rest of that module's shape.

Also extended (not gaps, but real build work this feature owns): `CourierAdapter` previously only
had `getRate()` (Feature 6's single-estimate call) — added `checkCoverage()`, `getQuote()`,
`book()`, `track()`, `cancel()`, with a deterministic mock (three couriers, fixed cost/ETA/
reliability figures, a couple of deliberate COD/general coverage gaps for adversarial testing, and
a fixed 4-step milestone progression for `track()`).

## A real pipeline gap found and fixed (not a documentation gap — a logic bug the doc's own wording would have caused)

Task 6.1's literal wording lists the poll job's candidate orders as **PICKED_UP/IN_TRANSIT/
OUT_FOR_DELIVERY only**. Feature 7's state machine's only edge out of `PROCESSING` is
`PROCESSING → PICKED_UP`, and **nothing else in either feature ever fires that transition**. Taken
literally, every booked order would sit in `PROCESSING` forever with no path to `PICKED_UP` at
all — the pipeline the Flow diagram describes (Booking → Tracking Registration → Shipment
Timeline) would structurally never advance. Fixed by including `PROCESSING` in the poll job's
candidate query (`tracking.repository.ts`'s `findActiveShipmentOrders`) — flagged as this
feature's own correction, not a literal reading of Task 6.1.

## A second real bug found during implementation: a duplicate tracking_events row per milestone

Feature 7's `transitionOrderStatus` already inserts **its own** `tracking_events` row on every
transition (no location data). My first pass at the poll job also called a separate
`appendTrackingEvent()` repository method (with `location_lat`/`location_lng`) **before** calling
`transitionOrderStatus` — producing **two** rows per genuine milestone, one with location data and
one without. Caught by this feature's own poll-job tests (an unexpected extra row appeared).
Fixed by extending `transitionOrderStatus` itself with an optional `location?: {lat, lng}`
parameter (Feature 7 Task 6.1, extended — the same "add an optional param, old callers
unaffected" pattern Feature 6 used for `decrementStock`/`restoreStock`'s transaction client), and
removed the standalone `appendTrackingEvent` method entirely — every genuine milestone this
feature tracks also doubles as a canonical status transition, so there is no legitimate case left
for a second, separate insert path.

## The handoff contract Feature 7 described, honored exactly

- `transitionOrderStatus` remains the **only** place in the entire codebase that writes
  `orders.status` — grep-audited (`tests/tracking/reuseAudit.test.ts`, mirroring Feature 7's own
  audit). This feature calls it at every real transition site: booking success (`→ PROCESSING`),
  all-couriers-fail (`→ PENDING_MANUAL_LOGISTICS`), and every poll-driven milestone
  (`PROCESSING → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED`).
- The `courier-assignment-pending` BullMQ job Feature 7's `confirmPayment()` enqueues now has its
  first and only consumer (`startCourierAssignmentConsumer()`, wired at process bootstrap only —
  never during tests, which call `initializeShipment()` directly instead, the same pattern
  Feature 7 used for `confirmPayment`/`transitionOrderStatus` having no real trigger of their own
  at the time).
- The COD delivery-confirms-payment side effect (Feature 7 Task 6.3) is **not** re-implemented
  here — verified as an integration test (`tests/tracking/pollJob.test.ts`) that a poll-driven
  `DELIVERED` transition on a COD order flips `payments.status` to `CONFIRMED`, exactly as
  Feature 7's own entry action already does.
- `COMPLETED` is **not** invented as a transition anywhere in this feature (Task 7.6) — no source
  document specifies what triggers `DELIVERED → COMPLETED`; flagged as a carried-forward gap for
  Feature 12, not fabricated.

## Endpoints

### Seller-only — `/api/v1/orders/:id/*`, mounted alongside (not replacing) Feature 7's own order routes

- **`GET /orders/:id/courier-quotes`** — the scored, ranked list (`CourierQuotesDTO`). `422
  COURIER_QUOTES_NOT_READY` if scoring hasn't happened yet. Ownership re-checked via Feature 7's
  `getOwnedOrderRow` (a Seller who isn't this order's own Seller gets `403 ORDER_NOT_OWNED`, not
  just "any Seller can see any quotes").
- **`POST /orders/:id/refresh-rates`** — re-scores and **replaces** the existing `courier_quotes`
  rows (delete + recreate in one transaction) — the one exception to Gap #2's idempotent-scoring
  default. `422 ORDER_NOT_COURIER_ELIGIBLE` if the order is no longer eligible (already booked, or
  not `PAYMENT_CONFIRMED`).
- **`POST /orders/:id/book-courier`** — body `{ courierCode }`. Retries the requested courier up
  to 3× (30s apart in production — env-overridable via `COURIER_RETRY_DELAY_MS` for tests), then
  falls back to the next-best-scored courier from the same ranked list (never random/first-
  remaining), repeating the retry sequence for each candidate in turn. On success: `orders.
  courier`/`tracking_no` set, the winning `courier_quotes` row flagged `selected`, status →
  `PROCESSING` — all in one transaction, then the (reused, not duplicated) status transition.
  Booking a courier other than the top-scored one sets `orders.courier_overridden = true`
  automatically (Task 4.6). If every candidate exhausts its retries, the order lands in
  `PENDING_MANUAL_LOGISTICS` and a Seller notification is enqueued — this is a normal `200`
  response with that status, not an HTTP error (it's a legitimate terminal outcome for this
  action, not a client mistake). `409 COURIER_ALREADY_BOOKED` / `422
  ORDER_NOT_COURIER_ELIGIBLE`/`INVALID_COURIER_SELECTION` for the guarded failure cases.

### Tracking reads

- **`GET /api/v1/tracking/:orderId`** (authenticated) — tri-mode ownership, reusing Feature 7's
  `getOwnedOrderRow` directly (Buyer, Seller, or Admin/Support of the order).
- **`GET /api/v1/t/:publicToken`** (public, **no** auth middleware, ever) — resolves purely via
  `orders.tracking_token` (already existed from Feature 6/Schema §4.10 — no new token generation).
  Both reads return the **same minimal `TrackingDTO` shape**: `status`, `courier`, `trackingNo`,
  `deliveryStageLabel`, `lastLocation`, `timeline` — genuinely no PII fields (name/phone/address)
  in either version, adversarially tested by asserting the raw response body never contains the
  order's known recipient name/phone/address strings.

## Known limitations / assumptions (flagged explicitly, not silently decided)

1. **No automated re-booking path from `PENDING_MANUAL_LOGISTICS`.** Gap #4's eligibility rule
   ("courier-selection-eligible only when `status = PAYMENT_CONFIRMED`") is read literally —
   an order that landed in `PENDING_MANUAL_LOGISTICS` after an all-couriers-fail is **not**
   re-eligible through `book-courier` again. Feature 7's state machine does allow
   `PENDING_MANUAL_LOGISTICS → PROCESSING`, but that edge is for a human (Admin/Support)
   resolving the situation out-of-band, not an automated retry seam this feature builds.
2. **Coverage score is uniform (1) among candidates that already passed the coverage pre-filter.**
   `platform_config.courier_weights.coverage` still contributes to the weighted score, it just
   can't differentiate further among survivors of Task 3.1's binary filter — no source document
   specifies a finer-grained coverage signal.
3. **The 3-consecutive-poll-failure counter is in-memory, per-process**, not a database column —
   there's no schema column for it (adding one would violate this feature's zero-new-migrations
   constraint), and REQ-F-Track006 doesn't specify persistence. Resets on any successful poll;
   lost on a process restart (a genuinely stuck shipment would need 3 more consecutive failures
   after a restart to re-alert — an acceptable MVP tradeoff, not silently ignored).
4. **`getQuote()`'s reliability figures are static per courier** (mock, D2) — no real historical
   on-time-delivery data exists to compute this from; Feature 16's live adapter swap-in would need
   a real source for this input.
5. **No frontend for any of this** — SCR-S06's courier recommendation card/Confirm & Book/override
   dropdown, SCR-B08 (authenticated live tracking), and SCR-B09 (public tracking page) are all
   separate, not-yet-started work. The backend's `TrackingDTO`/`CourierQuotesDTO` shapes and the
   `/tracking` Socket.IO namespace (events: `order_status_update`, `tracking_location_update`) are
   ready for it.

## Reuse audit (`tests/tracking/reuseAudit.test.ts` + updates to Feature 7's own audit)

- Exactly one `CourierAdapter` implementation set (`index.ts`/`mock.ts`/`live.ts`), no second
  adapter.
- Exactly one Socket.IO server construction site (`core/socket/index.ts`), grepped across the
  entire `src/` tree.
- `tracking.repository.ts` never writes `orders.status` — only the two non-status columns
  (`courier`/`trackingNo`/`courierOverridden`) Schema §4.10 reserved for this feature.
- `transitionOrderStatus` remains the sole `orders.status` writer in `src/` (Feature 7's own audit,
  re-verified unaffected).
- No `transitionOrderStatus(..., 'COMPLETED')` call anywhere in this feature (Task 7.6).
- No `tracking_events` deletion/archival code (Task 7.4 — REQ-F-Track007's ≥12-month retention).
- No new Prisma model added — `CourierQuote`/`TrackingEvent` already existed; schema scanned for
  absence of any plausible new model name.
- Feature 7's own files (`order.service.ts`, `invoice.service.ts`, `order.controller.ts`,
  `order.routes.ts`) still contain zero references to `modules/tracking`, `CourierAdapter`, or
  `socket.io` — checked from both features' test suites (Task 8.7's "both codebases" instruction).
