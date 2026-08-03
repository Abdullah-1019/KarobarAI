# Handoff — F9 Notifications (Backend → Frontend, and Backend → Feature 10)

**Status:** Backend complete — 2026-08-03. New `notification/` module (repository/service/
consumer/controller/routes/dto) — the consumer/dispatch side of every notification job Features
1/6/7/8 were supposed to enqueue. Zero new Prisma models/migrations — `notifications`/
`notification_preferences` already existed complete from the Database feature. Full backend
suite green — see `docs/DoneTillNow.md`'s Feature 9 entry for the exact final count.

**Read `docs/FEATURE_9_EVENT_INVENTORY.md` before building against this** — it's the load-bearing
artifact for this feature. Two of the four features this one depends on (Features 6 and 7) turn
out to enqueue **zero** notification jobs in this actual codebase, despite the module doc's own
claim that they do. That's not a bug in this feature — it's flagged, tested against synthetic
payloads, and carried forward as a named gap, per the module doc's own explicit instruction not to
silently patch across feature boundaries.

---

## What this feature actually found (read the inventory doc for full detail)

1. **Feature 6 (checkout) and Feature 7 (orders) never call `enqueueNotification()`.** Only
   Feature 8's `tracking.service.ts` does, for exactly 3 events: `ORDER_DELIVERED`,
   `COURIER_MANUAL_LOGISTICS`, `TRACKING_POLL_FAILURE`. This feature's consumer, template
   registry, and dispatch pipeline are fully built and tested for **all ten** canonical event
   types (via synthetic test payloads for the six that have no real producer yet) — but six of
   them will never actually fire in production until a follow-up change adds the missing enqueue
   calls to Features 6/7. **This is the single most important thing for whoever picks this up
   next to know.**
2. **Feature 8's own producer payload needed a real fix, not just a flag.** It originally sent a
   pre-rendered, English-only `message` string — incompatible with this feature's bilingual,
   per-recipient-language template rendering. Fixed by changing the payload to carry `vars`
   instead, and renaming Feature 8's ad hoc `COURIER_TRACKING_FAILURE` to this feature's canonical
   `TRACKING_POLL_FAILURE`. Feature 8's full test suite re-verified clean afterward.
3. **Feature 1's OTP dispatch is not, and will not be, routed through this feature's consumer.**
   It's a direct, synchronous `SmsAdapter.sendSms()` call in `auth.service.ts` — never a BullMQ
   job. `OTP_REQUESTED` is registered in the template registry for documentation/consistency only.
4. **`GET`/`PATCH /profile/me/settings` already exists** (Feature 2) and already reads/writes
   `notification_preferences` — this feature does **not** duplicate that endpoint. It does reuse
   the same table internally (via its own repository) purely for dispatch-gating decisions.
   Feature 2's model (SMS + in-app permanently non-disableable at the *preference* level) and this
   feature's model (specific *events* override *any* channel's preference, including Email/
   WhatsApp) are complementary, not conflicting — both hold simultaneously, neither was changed.

## What shipped

- `adapters/whatsapp/` — new (index/mock/live), filling in Feature 0's placeholder. Same D2 shape
  as sms/email/courier/payment.
- `notification/templates.ts` — a single typed registry (not per-event JSON files — an Engineering
  Decision, functionally equivalent to "templates decoupled from code," far less file overhead),
  one EN/UR pair per canonical event type, `{{var}}` interpolation that degrades gracefully
  (leaves an unmatched placeholder untouched rather than throwing).
- `notification.service.ts` — `dispatchInApp`/`dispatchEmail`/`dispatchSms`/`dispatchWhatsApp`,
  structurally identical gating across all four (critical-allowlist check overrides the
  preference check, never the reverse), each independently try/caught so one channel's failure
  never blocks another. `processNotificationEvent()` is the single consumer entry point: validates
  the job envelope (Zod), resolves the recipient once (decrypts phone/email, reads
  `preferredLanguage`), fans out to all four channels via `Promise.allSettled`.
- `notification.consumer.ts` — the first real BullMQ `Worker` on the `notifications-pending` queue
  Feature 8 already produces into.
- Notification Center: `GET /api/v1/notifications` (cursor-paginated, IN_APP rows only — Email/
  SMS/WhatsApp are external, never rendered in-app), `GET /api/v1/notifications/unread-count`,
  `PATCH /api/v1/notifications/:id/read` (ownership-checked).
- Critical-event allowlist (`CRITICAL_EVENT_TYPES`, `packages/shared`): `ORDER_PLACED`,
  `ORDER_PAYMENT_CONFIRMED`, `ORDER_DELIVERED`, `ORDER_CANCELLED`, `COURIER_MANUAL_LOGISTICS`,
  `OTP_REQUESTED`, plus reserved `RETURN_DECISION`/`REFUND_ISSUED` for Feature 10 — a fixed
  constant, not admin-configurable, per the module doc's own framing.

## Endpoints

All under `/api/v1/notifications`, authenticated, always self-scoped (no `?userId=` param exists
anywhere):

- **`GET /notifications`** — `?cursor`/`?limit`, same cursor-pagination convention as every prior
  list endpoint. Each item includes `orderId` (the related order's **publicId**, not the internal
  id) for click-through navigation into Feature 7/8's existing order/tracking routes — no new
  navigation scheme invented.
- **`GET /notifications/unread-count`** — for the bell-icon badge.
- **`PATCH /notifications/:id/read`** — `403 NOTIFICATION_NOT_OWNED` for a cross-user attempt,
  `404 NOTIFICATION_NOT_FOUND` for an unknown id.

## In-app vs. external channel lifecycle (Gap #4)

In-app rows go `QUEUED→SENT` immediately on creation (there's no real "delivery" concept for a
database row), then `→READ` when the user opens/dismisses it. Email/SMS/WhatsApp rows go the full
`QUEUED→SENT`... actually `QUEUED→DELIVERED` on adapter success or `→FAILED` on adapter failure —
tested explicitly, including all three external channels failing simultaneously while the in-app
row still gets created correctly (channel independence, Task 5.4/6/7.3).

## Known limitations / assumptions (see `docs/FEATURE_9_EVENT_INVENTORY.md` for the full detail)

1. **Six order-lifecycle event types have no real producer** (`ORDER_PLACED`,
   `ORDER_PAYMENT_CONFIRMED`, `ORDER_CANCELLED`, `ORDER_PICKED_UP`, `ORDER_IN_TRANSIT`,
   `ORDER_OUT_FOR_DELIVERY`) — the consumer/template/dispatch side is fully built and tested with
   synthetic payloads; the enqueue calls themselves need to be added to Feature 6/7's code as a
   follow-up.
2. **Email is the "optional, no traced requirement" channel** (Gap #1, TRD §28) — safest to cut
   first under schedule pressure, per the module doc's own framing.
3. **WhatsApp is PRD R1.1, pulled forward into this feature per explicit instruction** (Gap #2) —
   a conscious choice, not scope creep. Real Meta Cloud API integration requires Business approval
   — deferred to Feature 16 regardless.
4. **No frontend for any of this** — the bell-icon component (shared across Seller/Buyer/Admin
   shells) and the full Notification Center screen are separate, not-yet-started work. The
   backend's `NotificationDTO`/`NotificationListDTO`/`UnreadCountDTO` shapes are ready for it.
5. **Payload `vars` are not deeply validated per event type** — only the outer job envelope
   (`userId`/`type`/`orderId`/`vars`) is Zod-validated at the consumer boundary; a missing optional
   var degrades gracefully (the template's `{{placeholder}}` is left untouched) rather than
   crashing, an intentional simplification over a full per-event-type payload schema map.
