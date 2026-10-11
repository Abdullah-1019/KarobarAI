# Feature 19: Payment Gateway — Stripe (Test Mode) + JazzCash/EasyPaisa Adapter Interfaces

## Implementation and verification status — 2026-10-10

**Status: PARTIAL (automated verification passed; live provider verification remains).** The adapter architecture, COD behavior, Stripe test-mode PaymentIntent/Elements flow, raw-body signed webhook route, event ledger, state transitions, full-refund handling, disabled JazzCash/EasyPaisa adapters, checkout selection, and localized frontend wiring are implemented. Checkout now displays the exact USD amount encoded in the PaymentIntent for each seller order before confirmation. No real Stripe test credentials were present in the root `.env`, so the specification's acceptance criterion requiring a real, dashboard-verifiable PaymentIntent remains unverified. No JazzCash or EasyPaisa transaction is simulated.

Runtime webhook path follows the repository's versioned API convention: `POST /api/v1/payments/stripe/webhook` (the specification's unversioned `/api/payments/stripe/webhook` is not an existing route convention). Environment variable names are `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET`; only test-mode prefixes are accepted. The academic conversion is **PKR 100 = USD 1.00**, rounded to the nearest USD cent; it is a demo mapping, not a live exchange rate.

The local gateway flags are existing `PlatformConfig` entries seeded as `false`; the adapters also require provider merchant credentials and still fail closed because no JazzCash/EasyPaisa protocol is implemented. No new configuration schema was added.

Verified on 2026-10-10: migration `20261010120000_feature19_stripe_payments` and all prior migrations deployed successfully to disposable pgvector PostgreSQL; Prisma validation passed. Focused payment/checkout/returns tests passed (5 suites, 40 tests), and after compatibility assertion updates the full backend suite passed (91 suites passed, 3 skipped; 816 tests passed, 7 skipped, 0 failed). A follow-up change exposes the exact server-calculated USD checkout amount; after this change, the payment adapter suite passed (14/14), backend typecheck/build and frontend typecheck/production build passed. Frontend build emitted a large-chunk/PWA precache warning. The full backend suite was not rerun after the amount-display change. No lint rules are configured. Browser checkout and a real Stripe Dashboard event have not been verified. No Stripe credentials were available; no live provider call was attempted. See `docs/DoneTillNow.md` for the full check record.

For manual test-mode verification, configure `STRIPE_SECRET_KEY` (`sk_test_...`), `STRIPE_PUBLISHABLE_KEY` (`pk_test_...`), and `STRIPE_WEBHOOK_SECRET` from a Stripe test-mode webhook endpoint. Forward `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, and `charge.refunded` to `POST /api/v1/payments/stripe/webhook`, then complete checkout with a Stripe test card and confirm persisted order state after webhook delivery. Do not use live keys. The development webhook must be reachable by Stripe through a local forwarding tool; no such external setup was performed here.

> **Agent Directive:** This feature does not replace JazzCash/EasyPaisa in the SRS — it adds Stripe as a demonstrable payment rail for the FYP phase, while keeping the local gateways as fully-specified adapter interfaces (not implemented against live commercial APIs, which require merchant agreements unavailable to a student project). COD remains the one payment method requiring zero third-party integration and should be treated as the primary "real" path in any demo.

---

## 1. Goal

A `PaymentAdapter` interface (matching the existing adapter pattern already used for couriers in Feature 8) with three implementations:
- `CODAdapter` — fully real, no external dependency.
- `StripeAdapter` — real integration, test/sandbox mode.
- `JazzCashAdapter` / `EasyPaisaAdapter` — interface fully implemented, calls stubbed behind a feature flag, documented as production-ready pending commercial merchant onboarding.

---

## 2. Why this doesn't require a schema change

The existing `PaymentMethod` enum already has `JAZZCASH`, `EASYPAISA`, `COD`. Add `STRIPE` as a new enum value — this is the only schema change in this feature.

```prisma
enum PaymentMethod {
  JAZZCASH
  EASYPAISA
  COD
  STRIPE
}
```

```bash
pnpm --filter @karobarai/backend prisma:migrate --name add_stripe_payment_method
```

---

## 3. Adapter Interface (`apps/backend/src/modules/payment/payment.adapter.ts`)

```typescript
interface PaymentAdapter {
  initiate(order: Order): Promise<{ paymentReference: string; redirectUrl?: string; clientSecret?: string }>;
  confirm(paymentReference: string, webhookPayload?: unknown): Promise<PaymentStatus>;
  refund(paymentReference: string, amount: number): Promise<{ success: boolean; refundReference: string }>;
}
```

Every adapter (COD, Stripe, JazzCash, EasyPaisa) implements this same interface — the rest of the checkout flow (`CheckoutService`) calls whichever adapter is selected without knowing which one it is, identical in spirit to how `CourierAdapter` already works for logistics.

---

## 4. `StripeAdapter` (real, test mode)

```typescript
class StripeAdapter implements PaymentAdapter {
  async initiate(order: Order) {
    const intent = await stripe.paymentIntents.create({
      amount: toStripeCents(order.totalAmount), // PKR has no subunit in Stripe's sense — document the conversion you choose (e.g. treat as smallest unit directly, or convert to USD test amount) and apply it consistently
      currency: 'usd', // Stripe test mode: use a Stripe-supported currency for sandbox demo purposes; document this substitution explicitly in your SRS/demo notes
      metadata: { orderId: order.id },
    });
    return { paymentReference: intent.id, clientSecret: intent.client_secret };
  }

  async confirm(paymentReference: string, webhookPayload: Stripe.Event) {
    // verify webhook signature, map Stripe PaymentIntent status to internal PaymentStatus enum
  }

  async refund(paymentReference: string, amount: number) {
    const refund = await stripe.refunds.create({ payment_intent: paymentReference, amount: toStripeCents(amount) });
    return { success: refund.status === 'succeeded', refundReference: refund.id };
  }
}
```

Use **Stripe test API keys only** — `sk_test_...` / `pk_test_...`. No production Stripe account or merchant verification is required for this; test mode works for any developer regardless of country restrictions on live merchant accounts. Document this scope limitation explicitly (see Section 7).

Config: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` (test values) in environment.

Webhook endpoint: `POST /api/payments/stripe/webhook`, verifying Stripe's signature header before processing — follow Stripe's standard webhook verification pattern, reusing whatever HTTP framework conventions the rest of the backend already uses for incoming webhooks (you already have a webhook pattern for COD/digital wallet confirmation per the Master Context doc's "Payment Confirmation" gap closure — match that structure).

---

## 5. `JazzCashAdapter` / `EasyPaisaAdapter` (interface complete, calls flagged off)

```typescript
class JazzCashAdapter implements PaymentAdapter {
  async initiate(order: Order) {
    if (!config.jazzCashEnabled) {
      throw new PaymentGatewayUnavailableError('JazzCash requires commercial merchant onboarding, not available in the current deployment');
    }
    // Real implementation path, ready to fill in once merchant credentials exist:
    // POST to JazzCash's hosted checkout API with order amount, merchant ID, secure hash per their integration guide
    ...
  }
  async confirm(paymentReference: string, webhookPayload?: unknown) { ... }
  async refund(paymentReference: string, amount: number) { ... }
}
```

`config.jazzCashEnabled` / `config.easyPaisaEnabled` are `PlatformConfig`-backed flags (reuse existing config table, same pattern as `chatbotEnabled` in Feature 16), defaulted to `false`. This keeps the code honestly representing reality: the interface and request-shaping logic exist and are correct, but the flag makes clear no live calls are made without real credentials.

---

## 6. `CheckoutService` wiring (existing file, modify only the adapter-selection logic)

```typescript
function getPaymentAdapter(method: PaymentMethod): PaymentAdapter {
  switch (method) {
    case 'COD': return new CODAdapter();
    case 'STRIPE': return new StripeAdapter();
    case 'JAZZCASH': return new JazzCashAdapter();
    case 'EASYPAISA': return new EasyPaisaAdapter();
  }
}
```

No other change to `CheckoutService` — this is a drop-in addition to whatever adapter-selection logic already exists for COD, following the existing pattern.

---

## 7. Documentation Language (use this exact framing in your SRS/report, not an apology)

> "Payment integration implements a gateway-agnostic adapter interface. Cash-on-Delivery remains available without an external payment dependency. Stripe test mode is the demonstrated card-payment pathway for the academic evaluation phase. JazzCash and EasyPaisa are represented by disabled adapter interfaces pending commercial merchant onboarding and provider credentials. The adapter architecture allows future activation without re-architecting checkout."

This framing pre-empts the panel's question rather than waiting for it, and it's accurate — don't phrase it as "we used Stripe instead of JazzCash," phrase it as "we built gateway-agnostic infrastructure and demonstrated it with the gateway available to us."

---

## 8. Numbered Implementation Tasks

**Task 1 — Schema.** Add `STRIPE` to `PaymentMethod` enum, migrate. Acceptance: clean migration, all existing tests pass.

**Task 2 — Adapter interface + COD/Stripe implementations.** Section 3-4. Acceptance: a test checkout with `STRIPE` produces a real Stripe test-mode PaymentIntent (verify via Stripe's test dashboard or API), webhook correctly transitions `Order`/`Payment` status on confirmation.

**Task 3 — JazzCash/EasyPaisa interface stubs.** Section 5. Acceptance: calling `initiate()` with the config flag off throws the documented error rather than silently failing or faking success; unit test confirms this.

**Task 4 — `CheckoutService` wiring.** Section 6. Acceptance: existing COD checkout tests still pass unmodified; new Stripe checkout path covered by a new test.

**Task 5 — Frontend.** Add Stripe Elements (or Stripe Checkout redirect, whichever fits the existing frontend's form patterns more cleanly) as a payment option alongside COD in the existing checkout UI.

**Task 6 — Documentation.** Update SRS payment section with the Section 7 language; update `docs/DoneTillNow.md`.

---

## 9. Definition of Done

- [ ] COD checkout flow unchanged and still fully passing.
- [ ] Stripe test-mode checkout produces a real, verifiable PaymentIntent and correctly updates `Order`/`Payment` status via webhook.
- [ ] JazzCash/EasyPaisa adapters exist, implement the shared interface, and fail predictably (not silently) when their feature flag is off.
- [ ] SRS updated with the framing from Section 7.
- [ ] All existing tests remain green.

### Verification update — 2026-10-11

Feature 19 remains **PARTIAL**. The local development payment/order 1763 was reconciled only after the configured test account showed no PaymentIntent: a guarded serializable transaction marked the payment failed, canceled the order, and restored its three reserved units once (stock 3 to 6). Repeating the reconciliation made no change. No pending Stripe payment remained in that database.

Checkout hardening now resumes persisted attempts, preserves the browser request key, retrieves known PaymentIntents, blocks a second checkout while a Stripe payment is unresolved, and serializes concurrent checkout/cart changes. Signed webhook processing can correlate an event delivered before the intent reference is saved locally. Isolated focused backend tests: **55 passed in 5 suites**; backend and frontend typechecks passed. The broader suites/builds recorded in `docs/DoneTillNow.md` are earlier evidence and were not rerun for this update.

One controlled isolated checkout created a real Stripe **test-mode** PaymentIntent for USD 6.50, matching the PKR 650 order under the documented academic conversion. Stripe reports the intent succeeded and has a corresponding success event. The local CLI listener received no event because its CLI session was not authenticated to the test account, despite displaying Ready. The isolated database was PENDING with zero webhook events when inspected. A later automated test reset removed that disposable checkout row, leaving the succeeded test intent orphaned from the current isolated database. This run **does not verify** webhook acceptance, persisted final state, duplicate live delivery, or browser confirmation. Do not use a listener's Ready message alone as proof of account/event access. Account for the orphaned test intent, authenticate the CLI listener with the same test account, verify its signing secret in the isolated backend, and keep the next live checkout database separate from resetting test suites until the event and final rows are checked.

### Order 1765 reconciliation evidence (2026-10-11)

The Store-6772 order 7c023e02-b339-4e7d-84e1-06785c177703 was PKR 100 subtotal plus PKR 150 shipping, with a USD 2.50 Stripe test PaymentIntent. Stripe account acct_1UP2qqGTyw9ZWTEi returned a succeeded, captured, unrefunded intent with matching order/payment metadata and a real payment_intent.succeeded event. The prior CLI listener log had no delivery; the currently running listener started after the event. The buyer-only, rate-limited `POST /api/v1/orders/:id/reconcile-payment` path fetches the existing intent and actual event through the authenticated Stripe test API and reuses the transactional event processor; it creates no PaymentIntent. Focused isolated tests passed (13/13), and the application reconciliation recorded one event row and changed payment/order 1765 to CONFIRMED/PAYMENT_CONFIRMED. This was not a live signed webhook delivery. Feature 19 remains PARTIAL until the browser checkout and signed webhook forwarding are verified together.
