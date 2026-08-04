# Handoff — F10 Returns & Refunds (Backend → Frontend, and Backend → Feature 12)

**Status:** Backend complete — 2026-08-04. New `returns/` module (repository/service/decision-
service/dto, plus `seller/` and `admin/` submodules per the module doc's own literal artifact
structure). Full backend suite green — see `docs/DoneTillNow.md`'s Feature 10 entry for the exact
final count. Zero new Prisma models/migrations — `returns`/`return_images`/`disputes` already
existed complete from the Database feature.

**This feature's own module doc assumes more prior infrastructure exists than actually does —
read the whole doc before building against it, not just the endpoint list.**

---

## Real gaps found before writing any of Tasks 2–7 (flagged, then resolved — the now-familiar pattern)

1. **The "Payments Feature" this doc's dependency line names as "already implemented" does not
   exist.** `PaymentAdapter` (Feature 6) only ever had `charge()` — no refund-trigger interface,
   no settlement engine, no webhook-confirmation handler exists anywhere in this codebase.
   Resolved the same way every "claimed to exist" gap has been resolved all session: extended
   `PaymentAdapter` with a mock-only `refund()` method, same D2 shape as `charge()`. The mock is
   **synchronous/immediate** (matching every other mock adapter in this codebase — courier
   `book()`/`track()`, sms/email `send()`) rather than modeling a webhook-driven confirmation step
   nothing in this codebase has ever built.
2. **`audit_logs` (Schema §4.24) has never been written to.** The doc says this feature "reuses
   the existing audit_logs write pattern from Feature 1/Admin foundation" — no such pattern exists;
   the `AuditLog` Prisma model has sat unused since the Database feature. Built the first writer
   (`core/audit/index.ts`'s `createAuditLog()`), generic enough for any future privileged-action
   feature to reuse as-is, accepting an optional transaction client so a caller can log in the same
   transaction as the mutation it's auditing (Task 5.6's explicit "if the audit write fails, the
   whole transaction rolls back" requirement).
3. **This is the first feature to gate a route by `authorize('ADMIN', 'SUPPORT')` at the router
   level.** Every prior Admin/Support access (Feature 7's Order Detail) checked role *inside* the
   service instead, since those routes were also reachable by Buyer/Seller. The `/api/v1/admin/
   returns*` routes are admin-only surfaces from the start, so the RBAC gate belongs at the router
   — `authorize('ADMIN', 'SUPPORT')` for reads, an additional `authorize('ADMIN')` layered onto the
   decision endpoint specifically (Support is read-only, per Task 5.1).
4. **No task in the module doc's own 7-task breakdown builds the buyer-appeal endpoint** (REJECTED
   → UNDER_DISPUTE), despite the doc's own Flow diagram (§2) showing it explicitly and Task 5's
   own Dependencies line assuming disputed cases exist to review ("returns land here either via
   explicit escalation, seller rejection → buyer appeal"). Built as `POST /api/v1/returns/:id/
   appeal` — a natural extension of Task 2's buyer-facing surface, since no other task claims it.

## A real bug this feature's own tests caught: inferring "is this disputed?" from status, not the row

The first pass of `decideReturn()` (the function shared by seller and admin decisions) checked
`row.status === 'UNDER_DISPUTE'` to decide whether to resolve a `Dispute` row. In real usage this
pairing always holds (`appealReturn()` creates the `Dispute` row and sets the status in the same
transaction) — but the service itself shouldn't *assume* that invariant rather than checking it.
Fixed to check `row.dispute !== null` directly — the actual related record, not an inferred proxy
for it. Caught by this feature's own dispute-resolution tests, not discovered later.

## The return state machine and the handoff contract to itself (Task 1.3)

`core/state-machines/return.state-machine.ts` mirrors `order.state-machine.ts`'s exact shape —
one canonical transition table, `canTransition(from, to)`. Two edges are context-dependent in a
way a pure table can't fully express, resolved the same way Order's table always has (only trusted
service code calls the transition function directly, never exposed generically):
- `REJECTED → UNDER_DISPUTE` (buyer appeal) and `REJECTED → CLOSED` (admin's final rejection of an
  already-disputed or plain-escalated case, chained immediately after `UNDER_DISPUTE/MANUAL_REVIEW
  → REJECTED`) are both legal edges in the table; only `decideReturn()`'s own logic decides which
  one a given call path actually uses.

## `ReturnDecisionService` — Task 5's Engineering Decision, actually built

`decision.service.ts`'s `decideReturn()` is the **single** function both `POST /seller/returns/
:id/decision` and `POST /admin/returns/:id/decision` call — never two parallel implementations.
The only things that differ by caller: whether a rejection auto-closes (admin only — BR-008 makes
admin decisions final; a seller's rejection leaves the buyer's appeal window open) and which
parties get notified (seller decisions only tell the buyer; admin decisions tell both, since the
seller wasn't the one who decided). RBAC and the mandatory-vs-conditional-reason rule are enforced
by each endpoint's own middleware/Zod schema before `decideReturn()` is ever called.

## Refund sync (Task 6) — an integration point, kept genuinely minimal

`triggerRefund()` is idempotent **by construction**: it only ever proceeds from `PICKUP_BOOKED`,
so a redelivered/duplicate call after the first success is a safe no-op — no idempotency-key table
needed (none exists in the frozen schema; the status guard *is* the idempotency mechanism). On
adapter failure, the return stays at `PICKUP_BOOKED` rather than a new enum value (schema frozen;
Task 6.5's own instruction) — visible to Admin as a stuck case via the existing queue, no dedicated
"stuck" filter query was built this pass (a straightforward future addition: `PICKUP_BOOKED` rows
older than N hours). No direct writes to `payments`/`settlements` anywhere — refunds are always
routed through `PaymentAdapter.refund()`, grep-audited.

**COD wallet nomination (Gap in the module doc itself, not this feature):** Task 6.3 says "COD
refunds go to buyer's nominated wallet, captured at return approval time" — no column anywhere in
the schema (`BuyerProfile`, `Address`, `Return`) can store a buyer-nominated wallet, and the schema
is frozen. Resolved by keeping the distinction purely behavioral: `triggerRefund()` passes
`order.paymentMethod` (`COD` vs the original gateway) to `PaymentAdapter.refund()`'s `method`
field — real money movement and wallet capture are out of scope for a mock adapter regardless, so
no wallet-reference data model was needed to honor this requirement at the MVP/mock level.

## Endpoints

### Buyer — `/api/v1/returns*`

- **`POST /returns`** — `{orderId, reason}`. Eligibility (delivered + within
  `platform_config.return_window_days` + no existing return) enforced server-side, pre-check *and*
  the schema's own `UNIQUE(order_id)` as a race backstop (`409 RETURN_ALREADY_EXISTS` either way,
  never a raw Prisma constraint error reaching the client).
- **`GET /returns`** — the buyer's own history, every status, not just active.
- **`GET /returns/:id`** — tri-mode ownership (Buyer, Seller, or Admin/Support), reused pattern
  from Feature 7's Order Detail.
- **`POST /returns/:id/images`** / **`DELETE /returns/:id/images/:imageId`** — Buyer-only, only
  while `INITIATED`, reuses Feature 4's `validateImageFile` + the existing `StorageAdapter`.
- **`POST /returns/:id/submit`** — requires ≥3 images, transitions `INITIATED → IMAGES_SUBMITTED →
  MANUAL_REVIEW` in one call (never `UNDER_AI_REVIEW` — MVP scope, Task 3.6).
- **`POST /returns/:id/appeal`** — the endpoint no task explicitly assigned (see above). Only from
  `REJECTED`.

### Seller — `/api/v1/seller/returns*`

- **`GET /returns`** — active queue (`MANUAL_REVIEW`) by default, `?history=true` widens to every
  status tied to the seller's own orders.
- **`GET /returns/:id`**, **`POST /returns/:id/decision`** (`{decision, reason?}` — reason
  mandatory only when rejecting, Zod refinement), **`POST /returns/:id/escalate`** (audit-trail-
  only, no status change — Task 4.6's Engineering Decision: no new enum value for "escalated").

### Admin — `/api/v1/admin/returns*`

- **`GET /returns`** — `MANUAL_REVIEW` + `UNDER_DISPUTE` by default, `?history=true` for
  everything, no ownership filter (Admin/Support see all). Support gets read-only.
- **`GET /returns/:id`** — includes `auditTrail` (every prior decision on this case), Admin/
  Support only.
- **`POST /returns/:id/decision`** — reason **always** mandatory (Admin-only, not Support). Final
  — `BR-008`, no further appeal loop.

## Known limitations / assumptions (see the module doc's own Assumptions §11 for what it already
flagged; this list is what this implementation pass additionally found)

1. Six event-inventory-style notification touchpoints reuse Feature 9's existing pipeline
   (`RETURN_INITIATED`, `RETURN_UNDER_REVIEW`, `RETURN_DECISION`, `REFUND_ISSUED` — the latter two
   using Feature 9's own pre-reserved canonical names) — four new template registry entries added,
   zero changes to Feature 9's dispatch logic.
2. Return-pickup booking reuses the order's own already-booked forward-shipment courier (no new
   scoring) and has **no retry/fallback** (unlike Feature 8's order-booking flow) — the mock always
   succeeds and no source document asks for return-pickup-specific retry logic; a real failure logs
   and leaves the return at `APPROVED` for manual attention.
3. Admin history/list endpoints do **not** inline the full audit trail per row (would require N+1
   queries) — only the detail endpoint (`GET /admin/returns/:id`) includes `auditTrail`.
4. No frontend for any of this — SCR-B10 (Returns Wizard), SCR-B11 (Appeal), SCR-S07 (Seller
   Review), SCR-AD04 (Admin Disputes Queue) all remain separate, not-yet-started work.
5. `DELIVERED → COMPLETED` (Feature 7/8's own carried-forward gap) and real payment-gateway
   refund integration remain Feature 12/16's job, unchanged.
