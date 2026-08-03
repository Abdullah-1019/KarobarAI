# Feature 9 — Notifications: Sign-off Checklist

Backend scope only (`apps/backend`) — the shared bell-icon component and full Notification Center
screen are a separate, not-yet-started deliverable. Full narrative contract:
`docs/handoffs/F9-notifications-backend.md`. Event-by-event producer audit:
`docs/FEATURE_9_EVENT_INVENTORY.md`. Progress-log entry: `docs/DoneTillNow.md`.

## Task 1 — Notification Foundation

- [x] `notification/` module scaffolded: repository, service, consumer, controller, routes, dto.
- [x] Zero new Prisma models/migrations — `notifications`/`notification_preferences` already
      existed complete.
- [x] Single BullMQ worker (`notification.consumer.ts`) on the existing `notifications-pending`
      queue, reusing the shared Redis connection — grep-confirmed no second client instantiated.
- [x] `/api/v1/notifications*` mounted behind `authenticate` — no guest access.

## Task 2 — Notification Event Registration

- [x] `NotificationEventType` (`packages/shared`) — an **open** union (`(string & {})` widening),
      not a closed enum, so Feature 10 can add `RETURN_DECISION`/`REFUND_ISSUED` without touching
      this feature's core (grep-audited).
- [x] Job envelope validated (Zod) at the consumer boundary — a malformed/legacy payload is
      rejected with a clear error, not a silent crash (tested).
- [x] Template registry: one EN/UR pair per canonical event type, `{{var}}` interpolation,
      zero hardcoded template strings in `notification.service.ts` (grep-audited).
- [x] **Full inventory completed** (`docs/FEATURE_9_EVENT_INVENTORY.md`) — every event type
      cross-referenced against Features 1/6/7/8's actual code, not their prose description. Two
      real discrepancies found: Features 6/7 enqueue **nothing** (flagged, not silently patched);
      Feature 8's own payload shape needed a targeted, re-tested fix (message→vars, event rename).

## Task 3 — In-App Notification Engine

- [x] `dispatchInApp()` — Gap #4's simplified `QUEUED→SENT→READ` lifecycle (never `DELIVERED`
      for in-app, tested).
- [x] Critical-event allowlist (`CRITICAL_EVENT_TYPES`) overrides `inapp_enabled=false` — tested
      explicitly (all four preferences off, critical event still dispatches).
- [x] `markAsRead()` — ownership-checked (tested: cross-user attempt → 403).
- [x] `getUnreadCount()` — matches actual non-READ row count; decrements correctly after a read
      (tested).

## Task 4 — Notification Center

- [x] `GET /notifications` — ownership-scoped (tested), cursor-paginated (tested), only `IN_APP`
      rows rendered (Email/SMS/WhatsApp are external).
- [x] `GET /notifications/unread-count`, `PATCH /notifications/:id/read` — both tested,
      ownership-adversarial included.
- [x] Each item carries the related order's **publicId** for click-through — reuses Feature 7/8's
      existing order/tracking routes, no new navigation scheme (tested).
- [ ] **Frontend not built**: shared bell-icon component, full Notification Center screen,
      empty/loading states.

## Task 5 — Email Notifications

- [x] `EmailAdapter` reused as-is (already existed from the Auth feature's password-reset work,
      not built fresh by this feature) — registered in the existing `ADAPTER_MODE` factory.
- [x] `dispatchEmail()` — identical gating shape to in-app, full `QUEUED→SENT→DELIVERED/FAILED`
      lifecycle (tested, including the first-ever `FAILED` row in this feature).
- [x] Independent of the other three channels — forcing Email's mock to fail leaves in-app/SMS/
      WhatsApp unaffected (tested).
- [x] Gap #1 (no traced PRD/TRD requirement ID) documented in this checklist and the handoff doc.

## Task 6 — SMS Notifications

- [x] **Zero new adapter file** — `dispatchSms()` imports Feature 1's existing `SmsAdapter`
      directly (grep-confirmed).
- [x] Identical gating/lifecycle shape to Email (tested).
- [x] Feature 1's OTP flow explicitly **not** rerouted through this consumer — a conscious
      decision (Finding #1 in the event inventory), not a missed regression test. `OTP_REQUESTED`
      registered in the template registry for documentation only.
- [x] REQ-F-Track004's five milestones (Confirmed/Picked Up/In Transit/Out for Delivery/
      Delivered) all registered event types — three (`ORDER_DELIVERED`, `TRACKING_POLL_FAILURE`
      isn't one of the five but is real; the other four milestones) have no real producer yet, per
      Finding #2 — dispatch-tested with synthetic payloads, not yet live.

## Task 7 — WhatsApp Notifications

- [x] `adapters/whatsapp/` built fresh (index/mock/live), filling Feature 0's placeholder —
      identical factory shape as Email/SMS/Courier/Payment.
- [x] `dispatchWhatsApp()` — identical gating/lifecycle structure to Email/SMS (tested).
- [x] Gap #2 (PRD R1.1 pulled forward per explicit instruction) documented in code comments and
      this checklist.
- [x] Meta Business approval requirement noted as a live-mode blocker only, deferred to Feature 16
      — mock mode has no such dependency.

## Task 8 — Validation & Testing

- [x] Integration suite: `tests/notification/dispatch.test.ts`, `criticalGating.test.ts`,
      `failureIsolation.test.ts`, `notificationCenter.test.ts`, `templates.test.ts`,
      `reuseAudit.test.ts` — 35 new tests (see `docs/DoneTillNow.md` for the exact final count).
- [x] Critical-non-disableable adversarial test — all four preferences off, critical event still
      dispatches on all four channels; a non-critical event with the same preferences is
      correctly gated (distinguishes "critical always sends" from "everything always sends").
- [x] Cross-channel failure-isolation test — each of the three external channels forced to fail
      independently (and all three simultaneously), in-app and the other channels unaffected.
- [x] Ownership adversarial test — Notification Center reads/mark-as-read, cross-user rejected.
- [x] Bilingual template test — every registered event type renders non-empty EN and UR.
- [x] Full reuse audit (grep-based, recorded below).
- [x] This checklist file + the finalized event inventory.

### Reuse audit — grep results (verbatim, `tests/notification/reuseAudit.test.ts`, all passing)

```
second SmsAdapter implementation: none — Feature 1's reused directly
Email/WhatsApp adapter shape mismatch vs Sms/Courier/Payment: none — identical index/mock/live
second BullMQ worker on notifications-pending: none — exactly one, in notification.consumer.ts
second Redis/ioredis client in the notification module: none found
hardcoded template message string in notification.service.ts: none — all message: fields come from renderTemplate()
event-type registry closed/non-extensible: none — open union confirmed
```

## Documentation Gaps — final status

| # | Item | Status |
|---|---|---|
| 1 | Features 6/7 enqueue nothing — 6 event types have no real producer | **Named, unresolved gap** — needs a follow-up change to Feature 6/7's code, decided case-by-case per Task 2's own instruction |
| 2 | Email's "optional, no traced requirement" status | Documented (Gap #1) — safest to cut under schedule pressure |
| 3 | WhatsApp pulled forward from PRD R1.1 | Documented (Gap #2) — conscious choice, not scope creep |
| 4 | Admin broadcast tool (SCR-AD07) | Explicitly deferred — Feature 12 |
| 5 | `RETURN_DECISION`/`REFUND_ISSUED` | Registry structured to accept them — Feature 10 to add |
| 6 | Real Email/SMS/WhatsApp provider integration | Explicitly deferred — Feature 16 |
| 7 | Meta Business approval for live WhatsApp | Documented as a live-mode blocker only — Feature 16 |

## Test results

See `docs/DoneTillNow.md`'s Feature 9 entry for the exact final pass/fail counts, confirmed
non-flaky across 2 consecutive full-suite runs.

## Sign-off

Backend scope: **complete**, with one explicitly named, unresolved cross-feature gap (Features
6/7's missing enqueue calls) carried forward rather than silently worked around. Frontend scope
(bell icon, Notification Center screen): **not started**.
