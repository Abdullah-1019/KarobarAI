# Feature 6 — Cart & Checkout: Sign-off Checklist

Backend scope only (`apps/backend`) — frontend screens (SCR-B04/B05/B06, address-book tab of
SCR-B12) are a separate, not-yet-started deliverable. Full narrative contract:
`docs/handoffs/F6-cart-checkout-backend.md`. Progress-log entry: `docs/DoneTillNow.md`.

## Task 1 — Cart Foundation

- [x] `cart/cart.service.ts` — no `cart.repository.ts` (consistent with `catalog`'s no-repository
      convention, Feature 4).
- [x] `cart/cart.controller.ts` + `cart.routes.ts`, `cart/cart.dto.ts`.
- [x] `/api/v1/cart*` mounted behind `authenticate` + `authorize('BUYER')` (unlike Feature 5's
      guest-friendly public router).
- [x] `addCartItemSchema { productId, quantity: positive int }` matches `cart_items.quantity`
      CHECK `> 0`.
- [x] Zero new Prisma models for this task — `carts`/`cart_items` already existed complete.

## Task 2 — Cart Initialization

- [x] `getOrCreateCart` — Prisma `upsert` keyed on the `buyer_id` UQ, race-safe.
- [x] `GET /cart` returns an empty-groups `200` for a brand-new buyer, **without** creating a cart
      row (verified: no cart row exists after a bare `GET`).
- [ ] **Frontend not built**: SCR-B04 screen shell, guest-cart-merge-on-login client logic (Gap
      #3 — entirely a frontend concern; no backend merge endpoint needed).

## Task 3 — Cart Operations

- [x] `POST /cart/items` — add-or-increment, never a duplicate row (tested).
- [x] `PATCH /cart/items/:itemId`, `DELETE /cart/items/:itemId` — ownership-checked (tested,
      cross-buyer 403).
- [x] Per-seller-grouped totals (`sellerGroups[].subtotal`, `grandSubtotal`) — a 2-seller cart
      returns exactly 2 groups (tested).
- [ ] **Frontend not built**: SCR-B04 full UI, wiring Feature 5's Add to Cart/Buy Now stubs.

## Task 4 — Cart Validation

- [x] Stock re-check reuses Feature 4's product read directly in `getRawCart` — no second
      `stock >= quantity` predicate anywhere else (reuse-audit confirmed).
- [x] `stockConflict: { available }` flagged on `GET /cart`, item stays visible (tested).
- [x] Per-seller-group minimum enforced against `platform_config.min_order_value_pkr`, read
      fresh every call, never hardcoded (tested, including a runtime config-value change).
- [ ] **Frontend not built**: inline "only N left" / "add PKR X more" conflict UI.

## Task 5 — Address Management

- [x] `address/` module — repository-less, mirrors `cart/`'s layered shape exactly.
- [x] `POST/GET/PATCH/DELETE /api/v1/addresses*` — full CRUD (tested).
- [x] `line1`/`line2`/`contact_phone` encrypted at rest via the existing Feature 1
      `encryptField`/`decryptField` helper — verified via direct DB inspection (ciphertext, not
      plaintext, in the test).
- [x] First-address auto-default (new behavior); explicit default-change remains Feature 2's
      `PATCH /profile/me/default-address`, not duplicated.
- [x] Soft-delete + last-address guard (`422 LAST_ADDRESS_CANNOT_BE_DELETED`, tested); deleting
      the current default clears the pointer without auto-promoting another address (tested).
- [ ] **Frontend not built**: SCR-B12 Addresses tab, `AddressSelector` component (Task 5.6).

## Task 6 — Shipping Calculation

- [x] `CourierAdapter` interface + mock + live-stub built (did **not** already exist — see the
      handoff doc's "three real gaps" section). One `getRate()` call per eligible seller group,
      never full parallel scoring (tested: multi-seller checkout shows independent shipping
      lines per order).
- [x] No `courier_quotes` row written — checkout's estimate is ephemeral, matching Gap #1.
- [x] No COD-city-coverage filtering built here — explicitly Feature 7's booking-time concern.

## Task 7 — Payment Method Selection & Checkout Processing

- [x] `order/` module (checkout-creation slice only) — `checkout.service.ts`,
      `order.controller.ts`, `order.routes.ts`, `checkout.dto.ts`. No `order.repository.ts`.
- [x] `POST /api/v1/checkout`, `Idempotency-Key` header required (`400` if missing, tested).
- [x] Multi-seller split: N seller groups → N `orders` rows in one transaction, each with its own
      `order_items` snapshot, `shipping_fee`, `commission_rate_snapshot` (the **seller's own**
      rate, tested).
- [x] One `payments` row per order — JazzCash/Easypaisa call the mock `PaymentAdapter.charge()`
      (tested, spy-verified call count); COD creates the row directly with no adapter call
      (tested, spy-verified zero calls).
- [x] Atomic stock decrement **inside the same transaction** as order creation — required a real
      fix to Feature 4's `decrementStock`/`restoreStock` (see handoff doc) to accept an outer
      transaction client; Feature 4's own tests re-verified green afterward.
- [x] No payment retry/webhook/settlement code anywhere in `order/` or `checkout.service.ts` —
      confirmed via code review, matching Gap #2's explicit boundary.
- [ ] **Frontend not built**: SCR-B05 Checkout screen, SCR-B06 Order Confirmation screen.

## Task 8 — Validation & Testing

- [x] Integration suite: `tests/cart/cart.test.ts` (15), `tests/address/address.test.ts` (12),
      `tests/order/checkout.test.ts` (12) — 44 new tests total (this feature's contribution to
      280/280 backend-wide).
- [x] Idempotency adversarial test — duplicate submission, verified DB order count unchanged.
- [x] Concurrent-oversell adversarial test — genuine `Promise.all` dispatch (not sequential),
      exactly one success, product stock never negative.
- [x] Cross-buyer ownership adversarial tests — cart items, addresses, and checkout using another
      buyer's address, all rejected (403/404), verified no data mutated.
- [x] Full reuse audit (grep-based, recorded below) — zero duplicate stock-check/adapter/
      encryption/idempotency implementations found.
- [x] This checklist file.
- [x] Coverage scoped to the new modules specifically: cart 98.2%, address 98.7%, order 97.8%
      statements — well above the 80% gate (not measured against the whole catalog module, the
      exact pitfall this task's Common Errors table warns about).

### Reuse audit — grep results (verbatim)

```
stock/quantity comparisons outside catalog.service.ts's decrementStock: none found
second PaymentAdapter/CourierAdapter implementations: none (one index/mock/live set each)
second field-encryption implementations (createCipheriv/createDecipheriv): none outside fieldCipher.ts
second Redis idempotency-cache pattern: none outside modules/order
modules/marketplace-style parallel folder for cart/address/order: none — all three live directly under src/modules/
*.repository.ts anywhere in src/modules: none
```

## Documentation Gaps — final status

| # | Item | Status |
|---|---|---|
| 1 | Checkout-time shipping estimate vs. eventual booked-courier rate may diverge | Flagged, not resolved — Feature 7's product decision |
| 2 | Payment retry/webhook/settlement | Explicitly deferred — Feature 8 |
| 3 | COD remittance ledger (`cod_remittances`) | Explicitly deferred — Feature 8 or a dedicated COD-reconciliation feature |
| 4 | Seller-rating filter/sort | Unchanged, inherited from Features 4/5 — blocked on Reviews (F16) |

## Test results

280/280 backend tests passing, 28/28 suites, confirmed non-flaky across 2 consecutive full-suite
runs (44 of those tests belong to this feature; 7 of Feature 4's existing inventory tests were
re-verified green after the `decrementStock`/`restoreStock` transaction-client refactor).

## Sign-off

Backend scope: **complete**. Frontend scope (SCR-B04/B05/B06, SCR-B12's Addresses tab): **not
started** — a distinct, separate piece of work for whoever picks up this feature's UI.
