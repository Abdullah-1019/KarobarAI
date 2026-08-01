# Handoff — F7 Order Management (Backend → Frontend, and Backend → Feature 8)

**Status:** Backend complete — 2026-08-01. Extends Feature 6's existing `order/` module (no new
top-level module) with everything after an order row exists: retrieval, the status state machine,
seller cancellation, a generic courier hand-off enqueue, and an on-demand invoice. Zero new Prisma
models, zero new migrations — every table this feature writes to (`orders`, `order_items`,
`tracking_events`, `payments`) already existed from the Database feature.

**Read this before building against it — the scope boundary with Feature 8 (Courier & Tracking)
is load-bearing, not incidental.**

---

## The module doc's own mid-document scope patch (followed literally, not reinterpreted)

The module doc (`docs/modules/7_ Order Management.md`) contains an explicit correction midway
through: the original "Task 7 — Courier Booking & Tracking" section is superseded by "Task 7 —
Courier Hand-off Stub", with a "Follow-on Edits Elsewhere" table correcting Tasks 5/8/9 to match.
This is a real, sourced correction from the team's own doc, not something this pass decided —
followed exactly:

- Courier scoring, booking + retry/fallback, COD-coverage filtering, the all-fail manual-logistics
  path, seller override, the 5-minute tracking poll, WebSocket push, and both tracking screens
  (SCR-B08/SCR-B09) are **out of scope for this feature** — deferred to Feature 8.
- **Confirmed absent from this feature's codebase** (grep-audited in `tests/order/reuseAudit.test.ts`,
  not just asserted): no `tracking.service.ts`, no `tracking/` module content (the folder is still
  just Feature 0's empty placeholder), no `courier_quotes` writes, no Socket.IO wiring, no BullMQ
  poll job, no `CourierAdapter` calls anywhere in this feature's own new files.
- `docs/DoneTillNow.md`'s previous "Next" footer (written at the end of Feature 6, before this
  patch existed in the doc) said Feature 7 would own "the full parallel courier-scoring/booking
  flow" — that's now wrong, superseded by the module doc's own later correction. Feature 8 owns it.

## The actual handoff contract to Feature 8

This feature owns the **state machine and every transition function**; Feature 8 owns the
**triggers** that call them:

- **`confirmPayment(orderId)`** (`order.service.ts`) — transitions `PAYMENT_PENDING →
  PAYMENT_CONFIRMED` and enqueues a generic BullMQ job (`courier-assignment-pending`, payload
  `{orderId}`, no scoring/adapter logic inside it) — **no consumer reads this queue in this
  feature**. Feature 8's webhook handler (payment-gateway confirmation) is the intended caller;
  this feature never implements webhook receipt or HMAC verification itself.
- **`transitionOrderStatus(orderId, targetStatus, actor, description?)`** — the **single** write
  path for `orders.status` in this entire codebase (grep-audited: zero other `.order.update(...
  status:` sites anywhere in `src/`). Feature 8's courier-booking/poll-job code should call this
  directly for every `PROCESSING → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED`
  transition — **never write `orders.status` a second way**. Invalid transitions throw
  `422 INVALID_STATUS_TRANSITION`; the full valid-edge table lives in
  `core/state-machines/order.state-machine.ts` and is imported, never redefined, by any caller.
- **Entry actions already wired into `transitionOrderStatus`**, so Feature 8 gets them for free by
  calling the same function: `CANCELLED` restores stock for every item (reuses Feature 4's
  `restoreStock`, passed the transaction client — never a second increment implementation);
  `DELIVERED` on a `COD` order sets `payments.status = CONFIRMED` (Gap #4 — COD's "confirmation" is
  a logistics event, not a gateway webhook). The `cod_remittances` ledger row itself is **not**
  written here — still Feature 8's/a dedicated reconciliation feature's job.
- Since this feature has no automatic caller that drives `PROCESSING → ... → DELIVERED`, that
  entire path was tested by calling `transitionOrderStatus` directly (simulating what Feature 8's
  poll job will eventually do) — see `tests/order/lifecycle.test.ts`.

## Endpoints

### Buyer — `/api/v1/orders*`, mounted on the existing `order/` module

- **`GET /orders`** — Buyer-only (`authorize('BUYER')`). `?tab=Pending|ConfirmedProcessing|
  Shipped|Delivered|Cancelled` maps to a canonical `OrderStatus[]` group via the shared
  `ORDER_STATUS_TABS` constant (`packages/shared`) — imported by both the buyer and seller list
  paths, never redefined per role. Cursor-paginated (`cursor`/`limit`/`nextCursor`), same shape as
  Feature 4/5's list endpoints — **not** the "page/limit + meta.totals" wording the module doc's
  Task 2 text loosely uses; Task 2.4 itself says to reuse Feature 4/5's exact pattern, which this
  does. Each item carries `returnEligible?: boolean` — a read-only gate (Task 3.4), computed by one
  batched query (not per-row), true only for `DELIVERED`/`COMPLETED` orders still inside
  `platform_config.return_window_days` **and** with no existing `returns` row (`Return.orderId` is
  unique, so this is a plain existence check, never a full state machine).
- **`GET /orders/:id`** — **tri-mode ownership**: the requester must be the order's own Buyer OR
  Seller OR Admin/Support — the first ownership check in this codebase that isn't strictly
  single-owner (cart/address/catalog are all single-owner). `commission: {rate, amount} | null` is
  present **only** when the requester is the order's own Seller — never Buyer, and (per a literal
  reading of Task 5.1) never Admin/Support either. Shipping `line1`/`line2`/`phone` are decrypted
  server-side for an already-authorized viewer only, never sent as ciphertext. `courierStatus` is
  hardcoded `"not_booked"` — always, since no real courier data exists in this feature's scope.
  `cancellable` reflects the state machine directly (`isCancellable(status)`).
- **`POST /orders/:id/cancel`** — **Seller-only** (not Buyer-triggerable — see the Assumption
  below). Cancellable only from a pre-shipment status (`PAYMENT_PENDING`/`PAYMENT_CONFIRMED`/
  `PROCESSING`/`PENDING_MANUAL_LOGISTICS`); `422 ORDER_NOT_CANCELLABLE` otherwise. Restores stock
  as a `transitionOrderStatus` entry action, returns the updated `OrderDetailDTO`.
- **`GET /orders/:id/invoice`** — tri-mode ownership, same as detail. Returns `text/html`, not
  JSON or a PDF — see the invoice section below.

### Seller — `/api/v1/seller/orders`, Seller-only

- **`GET /seller/orders`** — same tab/cursor contract as the buyer list, same shared query
  builder. `counterpartyName` is the order's **snapshotted recipient name only** (`ship_name`) —
  never phone or full address, which stay Order-Detail-only. This is this feature's own resolution
  of Task 4.3's vague "buyer (masked/summary per PII rules)" wording — flagged as an Assumption,
  not a literally-sourced rule.

**Role is always derived from the authenticated JWT (`req.user.role`, via `authorize()`), never a
client-supplied `?role=` query param** — a deliberate deviation from the module doc's literal
`?role=buyer` phrasing, since a client-suppliable role param on a role-scoped list is spoofable and
redundant with the token's own claim.

## Invoice (Task 8) — an on-demand render, not a persisted entity

`invoice.service.ts` calls `getOrderById` directly and does **zero direct Prisma queries of its
own** (grep-audited) — it's a pure view over data this feature's own retrieval function already
authorizes and shapes. No `invoices` table, no migration (Gap #2's explicit resolution: an invoice
is a derived artifact, not new state).

Rendered as **print-friendly HTML**, not a PDF — no PDF/templating library (`puppeteer`,
`handlebars`, `pug`, ...) exists anywhere in this codebase, and adding one for a single on-demand
document would be a real new dependency for one feature's convenience. This is the module doc's
own explicit fallback for exactly this situation. The browser's native "Print to PDF" produces
the PDF a user actually wants, with zero new dependencies. **Commission is excluded from the
invoice for every role, including the order's own Seller** — stricter than Order Detail's
seller-only commission visibility, since an invoice is treated as an external-facing financial
document (this feature's own interpretation of Task 8.2, not a separately sourced rule). All
snapshotted text fields (`titleSnapshot`, shipping name/address) are HTML-escaped before
interpolation — tested with a deliberately malicious product title.

## Assumptions (flagged explicitly, not silently decided)

1. **Cancel is Seller-only, not Buyer-triggerable.** Gap #3's literal phrasing ("Sellers may
   manually trigger only PAYMENT_CONFIRMED → PROCESSING... and cancellation from any pre-shipment
   state") and App Flow's SCR-S06 (the only screen with a cancel control) both point the same way.
   If product wants a Buyer-initiated cancel/cancellation-request flow later, that's new scope, not
   a bug in this implementation.
2. **Seller's order list shows only the recipient name, never phone/address** (Task 4.3's "masked/
   summary" is otherwise unspecified) — a minimal-PII-exposure reading, reversible later if the
   real UI needs more on the list itself.
3. **Invoice excludes commission for every role**, stricter than Order Detail — see above.
4. **`queryOrders` takes a fully-formed `Prisma.OrderWhereInput`, not the doc's literal
   `{ownerColumn, ownerId}` shape** — a dynamically-computed Prisma where-clause key risks losing
   type-safety against Prisma's strict `OrderWhereInput`; each thin caller (`getOrdersForBuyer`/
   `getOrdersForSeller`) builds its own `where` object and passes it to one shared builder,
   preserving "one shared builder, two thin callers" in spirit without the type-unsafety.

## Reuse audit (`tests/order/reuseAudit.test.ts` — a static source scan, not just a claim)

- `transitionOrderStatus` is the only site in `src/` that writes `orders.status` (regex-scanned
  across every `.ts` file, one legitimate hit inside itself, zero elsewhere).
- `restoreStock` (Feature 4) is reused as-is, passed the transaction client — zero second
  `stock: { increment }` site anywhere in `order.service.ts`.
- `modules/tracking/` is still exactly Feature 0's placeholder (`export {}` + a comment) —
  untouched by this feature.
- No `CourierAdapter` reference in any of this feature's own new files (`order.service.ts`,
  `invoice.service.ts`, `order.controller.ts`, `order.routes.ts`) — `checkout.service.ts`'s
  existing Feature 6 call is pre-existing and out of this feature's scope, left untouched.
- No `courier_quotes` (`CourierQuote`) writes anywhere under `modules/order`.
- No `invoices` table/model exists in `schema.prisma`; `invoice.service.ts` contains zero direct
  `prisma.*` calls.

## Known limitations (see `docs/FEATURE_7_CHECKLIST.md` for the task-by-task sign-off)

- No frontend for any of this — SCR-B07 (Buyer Orders list + detail), SCR-S05/SCR-S06 (Seller
  Orders list + detail with cancel), and an invoice-view/print trigger are all separate,
  not-yet-started work.
- `DELIVERED`/shipment-progress transitions have no real trigger in this feature — only
  `transitionOrderStatus` called directly in tests. Feature 8's poll job is the first real caller.
- `courierStatus` in Order Detail is always the literal string `"not_booked"` until Feature 8 adds
  real courier-assignment data to read.
