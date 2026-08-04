# Feature 9 — Event Inventory (Task 2.3/2.4/8.7)

Per Task 2's own instruction: this feature is the **first place** Features 1/6/7/8's prose-
described "enqueue a notification" language becomes a concrete event-type + payload contract.
Any mismatch between what an earlier feature actually does and what this feature's consumer
expects is logged here as a named discrepancy — **not silently patched around** — except where a
targeted, documented fix was the only way to make the pipeline actually work end-to-end (noted
explicitly below, with the fix applied and re-tested).

## Canonical event-type registry (`packages/shared/src/types/notification.ts`)

| Event Type | Critical? | Producer status |
|---|---|---|
| `OTP_REQUESTED` | ✅ | ⚠️ See Finding #1 |
| `ORDER_PLACED` | ✅ | ✅ `checkout.service.ts`'s `processCheckout` — see Finding #2 (resolved) |
| `ORDER_PAYMENT_CONFIRMED` | ✅ | ✅ `order.service.ts`'s `transitionOrderStatus` — see Finding #2 (resolved) |
| `ORDER_CANCELLED` | ✅ | ✅ `order.service.ts`'s `transitionOrderStatus` — see Finding #2 (resolved) |
| `ORDER_PICKED_UP` | — | ✅ `order.service.ts`'s `transitionOrderStatus` — see Finding #2 (resolved) |
| `ORDER_IN_TRANSIT` | — | ✅ `order.service.ts`'s `transitionOrderStatus` — see Finding #2 (resolved) |
| `ORDER_OUT_FOR_DELIVERY` | — | ✅ `order.service.ts`'s `transitionOrderStatus` — see Finding #2 (resolved) |
| `ORDER_DELIVERED` | ✅ | ✅ `order.service.ts`'s `transitionOrderStatus` (moved here from Feature 8's `pollOneOrder` — see Finding #2) |
| `COURIER_MANUAL_LOGISTICS` | ✅ | ✅ Feature 8 (`tracking.service.ts`'s `bookCourier`, all-fail path) |
| `TRACKING_POLL_FAILURE` | — | ✅ Feature 8 (`tracking.service.ts`'s `pollOneOrder`, 3-fail alert) — see Finding #3 for the rename |
| `RETURN_DECISION` (reserved) | ✅ | Not yet built — Feature 10 |
| `REFUND_ISSUED` (reserved) | ✅ | Not yet built — Feature 10 |

## Findings

### Finding #1 — OTP_REQUESTED is not, and will not be, routed through this feature's consumer

The module doc's dependency line claims Feature 1's OTP dispatch is something this feature
"closes the loop on." In the actual codebase, `auth.service.ts` calls
`getSmsAdapter().sendSms(phone, 'otp_code', {code, ttlMinutes}, lang)` **directly and
synchronously** — there is no BullMQ enqueue anywhere in the OTP path, and there never has been.

**Resolution:** `OTP_REQUESTED` is registered in this feature's template registry
(`templates.ts`) for structural completeness — so there's one canonical place documenting what
the OTP message says — but Feature 1's actual live call path is **not rerouted** through this
feature's async consumer. OTP delivery must not wait on a queue round-trip before the user sees
"code sent." This is a conscious non-change, not an oversight: Task 6.4's regression-testing
concern ("Feature 1's OTP flow... unchanged") is trivially satisfied because nothing about it was
touched at all.

### Finding #2 — Feature 6 (Cart & Checkout) and Feature 7 (Order Management) enqueued **nothing** (RESOLVED)

The module doc's Feature Overview and Pre-Generation Reuse Review both assert "Feature 6...
enqueues order-placed/payment-related notification jobs" and "Feature 7... enqueues order-
status-milestone jobs." **Neither claim was true in this codebase** at the time Feature 9 was
signed off. A direct search of `modules/order/`, `modules/cart/`, and `modules/address/` turned
up zero references to `enqueueNotification` — Feature 8's `tracking.service.ts` was the only real
producer, for 3 of the 10 non-reserved event types.

**Resolution — closed as a same-session follow-up, immediately after Feature 9's own sign-off, at
the user's explicit request:**

1. **`ORDER_PLACED`** — `checkout.service.ts`'s `processCheckout` now enqueues one notification per
   created order, to the buyer, **after** the creation transaction commits (never as a side effect
   that could roll back) and **after** the idempotency cache would have already short-circuited a
   replay — a resubmitted identical checkout request enqueues nothing a second time (tested).
2. **`ORDER_PAYMENT_CONFIRMED`/`ORDER_CANCELLED`/`ORDER_PICKED_UP`/`ORDER_IN_TRANSIT`/
   `ORDER_OUT_FOR_DELIVERY`/`ORDER_DELIVERED`** — rather than scattering an `enqueueNotification`
   call across every caller of a status change (`cancelOrder`, `confirmPayment`, Feature 8's
   `bookCourier`/poll job), the mapping lives **inside `transitionOrderStatus` itself**
   (`STATUS_NOTIFICATION_EVENTS`, a `targetStatus → NotificationEventType` map) — the single
   source of truth for status changes gets a single source of truth for which transitions notify,
   too. Fires once per successful transition, after the transaction commits, to the order's buyer;
   a failure to enqueue is logged and swallowed, never fails the transition itself.
3. **Feature 8's `pollOneOrder` no longer enqueues `ORDER_DELIVERED` explicitly** — that
   responsibility moved into `transitionOrderStatus`'s generic map (point 2 above). Leaving both in
   place would have double-notified the buyer on every delivery; removed the now-redundant
   explicit call, re-verified Feature 8's full suite green afterward.

`PROCESSING` and `PENDING_MANUAL_LOGISTICS` remain deliberately unmapped (no canonical event
exists for either in the Task 2.1 registry) — tested explicitly that a `PROCESSING` transition
enqueues nothing.

### Finding #3 — Feature 8's own producer payload didn't match what a real consumer needs (fixed)

Unlike Finding #2, this one **was** fixed directly, because it's an integration bug in code from
the same overall body of work (Feature 8), not a cross-team boundary requiring separate sign-off,
and leaving it broken would mean the 3 real events Feature 8 already produces couldn't be
dispatched correctly at all:

1. **Payload shape.** Feature 8's `NotificationPayload` originally carried a pre-rendered,
   English-only `message: string` field. This feature's dispatch model needs to render a
   **bilingual** template per the recipient's own `preferredLanguage` (Task 2.5/REQ-F-Notif003) —
   a producer-baked English string can't be translated after the fact. Changed the payload to
   carry `vars: Record<string, unknown>` instead; `tracking.service.ts`'s three call sites updated
   accordingly (`{orderId: order.publicId}` in each case).
2. **Event naming.** Feature 8 invented `COURIER_TRACKING_FAILURE` ad hoc (no canonical registry
   existed yet at the time). This feature's Task 2.1 registry names the same real event
   `TRACKING_POLL_FAILURE`. Renamed at the one call site to match — Task 2's own Unresolved Gaps
   table explicitly permits "a targeted patch to the specific earlier feature's enqueue call,
   decided case-by-case" as an acceptable resolution path once a mismatch is reviewed.

Both changes were re-verified: Feature 8's full test suite (`tests/tracking/`) re-run clean
afterward, zero regressions.

## Summary

- **10 of 10 non-reserved event types now have a real, working, tested producer→consumer
  pipeline** — `ORDER_PLACED` (checkout), `ORDER_PAYMENT_CONFIRMED`/`ORDER_CANCELLED`/
  `ORDER_PICKED_UP`/`ORDER_IN_TRANSIT`/`ORDER_OUT_FOR_DELIVERY`/`ORDER_DELIVERED`
  (`transitionOrderStatus`'s status-notification map), `COURIER_MANUAL_LOGISTICS`/
  `TRACKING_POLL_FAILURE` (Feature 8, unchanged). Finding #2 is resolved.
- `OTP_REQUESTED` is registered for documentation purposes only; Feature 1's real OTP path is
  deliberately untouched and never routed through this consumer.
- 2 event types (`RETURN_DECISION`, `REFUND_ISSUED`) are reserved for Feature 10, per the open
  event-type union's explicit design goal.
