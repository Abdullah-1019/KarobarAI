# **KarobarAI — Engineering Execution Playbook**

## **Feature 6: Cart & Checkout**

**Source of truth:** PRD · TRD · App Flow · Backend Schema · Implementation Plan (Docs 1–6). No architecture, schema, API contract, business rule, workflow, or folder structure is invented beyond what these documents specify. Gaps are marked **Assumption**; reuse-vs-extend calls are marked **Engineering Decision**.

**Depends on:** Feature 0 (Foundation — envelope, error hierarchy, Zod validation, adapter-factory skeleton), Feature 1 (Authentication — JWT, authenticate, RBAC/ownership middleware), Feature 4 (Product Management — catalog module, stock/inventory fields), Feature 5 (Buyer Marketplace — Product Detail screen whose Add to Cart/Buy Now buttons this feature wires up).

**Feeds:** Feature 7 (Order Management — consumes the orders this feature creates), Feature 8 (Payments — this feature calls the adapter interface but does not implement charge/webhook/settlement logic).

## **Table of Contents**

-   Feature Overview
    -   0.1. Pre-Generation Reuse Review
    -   0.2. Documentation Gaps & Assumptions
    -   0.3. Cart & Checkout Flow
-   Task 1 — Cart Foundation
-   Task 2 — Cart Initialization
-   Task 3 — Cart Operations
-   Task 4 — Cart Validation *(pending)*
-   Task 5 — Address Management *(pending)*
-   Task 6 — Shipping Calculation *(pending)*
-   Task 7 — Payment Method Selection & Checkout Processing *(pending)*
-   Task 8 — Validation & Testing *(pending)*

## **Feature Overview**

**What Feature 6 covers:** the persisted-cart-to-order pipeline — App Flow SCR-B04 (Cart), SCR-B05 (Checkout), SCR-B06 (Order Confirmation), plus the address-book tab of SCR-B12 (Buyer Profile/Settings) needed to select a delivery address at checkout. It implements PRD D4 (one seller per order, persisted cart, buyer-paid shipping), REQ-F-Cart-001–004, REQ-F-Inv-001–004 (checkout-time enforcement), and the checkout-side half of REQ-F-Payment-001–004/008 and REQ-F-COD-001–004 (initiation only — settlement/reconciliation is Feature 8's domain).

**What it explicitly excludes:**

-   **Payment processing internals** — charge(), webhook verification, retries, settlement, COD remittance ledger (REQ-F-Payment-003/005/007, REQ-F-COD-002/004) are Feature 8. This feature calls the **already-scaffolded** PaymentAdapter interface (TRD §2 adapter skeleton, built in Feature 2/Architecture) to *initiate* payment and persist the resulting payments row in PENDING/CONFIRMED state — it does not build the adapter's mock/live implementations or the retry/settlement engine.
-   **Courier scoring, booking, tracking** (App Flow SCR-S06, TRD §3 Strategy pattern for courier scoring) — full parallel-adapter scoring (40/30/20/10) and "Confirm & Book Courier" happen post-order-placement on the **seller** side and belong to Feature 7. This feature only produces a checkout-time **shipping-fee estimate** (see Gap #1) to populate orders.shipping\_fee.
-   **Order lifecycle beyond creation** (status transitions past PAYMENT\_PENDING/PAYMENT\_CONFIRMED, tracking, returns) — Feature 7.
-   **Seller-side anything** — this feature is 100% Buyer-facing.

**Governing tables (Schema Doc §4):** carts (4.8), cart\_items (4.9) — new consumption; orders (4.10), order\_items (4.11) — created here, owned going forward by Feature 7; payments (4.12) — a row is created here, owned going forward by Feature 8; addresses (4.4) — CRUD here; products (4.6) — read-only stock checks via Feature 4's existing repository.

### **0.1. Pre-Generation Reuse Review**

| **Feature 0–5 Asset** | **Exists At** | **Feature 6 Usage** |
| --- | --- | --- |
| Envelope helper, typed error hierarchy, Zod validation harness | Feature 0 | Reused unchanged for every new cart/checkout endpoint |
| --- | --- | --- |
| authenticate + ownership middleware | Feature 1 | Reused as-is — every cart/checkout route requires an authenticated Buyer and enforces buyer\_id = self (Schema §9) |
| --- | --- | --- |
| Adapter factory + ADAPTER\_MODE (mock↔live) | Feature 0/2 | Reused — checkout calls the existing PaymentAdapter interface's charge() mock; **no new adapter code** is written here |
| --- | --- | --- |
| products stock fields, oversell-prevention logic | Feature 4 | Reused directly — checkout's stock re-check calls Feature 4's existing atomic-decrement service method, not a new one |
| --- | --- | --- |
| CategorySelect, ProductCard | Feature 0/4 | Not directly needed here (cart line items use a lighter CartItemRow, new — see Artifacts), but the same design-token/Skeleton/EmptyState/Toast set is reused |
| --- | --- | --- |
| Skeleton, EmptyState, ToastProvider, ErrorBoundary | Feature 0 | Reused for all cart/checkout loading/empty/error states |
| --- | --- | --- |
| Product Detail's Add to Cart / Buy Now stubs | Feature 5, Task 6.4 | **This feature wires the real onClick** — the first live consumer of that stub |
| --- | --- | --- |
| Routing (/cart, /checkout, /orders/:id/confirmation, /account) | Feature 0 Task 10 | Routes already reserved — this feature fills them, no new route registration needed |
| --- | --- | --- |
| Repository pattern, service-layer convention | Feature 2/4 | New cart.repository.ts, cart.service.ts, checkout.service.ts follow the identical pattern already established — no new architectural style introduced |
| --- | --- | --- |

**Conclusion of review:** Cart and Checkout are genuinely new domain modules (no Feature 0–5 equivalent exists for basket persistence or order creation), so — unlike Feature 5 — this feature **does** introduce new backend modules. The discipline carried forward is: every read of product/stock data goes through Feature 4's existing service methods, never a re-implemented query.

**Engineering Decision — Module Boundaries:**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Backend module structure | Two new modules per TRD §12 folder structure: apps/api/src/modules/cart/ (Tasks 1–4) and apps/api/src/modules/order/ (Tasks 6–7, checkout-creation only) — matching the TRD's own folder layout exactly | TRD §12 already names cart/ ("persisted cart, split-at-checkout") and order/ ("+ state-machine usage") as distinct folders; this feature builds the checkout-creation slice of order/, leaving lifecycle/state-machine transitions to Feature 7 |
| --- | --- | --- |
| Stock re-validation at checkout | Call Feature 4's existing atomic stock-decrement/oversell-guard method (REQ-F-Inv-001/002) — do not write a second inventory check | Prevents the exact drift Feature 5's reuse review warned about: two independent "is this in stock" implementations |
| --- | --- | --- |
| Shipping-fee source at checkout | A single lightweight rate estimate (one CourierAdapter.getRate() mock call per D2), **not** the full parallel-scoring algorithm | See Gap #1 — full scoring is explicitly an Order Detail (seller, post-placement) concern per App Flow SCR-S06 |
| --- | --- | --- |

### **0.2. Documentation Gaps & Assumptions**

| **Gap** | **What the docs say** | **Assumption taken** |
| --- | --- | --- |
| **#1 — Shipping fee at checkout time** | App Flow SCR-B05 shows a "shipping line (buyer pays, D4)" on the checkout screen and Schema §4.10 has orders.shipping\_fee populated at order creation. But TRD/App Flow's *scoring* logic (cost 40/30/20/10, parallel adapter calls, courier\_quotes table) is described only at Order Detail/booking time (SCR-S06), **after** order placement, run by the seller. | **Assumption:** checkout calls CourierAdapter.getRate() (D2 mock) for a **single representative estimate** (not full parallel scoring across all couriers) to populate shipping\_fee and the total shown to the buyer. The full weighted-scoring/booking flow against courier\_quotes remains exclusively Feature 7's Order Detail screen. This checkout-time figure and the eventual booked-courier's actual rate may differ; no document reconciles this, so it is flagged, not silently resolved. |
| --- | --- | --- |
| **#2 — Payment initiation vs. payment processing boundary** | PRD/TRD describe charge(), webhook verification, retry×3, and settlement as one continuous flow (TRD §28 adapter table; App Flow §6.7 Payment Flow). No document draws a feature-boundary line inside that flow. | **Assumption:** Checkout's responsibility ends at calling PaymentAdapter.charge() (or marking COD) and persisting the resulting payments row with idempotency\_key set (REQ-F-Payment-004) and status = PENDING. Retry-on-failure (REQ-F-Payment-003), webhook-driven confirmation (REQ-F-Payment-002), and settlement (REQ-F-Payment-005) are Feature 8. This mirrors your brief's own instruction: "reuses the existing Payment Adapter architecture without implementing payment processing." |
| --- | --- | --- |
| **#3 — Guest cart merge on login** | App Flow SCR-B01 edge case: "guest cart held client-side until login, then merged to persisted cart (D4)." No document specifies the merge rule when a product already exists in both the guest cart and the persisted cart. | **Assumption:** on login, client-side guest-cart items are merged into the persisted cart by **summing quantities** for matching product\_id, capped at available stock (consistent with cart\_items' composite-unique (cart\_id, product\_id) constraint, Schema §4.9, which forbids duplicate rows). |
| --- | --- | --- |
| **#4 — Address ownership vs. Feature 1 scope** | Schema §4.4 addresses table and App Flow SCR-B12 ("Addresses (CRUD)") exist, but no prior feature (0–5) has built address CRUD — Feature 1 (Auth) only covers registration/session, not profile data. | **Assumption:** Address Management (Task 5) is built **inside this feature**, since Checkout (SCR-B05) is its first real consumer and no earlier feature claims it. This is a new module (addresses/), not a Feature 1 extension, since Feature 1's scope was explicitly auth/session only per its own playbook boundary. |
| --- | --- | --- |

### **0.3. Cart & Checkout Flow**

Cart Foundation

(cart/ module scaffold — repository/service/routes on the established pattern)

│

▼

Cart Initialization

(get-or-create persisted cart on first Buyer action; guest-cart merge on login)

│

▼

Cart Operations

(add / update quantity / remove; live total recalculation; wires Feature 5's

Add-to-Cart stub)

│

▼

Cart Validation

(stock re-check, min-order PKR 100 per resulting seller-split order,

out-of-stock exclusion)

│

▼

Address Management

(CRUD addresses; default address; feeds Checkout's address selector)

│

▼

Shipping Calculation

(single-estimate CourierAdapter.getRate() call → shipping\_fee line, D4)

│

▼

Payment Method Selection & Checkout Processing

(JazzCash/Easypaisa/COD selection → split cart into 1 order/seller →

idempotency key → PaymentAdapter.charge() or COD flag → order\_items

snapshot → atomic stock decrement)

│

▼

Validation & Testing

(reuse-audit · multi-seller split correctness · idempotency/oversell

adversarial tests · cross-check against Feature 4/5)

Each stage depends on the one before it: Cart Operations needs Cart Initialization's persisted-cart row to write into; Cart Validation runs against real cart contents; Address Management and Shipping Calculation are both checkout-screen prerequisites gathered before Payment Method Selection; Checkout Processing is the terminal action that consumes everything upstream (cart, addresses, shipping estimate, payment method) to create orders; Validation is only meaningful once the full create-order pipeline exists end-to-end.

## **Task 1 — Cart Foundation**

### **Purpose**

-   Scaffold the cart/ module per TRD §12's folder structure — repository, service, controller, routes — following the identical layered pattern established in Feature 4's catalog/ module.
-   Confirm carts (Schema §4.8) and cart\_items (Schema §4.9) require **zero new migrations** — both tables are already fully specified in Doc 5; this task wires Prisma access to them, it does not alter schema.
-   Reserve /cart route group on the existing public-router-with-authenticate pattern (cart requires a logged-in Buyer, unlike Feature 5's guest-accessible marketplace routes).

### **Dependencies**

-   Feature 0 complete (envelope, error hierarchy, validation harness, repository/service conventions)
-   Feature 1 complete (authenticate middleware, JWT, ownership-check pattern)
-   Feature 4 complete (products repository methods this task will call in Task 3–4, not yet needed in Task 1)

### **Expected Deliverables**

-   \[ \] apps/api/src/modules/cart/cart.repository.ts — Prisma-backed, one method set per §4.8/4.9 columns
-   \[ \] apps/api/src/modules/cart/cart.service.ts — business logic layer, thin controllers
-   \[ \] apps/api/src/modules/cart/cart.controller.ts + cart.routes.ts
-   \[ \] apps/api/src/modules/cart/cart.dto.ts — Zod schemas for cart/cart-item request bodies
-   \[ \] Route group /api/v1/cart\* mounted behind authenticate (Buyer role only)
-   \[ \] Confirmed: zero new Prisma models, zero new migrations for this task

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 1.1 | Scaffold cart.repository.ts with methods mapping 1:1 to Schema §4.8/4.9: findCartByBuyerId, createCart, findCartItem(cartId, productId), upsertCartItem, deleteCartItem, listCartItems(cartId) | New repository file, no schema changes | prisma studio / migration diff shows zero pending changes |
| --- | --- | --- | --- |
| 1.2 | Scaffold cart.service.ts calling the repository — no business logic yet beyond pass-through (business rules land in Tasks 3–4) | New service file | Unit test: service methods return repository output unmodified at this stage |
| --- | --- | --- | --- |
| 1.3 | Register /api/v1/cart route group with authenticate required (unlike Feature 5's optional-auth pattern — cart has no meaningful guest state per D4's "persisted per buyer" design) | Route group mounted, all sub-routes 401 without a valid Buyer token | Manual test: no-token request → 401; Seller-role token → 403 (ownership/role check reused from Feature 1) |
| --- | --- | --- | --- |
| 1.4 | Add Zod DTOs: AddCartItemDto { productId: bigint, quantity: number.positive() }, matching cart\_items.quantity CHECK > 0 (Schema §4.9) | cart.dto.ts | Invalid payload (quantity ≤ 0) rejected at the edge, matching REQ-NF-Security validation discipline already established |
| --- | --- | --- | --- |
| 1.5 | Confirm Feature 0's stubbed /cart frontend route (Task 10) resolves — no new route registration needed | No route-table changes | ROUTES.md requires no edits |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A cart repository method reimplements product-stock lookups instead of delegating to Feature 4's product repository | Cart repository owns only carts/cart\_items rows; any product/stock read goes through Feature 4's existing methods, called from cart.service.ts, not duplicated in cart.repository.ts |
| --- | --- |
| Cart routes mounted on the public (optional-auth) router group from Feature 5 | Cart is Buyer-only and always requires a valid session per D4 — mount on a route group requiring authenticate, not Feature 5's guest-friendly group |
| --- | --- |

## **Task 2 — Cart Initialization**

### **Purpose**

-   Implement get-or-create semantics for a Buyer's cart: carts.buyer\_id is unique (Schema §4.8, "one active cart per buyer"), so a Buyer's cart is created lazily on first interaction, not at registration.
-   Implement the guest-cart-to-persisted-cart merge on login (App Flow SCR-B01 edge case; Gap #3's Assumption).
-   Build the GET /cart read endpoint and the empty-cart state for SCR-B04.

### **Dependencies**

-   Task 1 complete (repository/service/routes scaffold)

### **Expected Deliverables**

-   \[ \] GET /api/v1/cart — returns the Buyer's cart with items, or an empty-cart shape if none exists yet (no premature row creation on mere page load)
-   \[ \] getOrCreateCart(buyerId) service method — idempotent, respects the buyer\_id UQ constraint
-   \[ \] Guest-cart merge logic (client-side merge algorithm per Gap #3, invoked once at login success)
-   \[ \] SCR-B04 Cart screen: empty state, skeleton loading, line-item list shell (item rendering completed in Task 3)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 2.1 | Implement getOrCreateCart(buyerId): SELECT first, INSERT ... ON CONFLICT DO NOTHING-equivalent via Prisma upsert keyed on the buyer\_id UQ to avoid a race on first-ever add | Idempotent method, safe under concurrent first-add requests | Two rapid concurrent POST /cart/items calls from a brand-new Buyer produce exactly one carts row (no UQ violation surfaced to the user) |
| --- | --- | --- | --- |
| 2.2 | Implement GET /api/v1/cart — calls getOrCreateCart only if items are about to be listed; returns { items: \[\], subtotal: 0 } shape for a cart with zero items, matching Schema's design (a cart can legitimately have zero cart\_items rows) | Working read endpoint | Brand-new Buyer with no prior cart activity gets 200 with an empty-items response, not a 404 |
| --- | --- | --- | --- |
| 2.3 | Build the guest-cart merge: on successful login (Feature 1's existing login success hook), read the client-held guest cart (local state, not persisted anywhere server-side pre-login) and call POST /cart/items once per guest-cart line, summing into any existing persisted quantity for the same product\_id (Gap #3) | Merge executes automatically post-login, transparent to the Buyer | Login with 2 guest-cart items where 1 overlaps an already-persisted cart item → resulting persisted cart shows summed quantity for the overlap, capped at stock (Task 4 dependency verified at Task 4, not blocking here) |
| --- | --- | --- | --- |
| 2.4 | Build SCR-B04 Cart screen shell: empty state ("Your cart is empty" + Browse CTA per App Flow), skeleton loader during fetch, grouped-by-seller layout placeholder (full grouping logic completed in Task 3) | Functional shell screen | Empty-cart Buyer sees the documented empty state, not a blank screen or error |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A carts row is created eagerly at registration (Feature 1) or on every GET /cart call regardless of intent | Only create on first genuine cart-mutating action (add-item) or lazily on first GET if the caller needs a real cart\_id; do not pre-provision empty carts platform-wide |
| --- | --- |
| Guest-cart merge double-counts on a page refresh immediately after login | Client must clear its local guest-cart state immediately after a successful merge dispatch, before any possible re-render/re-fire |
| --- | --- |

## **Task 3 — Cart Operations**

### **Purpose**

-   Implement add/update-quantity/remove against cart\_items, respecting the composite-unique (cart\_id, product\_id) constraint (Schema §4.9) — one row per product per cart, quantity incremented/decremented in place, never duplicated.
-   Wire Feature 5's Product Detail **Add to Cart / Buy Now** stub (Feature 5 Task 6.4) to this task's real endpoint — the first live caller of that stub.
-   Recalculate and return cart totals (per-seller subtotal, per App Flow SCR-B04's "grouped by seller" preview of D4's order-splitting) after every mutation.

### **Dependencies**

-   Task 2 complete (get-or-create cart, GET /cart endpoint)
-   Feature 4 complete (product price/stock read methods)
-   Feature 5 complete (Product Detail screen and its stubbed Add-to-Cart button, Task 6.4)

### **Expected Deliverables**

-   \[ \] POST /api/v1/cart/items — add product (creates or increments a cart\_items row)
-   \[ \] PATCH /api/v1/cart/items/:id — set quantity directly (stepper UI)
-   \[ \] DELETE /api/v1/cart/items/:id — remove line item
-   \[ \] Cart totals: subtotal, **grouped by seller** (D4 order-splitting preview), grand-total estimate (shipping excluded until Task 6)
-   \[ \] SCR-B04 fully functional: qty steppers, remove, per-seller subtotal grouping, "will split into separate orders" notice
-   \[ \] Feature 5's Add to Cart / Buy Now buttons wired to this task's real endpoints (Buy Now = add-item then navigate to /checkout)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 3.1 | Implement addCartItem(buyerId, productId, quantity): get-or-create cart (Task 2.1) → check for an existing cart\_items row for (cart\_id, product\_id) → if present, increment quantity; if absent, insert new row — never a second row for the same product (respects Schema §4.9's composite UQ) | Working add endpoint | Adding the same product twice results in one cart\_items row with summed quantity, not two rows / a UQ-violation error |
| --- | --- | --- | --- |
| 3.2 | Implement updateCartItemQuantity(cartItemId, buyerId, quantity) with ownership check (item's cart must belong to buyerId, per Schema §9 ownership rules) — ownership middleware pattern reused from Feature 1/4 | Working update endpoint, 403 on cross-buyer access attempt | A second Buyer's token cannot mutate another Buyer's cart\_items row (adversarial test deferred formally to Task 8, smoke-tested here) |
| --- | --- | --- | --- |
| 3.3 | Implement removeCartItem(cartItemId, buyerId) — hard delete of the cart\_items row (cart items are ephemeral working-state, not append-only/audited data, unlike orders) | Working delete endpoint | Removed item disappears from GET /cart immediately |
| --- | --- | --- | --- |
| 3.4 | Implement cart-totals computation: group cart\_items by the owning product's seller\_id (join to products.seller\_id, Schema §4.6), sum quantity × products.price per seller group, plus an overall grand-subtotal | Totals object in GET /cart response: { sellerGroups: \[{ sellerId, items\[\], subtotal }\], grandSubtotal } | A cart with items from 2 sellers returns exactly 2 sellerGroups, previewing D4's checkout-time order split |
| --- | --- | --- | --- |
| 3.5 | Build SCR-B04's full UI: qty stepper (calls 3.2), remove button (calls 3.3, with confirm-on-remove per standard CRUD pattern from Feature 4/5), per-seller subtotal cards, "this cart will split into N orders" notice when >1 seller group exists | Fully interactive Cart screen | Manual test: change qty → totals update live (per App Flow "totals update live"); remove last item from a seller group → that group disappears from the grouped view |
| --- | --- | --- | --- |
| 3.6 | Wire Feature 5 Product Detail's stubbed Add to Cart (calls 3.1) and Buy Now (calls 3.1 then client-side navigates to /checkout) — replace the Feature 5 no-op/"Coming soon" toast with the real call | Feature 5's stub is now live | Product Detail → Add to Cart → success toast → item appears in /cart; no regression to Feature 5's own detail-page tests |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Add-to-cart inserts a duplicate cart\_items row for a product already in the cart | Query for an existing (cart\_id, product\_id) row first (Step 3.1) — the DB's composite UQ will reject a blind insert, but the correct UX is an increment, not a caught-constraint-error retry |
| --- | --- |
| Totals computed client-side from a locally cached product-price snapshot instead of the server's authoritative response | Totals must be server-computed on every mutation and returned in the same response — client never independently multiplies price × qty as the source of truth (price could have changed since add) |
| --- | --- |
| Cross-buyer cart mutation succeeds because ownership check was skipped "since it's just a cart" | Ownership enforcement (Schema §9: "a buyer may read/mutate only carts, cart\_items... where buyer\_id = self") applies identically to cart rows as to orders/returns — no exception |
| --- | --- |

*End of Response 1 — Feature Overview, Pre-Generation Reuse Review, Documentation Gaps, Cart & Checkout Flow, and Tasks 1–3 complete. Awaiting confirmation before continuing with Tasks 4–6 (Cart Validation, Address Management, Shipping Calculation).*

## **Task 4 — Cart Validation**

### **Purpose**

-   Enforce stock re-validation and minimum-order-value rules before checkout can proceed, reusing Feature 4's existing atomic stock-check/oversell-guard logic rather than writing a second inventory check (Engineering Decision, Feature Overview).
-   Enforce PRD D4/REQ-F-Cart-004's minimum order value (PKR 100, admin-configurable) **per resulting seller-split order**, not on the cart's grand total — since checkout produces one order per seller (D4).
-   Surface out-of-stock/changed-price conflicts at the cart screen before the buyer reaches Checkout, per App Flow SCR-B04's edge cases.

### **Dependencies**

-   Task 3 complete (cart operations, per-seller grouping)
-   Feature 4 complete (products.stock, oversell-prevention service method, REQ-F-Inv-001/002)

### **Expected Deliverables**

-   \[ \] GET /cart response flags any item that is now out of stock or exceeds available stock (does not silently remove it — Buyer must see it per SCR-B04)
-   \[ \] Server-side validation endpoint (GET /cart/validate or inline on GET /cart) checking, per seller group: (a) every item in stock at requested qty, (b) seller-group subtotal ≥ PKR 100 (config-driven, not hardcoded)
-   \[ \] SCR-B04 UI: "only N left" inline conflict messages; items flagged out-of-stock excluded from checkout eligibility but remain visible
-   \[ \] platform\_config.min\_order\_value\_pkr (Schema §4.25) read at validation time — no hardcoded 100 in cart-validation code

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 4.1 | Call Feature 4's existing stock-check method (the same one backing REQ-F-Inv-002's oversell guard) per cart item — do not write a second products.stock comparison | Reused validation call | Grep confirms no second quantity > stock comparison exists outside Feature 4's method |
| --- | --- | --- | --- |
| 4.2 | Flag out-of-stock or now-insufficient-stock items in the GET /cart response: { ...item, stockConflict: { available: N } } — item stays in the response, not silently dropped | Conflict-flagged item shape | An item whose stock dropped to below cart quantity (simulated via direct DB update in test) shows the flag on next GET /cart, matches App Flow's "flagged, excluded from checkout" edge case |
| --- | --- | --- | --- |
| 4.3 | Read platform\_config.min\_order\_value\_pkr (Schema §4.25, admin-configurable per REQ-F-Cart-004) — no hardcoded 100 | Config-driven check | Changing the admin config value (simulated direct DB update, since Feature 8/Admin owns the UI for this) changes validation behavior without a code deploy |
| --- | --- | --- | --- |
| 4.4 | Implement per-seller-group minimum check: each seller group's subtotal (Task 3.4) must independently meet min\_order\_value\_pkr, since each becomes its own order at checkout (D4) | Per-group pass/fail flags | A cart with Seller A at PKR 250 and Seller B at PKR 60 flags only Seller B's group as below-minimum, not the whole cart |
| --- | --- | --- | --- |
| 4.5 | Build SCR-B04 conflict UI: inline "only 3 left" style message on stock conflicts; seller-group banner "add PKR 40 more from this seller to checkout" on below-minimum groups; Checkout CTA disabled/scoped to eligible groups only | Functional conflict UI | Manual test: cart with one below-minimum seller group → that group's items are excluded from the "Proceed to Checkout" eligible set, other groups unaffected |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Stock re-check re-implements the stock >= quantity comparison locally in cart.service.ts instead of calling Feature 4's method | Exact drift risk flagged in the Feature Overview's Engineering Decision — import and call Feature 4's existing guard, do not duplicate the predicate |
| --- | --- |
| Minimum-order check applied to the cart's grand total across all sellers | Contradicts D4 — checkout creates one order per seller, so the PRD's PKR-100 floor (BR-005) applies per resulting order, not to the combined cart |
| --- | --- |
| min\_order\_value\_pkr hardcoded as 100 in validation code | Must read from platform\_config (Schema §4.25) exactly as REQ-F-Cart-004 requires — Admin's Config Panel (Feature-8/Admin scope) changes this value at runtime |
| --- | --- |

## **Task 5 — Address Management**

### **Purpose**

-   Build CRUD for addresses (Schema §4.4) — this feature's first claim on the table, per Gap #4's Assumption, since no prior feature built it.
-   Implement default-address selection feeding Checkout's address step (App Flow SCR-B05), and the buyer-profile Addresses tab (SCR-B12).
-   Enforce field-level encryption on line1/line2/contact\_phone (Schema §4.4 notes these as encrypted) using the **already-implemented** field-encryption helper (TRD §17, built in Feature 0/2's architecture phase) — no new encryption code.

### **Dependencies**

-   Task 1 complete (module-scaffolding pattern to mirror)
-   Feature 0/2 complete (AES-256-GCM field-encryption helper, per TRD §17 — reused, not rebuilt)
-   Feature 1 complete (authenticate, ownership middleware)

### **Expected Deliverables**

-   \[ \] apps/api/src/modules/address/ — repository, service, controller, routes, DTOs (new module, mirrors cart/'s Task 1 pattern)
-   \[ \] POST /api/v1/addresses, GET /api/v1/addresses, PATCH /api/v1/addresses/:id, DELETE /api/v1/addresses/:id (soft delete per Schema §8)
-   \[ \] is\_default toggle logic (only one default per buyer)
-   \[ \] SCR-B12 Addresses tab: list, add/edit form, set-default, delete-with-confirm
-   \[ \] Checkout's address selector (Task 7 dependency, built here as a reusable AddressSelector component)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 5.1 | Scaffold address.repository.ts/service.ts/controller.ts/routes.ts mirroring Task 1's cart/ pattern exactly — no new architectural style | New module, same layered shape as cart/ | Code review: file structure matches cart/'s Task 1 scaffold 1:1 |
| --- | --- | --- | --- |
| 5.2 | Implement create/update using the **existing** field-encryption helper (TRD §17) for line1, line2, contact\_phone — call it, do not reimplement AES-256-GCM logic | Encrypted fields at rest | DB inspection: addresses.line1 stores ciphertext, not plaintext, matching Schema §4.4's column notes |
| --- | --- | --- | --- |
| 5.3 | Implement is\_default exclusivity: setting a new default unsets any prior default for the same buyer\_id in the same transaction | Single-default guarantee | Setting Address B as default when Address A was default → A's is\_default flips to false atomically |
| --- | --- | --- | --- |
| 5.4 | Implement soft-delete (deleted\_at, Schema §8) — deleting the only address prompts the Buyer to add a replacement before checkout (App Flow SCR-B12 edge case) | Soft-delete + UX guard | Deleting a buyer's last address blocks with a clear message rather than leaving zero addresses silently |
| --- | --- | --- | --- |
| 5.5 | Build SCR-B12 Addresses tab (list/add/edit/delete/set-default) using Feature 0's shared form/CRUD UI conventions (established across Features 4/5's list-management screens) | Functional address-book UI | Standard CRUD test pass: add → appears in list; edit → persists; delete → soft-removed, hidden from list |
| --- | --- | --- | --- |
| 5.6 | Build a reusable AddressSelector component (address list + "add new" inline) — used here in the profile tab, and again in Task 7's Checkout screen (no second implementation there) | Shared component | Component built once, imported by both SCR-B12 and (later) SCR-B05 |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A new/second encryption implementation written for address fields | TRD §17's AES-256-GCM helper already exists from Feature 0/2's architecture phase — import it; a second implementation risks key-handling inconsistency |
| --- | --- |
| AddressSelector rebuilt separately for Checkout in Task 7 | Task 5.6 explicitly builds it once for reuse — Task 7 must import this component, not create a checkout-specific address picker |
| --- | --- |
| Multiple is\_default = true rows left active for one buyer after a race condition | Wrap the unset-then-set in a single DB transaction (Step 5.3), not two sequential unguarded writes |
| --- | --- |

## **Task 6 — Shipping Calculation**

### **Purpose**

-   Produce a checkout-time shipping-fee estimate via a single CourierAdapter.getRate() mock call (Gap #1's Assumption) — explicitly **not** the full parallel-scoring algorithm, which remains Feature 7's Order Detail/booking concern (App Flow SCR-S06).
-   Populate the buyer-paid shipping line (D4) shown separately in the checkout summary and stored in orders.shipping\_fee (Schema §4.10) at order creation (Task 7).
-   Reuse the **already-scaffolded** CourierAdapter interface (TRD §2/§28, built in the architecture phase) — this task calls its mock, it does not build the adapter.

### **Dependencies**

-   Task 5 complete (a delivery address must be selected/known before a shipping rate can be estimated — destination city/province feeds the rate call)
-   Feature 0/2 complete (CourierAdapter interface + MockAdapter per D2, ADAPTER\_MODE factory)

### **Expected Deliverables**

-   \[ \] getShippingEstimate(destinationAddress, sellerGroup) service method — one CourierAdapter.getRate() call per seller group (since each seller group becomes its own order, each needs its own shipping line, D4)
-   \[ \] Checkout summary shows a per-order-to-be shipping line, distinct from item subtotal, per App Flow SCR-B05
-   \[ \] COD-city-coverage awareness deferred correctly to Feature 7 (this task does not filter by COD capability — that's a **booking-time** concern per REQ-F-Logistics-006, not a checkout-time one)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 6.1 | Confirm CourierAdapter interface + mock (getRate()) already exists from the architecture phase (TRD §2, §28) — import it, do not scaffold a new adapter or interface | Zero new adapter code | Grep confirms CourierAdapter import, no new adapters/courier/ files added by this feature |
| --- | --- | --- | --- |
| 6.2 | Implement getShippingEstimate(destinationCity, destinationProvince, sellerGroup) — calls getRate() once (not the full 3-courier parallel Promise.all scoring of App Flow SCR-S06/REQ-F-Logistics-002) per Gap #1's explicit scope line | New checkout-service method, single-adapter-call | Only one getRate() call fires per seller group per checkout attempt — not three |
| --- | --- | --- | --- |
| 6.3 | Attach the estimate to each seller group's checkout summary as shippingFee, added to that group's subtotal for the grand total shown to the buyer (D4: buyer pays shipping, shown as a separate line) | Per-seller-group shipping line in checkout preview | A 2-seller cart shows 2 distinct shipping lines, each independently sourced, matching D4's per-order shipping model |
| --- | --- | --- | --- |
| 6.4 | Explicitly do **not** implement COD-city-coverage filtering (REQ-F-Logistics-006) or courier selection UI here — that is Feature 7's Order Detail/booking scope; this task only needs *a* rate number for the total, not a courier choice | Documented scope boundary in code comments | Code review confirms no courier-selection dropdown or COD-coverage filter logic exists in this feature — only a numeric estimate is produced |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Full parallel 3-courier scoring (cost/time/reliability/coverage weights) implemented at checkout | Contradicts Gap #1's explicit scope split — that algorithm is Feature 7's Order Detail/booking responsibility (App Flow SCR-S06), reusing the identical CourierAdapter this task also touches, just at a different lifecycle point |
| --- | --- |
| A new courier\_quotes (Schema §4.22) row written from this feature | courier\_quotes is the scoring **log**, tied to the booking flow (Feature 7) — checkout's estimate is ephemeral (not persisted as a quote row); only orders.shipping\_fee is written, at order creation (Task 7) |
| --- | --- |
| Shipping estimate computed once for the whole cart instead of per seller group | D4 requires one shipping line per resulting order — a single cart-wide estimate would be inconsistent with the one-seller-per-order split |
| --- | --- |

*End of Response 2 — Tasks 4–6 complete. Awaiting confirmation before continuing with Tasks 7–8 (Payment Method Selection & Checkout Processing, Validation & Testing), followed by the final Table of Contents update, cross-reference verification, and full consistency review against Features 0–5.*

## **Task 7 — Payment Method Selection & Checkout Processing**

### **Purpose**

-   Build the terminal checkout action: select payment method (JazzCash/Easypaisa/COD, REQ-F-Payment-001) → split the persisted cart into **one order per seller** (D4) → create orders/order\_items/payments rows atomically → decrement stock.
-   Call the **existing** PaymentAdapter.charge() mock (D2) to initiate payment only — per Gap #2's Assumption, retry/webhook/settlement remain Feature 8's scope.
-   Satisfy REQ-F-Payment-004 (idempotency key on every payment-affecting POST) and REQ-F-Inv-001 (atomic stock decrement on order confirmation).

### **Dependencies**

-   Task 4 complete (cart validation — stock + min-order checks must pass before checkout is attempted)
-   Task 5 complete (selected delivery address)
-   Task 6 complete (per-seller-group shipping estimate)
-   Feature 4 complete (atomic stock-decrement method)
-   Feature 0/2 complete (PaymentAdapter interface + mock, per D2; idempotency-key middleware pattern, per TRD §9)

### **Expected Deliverables**

-   \[ \] apps/api/src/modules/order/ — new module: order.repository.ts, checkout.service.ts, order.controller.ts, order.routes.ts, checkout.dto.ts (checkout-creation slice only; lifecycle/state-machine transitions remain Feature 7's later scope per TRD §12's order/ folder note)
-   \[ \] POST /api/v1/checkout — single endpoint, Idempotency-Key header required (REQ-F-Payment-004)
-   \[ \] Multi-seller cart → N orders rows created in one transaction, each with its own order\_items snapshot, shipping\_fee, commission\_rate\_snapshot (Schema §4.10/4.11)
-   \[ \] One payments row per order (Schema §4.12), status = PENDING, idempotency\_key set; COD orders get a payments row with method = COD and no charge() call (mirrors App Flow §6.7's COD branch)
-   \[ \] Atomic stock decrement per line item, rollback-safe if any part of the transaction fails
-   \[ \] SCR-B05 Checkout screen (address selector, payment method, per-seller summary with shipping line, Place Order CTA) and SCR-B06 Order Confirmation screen

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 7.1 | Scaffold order/ module mirroring the cart//address/ layered pattern (Tasks 1/5) — repository/service/controller/routes/DTOs | New module, consistent shape | Code review: matches established pattern |
| --- | --- | --- | --- |
| 7.2 | Implement Idempotency-Key enforcement middleware on POST /checkout — reuse the pattern already reserved at Feature 0/2's architecture phase (TRD §9: "Idempotency-Key header required on payment-affecting POSTs"), do not invent a new mechanism | Duplicate submissions with the same key return the original result, not a second order set | Resubmitting the identical request (same key) after a successful checkout does not create duplicate orders |
| --- | --- | --- | --- |
| 7.3 | Implement the split-at-checkout transaction: for each seller group (Task 3.4's grouping) → re-validate stock (Task 4.1's reused Feature 4 method) one final time inside the transaction → create one orders row (buyer\_id, seller\_id, status=PAYMENT\_PENDING, subtotal, shipping\_fee from Task 6, total\_amount = subtotal+shipping\_fee, commission\_rate\_snapshot read from seller\_profiles.commission\_rate at this moment, ship\_\* snapshot fields from the selected address) → create order\_items rows with title\_snapshot/unit\_price frozen at purchase time (Schema §4.11) | One transaction, N orders, all-or-nothing | A 2-seller checkout produces exactly 2 orders rows + matching order\_items, or (on any failure) zero — verified via forced-failure test on the second group |
| --- | --- | --- | --- |
| 7.4 | Within the same transaction, decrement products.stock atomically per line item (call Feature 4's existing method, REQ-F-Inv-001) — if any product's stock is insufficient at this final check, abort the whole transaction and surface a clear "stock changed" error, not a partial order | Atomic, all-or-nothing stock decrement | Concurrent checkout attempts on the last unit of a product: exactly one succeeds, the other gets a clear oversell-prevented error (REQ-F-Inv-002) |
| --- | --- | --- | --- |
| 7.5 | Create one payments row per created order: for **JazzCash/Easypaisa**, call PaymentAdapter.charge() (mock, D2) and store the returned transaction\_ref/set status per the adapter's mock response, with idempotency\_key set (REQ-F-Payment-004, REQ-F-Payment-008 — never store wallet PINs); for **COD**, create the payments row with method=COD, status=PENDING, no charge() call, per App Flow §6.7's COD branch | Payments row(s) created, correctly branched by method | JazzCash/Easypaisa order → payments.gateway populated from mock adapter; COD order → payments.method=COD, no adapter call attempted |
| --- | --- | --- | --- |
| 7.6 | Explicitly stop here for payment processing: **no retry loop, no webhook handler, no settlement call** is implemented in this task (Gap #2) — a PENDING payment simply sits until Feature 8's webhook/retry logic (built separately) picks it up | Documented scope boundary in code comments | Code review confirms no retry-scheduling, no webhook-route, no settlement-trigger code exists in order/ or checkout.service.ts |
| --- | --- | --- | --- |
| 7.7 | Build SCR-B05 Checkout: AddressSelector (reused from Task 5.6), payment-method radio (JazzCash/Easypaisa/COD), per-seller-group order summary (items, shipping line from Task 6, commission **not shown to buyer** per App Flow), Place Order button (disabled during submit, no double-submit per idempotency + UI-level debounce) | Functional checkout screen | Manual test: select address + method → summary reflects Task 6's shipping line accurately per seller group |
| --- | --- | --- | --- |
| 7.8 | Build SCR-B06 Order Confirmation: order number(s) (all created orders listed for a multi-seller checkout), summary, estimated delivery (static/placeholder — real ETA is Feature 7's tracking concern), tracking link placeholder, "view my orders" link | Functional confirmation screen | Multi-seller checkout → confirmation lists all N orders individually, each with its own reference, per App Flow's edge case note |
| --- | --- | --- | --- |
| 7.9 | Handle checkout-time conflicts surfaced from Task 4: below-minimum seller groups and out-of-stock items are excluded from the checkout request entirely (not sent to POST /checkout) — Checkout screen only ever submits eligible groups | Clean failure mode | A cart with one below-minimum group → Checkout screen only submits/creates orders for the eligible group(s), consistent with Task 4.5's UI gating |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Payment retry logic (REQ-F-Payment-003) implemented inline in checkout.service.ts "since it's right there" | Explicitly out of scope per Gap #2 — a PENDING payment is a valid terminal state for this feature; retries are Feature 8's dedicated concern, built against the payments table this feature populates |
| --- | --- |
| Stock decremented in a separate transaction from order creation | Must be atomic with order/order\_items creation (Step 7.3/7.4) — a partial failure (order created, stock not decremented, or vice versa) violates Schema's ACID guarantee (Schema §0: "ACID transactions across order → payment → settlement → inventory") |
| --- | --- |
| Idempotency key checked but not actually preventing a second order-set on retry-submit | Verify the stored key is checked *before* the transaction begins, returning the original response on a match — not just recorded for audit |
| --- | --- |
| Commission rate read from platform\_config default instead of the seller's own seller\_profiles.commission\_rate override | Schema §4.3/4.6 explicitly allows a per-seller override of the platform default — commission\_rate\_snapshot must reflect the seller's actual rate at order time |
| --- | --- |

## **Task 8 — Validation & Testing**

### **Purpose**

-   Independently re-verify Tasks 1–7 against this feature's core guarantees: correct multi-seller order splitting (D4), atomic stock/payment consistency, and zero duplicated inventory/adapter logic.
-   Run adversarial tests on ownership, idempotency, and concurrent-oversell scenarios — the highest-risk areas of a checkout feature.
-   Produce the sign-off artifact required before Feature 7 (Order Management) builds on top of the orders this feature creates.

### **Dependencies**

-   Tasks 1–7 complete

### **Expected Deliverables**

-   \[ \] Integration test suite for cart/, address/, and order/ (checkout-creation slice) modules
-   \[ \] Idempotency adversarial test set (duplicate Idempotency-Key submissions)
-   \[ \] Concurrent-oversell adversarial test set (simultaneous checkout on last-unit stock)
-   \[ \] Cross-buyer ownership adversarial test set (cart items, addresses)
-   \[ \] Full reuse audit — grep-level confirmation against Feature 4's inventory logic and the architecture phase's PaymentAdapter/CourierAdapter
-   \[ \] FEATURE\_6\_CHECKLIST.md — consolidated sign-off
-   \[ \] Coverage confirmed ≥80% for all new module code (cart/, address/, order/ checkout slice)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 8.1 | Integration-test the full happy path: add items from 2 sellers → validate → select address → estimate shipping → checkout → 2 orders created, 2 payments rows, stock decremented correctly | Green test suite | Matches D4's split-at-checkout model end-to-end |
| --- | --- | --- | --- |
| 8.2 | Idempotency adversarial test: submit POST /checkout twice with the identical Idempotency-Key and payload | Second call returns the first call's result; no duplicate orders | Order count in DB unchanged after the second call (REQ-F-Payment-004) |
| --- | --- | --- | --- |
| 8.3 | Concurrent-oversell adversarial test: two simultaneous checkout requests for the last unit of a product | Exactly one succeeds; the other receives a clear stock-conflict error, no negative stock | products.stock never goes below 0 (Schema §4.6 CHECK constraint as the final backstop, but the application-level guard should catch it first) |
| --- | --- | --- | --- |
| 8.4 | Cross-buyer ownership adversarial test: Buyer B attempts to read/mutate Buyer A's cart items, addresses, or submit checkout using Buyer A's cart | All attempts return 403/404, never leak or mutate Buyer A's data | Matches Schema §9's ownership rules exactly |
| --- | --- | --- | --- |
| 8.5 | Full reuse audit — grep for: any second stock-check implementation outside Feature 4's method, any second PaymentAdapter/CourierAdapter implementation, any second encryption implementation, any second AddressSelector component | Zero matches (or each justified) | Recorded verbatim in FEATURE\_6\_CHECKLIST.md, matching the discipline established in Feature 5's Task 7.4 |
| --- | --- | --- | --- |
| 8.6 | Cross-check against App Flow's documented states: SCR-B04/B05/B06's loading/empty/error/edge cases (out-of-stock flag, below-minimum banner, payment-fail messaging placeholder, multi-order confirmation list) | Pass/fail note per screen | Consistent with Feature 0's shared Skeleton/EmptyState/Toast components, no new state-handling pattern introduced |
| --- | --- | --- | --- |
| 8.7 | Consolidate FEATURE\_6\_CHECKLIST.md — one section per task, Documentation Gaps table with final status, explicit confirmation of the Task 7.6 scope boundary (no payment processing built) | Committed sign-off artifact | Reviewed by both developers; open items flagged for Feature 7 (order lifecycle/tracking/courier booking) and Feature 8 (payment processing/settlement) |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Coverage gate measured against the whole products/catalog module, inflating the new checkout-specific code's real coverage | Scope coverage specifically to cart/, address/, and the new order/ checkout-creation files |
| --- | --- |
| Concurrent-oversell test run sequentially instead of truly simultaneously, masking a race condition | Use actual parallel request dispatch (e.g., Promise.all against two live requests) in the test, not two sequential calls |
| --- | --- |
| Reuse audit skipped as "obviously fine" | Must be a deliberate grep pass per the discipline established in Feature 5 Task 7.4 — not a recollection |
| --- | --- |

## **Final Consistency Pass**

### **1\. Table of Contents (updated, final)**

-   Feature Overview
    -   0.1. Pre-Generation Reuse Review
    -   0.2. Documentation Gaps & Assumptions
    -   0.3. Cart & Checkout Flow
-   Task 1 — Cart Foundation
-   Task 2 — Cart Initialization
-   Task 3 — Cart Operations
-   Task 4 — Cart Validation
-   Task 5 — Address Management
-   Task 6 — Shipping Calculation
-   Task 7 — Payment Method Selection & Checkout Processing
-   Task 8 — Validation & Testing

### **2\. Cross-Reference Verification**

| **Check** | **Result** |
| --- | --- |
| Organized by implementation dependency, not the feature-brief's list order | ✅ Foundation → Initialization → Operations → Validation → Address → Shipping → Checkout Processing → Validation & Testing; every task's Dependencies field names exact prior task(s) |
| --- | --- |
| Zero new Prisma models/migrations | ✅ carts, cart\_items, addresses, orders, order\_items, payments all pre-specified in Schema Doc 5 §4.4/4.8–4.12; confirmed at Task 1.1/8.5's reuse audit |
| --- | --- |
| No inventory logic recreated | ✅ Task 4.1/7.4 explicitly call Feature 4's existing stock-check/decrement method; Task 8.5 audits for a second implementation |
| --- | --- |
| No payment processing built | ✅ Task 7.5/7.6 explicitly stop at charge() initiation + payments row creation; retry/webhook/settlement flagged as Feature 8 scope (Gap #2) |
| --- | --- |
| No courier scoring/booking built | ✅ Task 6.4 explicitly excludes parallel scoring and courier\_quotes writes; flagged as Feature 7's Order Detail scope (Gap #1) |
| --- | --- |
| One-seller-per-order rule (D4) enforced | ✅ Task 3.4's per-seller grouping carries through Task 4 (per-group validation), Task 6 (per-group shipping), Task 7.3 (per-group order creation) |
| --- | --- |
| Buyer-paid shipping as a separate line (D4) | ✅ Task 6.3/7.3 — shipping\_fee stored distinctly from subtotal, summed into total\_amount |
| --- | --- |
| Encryption reused, not rebuilt | ✅ Task 5.2 — imports the TRD §17 field-encryption helper from Feature 0/2's architecture phase |
| --- | --- |
| AddressSelector built once, reused at Checkout | ✅ Task 5.6 builds it; Task 7.7 imports it — Common Errors table in Task 5 explicitly guards against a second implementation |
| --- | --- |
| Idempotency enforced per REQ-F-Payment-004 | ✅ Task 7.2/8.2 — dedicated adversarial test |
| --- | --- |
| Guest access correctly excluded | ✅ Task 1.3 — cart/checkout routes require authenticate, unlike Feature 5's guest-friendly marketplace routes; consistent with D4's "persisted per buyer" model |
| --- | --- |
| Shared components reused, not rebuilt | ✅ Skeleton, EmptyState, ToastProvider, CRUD form conventions all consumed from Feature 0/4/5 with zero new equivalents |
| --- | --- |
| Feeds Feature 7 correctly | ✅ Orders created here in PAYMENT\_PENDING/PAYMENT\_CONFIRMED-eligible state, ready for Feature 7's lifecycle/courier-booking/tracking to pick up |
| --- | --- |

### **3\. Assumptions Made (full list)**

| **#** | **Assumption** | **Task** |
| --- | --- | --- |
| 1 | Checkout-time shipping fee is a single CourierAdapter.getRate() estimate per seller group, not the full parallel-scoring algorithm (which remains Feature 7's Order Detail/booking concern) | Task 6 |
| --- | --- | --- |
| 2 | Checkout's responsibility ends at charge() initiation + a PENDING payments row; retry, webhook confirmation, and settlement are Feature 8 | Task 7 |
| --- | --- | --- |
| 3 | Guest-cart merge on login sums quantities for matching product\_id, capped at available stock | Task 2.3 |
| --- | --- | --- |
| 4 | Address Management (CRUD) is built inside this feature, since no earlier feature (0–5) claimed the addresses table and Checkout is its first real consumer | Task 5 |
| --- | --- | --- |

### **4\. Engineering Decisions Made (full list)**

| **#** | **Decision** | **Task** |
| --- | --- | --- |
| 1 | Two new modules (cart/, order/ checkout-creation slice) following the TRD §12 folder layout exactly — first genuinely new domain modules in the blueprint series so far | Feature Overview / Task 1, 7 |
| --- | --- | --- |
| 2 | Stock re-validation always delegates to Feature 4's existing atomic method — never a second inventory predicate | Task 4.1, 7.4 |
| --- | --- | --- |
| 3 | AddressSelector built once (Task 5.6), reused unmodified in Checkout (Task 7.7) | Task 5, 7 |
| --- | --- | --- |

### **5\. Unresolved Documentation Gaps (carried forward, not closed by this feature)**

| **#** | **Gap** | **Status** | **Needs** |
| --- | --- | --- | --- |
| 1 | Checkout-time shipping estimate vs. the eventual booked courier's actual rate at Feature 7's Order Detail stage may diverge — no document reconciles this | Flagged, not resolved | A product decision on whether to re-quote/adjust shipping\_fee post-booking, or accept the checkout-time estimate as final — Future scope for Feature 7 |
| --- | --- | --- | --- |
| 2 | Payment retry (REQ-F-Payment-003), webhook verification (REQ-F-Payment-002), and settlement (REQ-F-Payment-005/007) remain fully unbuilt — this feature only creates the PENDING payments row | Explicitly deferred | Feature 8 (Payments) must consume the payments/orders rows this feature produces |
| --- | --- | --- | --- |
| 3 | COD remittance ledger (cod\_remittances, Schema §4.14, F12) is not written by this feature — a COD order's payments row exists, but no remittance-tracking row is created | Explicitly deferred | Feature 8 or a dedicated COD-reconciliation feature must create the cod\_remittances row, likely triggered off order delivery, not checkout |
| --- | --- | --- | --- |
| 4 | Seller-rating filter/sort remains disabled (inherited unresolved from Features 4/5) | Unchanged, not this feature's concern | Blocked on Reviews (F16, R1.1) |
| --- | --- | --- | --- |

**Feature 6.md — Cart & Checkout Engineering Execution Playbook is complete.** All 8 tasks follow the required dependency sequence, correctly enforce PRD D4 (one-seller-per-order, persisted cart, buyer-paid shipping), reuse Feature 4's inventory logic and the architecture phase's Payment/Courier adapter interfaces with zero duplication (confirmed via the Task 8.5 reuse audit), and explicitly stop short of payment processing and courier booking/scoring, both flagged as Feature 7/8 scope. Every Assumption and Engineering Decision is logged above and carried into FEATURE\_6\_CHECKLIST.md for sign-off. Ready for the team to execute following Features 0–5.