# **KarobarAI — Engineering Execution Playbook**

## **Feature 8: Courier & Tracking**

**Source of truth:** PRD · TRD · App Flow · Backend Schema · Implementation Plan (Docs 1–6). No architecture, schema, API contract, business rule, workflow, or folder structure is invented beyond what these documents specify. Gaps are marked **Assumption**; reuse-vs-extend calls are marked **Engineering Decision**.

**Depends on:** Feature 0 (Foundation — adapter factory, ADAPTER\_MODE, Socket.IO gateway stub, BullMQ wiring), Feature 1 (Authentication), Feature 4 (Product Management), Feature 6 (Cart & Checkout — creates orders, single-estimate getRate() call at checkout), Feature 7 (Orders — **as patched**: order state machine, transitionOrderStatus, the courier-assignment-pending hand-off job enqueued from confirmPayment(), and the reserved Order Detail placeholder slot).

**Feeds:** Feature 9 (Notifications — this feature enqueues courier-failure and milestone alerts, consumed there), Feature 12 (Payments & Admin Operations — reads courier/shipment status for admin KPIs and manual-logistics oversight).

## **Table of Contents**

-   Feature Overview
    -   0.1. Pre-Generation Reuse Review
    -   0.2. Documentation Gaps & Assumptions
    -   0.3. Courier & Tracking Flow
-   Task 1 — Courier Foundation
-   Task 2 — Shipment Initialization
-   Task 3 — Courier Selection
-   Task 4 — Shipment Booking *(pending)*
-   Task 5 — Tracking Registration *(pending)*
-   Task 6 — Shipment Timeline *(pending)*
-   Task 7 — Delivery Status Synchronization *(pending)*
-   Task 8 — Validation & Testing *(pending)*

## **Feature Overview**

**What Feature 8 covers:** the full courier-assignment-to-delivery pipeline, consuming orders Feature 7 already created — App Flow SCR-S06 (Order Detail's courier card, Confirm & Book, override), SCR-B08 (authenticated tracking), SCR-B09 (public login-free tracking). It implements REQ-F-Logistics-001–008 (Intelligent Logistics) in full and REQ-F-Track001–008 (Live Order Tracking) in full — the exact scope Feature 7's Task 7 was patched to stop short of.

**What it explicitly excludes:**

-   **Order creation, checkout, payment, inventory** — untouched; this feature begins only after an order already exists (PAYMENT\_CONFIRMED or later).
-   **Order Management's own concerns** — Buyer/Seller order lists, Order Details' non-courier sections, invoice, cancellation, the order state machine's *definition* — all remain Feature 7's, unchanged. This feature only **calls** transitionOrderStatus (Feature 7 Task 6.1), it does not redefine it.
-   **Payment webhook/settlement/COD ledger** — Feature 12.
-   **Notification dispatch internals** (actual SMS/WhatsApp sending) — Feature 9; this feature only enqueues.
-   **Real courier provider integration** — mock only (D2); real adapters are Feature 16.

**Governing tables (Schema Doc §4):** tracking\_events (4.21), courier\_quotes (4.22) — new writes, owned by this feature going forward. orders (4.10) — courier, tracking\_no, courier\_overridden, status columns updated here, row itself owned by Feature 7. platform\_config (4.25) — courier\_weights read here.

### **0.1. Pre-Generation Reuse Review**

| **Feature 0–7 Asset** | **Exists At** | **Feature 8 Usage** |
| --- | --- | --- |
| Envelope helper, typed error hierarchy, Zod validation harness | Feature 0 | Reused unchanged for every new courier/tracking endpoint |
| --- | --- | --- |
| authenticate + ownership middleware, RBAC | Feature 1 | Reused as-is — courier-selection/booking endpoints require Seller ownership of the order (Schema §9); public tracking is the one intentionally token-authenticated (not JWT) route |
| --- | --- | --- |
| CourierAdapter interface + mock (D2) | Feature 0/2 (scaffold), Feature 6 Task 6 (single-estimate call only) | **This feature is the adapter's primary consumer** — implements the full parallel scoring, checkCoverage(), book(), track(), cancel() calls Feature 6 never touched |
| --- | --- | --- |
| order.state-machine.ts, transitionOrderStatus(orderId, targetStatus, actor) | Feature 7 Task 1.3/6.1 | Reused as the **only** way this feature changes orders.status — no second status-write path introduced |
| --- | --- | --- |
| confirmPayment()'s courier-assignment-pending queue enqueue | Feature 7 Task 7 (patched) | **This feature writes the consumer** for that queue — the first and only handler for this job |
| --- | --- | --- |
| Order Detail's reserved placeholder slot | Feature 7 Task 5.5/7.3 (patched) | This feature populates it: recommendation card, Confirm & Book button, override dropdown, live timeline, tracking link |
| --- | --- | --- |
| Public tracking route /t/:publicToken (stub) | Feature 0 Task 10, Feature 7 Task 7.5 (patched, left unimplemented) | This feature implements the real screen behind the existing stub route — no new route registration |
| --- | --- | --- |
| Socket.IO gateway stub | Feature 0/2 (architecture phase) | Reused for real-time tracking push — this feature is the first real emitter on the /tracking namespace |
| --- | --- | --- |
| BullMQ/Redis queue wiring | Feature 0/2 (architecture phase) | Reused for the 5-minute poll job and the courier-assignment-pending consumer |
| --- | --- | --- |
| Notification module's producer/enqueue interface | Built in Feature 9 (interface reserved earlier in TRD §12) | This feature only **calls** the enqueue function (seller alerts on manual-logistics, 3-failed-polls) — does not build SMS/in-app dispatch itself |
| --- | --- | --- |
| Repository/service/controller layered pattern | Feature 2, established in Features 4/6/7 | New tracking/ module follows the identical shape |
| --- | --- | --- |

**Conclusion of review:** Feature 8 introduces exactly one new backend module — tracking/ — matching TRD §12's own folder layout (which lists tracking/ distinct from order/). All order-row mutation happens exclusively through Feature 7's transitionOrderStatus; all courier-provider calls happen exclusively through the existing CourierAdapter interface. No new adapter, no new state machine, no new order-query logic.

**Engineering Decision — Module Boundary (reconfirms, does not repeat, Feature 7's own decision):**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Backend module structure | New apps/api/src/modules/tracking/ only — repository/service/controller/routes/dto | Already decided in Feature 7's original (now-patched) Task 7 and TRD §12; Feature 7's patch simply moved the *implementation* here without changing the *planned* module boundary |
| --- | --- | --- |
| Courier-assignment trigger | Consume the courier-assignment-pending BullMQ job Feature 7's confirmPayment() already enqueues — do not add a second trigger path (e.g., polling for newly-confirmed orders) | Avoids a duplicate "what counts as ready for courier assignment" check; Feature 7 already knows the moment payment confirms |
| --- | --- | --- |
| Order-status writes | Always via transitionOrderStatus (Feature 7 Task 6.1) | Feature 7's Task 9.5 reuse-audit explicitly checks for a second orders.status write path — this feature must not introduce one |
| --- | --- | --- |

### **0.2. Documentation Gaps & Assumptions**

| **Gap** | **What the docs say** | **Assumption taken** |
| --- | --- | --- |
| **#1 — Checkout-time shipping estimate vs. booking-time actual rate** | Feature 6 Task 6 (Gap #1) explicitly flagged: "the checkout-time estimate and the eventual booked-courier's actual rate may diverge — no document reconciles this." | **Assumption carried forward, resolved here:** on successful booking (Task 4), this feature does **not** retroactively rewrite orders.shipping\_fee or total\_amount (both are part of the immutable-once-created order snapshot per Schema §4.10's design and REQ-NF-Safety-007's spirit). The booked courier's actual quoted cost is recorded only in courier\_quotes.cost (Schema §4.22) for internal/analytics reference; the buyer-facing total from checkout stands. Any discrepancy is a Future-scope reconciliation concern, not solved in this feature. |
| --- | --- | --- |
| **#2 — Courier-quote persistence timing** | Schema §4.22 defines courier\_quotes as a "scoring log," but no document says whether quotes are written once at scoring time or re-written on every re-score (e.g., if a Seller reloads Order Detail multiple times before booking). | **Assumption:** scoring is idempotent-per-order-state — scoreCouriers() writes fresh courier\_quotes rows only on the **first** score after confirmPayment()'s job fires; a Seller re-opening Order Detail before booking sees the **already-computed** quotes (read, not re-scored), avoiding duplicate courier\_quotes rows and duplicate adapter calls. Re-scoring is only triggered by an explicit "Refresh rates" action if the Seller requests it (UI affordance), which does write new rows. |
| --- | --- | --- |
| **#3 — Map/location data source for tracking** | Schema §4.21 has location\_lat/location\_lng on tracking\_events; App Flow SCR-B08 says "map embed with last known location." TRD §4 (Frontend Stack) names Google Maps JS API "behind a mockable wrapper" but no document specifies what the **mock** CourierAdapter.track() returns for location in MVP. | **Assumption:** the mock CourierAdapter.track() (D2) returns a deterministic, plausible lat/lng progression per courier/destination-city pair (simulating movement toward the delivery address) so the map/timeline can be demoed meaningfully; real GPS data arrives only when live courier adapters replace the mock (Feature 16). |
| --- | --- | --- |
| **#4 — "Eligible for courier selection" order states** | Your brief says "Sellers can select an available courier for eligible orders" but doesn't enumerate eligibility. Feature 7's state machine defines PAYMENT\_CONFIRMED as the state entered right before courier assignment. | **Assumption:** an order is courier-selection-eligible only when status = PAYMENT\_CONFIRMED (i.e., after Feature 7's confirmPayment() has fired and the courier-assignment-pending job has been consumed/scored) and no courier has yet been booked (orders.courier IS NULL). Orders already in PROCESSING or later show the *booked* courier read-only, not a re-selection UI. |
| --- | --- | --- |

### **0.3. Courier & Tracking Flow**

Courier Foundation

(tracking/ module scaffold — repository/service/controller/routes,

on top of Feature 7's existing order/state-machine)

│

▼

Shipment Initialization

(consume the courier-assignment-pending job from Feature 7's

confirmPayment(); resolve destination + COD-eligibility inputs)

│

▼

Courier Selection

(parallel CourierAdapter scoring: cost 40/time 30/reliability 20/

coverage 10; courier\_quotes rows; COD-coverage filter)

│

▼

Shipment Booking

("Confirm & Book" one-click; retry×3@30s → fallback; seller override;

all-fail → PENDING\_MANUAL\_LOGISTICS + notify)

│

▼

Tracking Registration

(orders.courier/tracking\_no set; tracking\_token already exists from

Feature 7 — public page now goes live)

│

▼

Shipment Timeline

(5-min BullMQ poll job → tracking\_events rows → Socket.IO push;

3-failed-polls alert)

│

▼

Delivery Status Synchronization

(poll-driven transitions via Feature 7's transitionOrderStatus;

COD delivery-confirms-payment side effect already owned by

Feature 7 Task 6.3 — this feature only fires the DELIVERED call)

│

▼

Validation & Testing

(reuse-audit · courier-failure adversarial tests · cross-check

against Feature 7's patched hand-off seam)

Each stage depends on the one before it: Shipment Initialization needs the module scaffold to consume the hand-off job into; Courier Selection needs a resolved order/destination before it can score; Booking needs a scored list to book from; Tracking Registration needs a successful booking to have a tracking number to register; Shipment Timeline needs a registered shipment to poll; Delivery Status Sync is the terminal effect of the timeline reaching DELIVERED; Validation is only meaningful once the full pipeline exists end-to-end.

## **Task 1 — Courier Foundation**

### **Purpose**

-   Scaffold the tracking/ module — repository, service, controller, routes, DTOs — per TRD §12's folder layout, exactly where Feature 7's (patched) Task 7 always intended it to live.
-   Confirm courier\_quotes (Schema §4.22) and tracking\_events (Schema §4.21) require **zero new migrations** — both fully specified in Doc 5.
-   Reserve /api/v1/orders/:id/courier\* and /api/v1/tracking/\* route groups, mounted on Feature 7's existing authenticated order-route pattern (Seller-only for selection/booking; Buyer+Seller for tracking reads; token-based for the public page).

### **Dependencies**

-   Feature 0 complete (adapter factory, ADAPTER\_MODE, Socket.IO stub, BullMQ wiring)
-   Feature 1 complete (authenticate, ownership middleware)
-   Feature 7 complete **as patched** (order state machine, transitionOrderStatus, courier-assignment-pending job enqueue, reserved Order Detail slot, unimplemented /t/:token stub)

### **Expected Deliverables**

-   \[ \] apps/api/src/modules/tracking/tracking.repository.ts — Prisma-backed, methods for courier\_quotes and tracking\_events
-   \[ \] apps/api/src/modules/tracking/tracking.service.ts
-   \[ \] apps/api/src/modules/tracking/tracking.controller.ts + tracking.routes.ts
-   \[ \] apps/api/src/modules/tracking/tracking.dto.ts — Zod schemas for booking/override requests
-   \[ \] Route groups mounted: /api/v1/orders/:id/courier-quotes (GET), /api/v1/orders/:id/book-courier (POST), /api/v1/tracking/:orderId (GET, authenticated), /api/v1/t/:publicToken (GET, public — fills Feature 7's stub)
-   \[ \] Confirmed: zero new Prisma models, zero new migrations

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 1.1 | Scaffold tracking.repository.ts: createCourierQuotes(orderId, quotes\[\]), findQuotesByOrder(orderId), markQuoteSelected(quoteId), appendTrackingEvent(orderId, status, description, lat, lng, eventTime), findTrackingEventsByOrder(orderId), findOrderByTrackingToken(token) | New repository file, zero schema changes | Migration diff empty |
| --- | --- | --- | --- |
| 1.2 | Scaffold tracking.service.ts — pass-through only at this stage, business logic lands in Tasks 2–7 | New service file | Unit test: methods return repository output unmodified for now |
| --- | --- | --- | --- |
| 1.3 | Register route groups per Expected Deliverables, mounting Seller-only routes behind authenticate + ownership (order's seller\_id = self, reusing Feature 7 Task 2.3's tri-mode ownership pattern where applicable), and the public /t/:publicToken route with **no** auth middleware | Route groups mounted | No-token request to /orders/:id/book-courier → 401; wrong-seller token → 403; /t/:token with no token at all → 200 (once Task 5 implements it) |
| --- | --- | --- | --- |
| 1.4 | Confirm Feature 0's stubbed frontend routes (/orders/:id/track, /t/:publicToken) and Feature 7's reserved Order Detail placeholder resolve without new registration | No route-table changes | ROUTES.md requires no edits |
| --- | --- | --- | --- |
| 1.5 | Confirm zero direct orders.status writes exist anywhere in the new tracking/ module — all status changes will route through Feature 7's transitionOrderStatus (imported, not reimplemented) | Import-only dependency on Feature 7's order module | Grep: tracking/ module contains an import of transitionOrderStatus, no local prisma.order.update({ status: ... }) calls |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A second order-repository or a direct Prisma orders update written inside tracking.service.ts | All order-status mutation must go through Feature 7's transitionOrderStatus — tracking/ only owns courier\_quotes/tracking\_events tables directly |
| --- | --- |
| Public tracking route accidentally wrapped in authenticate "for consistency" | SCR-B09 is explicitly login-free (REQ-F-Track005) — this route must remain unauthenticated, resolving identity purely via the tracking\_token |
| --- | --- |

## **Task 2 — Shipment Initialization**

### **Purpose**

-   Implement the consumer for Feature 7's courier-assignment-pending BullMQ job — the single trigger point for courier scoring, per Gap #4's eligibility rule.
-   Resolve the inputs scoring needs: destination city/province (from the order's ship\_\* snapshot, Schema §4.10), payment method (COD vs. prepaid), and item weight/value if the mock adapter's rate call requires it.
-   Guard against duplicate initialization — Gap #2's idempotent-scoring assumption starts here.

### **Dependencies**

-   Task 1 complete (module scaffold, route groups)

### **Expected Deliverables**

-   \[ \] BullMQ consumer for the courier-assignment-pending queue (Feature 7 Task 6.2's enqueue point) — reuses the existing BullMQ/Redis wiring, no new queue infrastructure
-   \[ \] initializeShipment(orderId) service method: reads the order (via Feature 7's getOrderById, Task 2.3 — reused, not reimplemented), extracts destination + payment method, guards against re-initialization if quotes already exist for this order
-   \[ \] Eligibility check per Gap #4: only proceeds if status = PAYMENT\_CONFIRMED and courier IS NULL

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 2.1 | Register a BullMQ worker/consumer on the courier-assignment-pending queue (same queue name Feature 7 Task 6.2 enqueues to) — reuse the existing BullMQ/Redis connection from the architecture phase, do not instantiate a second Redis client | Working consumer, reused infra | Enqueuing a test job (simulating confirmPayment()) triggers this consumer within the expected poll interval |
| --- | --- | --- | --- |
| 2.2 | Implement initializeShipment(orderId): call Feature 7's getOrderById (Task 2.3) to fetch the order — do not write a second order-fetch query | Reused fetch, no duplication | Grep confirms initializeShipment imports and calls Feature 7's existing method |
| --- | --- | --- | --- |
| 2.3 | Guard: if orders.courier IS NOT NULL (already booked) or status != PAYMENT\_CONFIRMED (Gap #4), skip initialization and log a no-op — handles the case where a job is redelivered (BullMQ retry) after the order has already moved on | Idempotent, safe against redelivery | Re-processing an already-initialized order's job does not create duplicate courier\_quotes rows (ties into Gap #2, enforced fully in Task 3) |
| --- | --- | --- | --- |
| 2.4 | Extract destination (ship\_city/ship\_province from the order snapshot) and payment method (orders.payment\_method) — pass forward to Task 3's scoring call | Correct inputs assembled | A COD order's initialization correctly flags isCOD=true for Task 3's coverage filter |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A second Redis/BullMQ connection instantiated for this consumer | Reuse the exact client/connection config from the architecture phase (TRD §2) — a second connection risks configuration drift and doubles connection overhead |
| --- | --- |
| Destination read from the buyer's **current** default address instead of the order's frozen ship\_\* snapshot | Schema §4.10 explicitly snapshots shipping fields at order time to preserve history — courier destination must match what the buyer actually confirmed at checkout, not their possibly-since-changed address book |
| --- | --- |

*End of Response 1 — Title, Table of Contents, Feature Overview, Courier & Tracking Flow, and Tasks 1–2 complete (Task 3 continues below to complete the requested Tasks 1–3 batch).*

## **Task 3 — Courier Selection**

### **Purpose**

-   Implement scoreCouriers() — the full parallel-adapter scoring algorithm (REQ-F-Logistics-002/003) that Feature 6 explicitly deferred and Feature 7's patch removed.
-   Apply COD-coverage filtering (REQ-F-Logistics-006) and write courier\_quotes rows (Schema §4.22), respecting Gap #2's idempotent-scoring rule.
-   Populate Order Detail's reserved recommendation-card slot (Feature 7 Task 5.5/7.3, patched) with real, scored data.

### **Dependencies**

-   Task 2 complete (initializeShipment, resolved destination/COD inputs)
-   Feature 0/2 complete (CourierAdapter interface + mock, D2)

### **Expected Deliverables**

-   \[ \] scoreCouriers(orderId, destination, isCOD) — calls CourierAdapter.getRate() + checkCoverage() in parallel (Promise.all, 10s timeout each) across all configured couriers (TCS/Leopards/Trax mocks)
-   \[ \] COD orders filtered to COD-capable-at-destination couriers only, before scoring
-   \[ \] Weighted score computed from platform\_config.courier\_weights (Schema §4.25) — not hardcoded
-   \[ \] courier\_quotes rows written once per order (Gap #2), each with cost, eta\_hours, score, selected=false
-   \[ \] GET /orders/:id/courier-quotes — returns the scored list for Order Detail's recommendation card
-   \[ \] "Refresh rates" explicit re-score action (Gap #2's exception path)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 3.1 | Implement scoreCouriers(): for COD orders, call checkCoverage() first across all configured couriers and drop non-covering ones (REQ-F-Logistics-006) before scoring; for prepaid orders, skip the coverage pre-filter | Correctly filtered candidate list | A COD order to a city where only 2/3 couriers support COD scores exactly those 2 |
| --- | --- | --- | --- |
| 3.2 | Call getRate() in parallel (Promise.all, 10s timeout per call, REQ-F-Logistics-002) across the filtered candidate list | Parallel rate-fetch, no serial waterfall | Simulated slow mock adapter confirms calls fire concurrently, not sequentially (timing assertion in test) |
| --- | --- | --- | --- |
| 3.3 | Read platform\_config.courier\_weights (Schema §4.25: {cost:0.4,time:0.3,reliability:0.2,coverage:0.1}) and compute each courier's weighted score — no hardcoded weights | Config-driven scoring | Changing the admin config value (direct DB update, since Feature 12 owns the UI) changes the resulting scores without a code deploy |
| --- | --- | --- | --- |
| 3.4 | Write one courier\_quotes row per candidate courier (Schema §4.22: order\_id, courier, cost, eta\_hours, score, selected=false) — guarded by Task 2.3's idempotency check so this only fires once per order unless "Refresh rates" is explicitly invoked (Gap #2) | Correct, non-duplicated quote rows | Re-triggering initializeShipment for an already-quoted order (simulated redelivery) does not insert a second set of rows |
| --- | --- | --- | --- |
| 3.5 | Implement GET /orders/:id/courier-quotes (Seller-only, ownership-checked via Feature 7's pattern) — returns the sorted-by-score list | Working read endpoint | Order Detail's recommendation card (Task 3.6) renders the top-scored courier as the default selection |
| --- | --- | --- | --- |
| 3.6 | Populate Feature 7's reserved Order Detail placeholder (Task 5.5/7.3, patched) with the real recommendation card: courier name, cost, ETA, score, and the full ranked list for manual override consideration (booking wired in Task 4) | Feature 7's placeholder now shows live data | Opening Order Detail for a PAYMENT\_CONFIRMED order with completed scoring shows a populated card, not the "pending" placeholder text |
| --- | --- | --- | --- |
| 3.7 | Implement an explicit "Refresh rates" action (Seller-triggered) that re-calls scoreCouriers() and **replaces** (not appends to) the existing courier\_quotes rows for that order — the one legitimate exception to Gap #2's idempotency default | Working manual re-score | Clicking "Refresh rates" updates the displayed quotes; old quote rows for the order are superseded (soft-replaced or deleted-and-reinserted, per team's Prisma convention), not left as stale duplicates |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Courier weights hardcoded as {0.4, 0.3, 0.2, 0.1} in scoreCouriers() instead of read from platform\_config | Schema §4.25 makes this admin-configurable — matches the discipline already required for min\_order\_value\_pkr (Feature 6) and return\_window\_days |
| --- | --- |
| Scoring re-fires on every Order Detail page load, creating duplicate courier\_quotes rows | Gap #2 requires idempotency — score once per order unless "Refresh rates" is explicitly clicked (Step 3.7) |
| --- | --- |
| COD-coverage filter applied *after* scoring instead of before | Wastes getRate() calls on non-eligible couriers and risks recommending a courier that can't actually serve COD at the destination — filter first (Step 3.1), score second |
| --- | --- |

*End of Response 1 — Title, Table of Contents, Feature Overview, Courier & Tracking Flow, and Tasks 1–3 complete. Awaiting confirmation before continuing with Tasks 4–6 (Shipment Booking, Tracking Registration, Shipment Timeline).*

## **Task 4 — Shipment Booking**

### **Purpose**

-   Implement "Confirm & Book Courier" (REQ-F-Logistics-004, one-click, no additional form input) against Task 3's scored courier\_quotes list.
-   Implement retry×3@30s-then-fallback-to-next-best (REQ-F-Logistics-005) and the all-fail → PENDING\_MANUAL\_LOGISTICS path (REQ-F-Logistics-007), calling Feature 7's transitionOrderStatus exclusively.
-   Implement Seller override (REQ-F-Logistics-008) — booking any non-top-scored courier from the same list, logged.

### **Dependencies**

-   Task 3 complete (courier\_quotes populated, recommendation card rendered)
-   Feature 7 complete (transitionOrderStatus, notification-enqueue interface reserved)

### **Expected Deliverables**

-   \[ \] bookCourier(orderId, courierCode, actor) — calls CourierAdapter.book(), retry×3@30s on failure, falls back to next-best-scored courier automatically
-   \[ \] On success: orders.courier, orders.tracking\_no set; matching courier\_quotes.selected=true; transitionOrderStatus(orderId, 'PROCESSING') called
-   \[ \] On total failure (all couriers exhausted): transitionOrderStatus(orderId, 'PENDING\_MANUAL\_LOGISTICS'); seller notification enqueued (SMS + in-app, via existing enqueue interface)
-   \[ \] Seller override path: books any courier from Task 3's list, sets orders.courier\_overridden=true, logged for analytics (REQ-F-Logistics-008)
-   \[ \] POST /orders/:id/book-courier — Seller-only, ownership-checked
-   \[ \] Order Detail's "Confirm & Book Courier" button (default = top-scored) and override dropdown fully wired

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 4.1 | Implement bookCourier(orderId, courierCode, actor): validate the order is still eligible (Gap #4 — status=PAYMENT\_CONFIRMED, courier IS NULL) — reject with ConflictError(409) if already booked | Guarded booking entry point | Attempting to book an already-booked order returns 409, not a silent overwrite |
| --- | --- | --- | --- |
| 4.2 | Call CourierAdapter.book() for the requested courierCode — on failure, retry 3× at 30s intervals (REQ-F-Logistics-005) | Retry loop with correct spacing | Mock adapter's failure-injection (D2) triggers exactly 3 retries at ~30s apart, observable in test logs/timestamps |
| --- | --- | --- | --- |
| 4.3 | On exhausting retries for one courier, automatically fall back to the **next-best-scored** courier from Task 3's courier\_quotes list (not a random pick) and repeat the retry sequence for that courier | Correct fallback ordering | Forcing the top-scored courier's book() to always fail routes booking to the 2nd-ranked courier, confirmed by the resulting courier\_quotes.selected=true row matching the 2nd rank, not a 3rd or random one |
| --- | --- | --- | --- |
| 4.4 | On success: update orders.courier, orders.tracking\_no (from the adapter's book() response) in the same transaction as marking courier\_quotes.selected=true for the winning row; then call transitionOrderStatus(orderId, 'PROCESSING') (Feature 7 Task 6.1) — no direct orders.status write here | Atomic booking + correct status transition via reused method | Grep confirms this task's booking code imports and calls Feature 7's transitionOrderStatus, never writes orders.status directly |
| --- | --- | --- | --- |
| 4.5 | On total failure (every candidate courier's retries exhausted): call transitionOrderStatus(orderId, 'PENDING\_MANUAL\_LOGISTICS'), then enqueue a Seller notification (SMS + in-app) via the existing Notification producer interface — do not implement SMS/in-app dispatch logic here | Correct terminal failure handling | Simulated all-couriers-down scenario lands the order in PENDING\_MANUAL\_LOGISTICS; Seller Orders (Feature 7 Task 4.4) shows the alert badge; one notification job appears in the queue (verified via queue inspection, not delivery) |
| --- | --- | --- | --- |
| 4.6 | Implement Seller override: Seller selects any courier from Task 3's ranked list (not just top-scored) — same bookCourier() call, but sets orders.courier\_overridden=true on success (Schema §4.10, pre-existing column) | Override correctly logged | Booking courier ranked #3 sets courier\_overridden=true; booking the top-ranked courier normally leaves it false |
| --- | --- | --- | --- |
| 4.7 | Wire Order Detail's "Confirm & Book Courier" button (calls 4.1 with the top-scored courier as default) and an override dropdown (calls 4.1/4.6 with the Seller's chosen courier) — both disable/hide once orders.courier IS NOT NULL | Fully functional booking UI | Manual test: click Confirm & Book → button disables during the retry/fallback sequence → success toast + status updates on completion |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A direct prisma.order.update({ status: 'PROCESSING' }) call added "for speed" instead of going through transitionOrderStatus | Breaks Feature 7's single-source-of-truth guarantee (its own Task 9.5 reuse audit checks exactly for this) — always call the shared state-machine method |
| --- | --- |
| Fallback picks a random or first-remaining courier instead of the next-best by score | REQ-F-Logistics-005 implies ordered fallback — must consult the same courier\_quotes ranking, not an arbitrary remaining candidate |
| --- | --- |
| Retry timer implemented with a blocking sleep() inside a request-handling thread | Use the existing BullMQ delayed-job pattern (or equivalent async scheduling already established in the architecture phase) so retries don't block the API process |
| --- | --- |

## **Task 5 — Tracking Registration**

### **Purpose**

-   Activate tracking once a shipment is booked: confirm orders.tracking\_token (already generated at order-creation time by Feature 6, Schema §4.10) is the resolution key for the public page — no new token generation here.
-   Implement the public, login-free tracking page (SCR-B09) behind Feature 7's previously-unimplemented /t/:publicToken stub.
-   Confirm the authenticated tracking page (SCR-B08) route is ready to receive live data (populated fully in Task 6).

### **Dependencies**

-   Task 4 complete (a booked order with tracking\_no set exists to register tracking for)

### **Expected Deliverables**

-   \[ \] GET /t/:publicToken — implemented for real, resolves orders.tracking\_token → order, returns a minimal read-only DTO (status, courier, tracking\_no, last known location, milestone timeline) with **no PII**
-   \[ \] GET /tracking/:orderId — authenticated version (Buyer or Seller of the order), same core data plus buyer-visible extras (full address is NOT shown even here — per Schema §4.10, ship\_\* fields remain encrypted/access-scoped)
-   \[ \] SCR-B09 screen: read-only status + map, invalid/expired-token friendly error state, buyer's-language default (falling back to Urdu, per App Flow assumption 12)
-   \[ \] SCR-B08 screen shell: timeline + map container ready to receive Task 6's live poll data

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 5.1 | Implement findOrderByTrackingToken(token) (Task 1.1's repository method) — resolves via orders.tracking\_token (Schema §4.10, already UQ-indexed from Feature 6) — no new token field, no new generation logic | Working resolution | A valid token resolves to the correct order; an invalid/malformed token returns a clean "not found," not a 500 |
| --- | --- | --- | --- |
| 5.2 | Implement GET /t/:publicToken controller: assembles a deliberately minimal DTO — status, courier, tracking\_no, latest tracking\_events entry (status/description/lat/lng/event\_time), and a friendly delivery-stage label — explicitly excluding buyer name, full address, phone, payment details | Minimal public DTO | Response body inspected in test confirms no PII fields present, matching App Flow SCR-B09's explicit "no PII beyond what's needed to show status" |
| --- | --- | --- | --- |
| 5.3 | Implement GET /tracking/:orderId (authenticated, ownership-checked via Feature 7's getOrderById pattern — Buyer or Seller of the order, or Admin/Support) — same core tracking data, used by SCR-B08 | Working authenticated endpoint | Third-party Buyer/Seller token → 403; the order's own Buyer or Seller → 200 |
| --- | --- | --- | --- |
| 5.4 | Build SCR-B09: read-only screen consuming 5.2's endpoint — status + map (Task 6 will feed real location data; for now render with whatever the latest tracking\_events row provides, even if just the booking-time initial entry), language defaulting to the order buyer's preferred\_language then Urdu (App Flow assumption 12) | Functional public tracking page | Visiting /t/:validToken> with no auth token succeeds (200); invalid token shows the friendly "tracking not found" state per App Flow |
| --- | --- | --- | --- |
| 5.5 | Build SCR-B08 shell: authenticated timeline + map container, wired to 5.3's endpoint — full live-update behavior (WebSocket push) completed in Task 6, this step only confirms the screen correctly renders whatever tracking data exists **now** | Functional but not-yet-live-updating screen | Buyer/Seller opening /orders/:id/track sees the current known status, no crash, even before Task 6's poll job starts advancing it |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A new tracking-token field/table introduced "for the public page" | orders.tracking\_token already exists from Feature 6 (Schema §4.10, UQ) — reuse it, do not generate a second token |
| --- | --- |
| Public DTO accidentally includes the order's ship\_name/ship\_phone or buyer identity | App Flow SCR-B09 is explicit — public tracking must never leak PII; keep the public and authenticated DTOs as genuinely separate shapes, not the same object with fields "hidden" client-side |
| --- | --- |
| SCR-B08 built to require Task 6's WebSocket wiring before it can render anything at all | The screen must gracefully render *current* state now and *upgrade* to live-push once Task 6 wires it — a hard dependency on not-yet-built infra would break incremental delivery |
| --- | --- |

## **Task 6 — Shipment Timeline**

### **Purpose**

-   Implement the 5-minute BullMQ poll job (REQ-F-Track001) that calls CourierAdapter.track() for all active shipments and appends tracking\_events rows on new milestones.
-   Implement Socket.IO push (REQ-F-Track002) on every new tracking\_events insert, completing SCR-B08's live-update behavior.
-   Implement the 3-consecutive-failed-poll seller alert (REQ-F-Track006) and the map-down graceful-degradation fallback (REQ-NF-Safety-004).

### **Dependencies**

-   Task 5 complete (tracking pages exist and can render current state; this task makes them live)
-   Feature 7 complete (transitionOrderStatus, for milestone-driven status advancement)

### **Expected Deliverables**

-   \[ \] BullMQ recurring job (5-min interval): iterates orders in PICKED\_UP/IN\_TRANSIT/OUT\_FOR\_DELIVERY, calls CourierAdapter.track() per order
-   \[ \] On a new milestone: appends a tracking\_events row (Schema §4.21) and calls transitionOrderStatus if the milestone maps to a status change
-   \[ \] Socket.IO emit (order\_status\_update, tracking\_location\_update, TRD §9) on the existing /tracking namespace on every new tracking\_events row
-   \[ \] 3-consecutive-poll-failure detection per order → in-app alert enqueued to Seller (REQ-F-Track006)
-   \[ \] Graceful degradation: adapter/maps failure → text-only status shown, no broken map component
-   \[ \] SCR-B08 fully live: timeline + map update via WebSocket without refresh

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 6.1 | Register a recurring BullMQ job (5-min interval, REQ-F-Track001) that queries all orders with status IN (PICKED\_UP, IN\_TRANSIT, OUT\_FOR\_DELIVERY) — reuse the existing BullMQ/Redis wiring, no new queue infra | Recurring job registered | Job fires on schedule in a local dev run; queries only active-shipment orders, confirmed via log inspection |
| --- | --- | --- | --- |
| 6.2 | For each active order, call CourierAdapter.track() (mock, D2, Gap #3's deterministic lat/lng progression) — on a new milestone (status differs from the last tracking\_events entry), append a new tracking\_events row (status, description, location\_lat, location\_lng, event\_time) | New rows appended only on genuine milestone change, not every poll | Polling an order with no status change does not create duplicate/no-op tracking\_events rows |
| --- | --- | --- | --- |
| 6.3 | If the new milestone maps to a canonical order-status change (e.g., PICKED\_UP → IN\_TRANSIT), call transitionOrderStatus(orderId, newStatus) (Feature 7 Task 6.1) — no direct orders.status write | Correct, reused transition call | Grep confirms this poll job's status-advancing code path imports and calls Feature 7's shared method |
| --- | --- | --- | --- |
| 6.4 | On every tracking\_events insert (from this poll job, or from Task 4's booking-triggered PROCESSING transition), emit a Socket.IO event on the existing /tracking namespace (order\_status\_update + tracking\_location\_update, TRD §9) — reuse the gateway stub, no second real-time channel | Live push functional | A subscribed client (open SCR-B08 tab) receives the update without polling/refresh |
| --- | --- | --- | --- |
| 6.5 | Track consecutive poll failures per order (e.g., a counter incremented on adapter error, reset on success); at 3 consecutive failures (REQ-F-Track006), enqueue an in-app alert to the Seller via the existing Notification producer interface — do not implement dispatch logic here | Alert fires correctly at the 3-failure threshold | Mock adapter configured to fail 3 consecutive track() calls for one order → one alert job enqueued; a 4th success resets the counter and resumes normal polling |
| --- | --- | --- | --- |
| 6.6 | Implement graceful degradation on SCR-B08/SCR-B09: if the latest poll failed or the adapter/maps call errors, render a text-only status view (last known status + description) instead of a broken/blank map component (TRD §14/REQ-NF-Safety-004) | Correct degraded-mode UI | Simulated maps/adapter failure shows the text fallback, no console error or blank map area |
| --- | --- | --- | --- |
| 6.7 | Confirm SCR-B08 is now fully live: opening the tracking page and letting the poll job run (or manually triggering a test poll cycle) shows the timeline and map advancing without a page refresh | End-to-end live tracking confirmed | Manual test: book courier (Task 4) → poll cycles advance status → SCR-B08 updates live via WebSocket → reaches DELIVERED |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| tracking\_events row appended on every poll cycle regardless of whether the milestone actually changed | Bloats the table and breaks the "milestone history" semantics of REQ-F-Track007 — only insert on genuine status/location change |
| --- | --- |
| A second WebSocket server or namespace created instead of reusing the existing /tracking gateway stub | TRD §2's architecture phase already reserved this — reuse it |
| --- | --- |
| Poll-driven status transitions bypass transitionOrderStatus "since it's a background job, not a user action" | The state machine's single-source-of-truth guarantee applies regardless of actor type (system vs. Seller vs. Buyer) — Feature 7's method is actor-agnostic and must be the only path |
| --- | --- |

*End of Response 2 — Tasks 4–6 complete. Awaiting confirmation before continuing with Tasks 7–8 (Delivery Status Synchronization, Validation & Testing), followed by the final Table of Contents update, cross-reference verification, and full consistency review against Features 0–7.*

**Schema check for Tasks 4–6:** still zero new tables/columns. Task 4 writes to orders.courier/tracking\_no/courier\_overridden and courier\_quotes.selected (all pre-existing, §4.10/§4.22). Task 5 reads orders.tracking\_token (pre-existing, §4.10). Task 6 writes to tracking\_events (all columns pre-existing, §4.21). No migration required.

## **Task 7 — Delivery Status Synchronization**

### **Purpose**

-   Fire the final DELIVERED/COMPLETED transitions via Feature 7's transitionOrderStatus, ensuring delivery status stays synchronized between courier events and the order's canonical status.
-   Confirm the COD delivery-confirms-payment side effect (owned by Feature 7 Task 6.3) fires correctly when **this feature's** poll job is what actually reaches DELIVERED — this task verifies the hand-off works, it does not re-implement that side effect.
-   Stop the 5-minute poll job for orders that have reached a terminal state, and retain the completed tracking\_events history per REQ-F-Track007 (≥12 months).

### **Dependencies**

-   Task 6 complete (poll job, milestone-driven tracking\_events, Socket.IO push)
-   Feature 7 complete (Task 6.3's DELIVERED-entry-action COD side effect, Task 6.1's transitionOrderStatus)

### **Expected Deliverables**

-   \[ \] Poll job (Task 6.1) correctly calls transitionOrderStatus(orderId, 'DELIVERED') on the final courier milestone, then excludes that order from future poll cycles (terminal state)
-   \[ \] Final delivery notification enqueued (SMS + in-app/WhatsApp-ready) via the existing Notification producer interface — polling stops immediately after
-   \[ \] Verified: Feature 7's COD-payment-confirms-on-delivery side effect fires correctly when triggered from this feature's poll-driven DELIVERED call (no new COD logic written here — confirmation only)
-   \[ \] tracking\_events history retained, queryable, no deletion/archival logic that would violate the ≥12-month retention (REQ-F-Track007)
-   \[ \] Order Detail and SCR-B07 (My Orders, Feature 7) correctly reflect terminal delivered/completed state

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 7.1 | Extend Task 6.1's poll-job query to exclude orders already in DELIVERED/COMPLETED/CANCELLED (terminal states) — once transitionOrderStatus(orderId, 'DELIVERED') fires, the next poll cycle's query naturally omits that order since it filters on PICKED\_UP/IN\_TRANSIT/OUT\_FOR\_DELIVERY only | Poll job self-terminates per order at delivery | An order reaching DELIVERED does not appear in the next poll cycle's candidate list (log/query inspection) |
| --- | --- | --- | --- |
| 7.2 | On the OUT\_FOR\_DELIVERY → DELIVERED milestone (from CourierAdapter.track()), call transitionOrderStatus(orderId, 'DELIVERED') (Feature 7 Task 6.1) — this call's entry-action already contains Feature 7's COD-payment-confirmation side effect (Task 6.3); this task does **not** duplicate that logic | Correct, single call site | For a COD order, payments.status flips to CONFIRMED immediately after this call — verified as an **integration** test against Feature 7's existing code, not a re-implementation here |
| --- | --- | --- | --- |
| 7.3 | Enqueue the final delivery notification (SMS + in-app, per REQ-F-Track004's "Delivered" milestone) via the existing Notification producer interface, immediately after the DELIVERED transition succeeds | Notification job enqueued once | One job appears in the queue per delivered order, not duplicated across retries of the same poll cycle |
| --- | --- | --- | --- |
| 7.4 | Confirm tracking\_events rows are never deleted or archived by this feature — REQ-F-Track007 requires ≥12-month retention; no cleanup job is introduced here (any future archival/partitioning is TRD §30 Future scope, not this feature's concern) | No deletion logic present | Grep confirms zero DELETE/archival calls against tracking\_events in this feature's codebase |
| --- | --- | --- | --- |
| 7.5 | Confirm Order Detail (Feature 7 Task 5) and SCR-B07 (Feature 7 Task 3) correctly render the terminal state using data this feature wrote — no changes needed to Feature 7's own rendering code, since it already reads orders.status/tracking\_events generically | Correct terminal-state display, zero Feature 7 code changes | A delivered order shows "Delivered" status consistently across Seller Orders, My Orders, and Order Detail — confirmed via cross-screen manual check, not new code |
| --- | --- | --- | --- |
| 7.6 | Confirm COMPLETED (the state after DELIVERED, per App Flow §0's canonical list) is **not** fired by this feature — App Flow does not specify what triggers DELIVERED → COMPLETED (likely a settlement-confirmed signal, Feature 12's concern) — flag as a gap, do not invent a trigger | Documented boundary, no invented transition | Grep confirms no transitionOrderStatus(orderId, 'COMPLETED') call exists anywhere in Feature 8 |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A second, redundant COD-payment-confirmation write added in this task "to be safe" | Feature 7 Task 6.3 already owns this side effect as part of the DELIVERED transition's entry action — adding a second write here risks a race/duplicate update; verify via integration test, don't reimplement |
| --- | --- |
| A cleanup/archival job added to prune old tracking\_events rows | Explicitly out of scope — REQ-F-Track007 requires retention, and any future partitioning strategy is TRD §30's Future scope, not this feature |
| --- | --- |
| COMPLETED transition invented and fired automatically some fixed time after DELIVERED | No source document specifies this trigger — inventing one would violate "never invent... workflow"; this is correctly logged as an unresolved gap for Feature 12 instead |
| --- | --- |

## **Task 8 — Validation & Testing**

### **Purpose**

-   Independently re-verify Tasks 1–7 against this feature's core guarantees: zero duplicated order-status writes, correct courier scoring/booking/fallback/override behavior, and a fully live, correctly-scoped-PII tracking pipeline.
-   Run adversarial tests on courier-failure paths, ownership boundaries, and the public-tracking PII boundary — the highest-risk areas of this feature.
-   Produce the sign-off artifact confirming Feature 7's patched hand-off seam was correctly honored, before Feature 9 (Notifications) builds its dispatch logic against this feature's enqueue calls.

### **Dependencies**

-   Tasks 1–7 complete

### **Expected Deliverables**

-   \[ \] Integration test suite for the new tracking/ module (scoring, booking, poll job, public/authenticated tracking endpoints)
-   \[ \] Courier-failure adversarial test set (single-courier failure→fallback, all-couriers-fail→manual-logistics, 3-consecutive-poll-failure alert)
-   \[ \] Cross-role/cross-user ownership adversarial test set (booking, quote-viewing, authenticated tracking)
-   \[ \] Public-tracking PII adversarial test (confirm no leakage via /t/:token)
-   \[ \] Full reuse audit — grep-level confirmation against Feature 7 (transitionOrderStatus, no second status-write path), Feature 6/architecture phase (CourierAdapter, no second adapter), and Schema (zero new migrations)
-   \[ \] FEATURE\_8\_CHECKLIST.md — consolidated sign-off
-   \[ \] Coverage confirmed ≥80% for all new tracking/ module code

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 8.1 | Integration-test the full happy path: confirmPayment job (Feature 7) → initializeShipment → scoreCouriers → bookCourier → poll cycles advance status → DELIVERED → COD side effect verified → final notification enqueued | Green test suite | End-to-end matches the Courier & Tracking Flow diagram exactly |
| --- | --- | --- | --- |
| 8.2 | Courier-failure adversarial test: (a) single courier fails 3× → falls back to next-best, booking still succeeds; (b) all couriers exhausted → PENDING\_MANUAL\_LOGISTICS + notification enqueued; (c) 3 consecutive poll failures on one order → in-app alert enqueued, 4th success resumes | All three scenarios pass | Matches REQ-F-Logistics-005/007 and REQ-F-Track006 exactly |
| --- | --- | --- | --- |
| 8.3 | Cross-role/cross-user ownership adversarial test: Seller A attempts to book/view quotes for Seller B's order; a Buyer attempts to call the Seller-only booking endpoint; a third-party Buyer/Seller attempts GET /tracking/:orderId for an order they don't own | All rejected 403/404 | Matches Schema §9 and PRD §11's permission matrix |
| --- | --- | --- | --- |
| 8.4 | Public-tracking PII adversarial test: fetch /t/:validToken> and assert the response contains **no** buyer name, phone, full address, or payment details — only status/courier/tracking\_no/location/timeline | Zero PII fields present | Automated schema-diff test on the public DTO against a disallow-list of PII field names |
| --- | --- | --- | --- |
| 8.5 | Full reuse audit — grep for: any direct orders.status write outside transitionOrderStatus, any second CourierAdapter implementation, any second WebSocket/BullMQ mechanism, any new Prisma model/migration, any tracking\_events deletion/archival code | Zero matches (or each justified) | Recorded verbatim in FEATURE\_8\_CHECKLIST.md, matching the discipline established in Features 5/6/7 |
| --- | --- | --- | --- |
| 8.6 | Cross-check against App Flow's documented states: SCR-S06 (recommendation card, override, retry/fallback messaging), SCR-B08 (map-down fallback, live updates), SCR-B09 (invalid token state) | Pass/fail note per screen | Consistent with Feature 0's shared Skeleton/EmptyState/Toast components |
| --- | --- | --- | --- |
| 8.7 | Explicitly verify Feature 7's patch was correctly honored: Feature 7's codebase contains no tracking/ module, no CourierAdapter calls, no courier\_quotes writes, no Socket.IO /tracking emits — all such logic lives exclusively in this feature | Confirmed clean boundary between Feature 7 and Feature 8 | Grep across **both** feature codebases confirms no overlap/duplication introduced by the earlier patch |
| --- | --- | --- | --- |
| 8.8 | Consolidate FEATURE\_8\_CHECKLIST.md — one section per task, Documentation Gaps table with final status, explicit confirmation that COMPLETED transition and schema changes are correctly out of scope | Committed sign-off artifact | Reviewed by both developers; open items flagged for Feature 9 (notification dispatch) and Feature 12 (COMPLETED trigger, real courier swap-in prep) |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Coverage gate measured against Feature 7's already-covered order/ code, masking whether this feature's new tracking/ code is actually tested | Scope coverage specifically to the new tracking/ module files |
| --- | --- |
| Courier-failure tests run against a real (non-mock) adapter path | Must use D2's mock adapter's built-in failure-injection — no real courier API access exists at this stage |
| --- | --- |
| Reuse audit skipped as "obviously fine" | Must be a deliberate grep pass per the discipline established in Features 5/6/7 — not a recollection |
| --- | --- |

## **Final Consistency Pass**

### **1\. Table of Contents (updated, final)**

-   Feature Overview
    -   0.1. Pre-Generation Reuse Review
    -   0.2. Documentation Gaps & Assumptions
    -   0.3. Courier & Tracking Flow
-   Task 1 — Courier Foundation
-   Task 2 — Shipment Initialization
-   Task 3 — Courier Selection
-   Task 4 — Shipment Booking
-   Task 5 — Tracking Registration
-   Task 6 — Shipment Timeline
-   Task 7 — Delivery Status Synchronization
-   Task 8 — Validation & Testing

### **2\. Cross-Reference Verification**

| **Check** | **Result** |
| --- | --- |
| Organized by implementation dependency, not the feature-brief's list order | ✅ Foundation → Initialization → Selection → Booking → Tracking Registration → Timeline → Delivery Sync → Validation; every task's Dependencies field names exact prior task(s) |
| --- | --- |
| Zero new Prisma models/migrations across all 8 tasks | ✅ Confirmed explicitly after Tasks 1–3 and again after Tasks 4–6; reconfirmed at Task 8.5's reuse audit |
| --- | --- |
| No order-status write path outside Feature 7's transitionOrderStatus | ✅ Task 1.5, 4.4, 6.3, 7.2 all explicitly call the reused method; audited at Task 8.5 |
| --- | --- |
| No second CourierAdapter implementation | ✅ This feature is the adapter's sole real consumer (Feature 6 only used a single-estimate call); audited at 8.5 |
| --- | --- |
| Feature 7's patched hand-off honored | ✅ Task 2.1 consumes exactly the courier-assignment-pending job Feature 7 enqueues; Task 8.7 explicitly cross-checks both codebases for overlap |
| --- | --- |
| Full courier scoring/booking/tracking correctly placed here (not Feature 7) | ✅ Matches the roadmap correction — Feature 7 only reserves the seam, this feature is the real implementation |
| --- | --- |
| Public tracking PII boundary respected | ✅ Task 5.2, adversarial-tested at Task 8.4 |
| --- | --- |
| Ownership enforced identically to prior features | ✅ Task 1.3, adversarial-tested at Task 8.3 |
| --- | --- |
| COD delivery-confirms-payment correctly deferred to Feature 7's existing logic | ✅ Task 7.2 — verification only, no duplicate write |
| --- | --- |
| COMPLETED transition correctly not invented | ✅ Task 7.6 — flagged as a gap, not fabricated |
| --- | --- |
| Real courier integration correctly deferred | ✅ Mock-only throughout (D2); Feature 16 owns the live swap-in |
| --- | --- |
| Shared components/infra reused, not rebuilt | ✅ Socket.IO gateway, BullMQ wiring, Notification producer interface, envelope/error/validation harness all consumed from Features 0/7/9(interface) with zero new equivalents |
| --- | --- |

### **3\. Assumptions Made (full list)**

| **#** | **Assumption** | **Task** |
| --- | --- | --- |
| 1 | Checkout-time shipping estimate is not retroactively reconciled against the booked courier's actual quoted cost; orders.shipping\_fee/total\_amount remain as set at checkout, courier\_quotes.cost holds the actual figure for internal reference only | Feature Overview / Task 4 |
| --- | --- | --- |
| 2 | Scoring is idempotent-per-order — courier\_quotes written once after confirmPayment()'s job, re-scored only via an explicit "Refresh rates" action | Task 3 |
| --- | --- | --- |
| 3 | Mock CourierAdapter.track() returns a deterministic, plausible lat/lng progression per courier/destination pair for demo purposes | Task 6 |
| --- | --- | --- |
| 4 | An order is courier-selection-eligible only when status=PAYMENT\_CONFIRMED and courier IS NULL; already-booked orders show read-only courier info | Task 2, 4 |
| --- | --- | --- |

### **4\. Engineering Decisions Made (full list)**

| **#** | **Decision** | **Task** |
| --- | --- | --- |
| 1 | New tracking/ module (repository/service/controller/routes) — reconfirms, does not repeat, Feature 7's original (patched) module-boundary decision and TRD §12's folder layout | Task 1 |
| --- | --- | --- |
| 2 | Courier-assignment trigger is exclusively the courier-assignment-pending BullMQ job from Feature 7's confirmPayment() — no second/polling-based trigger | Task 2 |
| --- | --- | --- |
| 3 | All order-status writes route through Feature 7's transitionOrderStatus — no second write path, verified at every relevant step (4.4, 6.3, 7.2) and audited at Task 8.5 | Tasks 1, 4, 6, 7 |
| --- | --- | --- |

### **5\. Unresolved Documentation Gaps (carried forward, not closed by this feature)**

| **#** | **Gap** | **Status** | **Needs** |
| --- | --- | --- | --- |
| 1 | Checkout-time shipping estimate vs. booked-courier actual rate divergence (Feature 6 Gap #1) — not reconciled, only formally resolved as "checkout total stands, actual cost is reference-only" | Resolved-by-decision, not by reconciliation logic | A product decision if true reconciliation (e.g., adjusting total\_amount or issuing a credit/charge difference) is ever desired — Future scope |
| --- | --- | --- | --- |
| 2 | DELIVERED → COMPLETED transition trigger is undefined by any source document | Explicitly flagged, not invented | Feature 12 (Payments & Admin Operations) likely owns this — probably tied to settlement completion or a fixed grace period; needs a product/documentation decision |
| --- | --- | --- | --- |
| 3 | Real courier provider integration (replacing the mock CourierAdapter) | Explicitly deferred | Feature 16 (External APIs) |
| --- | --- | --- | --- |
| 4 | Webhook verification, payment retry, settlement engine, COD remittance ledger | Explicitly deferred (unchanged from Feature 7's own gap list) | Feature 12 (Payments & Admin Operations) |
| --- | --- | --- | --- |
| 5 | Notification dispatch internals (actual SMS/WhatsApp/in-app delivery) | Explicitly deferred — this feature only enqueues | Feature 9 (Notifications) |
| --- | --- | --- | --- |

**Feature 8.md — Courier & Tracking Engineering Execution Playbook is complete.** All 8 tasks follow the required dependency sequence, correctly implement the full courier scoring/booking/retry/fallback/override algorithm and the complete tracking pipeline (poll job, WebSocket push, public/authenticated pages) that Feature 7's patch deliberately deferred here, introduce **zero schema changes**, and route every order-status mutation through Feature 7's existing transitionOrderStatus (confirmed via the Task 8.5/8.7 reuse audit). Every Assumption and Engineering Decision is logged above and carried into FEATURE\_8\_CHECKLIST.md for sign-off. Ready for the team to execute following Features 0–7 (patched).