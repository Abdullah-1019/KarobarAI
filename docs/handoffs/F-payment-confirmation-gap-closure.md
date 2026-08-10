# Handoff — Payment Confirmation Gap Closure (Backend → Frontend)

**Status:** Backend complete — 2026-08-08. Full backend suite green: **74/74 suites, 742/742
tests**, confirmed clean across 2 consecutive full-suite runs. No schema changes, no new
endpoints — this is a bug fix inside the existing `POST /api/v1/checkout` flow.

**Files changed:** `apps/backend/src/modules/order/order.service.ts`,
`apps/backend/src/modules/order/checkout.service.ts`, plus test updates in
`apps/backend/tests/order/checkout.test.ts` and `apps/backend/tests/order/lifecycle.test.ts`.

---

## 1. What was broken

`confirmPayment()` (`order.service.ts`) has existed since Feature 7 and correctly transitions an
order from `PAYMENT_PENDING` → `PAYMENT_CONFIRMED`. Nothing in the entire codebase ever called
it — confirmed by grepping every call site. The practical effect:

- **Every order, COD or online payment, was permanently stuck at `PAYMENT_PENDING`.**
- Courier scoring/booking (the "courier recommendation card" the seller sees) requires
  `PAYMENT_CONFIRMED` — there is no `PAYMENT_PENDING → PROCESSING` edge in the order state
  machine. So **no order could ever be shipped**, regardless of payment method.
- The `ORDER_PAYMENT_CONFIRMED` buyer notification never fired for online-payment orders.

## 2. What was fixed

Right after an order's payment row is created inside the checkout transaction, `checkout.
service.ts` now calls `confirmPayment(orderId)` for **every** order in the batch (once the
transaction has committed), COD included. This is explicitly flagged in code as an **interim
mock-mode fix** — the real fix, once a real payment gateway is integrated, is an HMAC-verified
webhook handler (App Flow §6.7) that calls `confirmPayment()` asynchronously when the gateway
actually confirms the charge. That's Feature 12/16's job, not this one.

The two payment paths now behave differently, on purpose:

| | Order `status` | `payments.status` | `ORDER_PAYMENT_CONFIRMED` notification | Courier hand-off enqueued |
|---|---|---|---|---|
| **COD** | → `PAYMENT_CONFIRMED` | stays `PENDING` | **suppressed** | ✅ yes |
| **JAZZCASH / EASYPAISA** | → `PAYMENT_CONFIRMED` | → `CONFIRMED` | ✅ sent | ✅ yes |

Why COD's payment row stays `PENDING`: cash hasn't been collected yet — that only happens at
delivery (this reuses the *existing* `DELIVERED`+COD logic, unchanged). Why the notification is
suppressed for COD specifically: its template literally says *"Payment confirmed for order
#..."*, which would be false for a COD buyer at this point. COD orders still get their
`ORDER_PLACED` notification at checkout, same as always — they just don't get a second,
misleading "payment confirmed" one.

Reaching `PAYMENT_CONFIRMED` is what actually matters for COD here — it's what unlocks courier
scoring/booking for the seller, which was completely unreachable for COD orders before this fix,
not just delayed.

## 3. Exact response contract — what the frontend must read

`POST /api/v1/checkout` returns `{data: {orders: [...]}}`. Each order object's `status` and
`paymentStatus` fields now reflect the **post-confirmation** state, not the raw pre-confirmation
state:

```jsonc
// COD
{ "paymentMethod": "COD", "status": "PAYMENT_CONFIRMED", "paymentStatus": "PENDING", ... }

// JAZZCASH / EASYPAISA — success
{ "paymentMethod": "JAZZCASH", "status": "PAYMENT_CONFIRMED", "paymentStatus": "CONFIRMED", ... }

// JAZZCASH / EASYPAISA — the rare case where confirmation itself fails after the order was
// already created (logged server-side, does not fail the HTTP request)
{ "paymentMethod": "JAZZCASH", "status": "PAYMENT_PENDING", "paymentStatus": "PENDING", ... }
```

## 4. What the frontend (partner) needs to build

This was scoped and requested separately — the frontend has **not** been built yet. Needed on
the Checkout screen's Place Order button:

- **COD selected:** enable the button as soon as the form is valid. Place the order immediately
  on click — there is nothing to wait for; `paymentStatus` will always come back `PENDING` for
  COD, and that's correct, not an error.
- **JAZZCASH or EASYPAISA selected:** on click, disable the button and show a "Confirming
  payment..." loading state while the checkout request is in flight. Only transition to the
  Order Confirmation screen once **every** order in the response has `paymentStatus ===
  "CONFIRMED"`. If any online-payment order comes back with anything else, show a clear error
  and re-enable the button rather than silently proceeding to confirmation.

## 5. Where to look for proof this works

- `apps/backend/tests/order/checkout.test.ts` — single-seller and multi-seller JazzCash checkout
  reaching `PAYMENT_CONFIRMED`/`CONFIRMED`; COD checkout reaching `PAYMENT_CONFIRMED` with
  `paymentStatus` staying `PENDING`; courier hand-off firing for both; the payment-confirmed
  notification firing for JazzCash and *not* for COD.
- `apps/backend/tests/order/lifecycle.test.ts` — `confirmPayment()`/`transitionOrderStatus()`
  unit-level coverage of the same COD-vs-online split, independent of the checkout HTTP layer.

## 6. Known limitation (not fixed here, flagged on purpose)

This is still a **mock payment gateway** — `MockPaymentAdapter.charge()` never talks to a real
JazzCash/Easypaisa endpoint, and calling `confirmPayment()` synchronously inside the checkout
request is a stand-in for what should eventually be an async, webhook-driven confirmation. When
real gateway integration happens, this synchronous call should be replaced by a webhook handler
that calls `confirmPayment()` on genuine payment-cleared events — the checkout request itself
should go back to only *initiating* the charge, not confirming it.
