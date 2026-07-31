# Handoff — F6 Cart & Checkout (Backend → Frontend)

**Status:** Backend complete — 2026-07-31. Three new modules (`cart/`, `address/`, `order/`'s
checkout-creation slice), matching TRD §12's folder layout — the first genuinely new domain
modules since Feature 4/5 (which were pure composition layers). Full backend suite green:
**280/280 tests, 28/28 suites** (44 new to this feature: cart 15, address 12, checkout 12,
inventory-refactor regression 5), confirmed non-flaky across 2 consecutive full-suite runs.
Module coverage: cart 98.2%, address 98.7%, order 97.8% statements — comfortably above the 80%
gate.

**This is financially sensitive — read the whole doc before building against it, not just the
endpoint list.**

---

## Three real gaps found before writing any code (flagged, then resolved — not silently patched)

The module doc's own "Pre-Generation Reuse Review" claimed three things already existed from an
earlier "architecture phase." None of them did:

1. **`PaymentAdapter` and `CourierAdapter`** were empty placeholder files explicitly marked
   "implemented in Feature 12" / "implemented in Feature 8" respectively — not built at all, not
   even mocks. Built now as **mock-only** (same D2 interface+mock+live-stub shape as sms/email/
   storage) — this was confirmed with you as the same resolution already used for Feature 4's AI
   integration gap ("mock stub for now"). `LivePaymentAdapter`/`LiveCourierAdapter` throw until
   real gateway/courier credentials exist (Features 12/8's future work).
2. **No idempotency-key mechanism existed anywhere.** Implemented directly inside
   `checkout.service.ts` (Redis-cached full response, keyed by `buyer + client-supplied key`,
   24h TTL) rather than generic Express middleware — simpler, and the actual "return the original
   result on retry" behavior needed to live next to the transaction it's protecting anyway.
3. **`orders.ship_name` (NOT NULL) has no upstream data source** — neither `addresses` nor
   `users`/`buyer_profiles` has any name field anywhere in the base Schema Doc. Closed with a
   small additive migration: **`addresses.recipient_name`** (required at the API layer). Related:
   **`addresses.contact_phone` is nullable in the DB but `orders.ship_phone` is NOT NULL** — this
   feature's Zod validation requires `contactPhone` even though the column itself still allows
   null (matches Schema's own definition; the stricter rule is enforced at the API boundary only).

## A real architectural fix this feature required (not new functionality — a correctness fix)

Feature 4's `decrementStock`/`restoreStock` each opened **their own independent transaction**.
Task 7.4 explicitly requires stock decrement to happen **inside the same transaction** as order
creation (Schema §0's ACID guarantee). Calling the old version from inside checkout's own
transaction would have silently run stock mutation on a **separate connection** — a partial
failure could create an order without decrementing stock, or vice versa. Both functions now
accept an **optional** `Prisma.TransactionClient` parameter: omitted, they behave exactly as
before (Feature 4's own tests, unmodified, still pass); passed, they participate in the caller's
transaction instead of opening a new one. This is the only change to any Feature 4 file.

## Endpoints

### Cart — `/api/v1/cart*`, Buyer-only (unlike Feature 5, no guest state — D4 is "persisted per buyer")

- **`GET /cart`** — `{ sellerGroups: [...], grandSubtotal }`. A brand-new buyer with zero cart
  activity gets an empty-groups `200`, **never creates a cart row** just from a read. Each item
  carries `stockConflict: { available } | null` (flagged, never silently dropped) and each seller
  group carries `eligibleForCheckout` + `minOrderValuePkr` (read from `platform_config`, never
  hardcoded).
- **`POST /cart/items`** — `{ productId (publicId), quantity }`. Adding an already-present product
  increments its quantity in place (never a duplicate row — respects the `(cart_id, product_id)`
  unique constraint by design, not by catching a violation). `404` if the product isn't `LIVE`.
- **`PATCH /cart/items/:itemId`** / **`DELETE /cart/items/:itemId`** — `itemId` is the raw
  `cart_item_id` (no `publicId` column exists on this table — internal IDs are fine here since
  cart items are always accessed by their owner only, same reasoning as `addresses`). `403
  CART_ITEM_NOT_OWNED` for a cross-buyer attempt.

### Address — `/api/v1/addresses*`, Buyer-only

- **`POST /addresses`** — `{ label?, recipientName, line1, line2?, city, province, postalCode?,
  contactPhone }`. **The buyer's very first address auto-becomes their default** — this is new
  behavior this feature introduces. Explicitly **changing** which existing address is default is
  **not** duplicated here — it remains Feature 2's `PATCH /profile/me/default-address` (its own
  transactional unset-old/set-new swap), unchanged.
- **`GET /addresses`** — default first, then by creation order.
- **`PATCH /addresses/:addressId`** — never accepts `isDefault` (rejected as an unknown field,
  `400`) — see above.
- **`DELETE /addresses/:addressId`** — soft-delete. **Blocked (`422
  LAST_ADDRESS_CANNOT_BE_DELETED`) if it's the buyer's only remaining address.** If the deleted
  address was the default, `buyerProfile.defaultAddressId` is cleared to `null` — **no
  auto-promotion** of another address to default (an unrequested default change would be a
  surprising side effect of a delete); the buyer must explicitly pick a new one afterward.

### Checkout — `POST /api/v1/checkout`, Buyer-only

Body: `{ addressId, paymentMethod: "JAZZCASH" | "EASYPAISA" | "COD" }`. **Requires an
`Idempotency-Key` header** (`400 IDEMPOTENCY_KEY_REQUIRED` if missing) — resubmitting the exact
same key returns the **original** result byte-for-byte, never a second order set.

**Processes every currently-eligible seller group in the cart in one call** — there's no
per-group opt-in in the request body. The frontend's job is to only let the buyer reach Checkout
when the cart's `eligibleForCheckout` flags look right; the backend independently re-derives
eligibility fresh at checkout time regardless (defense in depth — see the concurrency note below).
`422 CHECKOUT_NOT_ELIGIBLE` if zero groups are eligible (e.g., everything is below-minimum or
out of stock).

Response: `{ orders: CreatedOrderDTO[] }` — one entry per seller group that became an order, each
with its own `subtotal`, `shippingFee` (a single `CourierAdapter.getRate()` estimate — see Gap
#1's scope note below), `totalAmount`, `commissionRateSnapshot` (the **seller's own** rate at
order time, not the platform default), and item snapshots (`titleSnapshot`/`unitPrice` frozen,
independent of the live product row from then on).

**Only the purchased seller groups' cart items are removed** — any other seller's still-
ineligible or newly-added items stay in the cart untouched.

## Scope boundaries carried forward from the module doc — deliberately not built here

- **Shipping estimate is a single mock rate per seller group** (Gap #1) — never the full
  parallel-scoring algorithm (cost/time/reliability/coverage weights) or a `courier_quotes` log
  row. That's Feature 7's Order Detail/booking concern, using the same adapter at a different
  lifecycle point. The checkout-time estimate and the eventual booked courier's real rate may
  diverge — flagged, not reconciled, per the module doc's own explicit note.
- **Payment processing stops at `charge()`-initiation** (Gap #2) — a `PENDING` payments row is a
  valid terminal state for this feature. Retry, webhook-driven confirmation, and settlement are
  Feature 8's scope, built against the `payments`/`orders` rows this feature creates.
- **No `cod_remittances` row** is written for COD orders — that's Feature 8/a dedicated
  COD-reconciliation concern, likely triggered off delivery, not checkout.
- **Guest-cart merge-on-login** (Gap #3) is entirely a frontend concern (client-side guest cart
  state merged via repeated `POST /cart/items` calls after login) — no backend merge endpoint
  exists or is needed.

## Concurrency guarantees (tested, not just claimed)

- **Concurrent checkout on the last unit of stock**: exactly one request succeeds; the other
  fails cleanly — either `409 INSUFFICIENT_STOCK` (if it reaches the transaction) or `422
  CHECKOUT_NOT_ELIGIBLE` (if its own pre-transaction cart read already sees the depleted stock,
  because the winner fully committed first) — **both are correct outcomes depending on timing,
  neither is a bug.** Stock is re-validated a second time, inside the transaction, immediately
  before decrementing — this is the actual race-safety guarantee, not the earlier cart-read.
- **Idempotent resubmission**: verified the DB order count stays at 1 and stock is decremented
  exactly once after two identical requests.
- **Multi-seller split**: verified a 2-seller cart produces exactly 2 `orders` rows in one
  transaction, each with its own `order_items`/shipping line/payment row.

## Reuse audit (Task 8.5 — done, not skipped)

Grepped before considering this done: zero second stock-quantity comparisons outside
`catalog.service.ts`; zero second `PaymentAdapter`/`CourierAdapter`/encryption implementations;
zero second idempotency mechanism; no `modules/marketplace`-style parallel folder for
cart/address/order; no `*.repository.ts` file anywhere (consistent with the no-repository-layer
convention already established in `catalog`/`profile`).

## Known limitations / assumptions

- `platform_config.min_order_value_pkr` is read fresh on every cart/checkout call — no caching
  (unlike categories' 5-min TTL), since a config value Admin might change should reflect promptly.
- Checkout applies **one** address and **one** payment method to every order created in that
  call — matches App Flow SCR-B05 (one checkout action → N orders, one per seller), not a
  per-seller-group override.
