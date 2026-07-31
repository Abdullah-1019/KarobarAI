# **KarobarAI — Engineering Execution Playbook**

## **Feature 7: Order Management**

**Source of truth:** PRD · TRD · App Flow · Backend Schema · Implementation Plan (Docs 1–6). No architecture, schema, API contract, business rule, workflow, or folder structure is invented beyond what these documents specify. Gaps are marked **Assumption**; reuse-vs-extend calls are marked **Engineering Decision**.

**Depends on:** Feature 0 (Foundation), Feature 1 (Authentication), Feature 4 (Product Management — inventory/stock methods), Feature 6 (Cart & Checkout — creates the orders/order\_items/payments rows this feature manages, and the PaymentAdapter/CourierAdapter interfaces this feature calls).

**Feeds:** Feature 8 (Payments & Admin Operations — settlement, webhook confirmation, COD reconciliation, admin overrides all act on the order/payment state this feature maintains).

## **Table of Contents**

-   Feature Overview
    -   0.1. Pre-Generation Reuse Review
    -   0.2. Documentation Gaps & Assumptions
    -   0.3. Order Management Flow
-   Task 1 — Order Foundation
-   Task 2 — Order Retrieval
-   Task 3 — Buyer Orders
-   Task 4 — Seller Orders *(pending)*
-   Task 5 — Order Details *(pending)*
-   Task 6 — Order Status Management *(pending)*
-   Task 7 — Courier Booking & Tracking *(pending)*
-   Task 8 — Invoice Generation *(pending)*
-   Task 9 — Validation & Testing *(pending)*

## **Feature Overview**

**What Feature 7 covers:** the full post-checkout lifecycle of orders created by Feature 6 — App Flow SCR-S05 (Seller Order Management), SCR-S06 (Order Detail + Courier Booking), SCR-B07 (My Orders), SCR-B08 (Order Tracking, authenticated), SCR-B09 (Public Tracking Page, login-free). It implements the **order/tracking-events/courier\_quotes** slice of Schema Doc 5, TRD §3's Order state machine, REQ-F-Logistics-001–008 (Intelligent Logistics), REQ-F-Track001–008 (Live Order Tracking), and the order-side half of REQ-F-Payment (payment status is **read**, not mutated, here).

**What it explicitly excludes:**

-   **Payment processing** — retry logic (REQ-F-Payment-003), webhook-driven PAYMENT\_CONFIRMED transitions (REQ-F-Payment-002), settlement (REQ-F-Payment-005/007), and COD remittance reconciliation (cod\_remittances, REQ-F-COD-002/004) are **Feature 8**. This feature reads payments/orders.status to display order state and **advances the order state machine on a payment-confirmed signal**, but does not implement the confirmation mechanism itself (see Gap #1).
-   **Admin overrides** (payment release, dispute resolution, config panel) — Feature 8/Admin.
-   **Returns** (SCR-S07, SCR-B10/B11, returns/return\_images/disputes tables) — a separate future feature; Order Detail/My Orders surface a "Return" entry point only as a navigation link, not built here.
-   **Cart/Checkout mutation** — Feature 6 owns carts/cart\_items/order **creation**; this feature owns everything **after** an order row exists.

**Governing tables (Schema Doc §4):** orders (4.10), order\_items (4.11) — read/status-transition here, created by Feature 6; tracking\_events (4.21), courier\_quotes (4.22) — created here; payments (4.12) — read-only here; products (4.6) — stock-restoration on cancellation (REQ-F-Inv-004).

### **0.1. Pre-Generation Reuse Review**

| **Feature 0–6 Asset** | **Exists At** | **Feature 7 Usage** |
| --- | --- | --- |
| Envelope helper, typed error hierarchy, Zod validation harness | Feature 0 | Reused unchanged for every new order/tracking/invoice endpoint |
| --- | --- | --- |
| authenticate + ownership middleware, RBAC | Feature 1 | Reused as-is — Seller Orders/Buyer Orders enforce seller\_id = self / buyer\_id = self (Schema §9); public tracking (SCR-B09) is the one intentionally unauthenticated route (via tracking\_token, not RBAC bypass) |
| --- | --- | --- |
| PaymentAdapter interface + mock (D2) | Feature 0/2 (scaffold), Feature 6 (first caller) | **Read-only** here — this feature reads payments.status to gate order-status transitions; it does not call charge()/webhooks (Feature 8's scope) |
| --- | --- | --- |
| CourierAdapter interface + mock (D2), single-estimate call pattern | Feature 0/2 (scaffold), Feature 6 Task 6 (single-estimate use) | **This feature is the adapter's primary consumer** — implements the full parallel Promise.all scoring (40/30/20/10) across all configured couriers, explicitly deferred by Feature 6 (Gap #1 of Feature 6) to here |
| --- | --- | --- |
| orders, order\_items rows, commission\_rate\_snapshot, ship\_\* snapshot fields | Feature 6 Task 7 | Consumed as-is — this feature never re-creates or re-snapshots these; it transitions orders.status and appends tracking\_events |
| --- | --- | --- |
| Stock-decrement / oversell-guard method | Feature 4 | Reused for the **reverse** operation — stock **restoration** on cancellation (REQ-F-Inv-004) calls the same inventory module, not a new increment method |
| --- | --- | --- |
| Repository/service/controller layered pattern | Feature 2, established in Features 4/6 | New order/ module additions and new tracking/ module follow the identical shape |
| --- | --- | --- |
| Socket.IO gateway stub | TRD §2 (Architecture phase) | Reused for real-time tracking push (REQ-F-Track002) — this feature emits events on it, does not re-scaffold Socket.IO |
| --- | --- | --- |
| BullMQ/Redis queue wiring | TRD §2 (Architecture phase) | Reused for the 5-minute tracking-poll job (REQ-F-Track001) and notification dispatch (calls into the Notification module, built elsewhere — this feature only enqueues, does not build the notification-sending pipeline) |
| --- | --- | --- |
| Routing (/seller/orders, /orders, /orders/:id, /orders/:id/track, /t/:token) | Feature 0 Task 10 | Routes already reserved — this feature fills them |
| --- | --- | --- |

**Conclusion of review:** Feature 7 introduces two new backend concerns — an order/ lifecycle slice (extending, not duplicating, Feature 6's order/ module) and a new tracking/ module (tracking events + courier scoring/booking) — while strictly reusing Feature 6's created rows, Feature 4's inventory methods, and the architecture phase's adapter interfaces.

**Engineering Decision — Module Boundaries:**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Backend module structure | Extend Feature 6's apps/api/src/modules/order/ with lifecycle/status-transition/invoice logic; add a new apps/api/src/modules/tracking/ for courier scoring, booking, tracking-events, and the poll job — matching TRD §12's folder layout, which lists tracking/ as its own module folder distinct from order/ | TRD §12 explicitly separates order/ ("+ state-machine usage") from tracking/ ("poll jobs + WebSocket gateway") — this feature honors that existing folder boundary rather than merging them |
| --- | --- | --- |
| Order state machine | Single shared state-machine module (core/state-machines/order.state-machine.ts, per TRD §3's Strategy/State-machine pattern: "Single source of valid transitions (shared module)") | TRD explicitly calls for one canonical transition table — this feature implements it once, both Seller Order Status updates (Task 6) and Payment-confirmation-driven transitions read the same table |
| --- | --- | --- |
| Courier scoring | Full parallel Promise.all across configured couriers (REQ-F-Logistics-002), reusing the exact CourierAdapter interface Feature 6 already imports for its single-estimate call | Avoids a second adapter-calling convention; only the calling pattern (one call vs. parallel-all) differs between Feature 6's checkout estimate and this feature's booking-time scoring |
| --- | --- | --- |

### **0.2. Documentation Gaps & Assumptions**

| **Gap** | **What the docs say** | **Assumption taken** |
| --- | --- | --- |
| **#1 — PAYMENT\_PENDING → PAYMENT\_CONFIRMED transition trigger** | App Flow §6.7 shows payment confirmation arriving via webhook (HMAC-verified); Feature 6 explicitly stops at creating a PENDING payments row (Feature 6 Gap #2). No document says which feature *writes* the PAYMENT\_CONFIRMED order-status transition. | **Assumption:** this feature's order state machine exposes a confirmPayment(orderId) transition method, called by whatever mechanism Feature 8 implements (webhook handler) — i.e., **Feature 7 owns the state machine and the transition function; Feature 8 owns the trigger (webhook receipt) that calls it.** This feature does not implement webhook verification itself. For COD orders, the equivalent trigger is delivery confirmation (Task 6.4), which this feature does own, since COD's "confirmation" is a logistics event (courier-confirmed delivery), not a payment-gateway webhook. |
| --- | --- | --- |
| **#2 — Invoice: no schema table, no explicit PRD requirement** | Neither the PRD's Functional Requirements (§12) nor Schema Doc 5 mentions an invoices table or an REQ-F-Invoice-\* ID. App Flow's Order Confirmation (SCR-B06) shows only an order summary. Your brief lists "Invoice" as an explicit deliverable, however. | **Assumption:** Invoice is a **derived, generated artifact** (PDF/HTML rendering of an existing orders+order\_items+payments row), not a new persisted entity — no new table is added (would contradict "DO NOT MODIFY Database Schema"). It is generated on-demand from data this feature already owns, matching REQ-F-Analytics-006's precedent (PDF export, Future-scoped but same "render from existing data" pattern) rather than inventing new schema. |
| --- | --- | --- |
| **#3 — Seller-permitted order-status transitions** | App Flow SCR-S06 shows Confirm & Book Courier, cancel (from allowed states); the canonical status list (App Flow §0) is fixed, but no document enumerates exactly which transitions a **Seller** (vs. the system/courier-poll) may trigger manually. | **Assumption:** Sellers may manually trigger only PAYMENT\_CONFIRMED → PROCESSING (implicit on courier booking) and cancellation from any pre-shipment state (PAYMENT\_PENDING/PAYMENT\_CONFIRMED/PROCESSING, per App Flow SCR-S06 "Cancel order (only from allowed states)"). All shipment-progress transitions (PICKED\_UP → IN\_TRANSIT → OUT\_FOR\_DELIVERY → DELIVERED) are **system-driven** by the courier tracking-poll job (Task 7), not manually settable by the Seller — consistent with REQ-F-Track001's poll-driven design. |
| --- | --- | --- |
| **#4 — COD "delivery confirms payment" mechanics** | App Flow §6.7: "\[COD\] mark COD → confirm on delivery → courier remits → ledger → settle." No document specifies which system component flips payments.status on delivery. | **Assumption:** this feature's DELIVERED transition (Task 6, system/poll-driven) triggers a payments.status = CONFIRMED update for COD orders as a side effect of the state-machine's DELIVERED entry action — since delivery **is** the COD payment-confirmation event, and this feature already owns the delivery transition. The cod\_remittances ledger row itself remains Feature 8's responsibility (Feature 6 Gap #3), not written here. |
| --- | --- | --- |

### **0.3. Order Management Flow**

Order Foundation

(order/ lifecycle module extension + new tracking/ module scaffold,

on top of Feature 6's existing order rows)

│

▼

Order Retrieval

(shared base query/authorization logic — ownership-scoped order fetch,

used by both Buyer and Seller views)

│

▼

Buyer Orders

(SCR-B07 My Orders — buyer-scoped list + status filters)

│

▼

Seller Orders

(SCR-S05 Order Management — seller-scoped list + status-tab mapping)

│

▼

Order Details

(SCR-S06 / order detail for buyer — full order view, both roles)

│

▼

Order Status Management

(shared state-machine module; seller-triggered + system-triggered

transitions; payment-confirmation hook per Gap #1/#4)

│

▼

Courier Booking & Tracking

(parallel courier scoring, Confirm & Book, 5-min poll job, WebSocket

push, tracking\_events, public tracking page)

│

▼

Invoice Generation

(on-demand PDF/HTML render from existing order/payment data, Gap #2)

│

▼

Validation & Testing

(reuse-audit · state-machine transition tests · ownership adversarial

tests · cross-check against Feature 6)

Each stage depends on the one before it: Order Retrieval's ownership-scoped query underlies both Buyer and Seller list views; Order Details needs a resolvable single-order fetch before it can render; Status Management must exist before Courier Booking can transition an order into PROCESSING/PICKED\_UP; Tracking depends on a booked courier existing; Invoice depends on a stable, deliverable order record; Validation is only meaningful once the full lifecycle is wired end-to-end.

## **Task 1 — Order Foundation**

### **Purpose**

-   Extend Feature 6's order/ module with lifecycle-scoped repository methods (status transitions, cancellation) without touching Feature 6's checkout-creation code.
-   Scaffold the new tracking/ module (repository/service/controller/routes) per TRD §12's folder layout, for tracking\_events and courier\_quotes.
-   Confirm zero new Prisma models/migrations — orders, order\_items, tracking\_events, courier\_quotes are all fully specified in Schema Doc 5 §4.10/4.11/4.21/4.22.

### **Dependencies**

-   Feature 6 complete (order/ module, checkout-creation slice; orders/order\_items/payments rows exist)
-   Feature 0/2 complete (adapter factory, Socket.IO stub, BullMQ wiring, error hierarchy, envelope)
-   Feature 1 complete (authenticate, ownership middleware)

### **Expected Deliverables**

-   \[ \] apps/api/src/modules/order/order.repository.ts extended with: findOrderById, updateOrderStatus, findOrdersByBuyer, findOrdersBySeller (additive to Feature 6's create-only methods, same file, same module)
-   \[ \] apps/api/src/modules/tracking/ — new module: tracking.repository.ts, tracking.service.ts, tracking.controller.ts, tracking.routes.ts, tracking.dto.ts
-   \[ \] core/state-machines/order.state-machine.ts — new shared module per TRD §3 (Engineering Decision above)
-   \[ \] Confirmed: zero new Prisma models, zero new migrations

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 1.1 | Add lifecycle-read/-write methods to Feature 6's existing order.repository.ts — do not create a parallel order-lifecycle.repository.ts | Single repository file, extended | Code review: one order.repository.ts, additive commit, no new file |
| --- | --- | --- | --- |
| 1.2 | Scaffold tracking/ module mirroring the cart//address/ layered pattern (Feature 6 Tasks 1/5) | New module, consistent shape | Code review matches established pattern |
| --- | --- | --- | --- |
| 1.3 | Implement order.state-machine.ts: encode the canonical transition table from App Flow §0 — PAYMENT\_PENDING → PAYMENT\_CONFIRMED → PROCESSING → PICKED\_UP → IN\_TRANSIT → OUT\_FOR\_DELIVERY → DELIVERED → COMPLETED, plus CANCELLED (from pre-shipment states only, Gap #3) and PENDING\_MANUAL\_LOGISTICS (from PAYMENT\_CONFIRMED, on all-courier-failure, REQ-F-Logistics-007) | Pure-function transition validator: canTransition(from, to) => boolean, used by both Task 6 and Task 7 | Unit test: every valid transition in the canonical list passes; every skip-a-step or backward transition is rejected |
| --- | --- | --- | --- |
| 1.4 | Register /api/v1/orders/\* (extends Feature 6's route group) and /api/v1/tracking/\* route groups, both behind authenticate except the public-token tracking endpoint (reserved here, implemented Task 7) | Route groups mounted | No-token request to /orders/\* → 401; public /t/:token endpoint reserved but returns 501 stub until Task 7 |
| --- | --- | --- | --- |
| 1.5 | Confirm Feature 0's stubbed frontend routes (/seller/orders, /orders, /orders/:id, /orders/:id/track, /t/:publicToken) resolve — no new registration needed | No route-table changes | ROUTES.md requires no edits |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A second orders repository/module created instead of extending Feature 6's | Explicit instruction violation — grep for a single order.repository.ts file, additive only |
| --- | --- |
| State machine transition rules hardcoded separately in the controller and in a service method | TRD §3 requires **one** shared module — both Task 6 (seller-triggered) and Task 7 (system/poll-triggered) must import the same order.state-machine.ts |
| --- | --- |

## **Task 2 — Order Retrieval**

### **Purpose**

-   Implement the shared, ownership-scoped order-fetch logic underlying both Buyer (Task 3) and Seller (Task 4) list/detail views — one query-building layer, not two parallel implementations.
-   Enforce Schema §9's ownership rules at the repository/service boundary: a Seller reads only seller\_id = self orders; a Buyer reads only buyer\_id = self orders.
-   Establish pagination (cursor/page+limit, TRD §9 convention) reused from Feature 4/5's list-endpoint pattern.

### **Dependencies**

-   Task 1 complete (extended repository, route groups)

### **Expected Deliverables**

-   \[ \] order.service.ts: getOrdersForBuyer(buyerId, filters, pagination), getOrdersForSeller(sellerId, filters, pagination) — both delegate to one underlying order.repository.ts query builder, parameterized by the ownership column
-   \[ \] getOrderById(orderId, requestingUser) — single-order fetch with an ownership check that accepts **either** a matching buyer\_id **or** seller\_id **or** Admin/Support role (Schema §9)
-   \[ \] Status-tab filter support (App Flow SCR-S05's friendly-label groupings, mapped to canonical enum sets)
-   \[ \] Pagination reused from TRD §9 (page/limit, default limit 20, meta totals)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 2.1 | Implement one repository query-builder method queryOrders({ ownerColumn, ownerId, statusFilter, pagination }) — used by both buyer and seller service methods with a different ownerColumn/ownerId pair, not two separate SQL/Prisma query bodies | Single query-builder, two thin callers | Code review: one queryOrders method, called twice with different params — no duplicated WHERE composition |
| --- | --- | --- | --- |
| 2.2 | Implement the canonical-status-set → friendly-tab mapping from App Flow SCR-S05: **Pending** (PAYMENT\_PENDING,PENDING\_MANUAL\_LOGISTICS), **Confirmed/Processing** (PAYMENT\_CONFIRMED,PROCESSING), **Shipped** (PICKED\_UP,IN\_TRANSIT,OUT\_FOR\_DELIVERY), **Delivered** (DELIVERED,COMPLETED), **Cancelled** (CANCELLED) | Shared mapping constant, importable by both Buyer (Task 3) and Seller (Task 4) UIs | A ?tab=Shipped filter query correctly returns orders in any of the 3 underlying statuses |
| --- | --- | --- | --- |
| 2.3 | Implement getOrderById with tri-mode ownership: caller's userId must equal the order's buyer\_id **or** seller\_id, or the caller's role must be Admin/Support (read-access per PRD §11 permission matrix) | Working single-order fetch with correct 403 on mismatch | A third-party Buyer's token requesting another buyer's order → 403; the order's own Seller requesting it → 200; Admin requesting any order → 200 |
| --- | --- | --- | --- |
| 2.4 | Wire pagination per TRD §9 (page/limit, default 20, meta.totals) — reuse the exact pattern from Feature 4/5's list endpoints, not a new pagination convention | Consistent pagination shape | Response envelope's meta matches the format already used in Feature 5's Product Listing |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Separate SQL/Prisma query logic written for Buyer vs. Seller order lists | Contradicts the reuse-first discipline established across Features 4–6 — one parameterized query builder, two thin service wrappers |
| --- | --- |
| getOrderById allows any authenticated user to view any order (ownership check omitted "since it's just a read") | Schema §9 is explicit: ownership applies to orders identically to carts/returns — no relaxed read exception |
| --- | --- |

## **Task 3 — Buyer Orders**

### **Purpose**

-   Build SCR-B07 (My Orders) — the buyer-facing order list with status filters and entry points into Track/Return/Review.
-   Consume Task 2's shared retrieval logic exclusively — no buyer-specific query duplication.
-   Wire the "Track" action to the (not-yet-built) Task 7 tracking screen and the "Return" action as a navigation stub (Returns is out of this feature's scope, per Feature Overview's exclusions).

### **Dependencies**

-   Task 2 complete (getOrdersForBuyer, status-tab mapping, pagination)

### **Expected Deliverables**

-   \[ \] GET /api/v1/orders?role=buyer (or equivalent buyer-scoped route) — calls getOrdersForBuyer
-   \[ \] SCR-B07 screen: order list with status chips, filters (active/completed/returns), per-order actions
-   \[ \] Empty state ("You haven't placed any orders yet") per App Flow
-   \[ \] Return-eligibility gating logic (≤14 days since delivery, no prior return) — **gate check only**, the Return flow itself is out of scope (future feature)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 3.1 | Implement the buyer-scoped controller endpoint, calling order.service.ts's getOrdersForBuyer (Task 2.1) — no new query logic in the controller | Working endpoint | Buyer A's token never returns Buyer B's orders (spot-check; full adversarial test deferred to Task 9) |
| --- | --- | --- | --- |
| 3.2 | Build SCR-B07: order list with status chips (mapped via Task 2.2's shared tab constant), filters (active/completed/returns tabs), each row showing order ID, seller, total, status | Functional My Orders screen | Manual test: placing 2 orders (from Feature 6) with different statuses shows correctly chip-labeled rows |
| --- | --- | --- | --- |
| 3.3 | Wire per-order "Track" action → navigates to /orders/:id/track (Task 7's screen, route already reserved by Feature 0) | Functional navigation | Clicking Track on a shippable-state order navigates correctly; disabled/hidden for PAYMENT\_PENDING orders with no tracking yet |
| --- | --- | --- | --- |
| 3.4 | Implement return-eligibility gate (read-only check: deliveredAt within 14 days per platform\_config.return\_window\_days, Schema §4.25, **and** no existing returns row for this order) — render the "Return" button enabled/disabled accordingly, but do **not** build the Return flow itself (out of scope) | Correctly gated button, non-functional beyond gating | An order delivered 20 days ago shows "Return" disabled/hidden per BR-002's window; the button's onClick, if enabled, is a stub navigation to a not-yet-built route (documented as a future-feature handoff point, same pattern as Feature 5's Add-to-Cart stub before Feature 6 wired it) |
| --- | --- | --- | --- |
| 3.5 | Build the empty state ("You haven't placed any orders yet") using Feature 0's shared EmptyState component | Correct empty UI | Brand-new Buyer with zero orders sees the documented message, not a blank/broken list |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Return-eligibility check re-implements the 14-day window as a hardcoded 14, not reading platform\_config.return\_window\_days | Must read the admin-configurable value (Schema §4.25), matching the discipline already required in Feature 6 Task 4.3 for min\_order\_value\_pkr |
| --- | --- |
| Return button wired to call a real (non-existent) returns-creation endpoint | It must be a stub/navigation placeholder only — the Returns feature does not yet exist; a call to a missing endpoint is a regression, not an acceptable placeholder (same rule as Feature 5 Task 6.4's Add-to-Cart stub) |
| --- | --- |

*End of Response 1 — Title, Table of Contents, Feature Overview, Order Management Flow, and Tasks 1–3 complete. Awaiting confirmation before continuing with Tasks 4–6 (Seller Orders, Order Details, Order Status Management).*

## **Task 4 — Seller Orders**

### **Purpose**

-   Build SCR-S05 (Seller Order Management) — the seller-facing order pipeline view, using the identical friendly-tab mapping and pagination as Buyer Orders (Task 2/3), no duplicated logic.
-   Surface the PENDING\_MANUAL\_LOGISTICS alert badge (REQ-F-Logistics-007) distinctly in the seller view, since it is a seller-actionable state Buyers don't need to see flagged the same way.
-   Wire per-row entry into Order Detail (Task 5), the seller's primary action surface.

### **Dependencies**

-   Task 2 complete (getOrdersForSeller, shared status-tab mapping, pagination)
-   Task 3 complete (confirms the shared retrieval pattern works end-to-end for one role before building the second)

### **Expected Deliverables**

-   \[ \] GET /api/v1/orders?role=seller (or equivalent seller-scoped route) — calls getOrdersForSeller
-   \[ \] SCR-S05 screen: tabbed order list (Pending/Confirmed-Processing/Shipped/Delivered/Cancelled), per-row buyer/items/total/status/inline courier box
-   \[ \] PENDING\_MANUAL\_LOGISTICS alert badge on affected rows
-   \[ \] Empty state per tab ("No orders in this stage")

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 4.1 | Implement the seller-scoped controller endpoint, calling order.service.ts's getOrdersForSeller (Task 2.1's same query-builder, ownerColumn=seller\_id) — no new query logic | Working endpoint | Seller A's token never returns Seller B's orders (spot-check; full adversarial test deferred to Task 9) |
| --- | --- | --- | --- |
| 4.2 | Build SCR-S05: tabs using Task 2.2's exact shared mapping constant (Pending/Confirmed-Processing/Shipped/Delivered/Cancelled) — same constant Buyer Orders imports, not a redefinition | Functional Seller Order Management screen | Tab labels and underlying status-set groupings are byte-identical to Task 2.2's definition (import, not copy-paste) |
| --- | --- | --- | --- |
| 4.3 | Render per-row: order ID, buyer (masked/summary per PII rules), items count, total, status, inline courier box (shows assigned courier or "Not yet booked") | Functional row rendering | A freshly-placed order (from Feature 6) with no courier yet shows "Not yet booked" |
| --- | --- | --- | --- |
| 4.4 | Surface a distinct alert badge on rows where status = PENDING\_MANUAL\_LOGISTICS (REQ-F-Logistics-007) | Visually distinct badge/alert | An order flagged PENDING\_MANUAL\_LOGISTICS (simulated — real trigger is Task 7) is visually distinguishable from a normally-processing order |
| --- | --- | --- | --- |
| 4.5 | Build per-tab empty state ("No orders in this stage") using Feature 0's shared EmptyState | Correct empty UI per tab | A tab with zero matching orders shows the message, not an empty table with no context |
| --- | --- | --- | --- |
| 4.6 | Wire per-row click → navigates to /seller/orders/:id (Task 5's Order Detail, route already reserved by Feature 0) | Functional navigation | Clicking a row opens the correct order's detail view |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A second tab-mapping constant defined for the seller view, drifting from Buyer Orders' definition | Both must import Task 2.2's single shared constant — a redefinition risks the two roles' tab groupings silently diverging over time |
| --- | --- |
| PII (buyer phone/address) rendered unmasked in the seller order list | Order list is a summary view; full (still-decrypted-server-side-as-needed, access-controlled) detail belongs in Order Detail (Task 5), not the list row |
| --- | --- |

## **Task 5 — Order Details**

### **Purpose**

-   Build the single-order detail view consumed by **both** roles: Seller's SCR-S06 (Order Detail + Courier Booking panel) and the Buyer-facing order detail (implicit companion to SCR-B07's "view" action) — one screen/component, role-conditional action panel, consistent with the reuse discipline established across this series.
-   Render complete order information: buyer/shipping info, item list, payment summary (including shipping line and commission preview, seller-only), status timeline.
-   Reserve, but do not yet implement, the courier-booking action panel and tracking timeline (Task 7 fills these in) — Task 5 renders the **static** order data; Task 7 adds the **live/action** layer.

### **Dependencies**

-   Task 2 complete (getOrderById with tri-mode ownership)
-   Task 4 complete (Seller Orders list, the primary navigation source into this screen)

### **Expected Deliverables**

-   \[ \] GET /api/v1/orders/:id — single-order fetch, role-aware response shaping (commission preview shown only if requestingUser.role === Seller and matches seller\_id)
-   \[ \] Order Detail screen: buyer/shipping info (decrypted server-side, access-controlled), item list (from order\_items snapshots), payment summary (subtotal, shipping\_fee, total\_amount, commission preview for sellers only), status display (placeholder timeline, wired live in Task 7)
-   \[ \] Reserved (non-functional) UI slots for: courier recommendation card, Confirm & Book button, tracking link — populated in Task 7
-   \[ \] Cancel-order action (per Gap #3, from pre-shipment states only)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 5.1 | Implement GET /orders/:id using Task 2.3's getOrderById (tri-mode ownership) — response includes commissionRateSnapshot/computed commission preview **only** when the requester is the order's Seller (Buyers never see commission per App Flow SCR-B05's "commission not shown to buyer") | Role-shaped response | A Buyer's fetch of their own order omits commission figures; the same order fetched by its Seller includes them |
| --- | --- | --- | --- |
| 5.2 | Render item list from order\_items (Schema §4.11) — title\_snapshot/unit\_price as frozen at purchase time, **not** a live join back to the current products row (preserves purchase-time history per Schema's snapshot design) | Correct historical rendering | Editing a product's current title/price (Feature 4) after an order exists does not change what Order Detail displays for that historical order |
| --- | --- | --- | --- |
| 5.3 | Render shipping info from the order's ship\_\* snapshot columns (Schema §4.10) — decrypted server-side for authorized viewers only, never sent as ciphertext to the client | Correct, access-controlled shipping display | The order's snapshotted address, not the buyer's current default address (which may have changed since), is what's shown — matching Schema's "snapshot (preserves history)" note |
| --- | --- | --- | --- |
| 5.4 | Render payment summary: subtotal, shipping fee (from Feature 6 Task 6/7), total, payment method/status (read from payments, read-only) | Correct summary block | COD order shows method=COD, status reflecting whatever Feature 6 set (PENDING until Task 6/7's delivery-confirms-COD logic, Gap #4, fires) |
| --- | --- | --- | --- |
| 5.5 | Reserve UI slots (empty/placeholder state) for: courier recommendation card, "Confirm & Book Courier" button, status timeline, tracking link — explicitly marked in code as "populated by Task 7," not left silently broken | Placeholder sections present, clearly non-functional | Screen renders cleanly with clear "booking not yet available" style placeholders, no crashes/undefined errors |
| --- | --- | --- | --- |
| 5.6 | Implement Cancel-order action: enabled only from PAYMENT\_PENDING/PAYMENT\_CONFIRMED/PROCESSING (Gap #3) — calls the state machine's cancel transition (Task 1.3), triggers stock restoration (REQ-F-Inv-004, calls Feature 4's existing increment method) | Working cancel action with correct state-gating | Attempting cancel from PICKED\_UP or later is rejected (button disabled client-side, endpoint returns 422 server-side as defense-in-depth) |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Item list re-fetches current product data (title/price) via Feature 4's live product endpoint instead of using the order's own order\_items snapshot | Violates Schema §4.11's explicit "preserve history" design — orders must always display what was actually purchased, not the product's current state |
| --- | --- |
| Commission preview leaked to the Buyer's response | App Flow SCR-B05 is explicit: commission is never shown to buyers — Step 5.1's role-shaping must be enforced server-side, not just hidden client-side (a Buyer could otherwise read it directly from the API response) |
| --- | --- |
| Cancel action allowed from IN\_TRANSIT or later, restoring stock on an already-shipped order | Contradicts Gap #3's pre-shipment-only assumption and would create a stock/physical-reality mismatch — the state machine (Task 1.3) must reject this transition |
| --- | --- |

## **Task 6 — Order Status Management**

### **Purpose**

-   Wire the shared order.state-machine.ts (Task 1.3) into real transition endpoints: Seller-triggered (booking → PROCESSING, cancel) and system-triggered (courier-poll-driven shipment progress, payment-confirmation-driven PAYMENT\_CONFIRMED, delivery-driven DELIVERED/COMPLETED).
-   Implement the Gap #1 payment-confirmation hook (confirmPayment(orderId), callable by Feature 8's future webhook handler) and the Gap #4 COD-delivery-confirms-payment side effect.
-   Ensure every transition writes a corresponding tracking\_events row (Schema §4.21) for timeline/history purposes, even for non-courier-driven transitions like PAYMENT\_CONFIRMED.

### **Dependencies**

-   Task 1 complete (order.state-machine.ts)
-   Task 5 complete (Order Detail screen, where the Cancel action already calls the state machine per 5.6)

### **Expected Deliverables**

-   \[ \] order.service.ts: transitionOrderStatus(orderId, targetStatus, actor) — single entry point, validates via canTransition (Task 1.3), writes orders.status + a tracking\_events row atomically
-   \[ \] confirmPayment(orderId) — Gap #1's hook, transitions PAYMENT\_PENDING → PAYMENT\_CONFIRMED, triggers the courier-scoring kickoff (Task 7)
-   \[ \] PENDING\_MANUAL\_LOGISTICS transition (system-triggered, from PAYMENT\_CONFIRMED, on all-courier-adapter-failure, REQ-F-Logistics-007) — reserved here, fired from Task 7
-   \[ \] COD delivery-confirms-payment side effect (Gap #4) implemented as part of the DELIVERED transition's entry action
-   \[ \] Every transition appends a tracking\_events row with status, description, event\_time

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 6.1 | Implement transitionOrderStatus(orderId, targetStatus, actor): load current status → canTransition(current, target) (Task 1.3) → if valid, update orders.status and insert a tracking\_events row in one transaction; if invalid, throw a BusinessRuleError(422) (TRD §14's typed error hierarchy) | Single, reused-everywhere transition entry point | Every subsequent transition call (Seller cancel, Task 7's courier-driven updates) goes through this one method — grep confirms no direct orders.status write elsewhere |
| --- | --- | --- | --- |
| 6.2 | Implement confirmPayment(orderId) (Gap #1): calls transitionOrderStatus(orderId, 'PAYMENT\_CONFIRMED', 'system'), then enqueues the courier-scoring kickoff (BullMQ job, reusing the queue wiring from the architecture phase) — this method is the integration point Feature 8's webhook handler will call; **this feature does not implement the webhook itself** | Callable service method, documented as Feature 8's integration point | Manually invoking confirmPayment (test harness, simulating what a webhook will eventually do) correctly transitions the order and enqueues Task 7's scoring job |
| --- | --- | --- | --- |
| 6.3 | Implement the COD variant: within the DELIVERED transition's entry action (fired by Task 7's courier-poll job, not manually), if orders.payment\_method === COD, also update the corresponding payments row to status = CONFIRMED (Gap #4) — the cod\_remittances ledger row itself is **not** created here (deferred to Feature 8, per Feature 6 Gap #3) | Side-effect correctly scoped | A COD order reaching DELIVERED shows payments.status = CONFIRMED immediately after; no cod\_remittances row exists yet (confirmed absent, by design) |
| --- | --- | --- | --- |
| 6.4 | Confirm Seller-manual transitions are limited to exactly Gap #3's set: booking-triggered PROCESSING entry (Task 7 fires this, not a separate manual button) and Cancel (already wired, Task 5.6) — no other manual status-set endpoint exposed to Sellers | Correctly restricted action surface | Attempting to directly PATCH an order to DELIVERED via a hypothetical manual endpoint does not exist / returns 404 — only the system/poll path (Task 7) can reach shipment-progress states |
| --- | --- | --- | --- |
| 6.5 | Every call to transitionOrderStatus appends a tracking\_events row (Schema §4.21: order\_id, status, description, event\_time) — including non-shipment transitions like PAYMENT\_CONFIRMED and CANCELLED, so the full history is queryable, not just courier milestones | Complete tracking\_events history per order | An order's full lifecycle (payment confirm → processing → cancel, or → delivered) produces a complete, chronologically ordered tracking\_events list with no gaps |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A second, ad-hoc orders.status = X write introduced somewhere outside transitionOrderStatus (e.g., directly in a controller) | Breaks the single-source-of-truth guarantee TRD §3 requires — every status change must go through the one state-machine-validated method |
| --- | --- |
| Webhook verification/HMAC logic accidentally implemented inside confirmPayment "since it needs to be called somehow" | Gap #1 explicitly scopes this feature to the **transition function only** — the trigger (webhook receipt + HMAC check) is Feature 8's REQ-F-Payment-002 responsibility |
| --- | --- |
| tracking\_events only written for courier-driven milestones, silently skipping PAYMENT\_CONFIRMED/CANCELLED | REQ-F-Track007's 12-month history retention implies a complete timeline — every transition, not just shipment ones, must be logged |
| --- | --- |

*End of Response 2 — Tasks 4–6 complete. Awaiting confirmation before continuing with Tasks 7–9 (Courier Booking & Tracking, Invoice Generation, Validation & Testing), followed by the final Table of Contents update, cross-reference verification, and full consistency review against Features 0–6.*

### **Task 7 — Courier Hand-off Stub *(replaces "Courier Booking & Tracking")***

#### **Purpose**

-   Reserve the exact integration seam Feature 8 needs — a placeholder UI slot on Order Detail and a generic "ready for courier assignment" job — without implementing scoring, booking, or tracking logic here.
-   Confirm the order.state-machine.ts (Task 1.3) already defines PROCESSING and PENDING\_MANUAL\_LOGISTICS as valid states; this task does not add new states, it only stops short of *firing* the transitions that lead into them via courier logic.
-   **Scope correction:** courier scoring (REQ-F-Logistics-002/003), booking + retry/fallback (REQ-F-Logistics-004/005), COD-coverage filtering (REQ-F-Logistics-006), the all-fail path (REQ-F-Logistics-007), seller override (REQ-F-Logistics-008), the 5-minute tracking poll (REQ-F-Track001), WebSocket push (REQ-F-Track002), and both tracking screens (SCR-B08/SCR-B09) are **out of scope for Feature 7** and are deferred to **Feature 8 — Courier & Tracking**.

#### **Dependencies**

-   Task 6 complete (transitionOrderStatus, confirmPayment kickoff hook)
-   Task 5 complete (Order Detail screen, reserved UI slot)

#### **Expected Deliverables**

-   Order Detail screen: a **static, non-functional placeholder** where the courier recommendation card / Confirm & Book button / tracking timeline / tracking link will render — clearly labeled in code as "populated by Feature 8," not left as a silent blank or broken component
-   confirmPayment()'s kickoff (Task 6.2) enqueues a **generic** BullMQ job (e.g. courier-assignment-pending) carrying only orderId — no scoring/adapter logic inside this job's handler; Feature 8 owns writing the actual consumer
-   Explicit confirmation: **no** tracking.service.ts, **no** tracking/ module, **no** courier\_quotes writes, **no** Socket.IO /tracking namespace wiring, **no** BullMQ poll job, **no** SCR-B08/SCR-B09 screens exist in Feature 7's codebase
-   PENDING\_MANUAL\_LOGISTICS and PROCESSING remain defined (not removed) in order.state-machine.ts (Task 1.3) as valid target states — but nothing in Feature 7 transitions an order into either of them via courier logic

#### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 7.1 | Confirm order.state-machine.ts (Task 1.3) still defines PROCESSING and PENDING\_MANUAL\_LOGISTICS in its transition table — no removal, no change to Task 1.3 | Unmodified state machine | Existing Task 1.3 unit tests still pass unchanged |
| --- | --- | --- | --- |
| 7.2 | Replace any scoring/booking logic previously drafted here with a single enqueue call inside confirmPayment() (Task 6.2): push { orderId } onto a courier-assignment-pending queue — **no handler/consumer is written for this queue in Feature 7** | One enqueue call, zero consumer code | Grep confirms no file in Feature 7's order/ module reads from or processes courier-assignment-pending |
| --- | --- | --- | --- |
| 7.3 | On Order Detail (Task 5), render a labeled placeholder section: "Courier assignment pending — handled by Feature 8" (or equivalent dev-facing comment/empty-state), replacing any previously wired recommendation card, Confirm & Book button, override dropdown, or live timeline | Static placeholder only | Screen renders cleanly with no interactive courier controls; no console errors from missing handlers |
| --- | --- | --- | --- |
| 7.4 | Remove/do not implement: scoreCouriers(), bookCourier(), the 5-min poll job, Socket.IO /tracking emits, SCR-B08, SCR-B09, and any courier\_quotes (Schema §4.22) writes | Zero courier-adapter-calling code in Feature 7 | Grep for CourierAdapter usage inside Feature 7's codebase returns **no matches** — the adapter is untouched until Feature 8 |
| --- | --- | --- | --- |
| 7.5 | Confirm the public tracking route /t/:publicToken (Feature 0 Task 10 stub) remains an unimplemented placeholder — still returns Feature 0's default stub response, not a 404, not a real screen | Route reserved, unimplemented | Manual check: hitting /t/:token returns Feature 0's generic stub, unchanged since Task 1.4 |
| --- | --- | --- | --- |

#### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A tracking.service.ts or tracking/ module accidentally left in from drafting | Delete it entirely — this belongs to Feature 8, not Feature 7; its presence here is exactly the duplication this patch exists to prevent |
| --- | --- |
| confirmPayment()'s job handler contains real scoring logic "since it was already written" | Strip it down to a bare enqueue — Feature 8 will write its own consumer against this same queue name |
| --- | --- |
| Order Detail's courier section silently omitted instead of shown as a labeled placeholder | Buyers/Sellers should see a clear "coming soon" state, not a missing/broken section — matches the same stub discipline used for Feature 5's Add-to-Cart button before Feature 6 wired it |
| --- | --- |

### **Follow-on Edits Elsewhere in Feature 7.md**

These are small, targeted line-edits in *other* sections — not rewrites — needed for internal consistency after the Task 7 patch above.

| **Location** | **Old text implies** | **Change to** |
| --- | --- | --- |
| **Pre-Generation Reuse Review** table, CourierAdapter row | "This feature is the adapter's primary consumer — implements the full parallel scoring..." | "CourierAdapter is **not called** by Feature 7 — Task 7 only enqueues a generic hand-off job. Feature 8 is the adapter's actual consumer." |
| --- | --- | --- |
| **Task 4.3 / 4.4** (Seller Orders — inline courier box, PENDING\_MANUAL\_LOGISTICS badge) | Implies the badge fires from Feature 7's own booking logic | Keep the badge/UI as-is (still useful to *display* the status if Feature 8 ever sets it) — but note in a comment: "this status is only ever set by Feature 8; Feature 7 never transitions an order into this state" |
| --- | --- | --- |
| **Task 5.5** (reserved UI slots) | "populated in Task 7" | Change to: "populated by **Feature 8**" |
| --- | --- | --- |
| **Task 9 (Validation & Testing)**, steps 9.1/9.4 | Reference courier-failure scenarios, scoring, poll jobs as things to test here | Remove those sub-checks from Feature 7's Task 9 — courier-failure adversarial testing (retry/fallback/manual-logistics/poll-failure) moves to **Feature 8's own Task 9** |
| --- | --- | --- |
| **Final Consistency Pass → Cross-Reference Verification table**, "Courier scoring/booking correctly placed here" row | Currently says ✅ built in Feature 7 | Change to: ✅ **correctly deferred to Feature 8** — Feature 7 only reserves the hand-off seam |
| --- | --- | --- |
| **Unresolved Documentation Gaps table**, Gap #1 | Currently only mentions payment webhook as deferred | Add a line: courier scoring/booking/tracking (originally drafted here) is deferred to Feature 8, not Feature 7 |
| --- | --- | --- |

## **Task 8 — Invoice Generation**

### **Purpose**

-   Generate an on-demand invoice document (PDF/HTML) from existing orders/order\_items/payments data — no new persisted entity, per Gap #2's Assumption.
-   Reuse Feature 0's rendering conventions (no new PDF/templating stack introduced without justification) and existing order-fetch logic (Task 5's getOrderById) rather than a parallel data-assembly path.

### **Dependencies**

-   Task 5 complete (getOrderById, full order detail data shape)
-   Task 6 complete (order status — invoices are typically only meaningful post-PAYMENT\_CONFIRMED, per Gap #2's derived-artifact framing)

### **Expected Deliverables**

-   \[ \] invoice.service.ts: generateInvoice(orderId, requestingUser) — reuses getOrderById's ownership check, assembles a render-ready DTO (buyer/seller info, item lines, subtotal/shipping/total, payment method/status, commission **excluded** from the buyer-facing invoice per the same rule as Order Detail)
-   \[ \] GET /api/v1/orders/:id/invoice — returns a rendered PDF (or HTML, printable) document
-   \[ \] Invoice accessible from Order Detail (both roles) and Order Confirmation (SCR-B06, Feature 6) as a "Download Invoice" action
-   \[ \] Explicitly documented: no new invoices table, no new migration

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 8.1 | Implement generateInvoice(orderId, requestingUser): calls Task 5's getOrderById (reused ownership + data shape), maps the result into an invoice-specific view (no direct DB access beyond what getOrderById already provides) | Thin service method, zero new queries | Grep confirms invoice.service.ts contains no direct Prisma calls — it only transforms getOrderById's output |
| --- | --- | --- | --- |
| 8.2 | Exclude commission figures from the invoice output regardless of requester role (an invoice is a buyer-facing financial document; unlike Order Detail, it should not reveal platform commission even to the Seller viewing their own copy) — **flagged as a documented interpretation**, since no source doc explicitly states invoice content rules | Commission-free invoice output for all roles | Both a Buyer-requested and Seller-requested invoice for the same order render identical commission-free line items (documented as an Assumption, see final Gaps table) |
| --- | --- | --- | --- |
| 8.3 | Render as PDF using a lightweight, already-available templating approach (reuse whatever HTML-to-PDF or templating utility, if any, was established in the architecture phase; if none exists, use a minimal server-side HTML render returned with a print-friendly stylesheet rather than introducing a new heavyweight PDF dependency) | Downloadable/printable invoice | Invoice opens correctly in-browser (HTML) or downloads correctly (PDF), matching whichever approach is confirmed available — documented explicitly if this required picking a new minimal dependency |
| --- | --- | --- | --- |
| 8.4 | Wire GET /orders/:id/invoice into Order Detail (Task 5, both roles) and Order Confirmation (SCR-B06, Feature 6) as a "Download Invoice" button | Functional download entry points from two screens | Clicking from either screen produces the identical invoice for the same order |
| --- | --- | --- | --- |
| 8.5 | Confirm no new Prisma model/migration is introduced — invoice is purely a derived render, per Gap #2 | Zero schema changes | Migration diff empty after this task |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A new invoices table added "to store generated invoice history" | Explicitly forbidden — contradicts "DO NOT MODIFY Database Schema" and Gap #2's derived-artifact framing; if invoice history/audit is later required, that's a documented future gap, not something to schema-patch here |
| --- | --- |
| Invoice re-queries order\_items/payments directly instead of reusing getOrderById's already-assembled, ownership-checked data | Risks a second, potentially inconsistent ownership check path — Task 8.1 requires composition over getOrderById, not a parallel data-access route |
| --- | --- |
| A new PDF-generation library added without confirming whether one already exists from the architecture phase | Check first — introducing a redundant PDF dependency violates the reuse-first discipline; if genuinely none exists, this is the one legitimately new small dependency this feature may need, and must be called out explicitly |
| --- | --- |

## **Task 9 — Validation & Testing**

### **Purpose**

-   Independently re-verify Tasks 1–8 against this feature's core guarantees: correct, single-source-of-truth state-machine transitions; ownership-scoped access across both roles; correct courier scoring/booking/fallback behavior; and inventory/payment side effects firing exactly once.
-   Run adversarial tests on cross-role/cross-user access, invalid state transitions, and courier-failure edge cases — the highest-risk areas of an order-lifecycle feature.
-   Produce the sign-off artifact required before Feature 8 (Payments & Admin Operations) builds its webhook/settlement/admin-override logic on top of this feature's state machine and hooks.

### **Dependencies**

-   Tasks 1–8 complete

### **Expected Deliverables**

-   \[ \] Integration test suite for order/ lifecycle additions and the new tracking/ module
-   \[ \] State-machine adversarial test set (every invalid transition attempt rejected)
-   \[ \] Cross-role/cross-user ownership adversarial test set (Buyer-vs-Seller, Buyer-vs-Buyer, Seller-vs-Seller)
-   \[ \] Courier-failure adversarial test set (single failure→retry, all-fail→manual-logistics, 3-consecutive-poll-failure alert)
-   \[ \] Full reuse audit — grep-level confirmation against Feature 4 (inventory), Feature 6 (order creation, adapters), and the architecture phase (Socket.IO, BullMQ, adapters)
-   \[ \] FEATURE\_7\_CHECKLIST.md — consolidated sign-off
-   \[ \] Coverage confirmed ≥80% for all new module code (order/ lifecycle additions, tracking/, invoice.service.ts, order.state-machine.ts)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 9.1 | Integration-test the full happy path: confirmPayment → auto-scoring → Confirm & Book → poll-driven progress → DELIVERED → (COD variant) payments.status=CONFIRMED side effect → invoice download | Green test suite | Matches Gap #1/#4's assumptions end-to-end |
| --- | --- | --- | --- |
| 9.2 | State-machine adversarial test: attempt every documented-invalid transition (e.g., PAYMENT\_PENDING → DELIVERED directly, CANCELLED → PROCESSING) via direct service call, bypassing the UI | All rejected with BusinessRuleError(422) | No transition ever mutates orders.status outside canTransition's validated set (Task 1.3) |
| --- | --- | --- | --- |
| 9.3 | Cross-role/cross-user ownership adversarial test: Buyer A reads/cancels Buyer B's order; Seller A reads/books-courier-for Seller B's order; a Buyer attempts a Seller-only action (booking) on their own order | All rejected 403/404 | Matches Schema §9 and PRD §11's permission matrix exactly |
| --- | --- | --- | --- |
| 9.4 | Courier-failure adversarial test: single-attempt failure → confirm 3×@30s retry observed → fallback to next-best; all-couriers-fail → confirm PENDING\_MANUAL\_LOGISTICS + notification enqueued; 3-consecutive-poll-failure → confirm in-app alert enqueued | All three scenarios pass | Matches REQ-F-Logistics-005/007 and REQ-F-Track006 exactly |
| --- | --- | --- | --- |
| 9.5 | Full reuse audit — grep for: any second orders.status write path outside transitionOrderStatus, any second courier-adapter-calling convention outside tracking.service.ts, any second WebSocket/queue mechanism, any new invoices table/migration, any inventory-increment logic outside Feature 4's existing method | Zero matches (or each justified) | Recorded verbatim in FEATURE\_7\_CHECKLIST.md, matching the discipline established in Features 5/6 |
| --- | --- | --- | --- |
| 9.6 | Cross-check against App Flow's documented states: SCR-S05/S06, SCR-B07/B08/B09's loading/empty/error/edge cases (manual-logistics alert, map-down text fallback, invalid tracking token, empty order lists per tab) | Pass/fail note per screen | Consistent with Feature 0's shared Skeleton/EmptyState/Toast components |
| --- | --- | --- | --- |
| 9.7 | Consolidate FEATURE\_7\_CHECKLIST.md — one section per task, Documentation Gaps table with final status, explicit confirmation of the Task 6.2/Task 8 scope boundaries (no webhook implementation, no new invoices table) | Committed sign-off artifact | Reviewed by both developers; open items flagged for Feature 8 |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Coverage gate measured against Feature 6's already-covered order/ checkout-creation code, masking whether this feature's new lifecycle code is actually tested | Scope coverage specifically to this feature's new/modified files (order.state-machine.ts, lifecycle additions to order.repository.ts/service.ts, all of tracking/, invoice.service.ts) |
| --- | --- |
| Courier-failure tests run against the real (non-mock) adapter path | Must use D2's mock adapter's built-in failure-injection capability — no real courier API access exists at this stage |
| --- | --- |
| Reuse audit skipped as "obviously fine" | Must be a deliberate grep pass per the discipline established in Features 5/6 — not a recollection |
| --- | --- |

## **Final Consistency Pass**

### **1\. Table of Contents (updated, final)**

-   Feature Overview
    -   0.1. Pre-Generation Reuse Review
    -   0.2. Documentation Gaps & Assumptions
    -   0.3. Order Management Flow
-   Task 1 — Order Foundation
-   Task 2 — Order Retrieval
-   Task 3 — Buyer Orders
-   Task 4 — Seller Orders
-   Task 5 — Order Details
-   Task 6 — Order Status Management
-   Task 7 — Courier Booking & Tracking
-   Task 8 — Invoice Generation
-   Task 9 — Validation & Testing

### **2\. Cross-Reference Verification**

| **Check** | **Result** |
| --- | --- |
| Organized by implementation dependency, not the feature-brief's list order | ✅ Foundation → Retrieval → Buyer → Seller → Details → Status → Courier/Tracking → Invoice → Validation; every task's Dependencies field names exact prior task(s) |
| --- | --- |
| Zero new Prisma models/migrations | ✅ orders, order\_items, tracking\_events, courier\_quotes all pre-specified in Schema Doc 5 §4.10/4.11/4.21/4.22; invoice explicitly confirmed schema-free (Task 8.5) |
| --- | --- |
| Order/tracking modules extend, not duplicate, Feature 6 | ✅ Task 1.1 extends Feature 6's existing order.repository.ts; new tracking/ module matches TRD §12's own folder separation |
| --- | --- |
| Single source of truth for status transitions | ✅ Task 1.3/6.1 — one order.state-machine.ts + one transitionOrderStatus entry point, audited at Task 9.5 |
| --- | --- |
| Courier scoring/booking correctly placed here (not Feature 6) | ✅ Task 7.1–7.5 fulfills Feature 6 Gap #1's deferred full-scoring algorithm |
| --- | --- |
| Payment-confirmation trigger boundary (Gap #1) respected | ✅ Task 6.2 builds the transition function only; webhook/HMAC explicitly excluded, flagged for Feature 8 |
| --- | --- |
| COD delivery-confirms-payment (Gap #4) scoped correctly | ✅ Task 6.3 — payments.status update only; cod\_remittances ledger explicitly deferred to Feature 8 |
| --- | --- |
| Invoice is derived, not a new entity (Gap #2) | ✅ Task 8.1/8.5 — reuses getOrderById, zero schema changes |
| --- | --- |
| Ownership enforced identically across both roles | ✅ Task 2.3/2.4, adversarial-tested at Task 9.3 |
| --- | --- |
| Inventory restoration reuses Feature 4 | ✅ Task 5.6 calls Feature 4's existing increment method, not a new one |
| --- | --- |
| Real-time/queue infra reused, not rebuilt | ✅ Task 7.8/7.6 — existing Socket.IO /tracking namespace and BullMQ wiring from the architecture phase |
| --- | --- |
| Public tracking correctly unauthenticated but minimal-data | ✅ Task 7.10 — token-based, no PII beyond status, distinct DTO from the authenticated Order Detail response |
| --- | --- |
| Returns/Admin/Payments-processing correctly excluded | ✅ Feature Overview's exclusions list; no return-flow, no webhook, no settlement code introduced anywhere in Tasks 1–9 |
| --- | --- |
| Feeds Feature 8 correctly | ✅ confirmPayment hook (Task 6.2) and orders/payments state are ready integration points for Feature 8's webhook/settlement/admin-override logic |
| --- | --- |

### **3\. Assumptions Made (full list)**

| **#** | **Assumption** | **Task** |
| --- | --- | --- |
| 1 | This feature owns the order state machine and the confirmPayment transition function; Feature 8 owns the trigger (webhook receipt) that calls it. COD's equivalent trigger (delivery) is owned here, since it's a logistics event | Task 1.3, 6.2 |
| --- | --- | --- |
| 2 | Invoice is a derived, on-demand render from existing orders/order\_items/payments data — no new persisted entity/table | Task 8 |
| --- | --- | --- |
| 3 | Sellers may manually trigger only booking (→PROCESSING) and cancellation from pre-shipment states; all shipment-progress transitions are system/poll-driven | Task 1.3, 6.4 |
| --- | --- | --- |
| 4 | COD delivery confirms payment as a side effect of the DELIVERED transition's entry action; the cod\_remittances ledger row remains Feature 8's responsibility | Task 6.3 |
| --- | --- | --- |

### **4\. Engineering Decisions Made (full list)**

| **#** | **Decision** | **Task** |
| --- | --- | --- |
| 1 | Extend Feature 6's order/ module for lifecycle logic; add a new tracking/ module for scoring/booking/tracking-events/poll-job, per TRD §12's existing folder separation | Task 1 |
| --- | --- | --- |
| 2 | Single shared order.state-machine.ts, imported by both seller-triggered and system-triggered transition paths | Task 1.3, 6.1, 7.3, 7.6 |
| --- | --- | --- |
| 3 | Full parallel courier scoring (this feature) is a distinct calling pattern from Feature 6's single-estimate call, both against the same CourierAdapter interface — no second adapter built | Task 7.1 |
| --- | --- | --- |
| 4 | Invoice excludes commission for all roles (stricter than Order Detail's seller-only commission visibility), since an invoice is treated as an external-facing financial document | Task 8.2 (flagged as an interpretation, not a sourced requirement) |
| --- | --- | --- |

### **5\. Unresolved Documentation Gaps (carried forward, not closed by this feature)**

| **#** | **Gap** | **Status** | **Needs** |
| --- | --- | --- | --- |
| 1 | Webhook verification (REQ-F-Payment-002), payment retry (REQ-F-Payment-003), settlement (REQ-F-Payment-005/007), and cod\_remittances (F12) remain fully unbuilt — this feature only exposes the confirmPayment/COD-side-effect hooks | Explicitly deferred | Feature 8 must implement the webhook handler calling confirmPayment, plus retry/settlement/reconciliation logic |
| --- | --- | --- | --- |
| 2 | Invoice's commission-exclusion-for-all-roles rule (Task 8.2) is this playbook's interpretation, not sourced from any document | Flagged, not resolved | A product/documentation decision on whether sellers should see commission on their own invoice copy |
| --- | --- | --- | --- |
| 3 | Returns flow (SCR-S07, SCR-B10/B11) has only a navigation-stub gate (Task 3.4) — no Returns backend/UI exists yet | Explicitly deferred | A dedicated future Returns feature, consistent with the PRD's R1.1 scoping of ReturnsAI automation and the MVP-scoped manual-review workflow |
| --- | --- | --- | --- |
| 4 | Admin overrides (payment release, dispute resolution, config panel for courier weights/commission) are read from platform\_config here but never written by this feature | Explicitly deferred | Feature 8 (Payments & Admin Operations) owns the Config Panel UI and admin-override endpoints |
| --- | --- | --- | --- |
| 5 | Seller-rating filter/sort remains disabled (inherited unresolved from Features 4/5/6) | Unchanged, not this feature's concern | Blocked on Reviews (F16, R1.1) |
| --- | --- | --- | --- |

**Feature 7.md — Order Management Engineering Execution Playbook is complete.** All 9 tasks follow the required dependency sequence, correctly extend (not duplicate) Feature 6's order-creation work, implement the full courier-scoring/booking/tracking algorithm this series always scoped to this stage, maintain a single-source-of-truth state machine (confirmed via the Task 9.5 reuse audit), and explicitly stop short of payment processing/webhooks/settlement/admin operations, all flagged as Feature 8 scope. Every Assumption and Engineering Decision is logged above and carried into FEATURE\_7\_CHECKLIST.md for sign-off. Ready for the team to execute following Features 0–6.