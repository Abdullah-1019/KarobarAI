# KarobarAI — Engineering Execution Playbook

## Feature 10: Returns & Refunds

**Source of truth:** PRD (Doc 1) · TRD (Doc 2) · App Flow (Doc 3) · Backend Schema (Doc 5) · Implementation Plan (Doc 6) **Depends on:** Feature 1 (Auth/RBAC), Feature 4 (Object Storage Adapter), Feature 7 (Order Management), Feature 9 (Notifications), Feature 10-Payments\* (Payment Module)

\*Naming note: the source brief refers to an already-built "Payment Module" as "Feature 10." To avoid collision with this document (Returns & Refunds), this playbook refers to it explicitly as **Payments Feature** throughout. No renumbering of prior features is implied or performed.

**Status:** Final — Response 3 of 3 (Tasks 1–7 + Validation & Consistency Review complete).

## Table of Contents

1.  [Feature Overview](#1-feature-overview)
2.  [Return & Refund Flow](#2-return--refund-flow)
3.  Task 1 — Return Foundation
4.  Task 2 — Return Request
5.  Task 3 — Return Image Upload
6.  Task 4 — Seller Review
7.  Task 5 — Admin Review
8.  Task 6 — Refund Status
9.  Task 7 — Return History
10.  Validation & Testing
11.  Consistency Review, Assumptions, Documentation Gaps

## 1\. Feature Overview

-   Implements the **MVP Returns workflow** (REQ-F-Return-001/002/006/007/009, BR-002, BR-007) and reserves the **R1.1 AI automation layer** (REQ-F-Return-003/004/005/008, REQ-AI-Return-001/002, D3) without building it now.
-   One return per order (returns.order\_id UNIQUE, schema §4.15); return lifecycle is a state machine already reserved in return\_status enum (schema §3): INITIATED → IMAGES\_SUBMITTED → UNDER\_AI\_REVIEW → MANUAL\_REVIEW → APPROVED → REJECTED → PICKUP\_BOOKED → REFUND\_ISSUED → UNDER\_DISPUTE → CLOSED.
-   Refunds are **not a new payment integration** — this feature only synchronizes return outcomes with the existing Payments Feature (refund trigger, COD nominated-wallet path per REQ-F-COD-003) and never mutates immutable payment/settlement rows (REQ-NF-Safety-007).

**In scope (MVP):** Return Request, Return Image Upload (mock/real Object Storage Adapter), Seller Review, Admin Review (disputes/escalation), Refund Status sync, Return History. **Reserved, not built (R1.1):** AI condition/authenticity scoring, confidence-threshold auto-decision, seller AI-override UI beyond manual override already in MVP scope.

## 2\. Return & Refund Flow

Buyer (My Orders, SCR-B07)

│ eligibility: delivered ≤14 days (BR-002/admin-config) AND no prior return (BR-007)

▼

Returns Wizard (SCR-B10) ── reason + ≥3 photos (REQ-F-Return-002)

│

▼

returns row created: status = INITIATED → IMAGES\_SUBMITTED

│ \[R1.1 hook reserved, not invoked in MVP\] status → UNDER\_AI\_REVIEW

▼

status = MANUAL\_REVIEW (MVP default landing state — no AI in MVP, D3)

│

├──► Seller Review (SCR-S07): Approve / Reject (reason mandatory on reject, REQ-F-Return-006)

│ │

│ ├─ Approve ──► APPROVED ──► pickup booked (reuses Logistics adapters, Feature 7/TRD §28)

│ │ └──► REFUND\_ISSUED (sync w/ Payments Feature, ≤24h, REQ-F-Payment-007)

│ │

│ └─ Reject ───► REJECTED ──► buyer sees plain-language reason + Appeal (SCR-B11)

│ │

│ └─ Appeal ──► dispute row created (1:1 return, schema §4.17)

│ → UNDER\_DISPUTE

│

└──► Escalate to Admin (seller or system) ──► Admin Disputes Queue (SCR-AD04)

│

▼

Admin decision (mandatory reason, REQ-F-Admin-003) — FINAL (BR-008)

├─ Approve ──► APPROVED → pickup/refund path above

└─ Reject ──► REJECTED (CLOSED)

│

▼

CLOSED (terminal) — visible in Return History (buyer/seller/admin, permission-scoped)

Notes:

-   Every admin/seller decision with override or reason writes to audit\_logs in the same transaction (schema §10) — reused from Feature 1/Admin foundation, not rebuilt here.
-   Refund issuance never mutates a payments/settlements row; it inserts a new compensating record via the existing Payments Feature refund path (REQ-F-COD-004).

## Task 1 — Return Foundation

### Purpose

-   Stand up the returns module skeleton (routes/controller/service/repository/DTOs) inside the existing Core API structure (TRD §12: apps/api/src/modules/returns/) — no new folder pattern.
-   Wire the return state machine using the **shared state-machine module** pattern already established for Orders (TRD §3, Design Patterns table) so return transitions are centrally validated, not ad hoc.
-   Confirm/extend Prisma models against Doc 5 §4.15–4.17 (returns, return\_images, disputes) — schema is **frozen**; this task verifies parity, it does not redesign it.

### Dependencies

-   Feature 1: Auth middleware, JWT, RBAC/ownership middleware, response envelope, error hierarchy, Zod validation framework.
-   Feature 7: Order Management (order lifecycle, orders.delivered\_at, order repository) — returns eligibility reads from this.
-   Database Schema (Doc 5): returns, return\_images, disputes tables, return\_status/return\_condition/return\_decision/dispute\_status enums — already migrated; do not alter.
-   platform\_config seed key return\_window\_days (Feature 2/Admin config foundation) — reused, not recreated.

### Expected Deliverables

-   returns module scaffold present under apps/api/src/modules/returns/
-   Return state-machine definition (valid transitions only, shared core/state-machines/)
-   Prisma schema parity check report (no drift vs Doc 5 §4.15–4.17)
-   Return repository (Prisma-backed) with basic findByOrderId, create, updateStatus
-   Return DTOs (Zod) for create/read, aligned to schema field names

### Implementation Checklist

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 1.1 | Confirm Return, ReturnImage, Dispute Prisma models match Doc 5 §4.15–4.17 exactly (types, FKs, cascades) | Diff report: 0 discrepancies | prisma validate clean; manual field-by-field check vs schema doc |
| --- | --- | --- | --- |
| 1.2 | Create returns module folder (controller.ts, service.ts, routes.ts, dto.ts, repository.ts) under apps/api/src/modules/returns/ per TRD §12 layout | Folder scaffolded, empty handlers wired to router | pnpm build compiles; route /api/v1/returns mounts (404 stub OK) |
| --- | --- | --- | --- |
| 1.3 | Define return\_status transition map: INITIATED→IMAGES\_SUBMITTED→{UNDER\_AI\_REVIEW|MANUAL\_REVIEW}→{APPROVED|REJECTED}→{PICKUP\_BOOKED→REFUND\_ISSUED|UNDER\_DISPUTE}→CLOSED in core/state-machines/returnStateMachine.ts (mirrors Order state-machine pattern, TRD §3) | Reusable canTransition(from, to) function | Unit test: illegal transition (e.g. INITIATED→REFUND\_ISSUED) throws BusinessRuleError(422) |
| --- | --- | --- | --- |
| 1.4 | Implement ReturnRepository with create(), findByOrderId(), findById(), updateStatus() using Prisma, following Repository pattern already used in Order/Product modules | Repository class, unit-testable, no raw SQL | Jest unit tests pass with a test DB/mock |
| --- | --- | --- | --- |
| 1.5 | Define Zod DTOs: CreateReturnDto {orderId, reason}, ReturnResponseDto (envelope-shaped) reusing shared DTO conventions (Feature 1) | DTO files exported from dto.ts | Zod schema rejects unknown fields; passes on valid payload |
| --- | --- | --- | --- |
| 1.6 | Register error codes specific to returns: RETURN\_WINDOW\_CLOSED, RETURN\_ALREADY\_EXISTS, RETURN\_INVALID\_STATE in the shared error-code enum (TRD §9) | Error codes added to packages/shared | Codes importable from both api and tests; envelope emits them correctly on triggered errors |
| --- | --- | --- | --- |

### Engineering Decisions

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Return state machine location | Shared core/state-machines/ module (same pattern as Order lifecycle) | Single source of valid transitions, consistent with TRD §3 Design Patterns table; avoids duplicating state logic per module |
| --- | --- | --- |
| AI-review states in MVP | Modeled in enum, **never entered** by code in MVP | Schema (Doc 5) already reserves UNDER\_AI\_REVIEW; PRD D3 confirms MVP routes straight to MANUAL\_REVIEW — no migration needed later |
| --- | --- | --- |

### Common Errors

-   Attempting to add new columns/enum values to returns/disputes — **forbidden**; schema is frozen per Doc 5 unless a documented gap is found (see final consistency review).
-   Reimplementing a bespoke status-transition if/else chain instead of reusing the shared state-machine pattern.

### Artifacts Produced

-   apps/api/src/modules/returns/ (controller, service, routes, dto, repository) — reused by Tasks 2–7 in this feature.
-   core/state-machines/returnStateMachine.ts — reused by Seller Review, Admin Review, Refund Status tasks.
-   Shared error codes (RETURN\_WINDOW\_CLOSED, RETURN\_ALREADY\_EXISTS, RETURN\_INVALID\_STATE) — reused by Return Request (Task 2) and Return History (Task 7).

### Definition of Done

-   returns module compiles and mounts under /api/v1/returns with stub handlers returning 501/not implemented envelope
-   State-machine unit tests cover every documented legal and one illegal transition
-   Repository CRUD methods pass unit tests against a seeded test DB
-   Zero Prisma schema drift vs Doc 5 §4.15–4.17
-   Lint/type-check clean; no console/debug output

## Task 2 — Return Request

### Purpose

-   Let a buyer initiate a return on an eligible delivered order (REQ-F-Return-001, BR-002/BR-007) directly from the Returns Wizard (SCR-B10, step 1–2).
-   Enforce the 14-day window (admin-configurable) and the one-return-per-order rule at the API boundary, not just the UI.

### Dependencies

-   Task 1 (Return Foundation): module scaffold, repository, state machine, error codes.
-   Feature 7: Order Management — need orders.delivered\_at, orders.buyer\_id for ownership + eligibility checks.
-   Feature 1: authenticate → authorize(BUYER) → ownership middleware chain (reused as-is, TRD §8).
-   platform\_config.return\_window\_days (Feature 2/Admin config) for the configurable window.

### Expected Deliverables

-   POST /api/v1/returns endpoint (create return request)
-   GET /api/v1/returns/:id endpoint (buyer/seller/admin, ownership-scoped)
-   Eligibility validation service (window + duplicate-return check)
-   Reason field capture (returns.reason)
-   OpenAPI/Swagger entries for both endpoints

### Implementation Checklist

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 2.1 | Implement ReturnEligibilityService.check(orderId, buyerId): loads order via Order repository (Feature 7), confirms buyer\_id ownership, status = DELIVERED|COMPLETED, now() - delivered\_at ≤ return\_window\_days, and no existing returns row for that order\_id | Service returns {eligible: boolean, reasonCode?} | Unit tests: eligible case, expired-window case, already-returned case, wrong-owner case |
| --- | --- | --- | --- |
| 2.2 | Implement POST /api/v1/returns controller → validates CreateReturnDto (Zod) → calls eligibility service → on pass, ReturnRepository.create({orderId, reason, status: INITIATED}) | 201 response, enveloped, returns new return\_id/public reference | Integration test: valid request creates row with status=INITIATED |
| --- | --- | --- | --- |
| 2.3 | Map eligibility failures to typed errors: expired window → RETURN\_WINDOW\_CLOSED (422); duplicate → RETURN\_ALREADY\_EXISTS (409); not owner → ForbiddenError (403) | Correct HTTP status + error code per case | Integration tests assert exact status/code per Doc 2 §9 error-code conventions |
| --- | --- | --- | --- |
| 2.4 | Implement GET /api/v1/returns/:id with role-aware ownership: buyer sees own; seller sees own-order returns; admin/support see all | 200 with return detail (status, reason, timestamps) | Integration tests per role: buyer-other's-return → 403; seller-own-order → 200; admin → 200 |
| --- | --- | --- | --- |
| 2.5 | Add Swagger annotations for both endpoints (request/response schemas, error codes) at /api-docs (TRD §5.1, REQ-NF-Quality-004) | Endpoints visible and testable in Swagger UI | Manual check in /api-docs; schema matches DTOs |
| --- | --- | --- | --- |
| 2.6 | Wire **notification hook (reuse Feature 9)**: on successful creation, enqueue return\_initiated event (seller + buyer in-app/SMS) — no new notification infra | Job enqueued via existing BullMQ producer | Queue job visible in BullMQ board; consumer dispatches without new code paths |
| --- | --- | --- | --- |

### Common Errors

-   Checking eligibility only client-side (SCR-B10) without server-side re-validation — must be enforced in ReturnEligibilityService, since UI checks are bypassable.
-   Allowing a second return row per order — must rely on the schema's UNIQUE(order\_id) constraint as the hard backstop *and* a pre-check for a clean 409 error (not a raw DB constraint violation leaking to the client).

### Engineering Decisions

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Eligibility check placement | Dedicated ReturnEligibilityService, called by controller before repository write | Keeps controller thin (TRD §3 Service layer pattern); reusable by Task 4 (Seller Review re-validates state) and Task 7 (History filters) |
| --- | --- | --- |
| Duplicate-return handling | Pre-check in service **and** rely on DB unique constraint as final guard | Defense in depth; pre-check gives a clean 409 RETURN\_ALREADY\_EXISTS instead of a raw Prisma unique-violation error reaching the error middleware |
| --- | --- | --- |

### Artifacts Produced

-   ReturnEligibilityService — reused by Task 4 (Seller Review) and Task 5 (Admin Review) for state re-validation.
-   POST /api/v1/returns, GET /api/v1/returns/:id controllers — extended by Task 3 (image attach), Task 6 (status reads), Task 7 (history listing reuses the same ownership logic).
-   Swagger entries — extended, not recreated, by every subsequent task in this feature.
-   return\_initiated notification event — pattern reused by Tasks 4–6 for subsequent lifecycle notifications.

### Definition of Done

-   Buyer can create a return request only on an eligible order; ineligible attempts return correct 422/409/403 with correct error codes
-   Return record persists with status = INITIATED and correct reason
-   Ownership-scoped GET works correctly for buyer/seller/admin/support roles
-   Swagger documents both endpoints
-   return\_initiated notification fires exactly once per successful creation
-   Unit + integration test coverage maintained ≥80% for new code (REQ-NF-Quality-003)

## Task 3 — Return Image Upload

### Purpose

-   Capture the **≥3 required photos** (REQ-F-Return-002) that make a return submittable, using the platform's existing Object Storage Adapter — no new storage integration.
-   Persist images to return\_images (Doc 5 §4.16) and advance the return to IMAGES\_SUBMITTED, unblocking downstream review.

### Dependencies

-   Task 1 (Return Foundation): module scaffold, repository, state machine.
-   Task 2 (Return Request): an existing returns row in INITIATED state to attach images to.
-   Feature 4: Object Storage Adapter (upload(), getUrl() — TRD §28) — reused as-is; **do not build a new storage client**.
-   Feature 1: server-side file validation (magic-byte + size, Sec-012) — reused validation utility, not reimplemented.

### Expected Deliverables

-   POST /api/v1/returns/:id/images endpoint (multi-file, buyer-owned return only)
-   DELETE /api/v1/returns/:id/images/:imageId endpoint (pre-submission removal only)
-   Server-side validation: file type (JPEG/PNG/WebP), size, magic-byte check, minimum-3 rule enforced before allowing state transition
-   Auto-transition INITIATED → IMAGES\_SUBMITTED once ≥3 valid images exist and buyer confirms submission
-   Swagger entries for both endpoints

### Implementation Checklist

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 3.1 | Implement POST /api/v1/returns/:id/images: ownership check (buyer owns the return, status = INITIATED), accept multipart upload, validate each file (type/size/magic-byte, reusing Feature 1's upload validation util) | Rejects invalid files with ValidationError(400); valid files proceed | Integration test: oversized/non-image file → 400; valid JPEG ≤10MB → proceeds |
| --- | --- | --- | --- |
| 3.2 | For each valid file, call the existing ObjectStorageAdapter.upload() (Feature 4) — mock in MVP — then persist a return\_images row (return\_id, cdn\_url, created\_at) via ReturnImageRepository | New rows in return\_images, cdn\_url populated from adapter response | DB check: row count matches uploaded file count; cdn\_url non-null |
| --- | --- | --- | --- |
| 3.3 | Add a status guard: uploads only accepted while returns.status = INITIATED (reject with RETURN\_INVALID\_STATE 422 once submitted/under review) | Late upload attempts rejected | Integration test: upload after IMAGES\_SUBMITTED → 422 |
| --- | --- | --- | --- |
| 3.4 | Implement DELETE /api/v1/returns/:id/images/:imageId for pre-submission correction (buyer removes a bad photo before finalizing) | Row soft-removed / hard-deleted (per Doc 5, return\_images has no deleted\_at — use hard delete pre-submission only) | Integration test: delete succeeds only while status = INITIATED; image count decrements |
| --- | --- | --- | --- |
| 3.5 | Implement POST /api/v1/returns/:id/submit: validates ≥3 images exist (REQ-F-Return-002), transitions INITIATED → IMAGES\_SUBMITTED via the shared state machine (Task 1), then **MVP default**: immediately advance to MANUAL\_REVIEW (no AI dispatch in MVP, D3) | returns.status = MANUAL\_REVIEW after submit | Integration test: submit with 2 images → 422 RETURN\_IMAGES\_INSUFFICIENT; submit with 3+ → status becomes MANUAL\_REVIEW |
| --- | --- | --- | --- |
| 3.6 | Reserve (do not call) an AiReviewDispatcher interface stub for R1.1 — a no-op adapter that would call ai-service:/analyze-return later; wire the state machine to accept the UNDER\_AI\_REVIEW transition without invoking it | Interface exists, unused in MVP call path | Code review: no active MVP code path reaches UNDER\_AI\_REVIEW |
| --- | --- | --- | --- |
| 3.7 | Notification hook (reuse Feature 9): on transition to MANUAL\_REVIEW, enqueue return\_under\_review event to seller + admin queue view | Job enqueued, no new notification infra | Queue/board check |
| --- | --- | --- | --- |
| 3.8 | Swagger annotations for upload/delete/submit endpoints | Visible in /api-docs | Manual check |
| --- | --- | --- | --- |

### Common Errors

-   Storing raw uploaded bytes in Postgres instead of delegating to the Object Storage Adapter — forbidden; schema only stores cdn\_url (Doc 5 §4.16).
-   Allowing image upload/removal after IMAGES\_SUBMITTED — must be blocked by the state guard, not just hidden in the UI.
-   Calling a real or mock AI endpoint from this task — **out of scope**; MVP must land in MANUAL\_REVIEW, never UNDER\_AI\_REVIEW, per D3/PRD §12.4.

### Engineering Decisions

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Image storage mechanism | Existing Object Storage Adapter (Feature 4), mock mode in MVP | D2 adapter pattern; no new integration surface for returns |
| --- | --- | --- |
| AI dispatch in MVP | Stubbed interface only, never invoked | Matches D3/PRD explicitly: MVP is workflow-only; R1.1 activates the same state machine's UNDER\_AI\_REVIEW path without a later migration |
| --- | --- | --- |
| Pre-submission image edits | Hard delete allowed only while status = INITIATED | return\_images has no soft-delete column (Doc 5 §4.16); once submitted, images become part of the immutable review record |
| --- | --- | --- |

### Artifacts Produced

-   ReturnImageRepository — reused by Task 5 (Admin Review case detail) and Task 7 (Return History detail view).
-   POST /api/v1/returns/:id/images, DELETE .../images/:imageId, POST /api/v1/returns/:id/submit controllers — the submit transition is reused as the single entry point into review by Task 4.
-   AiReviewDispatcher stub interface — reserved for Feature 8/R1.1 ReturnsAI automation; **not implemented** here.
-   return\_under\_review notification event — reused by Task 4 and Task 5 as the pattern for subsequent lifecycle notifications.

### Definition of Done

-   Buyer cannot submit with fewer than 3 valid images
-   Uploaded images persist via the existing Object Storage Adapter with correct cdn\_url
-   Image upload/delete blocked outside INITIATED state
-   Submission transitions return to MANUAL\_REVIEW (never UNDER\_AI\_REVIEW) in MVP
-   return\_under\_review notification fires exactly once per submission
-   Swagger documents all three endpoints
-   Test coverage ≥80% maintained for new code

## Task 4 — Seller Review

### Purpose

-   Give sellers the manual-review decision surface (SCR-S07) required in MVP: approve, reject (with mandatory reason), or escalate to admin (REQ-F-Return-006/008).
-   Trigger the downstream pickup/refund path on approval by reusing existing Logistics and Payments integrations — no new courier or payment code.

### Dependencies

-   Task 1 (Return Foundation): state machine, repository.
-   Task 3 (Return Image Upload): return must be in MANUAL\_REVIEW with images attached before seller can act.
-   Feature 7: Order Management / Logistics adapters (CourierAdapter.book()) — reused for auto-pickup on approval.
-   Payments Feature: refund trigger interface — reused for Task 6 sync, referenced (not built) here.
-   Feature 1: RBAC (SELLER role) + ownership (seller owns the order tied to the return).

### Expected Deliverables

-   GET /api/v1/seller/returns — list returns for the seller's own orders, filterable by status
-   GET /api/v1/seller/returns/:id — case detail (reason, images, order snapshot)
-   POST /api/v1/seller/returns/:id/decision — approve/reject with mandatory reason on reject
-   POST /api/v1/seller/returns/:id/escalate — hand off to Admin queue
-   Approval side-effects: pickup booking call + APPROVED → PICKUP\_BOOKED transition (refund hookup deferred to Task 6, called here as a reused trigger point)

### Implementation Checklist

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 4.1 | Implement GET /api/v1/seller/returns with ownership filter (orders.seller\_id = self, joined via returns.order\_id) and status-tab filtering (mirrors SCR-S07 list) | Paginated list, envelope-wrapped | Integration test: seller A never sees seller B's returns |
| --- | --- | --- | --- |
| 4.2 | Implement GET /api/v1/seller/returns/:id returning return + order snapshot + return\_images URLs (reuses ReturnImageRepository from Task 3) | Full case detail payload | Integration test: 403 if seller doesn't own the underlying order |
| --- | --- | --- | --- |
| 4.3 | Implement POST /api/v1/seller/returns/:id/decision body {decision: APPROVED|REJECTED, reason?}; guard: only valid from MANUAL\_REVIEW; reason **mandatory** when REJECTED (Zod refinement, REQ-F-Return-006) | 200 on success; 422 RETURN\_INVALID\_STATE if not in MANUAL\_REVIEW | Integration test: reject without reason → 400 validation error; reject with reason → succeeds |
| --- | --- | --- | --- |
| 4.4 | On APPROVED: transition MANUAL\_REVIEW → APPROVED, then call existing CourierAdapter (Feature 7 Logistics) to book return pickup, then transition APPROVED → PICKUP\_BOOKED; log via shared audit\_logs if this counts as an override (it doesn't, for a normal first-pass seller decision — see 4.6) | Courier booking record created (reuse courier\_quotes/booking pattern); status advances to PICKUP\_BOOKED | Integration test against mock courier adapter: booking succeeds → PICKUP\_BOOKED; booking fails → retry pattern reused from REQ-F-Logistics-005 |
| --- | --- | --- | --- |
| 4.5 | On REJECTED: transition MANUAL\_REVIEW → REJECTED; enqueue return\_rejected notification (buyer, plain-language reason) reusing Feature 9 | Buyer notified with reason; status = REJECTED | Integration test + queue inspection |
| --- | --- | --- | --- |
| 4.6 | Implement POST /api/v1/seller/returns/:id/escalate: transitions case into the Admin queue by flagging it (e.g., a MANUAL\_REVIEW-tagged escalation flag or direct move — **use existing dispute-adjacent path only if the seller declines to decide**, otherwise sellers escalate by simply not deciding and Admin can pull any MANUAL\_REVIEW case). Where the seller *actively* escalates, write an audit\_logs entry with action=MODERATION equivalent context reference | Escalated case visible in Admin Disputes Queue (SCR-AD04) | Integration test: escalated case appears in admin's queryable manual-review queue |
| --- | --- | --- | --- |
| 4.7 | Ensure every seller decision (approve/reject) that constitutes an override or contested action writes to audit\_logs per Doc 5 §10 (mandatory-reason writes happen in the same transaction as the mutation) | Audit row present for every reject; approve logged for traceability | DB check: audit\_logs row exists with correct entity='returns', entity\_id, before/after snapshot |
| --- | --- | --- | --- |
| 4.8 | Swagger annotations for all four endpoints | Visible in /api-docs | Manual check |
| --- | --- | --- | --- |

### Common Errors

-   Allowing seller decisions on returns not in MANUAL\_REVIEW (e.g., already APPROVED/CLOSED) — must be blocked by the state machine, not just the UI.
-   Skipping the mandatory-reason-on-reject rule — Zod-level enforcement required, not just a UI-disabled button.
-   Building a new courier-booking code path instead of reusing Feature 7's existing CourierAdapter/scoring-and-booking service.

### Engineering Decisions

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Escalation mechanism | Seller either decides (approve/reject) or the case simply remains queryable by Admin in MANUAL\_REVIEW; explicit escalate endpoint only adds an audit trail, not a new state | Avoids inventing a new return\_status value not present in Doc 5 §3 enum (schema is frozen) |
| --- | --- | --- |
| Return pickup booking | Reuse Feature 7's existing courier adapter/booking service, invoked from the return-approval path | No duplicate logistics integration; consistent with TRD §3 Adapter/Strategy patterns |
| --- | --- | --- |
| Audit logging scope | Every reject (mandatory reason) and every approve (traceability) logged | Matches Doc 5 §10 "mandatory-reason writes" rule and general audit philosophy (REQ-F-Admin-003 lineage) even though MVP seller approvals don't strictly require a reason |
| --- | --- | --- |

### Artifacts Produced

-   apps/api/src/modules/returns/seller/ (controller, service) — reuses Task 1–3 repository/state machine.
-   Seller return-decision workflow (decision, escalate endpoints) — reused by Task 5 (Admin Review shares the same underlying transition functions) and Task 7 (History surfaces decision outcomes).
-   Return-approval → pickup-booking integration — reuses Feature 7's Logistics module; no new artifact there, only a new call site.
-   return\_rejected notification event — extends the Task 2/3 notification pattern.

### Definition of Done

-   Seller sees only returns tied to their own orders
-   Approve/reject blocked outside MANUAL\_REVIEW; reject requires a reason
-   Approval books pickup via the existing courier adapter and advances to PICKUP\_BOOKED
-   Rejection notifies buyer with plain-language reason
-   Every reject and approve decision produces a corresponding audit\_logs row
-   Swagger documents all endpoints
-   Test coverage ≥80% maintained for new code

## Task 5 — Admin Review

### Purpose

-   Give Admin the final-decision surface (SCR-AD04) for escalated/manual-review returns and appeals — the only role whose decision is terminal (BR-008).
-   Ensure every admin action is mandatory-reason and audited, matching the existing Admin governance pattern already built for other privileged actions (Feature 1/Admin foundation) — no new audit mechanism.

### Dependencies

-   Task 1 (Return Foundation): state machine, repository.
-   Task 4 (Seller Review): returns land here either via explicit escalation, seller rejection → buyer appeal, or simply sitting in MANUAL\_REVIEW/UNDER\_DISPUTE.
-   Feature 1: Admin RBAC, audit\_logs write pattern, mandatory-reason enforcement (reused, not rebuilt).
-   Disputes table (Doc 5 §4.17) — 1:1 with returns, created on buyer appeal (Task 4/SCR-B11 flow).

### Expected Deliverables

-   GET /api/v1/admin/returns — full queue (manual-review + escalated + disputed), filterable
-   GET /api/v1/admin/returns/:id — case detail (reason, images, seller decision history, dispute if any)
-   POST /api/v1/admin/returns/:id/decision — final approve/reject, mandatory reason, writes audit\_logs
-   Dispute resolution wired: resolving a dispute also closes/advances the parent returns row atomically
-   Swagger entries for all endpoints

### Implementation Checklist

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 5.1 | Implement GET /api/v1/admin/returns (Admin/Support RBAC): returns all cases in MANUAL\_REVIEW or UNDER\_DISPUTE, plus any explicitly escalated (Task 4.6), filterable by status/date | Paginated, envelope-wrapped queue matching SCR-AD04 | Integration test: Support role gets read access; Admin gets read+write |
| --- | --- | --- | --- |
| 5.2 | Implement GET /api/v1/admin/returns/:id: joins returns + return\_images (Task 3 repo) + disputes (if present) + prior seller decision (if any, from audit trail) | Full case detail incl. seller's prior action if escalated post-rejection | Integration test: case with a dispute row returns dispute detail; case without returns null gracefully |
| --- | --- | --- | --- |
| 5.3 | Implement POST /api/v1/admin/returns/:id/decision body {decision: APPROVED|REJECTED, reason} — **reason always mandatory** (REQ-F-Admin-003), valid only from MANUAL\_REVIEW or UNDER\_DISPUTE | 200 on success; 400 if reason missing; 422 RETURN\_INVALID\_STATE otherwise | Integration test: missing reason → 400 regardless of decision value |
| --- | --- | --- | --- |
| 5.4 | On admin APPROVED: same downstream path as seller approval (Task 4.4) — reuse the **same internal transition function**, not a duplicate — → APPROVED → PICKUP\_BOOKED (courier booking via Feature 7 adapter) | Identical approval side-effects regardless of decider role | Integration test: admin-approved case books pickup exactly like seller-approved case |
| --- | --- | --- | --- |
| 5.5 | On admin REJECTED: → REJECTED → CLOSED (admin decision is final, BR-008 — no further appeal loop); if resolving a dispute, also set disputes.status = RESOLVED\_REJECTED / RESOLVED\_APPROVED and disputes.resolved\_by/resolved\_at in the **same transaction** | Return and dispute rows consistent; no orphaned open dispute on a closed return | DB check: disputes.status and returns.status always resolve together (single transaction) |
| --- | --- | --- | --- |
| 5.6 | Every admin decision writes audit\_logs (action = DISPUTE\_RESOLVE or AI\_OVERRIDE-adjacent per Doc 5 enum, entity=returns, mandatory reason, before/after snapshot) in the same DB transaction as the status update — if the audit write fails, the whole transaction rolls back (Doc 5 §10) | Every admin decision has exactly one matching audit row | Integration test: simulate audit-write failure → return status unchanged (rollback verified) |
| --- | --- | --- | --- |
| 5.7 | Notification hook (reuse Feature 9): dispatch return\_decision\_final to buyer + seller with the plain-language reason | Both parties notified | Queue/board check |
| --- | --- | --- | --- |
| 5.8 | Swagger annotations for admin endpoints | Visible in /api-docs | Manual check |
| --- | --- | --- | --- |

### Common Errors

-   Building a separate "admin approval" code path instead of reusing the same transition/pickup-booking function as Task 4 — causes drift risk between seller and admin approval behavior.
-   Resolving a dispute without updating the parent return in the same transaction — leaves an inconsistent state (CLOSED dispute on a still-MANUAL\_REVIEW return, or vice versa).
-   Treating admin rejection as appealable — BR-008 makes it final; do not wire a further appeal loop.

### Engineering Decisions

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Approval logic reuse | Admin and Seller decision endpoints call the same underlying ReturnDecisionService.approve()/reject() methods, differing only in RBAC gate and mandatory-reason strictness | Prevents duplicated business logic and behavioral drift between the two decision surfaces (single-source transition + audit logic) |
| --- | --- | --- |
| Dispute + return consistency | Single DB transaction updates both disputes and returns on admin resolution | Doc 5 §5/§9 relationship (disputes 1:1 returns, RESTRICT) requires they never diverge |
| --- | --- | --- |
| Admin decision finality | No further appeal path after admin decision | BR-008: "admin decisions final" — explicit business rule, not an oversight |
| --- | --- | --- |

### Artifacts Produced

-   ReturnDecisionService (shared approve/reject/pickup-booking logic) — refactor point extracted from Task 4, now shared by both Seller and Admin review; **reused**, not duplicated.
-   apps/api/src/modules/returns/admin/ (controller, service) — reuses shared decision service, repository, state machine.
-   Dispute resolution transaction logic — reused by Return History (Task 7) to display final outcomes correctly.
-   return\_decision\_final notification event — final node in the returns notification chain (Tasks 2/3/4/5 events together form the complete lifecycle notification set for Feature 9 to dispatch).

### Definition of Done

-   Admin/Support can view the full manual-review/escalated/disputed queue; Support is read-only
-   Admin decision requires a reason unconditionally; missing reason → 400
-   Admin approval reuses the identical pickup-booking path as seller approval
-   Dispute + return status always update together in one transaction
-   Every admin decision produces exactly one audit\_logs row
-   Both parties notified of the final decision
-   Test coverage ≥80% maintained for new code

## Task 6 — Refund Status

### Purpose

-   Synchronize an APPROVED/PICKUP\_BOOKED return with the existing Payments Feature's refund mechanism (REQ-F-Payment-007, REQ-F-COD-003) — this task is an **integration point**, not a new payment engine.
-   Surface refund status back on the return record so buyers/sellers/admins see a single coherent state (return status + refund status) without querying two disconnected systems manually.

### Dependencies

-   Task 5 (Admin Review) / Task 4 (Seller Review): produces the APPROVED → PICKUP\_BOOKED transition that triggers this task.
-   Payments Feature (already implemented): refund-issuance interface, payments/settlements immutability rules (Doc 5 §4.12–4.13, REQ-NF-Safety-007) — **reused, never mutated directly**.
-   Feature 9: Notifications — refund-issued event.

### Expected Deliverables

-   ReturnRefundSyncService — calls the existing Payments Feature refund trigger on PICKUP\_BOOKED (or immediately on APPROVED if no physical pickup is required for the refund path — confirm against Payments Feature contract, flagged as Assumption if undocumented)
-   returns.status → REFUND\_ISSUED transition wired to a confirmed refund event from Payments Feature
-   GET /api/v1/returns/:id (Task 2, extended) now includes refund status/reference in its response
-   Idempotent refund trigger (no duplicate refund on retry/webhook replay)

### Implementation Checklist

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 6.1 | Confirm the exact refund-trigger contract exposed by the existing Payments Feature (method signature, sync vs async, webhook vs direct call) — **do not guess**; if undocumented, mark as an Assumption (see §11) and implement against the most conservative interpretation (async, idempotency-key-based, matching REQ-F-Payment-004 pattern) | Documented integration contract (internal note) | Code review confirms no invented payment logic — only calls into existing interface |
| --- | --- | --- | --- |
| 6.2 | Implement ReturnRefundSyncService.triggerRefund(returnId): loads the return + originating order + payment method (orders.payment\_method), calls Payments Feature's refund trigger with an idempotency key derived from return\_id (reusing REQ-F-Payment-004 pattern) | Refund request dispatched exactly once per return | Integration test: calling triggerRefund twice for the same return does not create two refund attempts |
| --- | --- | --- | --- |
| 6.3 | Wire the call site: invoke triggerRefund() immediately after → PICKUP\_BOOKED (prepaid + COD both handled per REQ-F-Payment-007/REQ-F-COD-003 — COD refunds go to buyer's nominated wallet, captured at return approval time, not the original payment instrument) | Refund attempt logged against the return | Integration test: COD-order return refund routes to nominated wallet path, not "reverse charge" |
| --- | --- | --- | --- |
| 6.4 | Subscribe to (or poll, per existing Payments Feature pattern) the refund-confirmation signal; on confirmation, transition returns.status: PICKUP\_BOOKED → REFUND\_ISSUED and stamp returns.refunded\_at | refunded\_at populated; status advances only on confirmed refund, not on request | Integration test: refund still pending → status stays PICKUP\_BOOKED; confirmed → REFUND\_ISSUED |
| --- | --- | --- | --- |
| 6.5 | On refund failure/timeout from the Payments Feature, keep return in PICKUP\_BOOKED and flag for Admin visibility (reuse Admin queue filters from Task 5, e.g., a "refund pending >24h" filter) rather than inventing a new return-status value | Stuck refunds surface to Admin without a schema change | Integration test: simulated refund failure keeps return visible in an admin-filterable "attention needed" view |
| --- | --- | --- | --- |
| 6.6 | Extend GET /api/v1/returns/:id (Task 2) response DTO to include refundStatus/refundedAt sourced from the Payments Feature lookup (join or service call), without duplicating payment data into the returns table (schema frozen, Doc 5 has no such column beyond refunded\_at) | Buyer/seller/admin see unified return+refund view in one call | Integration test: response includes refund info without a new DB column |
| --- | --- | --- | --- |
| 6.7 | Notification hook (reuse Feature 9): dispatch refund\_issued on confirmed refund (already an existing notification event per PRD §12.12 lifecycle list — reuse it, do not create a duplicate) | Buyer notified | Queue/board check |
| --- | --- | --- | --- |
| 6.8 | Swagger: update GET /api/v1/returns/:id schema to reflect the new refund fields | Docs current | Manual check |
| --- | --- | --- | --- |

### Common Errors

-   Directly UPDATE-ing a payments/settlements row from the returns module — forbidden; append-only/immutable per Doc 5 §0/§8; must go through the Payments Feature's own compensating-entry mechanism.
-   Adding a new return\_status enum value for refund failure — schema is frozen; use Admin-queue filtering on existing state + a timestamp threshold instead.
-   Re-triggering a refund on every webhook retry without an idempotency key — must reuse the REQ-F-Payment-004 idempotency-key discipline.

### Engineering Decisions

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Refund trigger point | Immediately after PICKUP\_BOOKED (not before) | Matches App Flow §6.7 Payment Flow ("Approved return → refund within 24h") and REQ-F-Payment-005/007 sequencing; avoids refunding before physical return process starts |
| --- | --- | --- |
| Refund status storage | Sourced live from Payments Feature at read time, not duplicated into returns table | Schema is frozen (Doc 5); returns.refunded\_at is the only owned field, avoids data-consistency drift between two systems |
| --- | --- | --- |
| Refund failure handling | No new enum state; surfaced via Admin-queue filter on PICKUP\_BOOKED age | Keeps schema unchanged while still giving Admin visibility (reuses Task 5 queue) |
| --- | --- | --- |

### Artifacts Produced

-   ReturnRefundSyncService — the only new integration code in this task; calls into the existing Payments Feature, does not modify it.
-   Extended GET /api/v1/returns/:id response contract — reused by Task 7 (Return History) for showing refund status in list/detail views.
-   refund\_issued event reuse — confirms no duplicate notification-event type was created.

### Definition of Done

-   Refund is triggered exactly once per approved return (idempotent, no duplicates on retry)
-   COD returns refund to the nominated wallet; prepaid returns refund via the original wallet path — both via existing Payments Feature logic only
-   returns.status only reaches REFUND\_ISSUED on confirmed refund, never on request
-   No direct writes to payments/settlements tables from the returns module
-   Stuck/failed refunds are visible to Admin without a schema change
-   Buyer notified on confirmed refund via the existing refund\_issued event

## Task 7 — Return History

### Purpose

-   Provide the permission-scoped history views required by SCR-B07 (My Orders → Returns tab), SCR-S07 (seller list), and SCR-AD08 (Audit Log Viewer overlap) — read-only aggregation, no new write paths.
-   Ensure history reflects the complete lifecycle (request → images → review → decision → refund) using only data already produced by Tasks 1–6.

### Dependencies

-   Tasks 1–6: all return data (status, images, decisions, refund status) already exists; this task only queries/aggregates it.
-   Feature 1: ownership/RBAC middleware (buyer sees own; seller sees own-order; admin/support see all).
-   audit\_logs (Feature 1/Admin foundation) — reused for the "decision history" trail, not rebuilt.

### Expected Deliverables

-   GET /api/v1/returns (buyer-scoped, "my returns") with pagination + status filter
-   GET /api/v1/seller/returns/history (extends Task 4 list with closed/refunded cases, not just active MANUAL\_REVIEW)
-   GET /api/v1/admin/returns/history (extends Task 5 queue with all terminal-state cases, joined with relevant audit\_logs)
-   Consistent response shape across all three (same DTO, different ownership filter) reusing the extended DTO from Task 6

### Implementation Checklist

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 7.1 | Implement GET /api/v1/returns (buyer): lists all returns where orders.buyer\_id = self, across all statuses (not just active), paginated (cursor/limit per TRD §9 pagination standard), default sort created\_at DESC | Buyer sees full personal history incl. CLOSED/REFUND\_ISSUED cases | Integration test: buyer sees only own returns across all statuses |
| --- | --- | --- | --- |
| 7.2 | Extend seller endpoint from Task 4 (GET /api/v1/seller/returns) with a history=true query flag or a separate /history route returning terminal-state cases in addition to active ones | Seller can view past decisions, not just the active queue | Integration test: seller history includes CLOSED and REFUND\_ISSUED cases tied to their orders |
| --- | --- | --- | --- |
| 7.3 | Extend admin endpoint from Task 5 similarly — full historical view across all statuses, additionally joined with matching audit\_logs entries (entity='returns', entity\_id=return\_id) for a complete decision trail | Admin sees full case history + who decided what, when, why | Integration test: admin history response includes audit trail entries per case |
| --- | --- | --- | --- |
| 7.4 | Apply consistent pagination (page/limit, default 20, per TRD §9) and status/date-range filters across all three endpoints, reusing the same query-param parsing utility already used elsewhere in the API (e.g., product/order listing) | Uniform filtering/pagination UX | Integration test: ?status=CLOSED&page=1&limit=20 behaves identically in shape across the three endpoints |
| --- | --- | --- | --- |
| 7.5 | Ensure response DTO includes: return status, reason, image count/thumbnails, decision (seller/admin, whichever is final), refund status/refunded\_at (Task 6), timestamps — a single reusable ReturnHistoryItemDto | One DTO shape shared by all three endpoints | Code review: no per-role duplicate DTOs; role only changes the query filter |
| --- | --- | --- | --- |
| 7.6 | Swagger annotations for all three history endpoints | Visible in /api-docs | Manual check |
| --- | --- | --- | --- |

### Common Errors

-   Building three separate response shapes per role instead of one shared DTO with role-based filtering — increases maintenance burden and risks drift.
-   Re-querying/duplicating audit\_logs data into a new "returns audit" table — reuse the existing immutable audit table (Doc 5 §4.24) directly via join/filter.

### Engineering Decisions

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| DTO strategy | Single ReturnHistoryItemDto reused across buyer/seller/admin endpoints, differing only by repository-level ownership filter | Matches TRD §3 Service-layer/Repository conventions; avoids duplicated response-shaping logic |
| --- | --- | --- |
| Admin audit join | Query-time join against existing audit\_logs, no new table | audit\_logs is already the system of record (Doc 5 §6/§10) for privileged actions; duplicating it would violate the single-immutable-log principle |
| --- | --- | --- |

### Artifacts Produced

-   GET /api/v1/returns, GET /api/v1/seller/returns/history, GET /api/v1/admin/returns/history — final read surfaces for this feature; no further tasks build on these within Feature 10.
-   ReturnHistoryItemDto — the terminal, most complete DTO of the feature; referenced by any future front-end work (out of scope here per playbook rules — backend only).

### Definition of Done

-   Buyer/seller/admin each see correctly ownership-scoped, full-lifecycle return history
-   Refund status appears inline (from Task 6) without extra client round-trips
-   Admin history includes joined audit-trail entries
-   Pagination/filtering consistent across all three endpoints
-   Swagger documents all three
-   Test coverage ≥80% maintained for new code

## Validation & Testing

| **Layer** | **Coverage Target** | **Tooling (reused)** | **Key Scenarios** |
| --- | --- | --- | --- |
| Unit | State machine transitions, eligibility service, DTO validation | Jest (reused, Feature 1 setup) | Every legal/illegal transition; window-expired; duplicate-return; reject-without-reason |
| --- | --- | --- | --- |
| Integration | All endpoints (buyer/seller/admin), ownership, error codes | Jest + Supertest, ephemeral Postgres/Redis (reused CI setup, TRD §23) | Full happy path request→images→seller-approve→pickup→refund→history; full reject→appeal→admin-reject→closed path |
| --- | --- | --- | --- |
| E2E | Cross-role full lifecycle | Reuse Feature 7/Payments E2E harness pattern (mock adapters incl. simulated failures) | Buyer submits → seller approves → mock courier books → mock refund confirms → buyer sees REFUND\_ISSUED in history |
| --- | --- | --- | --- |
| Security | AuthZ/ownership on every returns endpoint | Reused RBAC/ownership test harness | Buyer cannot access another buyer's return; seller cannot access another seller's order's return; support is read-only on admin endpoints |
| --- | --- | --- | --- |
| Regression | Immutability of payments/settlements untouched by this feature | Existing Payments Feature test suite (rerun, not modified) | Confirm no new code path writes to payments/settlements directly |
| --- | --- | --- | --- |

### Coverage Gate

-   ≥80% backend coverage maintained for all new returns module code (REQ-NF-Quality-003), verified in CI via existing Istanbul/c8 gate — no new tooling.
-   Zero lint/type errors (ESLint/tsc --noEmit, reused CI job).
-   OWASP-relevant checks folded into Feature 11 (system hardening) per Implementation Plan §Phase 11 — not repeated here, referenced only.

## Consistency Review, Assumptions, Documentation Gaps

### Consistency Review vs Features 0–10

| **Check** | **Result** |
| --- | --- |
| No new database tables/columns/enums introduced | ✅ Pass — only returns, return\_images, disputes (Doc 5 §4.15–4.17) used, unmodified |
| --- | --- |
| No new routing conventions introduced | ✅ Pass — follows /api/v1/<resource> (TRD §9); nested under /seller/ and /admin/ mirrors existing role-scoped route conventions |
| --- | --- |
| No new authentication mechanism introduced | ✅ Pass — reuses Feature 1's authenticate → authorize → ownership chain throughout |
| --- | --- |
| No duplicate shared components rebuilt | ✅ Pass — Object Storage Adapter (Feature 4), Notification system (Feature 9), Payments Feature, Order Management (Feature 7), response envelope, error hierarchy, Repository pattern, validation framework all reused, not rebuilt |
| --- | --- |
| Return lifecycle matches documented state machine | ✅ Pass — INITIATED→IMAGES\_SUBMITTED→MANUAL\_REVIEW→{APPROVED→PICKUP\_BOOKED→REFUND\_ISSUED}|{REJECTED→(appeal)→UNDER\_DISPUTE→CLOSED} matches Doc 5 §3 enum and PRD §12.4/App Flow §6 exactly |
| --- | --- |
| AI automation correctly deferred | ✅ Pass — UNDER\_AI\_REVIEW state reserved but never entered in MVP, matching D3/PRD explicitly; stub interface only (Task 3.6) |
| --- | --- |
| Refund handling respects immutability rules | ✅ Pass — no direct writes to payments/settlements; all refund actions routed through the existing Payments Feature (REQ-NF-Safety-007, REQ-F-COD-004) |
| --- | --- |
| Admin decision finality respected | ✅ Pass — BR-008 enforced; no appeal loop after admin decision (Task 5.5) |
| --- | --- |

**No conflicts found with Features 0–10 or with the PRD/TRD/App Flow/Schema/Implementation Plan.**

### Assumptions Made (flagged, not invented as fact)

1.  **Payments Feature refund-trigger contract** (Task 6.1): the exact method signature/sync-vs-async nature of the existing Payments Feature's refund trigger is not specified in the five source documents at the field/API level. This playbook assumes an async, idempotency-key-based interface consistent with REQ-F-Payment-004's general idempotency discipline. **Action for implementers:** confirm against the actual Payments Feature code before building Task 6.
2.  **Refund trigger timing** (Task 6.3): the documents state refund occurs "within 24h of return approval" (REQ-F-Payment-007) but do not explicitly state whether the trigger fires at APPROVED or PICKUP\_BOOKED. This playbook assumes PICKUP\_BOOKED (post-approval, pre-physical-return) based on App Flow §6.7's sequencing ("Approved return → refund within 24h" listed after the approval step, and pickup being the natural approval side-effect per Task 4/5). Flagged as an assumption, not a documented certainty.
3.  **Seller "escalation" mechanism** (Task 4.6): the source docs describe an "Escalate to admin" action (SCR-S07) but do not define whether this is a distinct state or simply Admin's ability to view any MANUAL\_REVIEW case. This playbook assumes the latter (no new enum state) to respect the frozen schema. If the intended UX requires a distinct escalated sub-state, that would require a schema change and must be raised as a formal conflict before implementation.
4.  **Admin approval reusing seller approval logic** (Task 5.4): assumed correct and intended (both should trigger identical downstream effects), since no document states admin approval should behave differently from seller approval in terms of pickup/refund side-effects.

### Unresolved Documentation Gaps

1.  **Return-image retention/deletion policy after CLOSED:** Doc 5 §4.16 defines return\_images with no deleted\_at, implying permanent retention, but no source document explicitly states a retention period or deletion policy for return images post-closure (unlike tracking\_events' explicit ≥12-month rule, REQ-F-Track007). Recommend a future documentation addendum.
2.  **Exact wording/i18n source for seller/admin rejection reasons:** PRD requires "plain-language reason" (REQ-F-Return-006) but no document specifies whether this is free-text (as currently implemented, Task 4.3/5.3) or a controlled set of reason codes mapped to i18n keys (as TRD §14 implies for other user-facing messages — "user-facing messages are i18n keys, never raw exceptions"). This playbook implemented free-text reason per the schema (disputes.admin\_reason TEXT, returns has no dedicated reason-code column), but this is a minor inconsistency worth flagging for the UI/UX Brief (Doc 4, not provided in this session) to resolve.
3.  **Return window edge case at exactly 14 days/24:00 boundary:** not specified by any source document (timezone handling, inclusive/exclusive boundary). Implementers should default to now() - delivered\_at <= return\_window\_days \* 24h (inclusive) pending clarification.

*End of Playbook — Feature 10: Returns & Refunds. All three responses (Tasks 1–7, Validation & Testing, Consistency Review) are now complete in this single document. No section was rewritten after its initial generation.*