# Feature 10 — Returns & Refunds: Sign-off Checklist

Backend scope only (`apps/backend`) — SCR-B10/B11/S07/AD04 frontend screens are a separate,
not-yet-started deliverable. Full narrative contract: `docs/handoffs/F10-returns-refunds-backend.md`.
Progress-log entry: `docs/DoneTillNow.md`.

## Task 1 — Return Foundation

- [x] `returns` / `return_images` / `disputes` Prisma models confirmed matching Doc 5 §4.15–4.17
      exactly — zero drift, zero new migration.
- [x] `returns/` module scaffolded per TRD §12 layout, including the doc's own literal `seller/`
      and `admin/` submodule structure (Tasks 4/5's Artifacts Produced).
- [x] `core/state-machines/return.state-machine.ts` — single canonical transition table, mirrors
      `order.state-machine.ts`'s exact shape. Every documented legal transition and adjacent
      illegal one tested explicitly.
- [x] `returns.repository.ts` — Prisma-backed, no raw SQL, one shared `queryReturns()` builder
      reused by buyer/seller/admin list **and** history endpoints (Task 7's DTO-reuse decision).
- [x] `RETURN_WINDOW_CLOSED`/`RETURN_ALREADY_EXISTS`/`RETURN_INVALID_STATE` + 6 more error codes
      registered in `packages/shared`.

## Task 2 — Return Request

- [x] `ReturnEligibilityService` (`checkEligibility`) — window (config-driven, never hardcoded) +
      no-existing-return + delivered-status + ownership, all server-side (tested: eligible,
      expired-window, not-yet-delivered, duplicate-return, wrong-owner cases).
- [x] `POST /returns` — 201 on success; `422 RETURN_WINDOW_CLOSED`, `409 RETURN_ALREADY_EXISTS`,
      `403` mapped correctly (tested per case).
- [x] Duplicate-return defense in depth: pre-check **and** the schema's own `UNIQUE(order_id)` as
      a race backstop, translated to a clean `409`, never a raw Prisma error.
- [x] `GET /returns/:id` — tri-mode ownership (Buyer/Seller/Admin/Support), tested per role plus
      an unrelated-party 403 and an unknown-id 404.
- [x] `RETURN_INITIATED` notification fires exactly once, to the seller (tested).
- [ ] **Frontend not built**: SCR-B10 Returns Wizard.

## Task 3 — Return Image Upload

- [x] `POST /returns/:id/images` — reuses Feature 4's `validateImageFile` (magic-byte, size) and
      the existing `StorageAdapter`, never a bespoke validation/storage path (tested: invalid file
      → 400, valid JPEG → persists with a real `cdnUrl`).
- [x] Upload/delete blocked outside `INITIATED` (tested: 422 after submission).
- [x] `POST /returns/:id/submit` — rejects `<3` images (`422 RETURN_IMAGES_INSUFFICIENT`, tested);
      `≥3` images transitions `INITIATED → IMAGES_SUBMITTED → MANUAL_REVIEW` in one call, **never**
      `UNDER_AI_REVIEW` (tested — grep-confirmed no MVP code path reaches it either).
- [x] `RETURN_UNDER_REVIEW` notification fires exactly once, to the seller, on submission (tested).
- [ ] **Frontend not built**: SCR-B10's photo-upload step.

## Task 4 — Seller Review

- [x] `GET /seller/returns` — ownership-filtered to the seller's own orders (tested: seller A never
      sees seller B's returns), active queue (`MANUAL_REVIEW`) by default, `?history=true` widens.
- [x] `POST /seller/returns/:id/decision` — reason mandatory only on `REJECTED` (Zod refinement,
      tested: reject-without-reason → 400); blocked outside `MANUAL_REVIEW` (tested).
- [x] Approval books return pickup (reuses the order's own forward-shipment courier, no new
      scoring) then triggers the refund sync (Task 6 hookup) — reaches `REFUND_ISSUED`
      end-to-end in one test given the mock's synchronous behavior.
- [x] Rejection notifies the buyer with the reason, does **not** auto-close (buyer's appeal window
      stays open — tested).
- [x] `POST /seller/returns/:id/escalate` — audit-trail-only, no new status value (Task 4.6's
      Engineering Decision, tested: status unchanged after escalation).
- [x] Every seller decision writes exactly one `audit_logs` row (`action=MODERATION`, tested).
- [ ] **Frontend not built**: SCR-S07 Seller Review.

## Task 5 — Admin Review

- [x] `GET /admin/returns` — `MANUAL_REVIEW` + `UNDER_DISPUTE` by default, `?history=true` for
      everything, no ownership filter; Support gets read access (tested).
- [x] `GET /admin/returns/:id` — includes the joined audit trail (tested).
- [x] `POST /admin/returns/:id/decision` — reason **always** mandatory, even for `APPROVED`
      (tested: missing reason → 400 regardless of decision value); Support blocked from writing
      (tested: 403).
- [x] Admin approval reuses the **identical** `decideReturn()` function as seller approval — no
      duplicated pickup-booking/refund logic (grep-audited).
- [x] Admin rejection is always final: `REJECTED → CLOSED` fires whether the case arrived via a
      formal dispute or a plain `MANUAL_REVIEW` escalation (tested both paths) — a seller's
      rejection never auto-closes.
- [x] Dispute + return status always update together in one transaction (tested: `RESOLVED_
      APPROVED`/`RESOLVED_REJECTED` set correctly alongside the return's own transition).
- [x] A real bug found and fixed by this feature's own tests: `decideReturn()` originally inferred
      "is this disputed?" from `status === 'UNDER_DISPUTE'` rather than the actual `Dispute` row —
      fixed to check `row.dispute !== null` directly. See handoff doc.
- [x] Every admin decision writes exactly one `audit_logs` row (`action=DISPUTE_RESOLVE`, tested).
- [ ] **Frontend not built**: SCR-AD04 Admin Disputes Queue.

## Task 6 — Refund Status

- [x] **Real gap found and resolved**: no "Payments Feature" refund-trigger interface existed
      anywhere in this codebase — `PaymentAdapter` extended with a mock-only `refund()` method
      (D2 shape, same as `charge()`). See handoff doc.
- [x] `triggerRefund()` idempotent by construction — only proceeds from `PICKUP_BOOKED`; a second
      call after success is a safe no-op (tested: adapter called exactly once across two calls).
- [x] COD vs. prepaid method correctly passed to the refund call (tested for both).
- [x] `returns.status` only reaches `REFUND_ISSUED` on confirmed refund; on adapter failure, stays
      `PICKUP_BOOKED`, no crash (tested).
- [x] Zero direct writes to `payments`/`settlements` anywhere in the returns module (grep-audited).
- [x] `REFUND_ISSUED` notification (Feature 9's own pre-reserved event name) fires to the buyer on
      confirmed refund (tested).

## Task 7 — Return History

- [x] `GET /returns` (buyer), `GET /seller/returns?history=true`, `GET /admin/returns?history=true`
      — one shared `ReturnListItemDTO`/query builder across all three, differing only by ownership
      filter (grep-audited: no per-role duplicate DTO).
- [x] Buyer history includes terminal-state cases (`CLOSED`/`REFUND_ISSUED`), not just active ones
      (tested).
- [x] `status`/`cursor`/`limit` filtering behaves identically in shape across all three endpoints
      (tested with the same query against all three).
- [x] Admin detail includes the joined audit trail (Task 7.3, tested — same assertion as Task 5.2).

## Task 8 — Validation & Testing

- [x] Integration suite: `tests/returns/stateMachine.test.ts`, `request.test.ts`, `images.test.ts`,
      `sellerReview.test.ts`, `dispute.test.ts`, `refund.test.ts`, `history.test.ts`,
      `reuseAudit.test.ts` — 82 new tests (see `docs/DoneTillNow.md` for the exact final count).
- [x] Ownership adversarial: unrelated buyer/seller on `GET /returns/:id` (403), non-owning seller
      on decision/escalate (403), Support on the write endpoint (403), Buyer/Seller on admin
      routes (403).
- [x] Full reuse audit (grep-based, recorded below) — zero second adapter implementations, zero
      direct payments/settlements writes, zero duplicated approval logic, zero new Prisma models.
- [x] This checklist file.

### Reuse audit — grep results (verbatim, `tests/returns/reuseAudit.test.ts`, all passing)

```
second orders.status-style direct returns.status write outside transitionReturnStatus: none found
direct payments/settlements table write anywhere in the returns module: none found
second CourierAdapter/PaymentAdapter/SmsAdapter/EmailAdapter implementation: none — all reused
raw prisma.auditLog.create outside core/audit's createAuditLog: none found
seller and admin decision endpoints sharing decideReturn(): confirmed, both import it
new Prisma model added for this feature: none — Return/ReturnImage/Dispute pre-existing
```

## Documentation Gaps — final status

| # | Item | Status |
|---|---|---|
| 1 | "Payments Feature" refund-trigger contract assumed pre-existing (module doc's own Assumption #1) | Resolved: `PaymentAdapter.refund()` built fresh, mock-only |
| 2 | Refund trigger timing (APPROVED vs PICKUP_BOOKED) | Resolved per the module doc's own Assumption #2 — triggers at PICKUP_BOOKED |
| 3 | Seller "escalation" mechanism (new state vs. audit-only) | Resolved per the module doc's own Assumption #3 — audit-only, no new enum value |
| 4 | Buyer-appeal endpoint — no task explicitly assigned it | Found and closed this pass — `POST /returns/:id/appeal` |
| 5 | COD nominated-wallet capture — no schema support exists | Resolved behaviorally (payment method passed to the mock refund call), no data model added |
| 6 | Return-image retention/deletion policy post-CLOSED | Unresolved — carried forward per the module doc's own §11 |
| 7 | Free-text vs. coded rejection reasons | Unresolved — carried forward per the module doc's own §11 |
| 8 | `DELIVERED → COMPLETED` trigger (Feature 7/8's own gap) | Unchanged, still Feature 12's job |

## Test results

See `docs/DoneTillNow.md`'s Feature 10 entry for the exact final pass/fail counts, confirmed
non-flaky across 2 consecutive full-suite runs.

## Sign-off

Backend scope: **complete**. Frontend scope (SCR-B10, SCR-B11, SCR-S07, SCR-AD04): **not
started**.
