# Handoff — F10 Returns & Refunds (Frontend)

**Status:** Complete — 2026-08-09. Built against `F10-returns-refunds-backend.md` (already real,
525/525 backend tests). `tsc --noEmit` and `vite build` both clean. Unlike F8/F9, this one was also
**verified end-to-end against a real running stack** this session (see "Verified" below) — not
just typecheck/build.

## Screens built

| Route | Screen |
|---|---|
| `/orders/:id` (existing page) | "Return" action added to `OrderListPage.tsx`'s Buyer scope, gated on `returnEligible` |
| `/orders/:id/return` | SCR-B10 — 4-step Returns Wizard (eligibility → reason → photos → review/submit) |
| `/orders/:id/return/status` | SCR-B11 — status timeline, refund status, Appeal (when `REJECTED`) |
| `/seller/returns` | SCR-S07 — queue list, active/history toggle |
| `/seller/returns/:id` | SCR-S07 detail — photos, Approve/Reject (reason required on reject), Escalate |

SCR-AD04 (Admin Disputes Queue) deferred — no real admin frontend exists yet (Feature 12 is still
a placeholder); premature to build one admin screen ahead of the rest of that console.

## Key files

`apps/frontend/src/features/returns/`: `returnsApi.ts`, `returnsErrors.ts`, `ReturnStatusTag.tsx`,
`ReturnImageUploader.tsx` (mirrors `features/catalog/ProductImageManager.tsx` minus reordering),
`ReturnWizardPage.tsx`, `ReturnStatusPage.tsx`, `SellerReturnsPage.tsx`,
`SellerReturnDetailPage.tsx`. Plus a new `returns` i18n namespace (`locales/en|ur/index.ts`,
registered in `app/i18n.ts`), a "Returns" nav link in `features/seller/SellerLayout.tsx`, and 4 new
routes in `app/router.tsx`.

## Two real design gaps found, resolved before building (not backend bugs — spec/DTO gaps)

1. **`reason` has no canonical list** — App Flow's SCR-B10 implies a dropdown; `createReturnSchema`
   just takes free text (1–200 chars), no `ReturnReason` enum anywhere. Resolved with a frontend-
   only fixed set of common reasons (+ "Other" free text), submitted as plain text underneath — no
   backend change needed.
2. **`returnEligible` only exists on `OrderListItemDTO`, not `OrderDetailDTO`** (explicitly a
   "Buyer-list-only gate check" per its own code comment) — the Return entry point is the My Orders
   list only, matching the backend's own intent. Similarly, no `GET /returns?orderId=` filter exists
   — `ReturnStatusPage.tsx` resolves the return tied to an order by matching it in the buyer's own
   (small, personal) `GET /returns` list client-side, then fetching the real detail by returnId.
   Keeps the documented route (`/orders/:id/return/status`) intact.

## A third gap found only once real data was flowing (not caught by typecheck/build)

**The seller/admin's decision reason text is never persisted on the `Return` row or exposed in
`ReturnDetailDTO`.** `decision.service.ts` bakes `Reason: {reason}` directly into the
`RETURN_DECISION` notification message — it's not a DB column. `ReturnStatusPage.tsx` doesn't
fabricate a field that doesn't exist; instead it shows a hint pointing the buyer to the
Notification Center (Feature 9) where the actual reason text was delivered.

## Verified end-to-end this session (real backend, real data, not just build checks)

Walked the full flow against a running stack: Buyer wizard (reason → 3+ photo upload → submit) →
Seller queue → Approve → confirmed via direct DB inspection that the mock chain fires
automatically and correctly: `APPROVED → PICKUP_BOOKED (mock CourierAdapter.book()) →
REFUND_ISSUED (mock PaymentAdapter.refund())` — same "mock now, real later" pattern as every other
adapter in this codebase (Feature 16's job to swap in real providers, no Feature 10 logic changes
needed for that later). Also confirmed all 4 return-related notification types
(`RETURN_INITIATED`, `RETURN_UNDER_REVIEW`, `RETURN_DECISION`, `REFUND_ISSUED`) reach both parties
correctly once fed valid data (see bugs below).

## Bugs found and fixed during this testing pass (not this feature's own frontend code)

1. **`adapters/storage/live.ts`'s `ensureBucket()` caches a rejected promise permanently** — if
   MinIO is unreachable on the *first* upload attempt, every upload fails forever afterward (even
   once MinIO recovers) until the backend process restarts, because `this.bucketReady` is only
   ever assigned once (`if (!this.bucketReady)`), regardless of whether that assignment resolved
   or rejected. Not patched (backend scope) — flagged for Abdullah alongside the `confirmPayment()`
   gap from the F8 handoff. Workaround for now: restart the backend after any MinIO outage.
2. **My own test-fixture bug, not application code:** `scripts/seed-return-test.ts` originally
   stored the seeded accounts' `email` as plaintext instead of `encryptField(email)` (real
   registration in `auth.service.ts` always encrypts it). Every notification job for those accounts
   failed at `resolveRecipient()`'s `decryptField()` call — silently killing all channels, not just
   one. Fixed in the script; the two existing seeded accounts were patched in place
   (`scripts/fix-seed-user-encryption.ts`) and their failed queue jobs retried
   (`scripts/retry-failed-notifications.ts`).
3. **Environment note, not a code bug:** this dev machine has no Docker installed at all (verified —
   no registry entry, no install directory, no Windows service); Postgres/Redis are native installs
   here. MinIO has no such native fallback in the README's documented setup, so it was run as a
   standalone `minio.exe` for this session. Worth deciding on a durable answer (proper Docker
   install, or a documented native-MinIO path) rather than repeating this per session.

## Dev/test tooling added (not part of the app)

`apps/backend/scripts/`: `seed-return-test.ts` (creates a fresh Buyer/Seller/`DELIVERED` order —
safe to re-run anytime a new return-eligible order is needed), `inspect-returns.ts`,
`inspect-notifications.ts`, `inspect-queue.ts` (read-only diagnostics), `fix-seed-user-encryption.ts`,
`retry-failed-notifications.ts` (one-time repairs, already applied, safe to leave/reuse). None of
these are imported by or affect the running app.

## Known limitations / not built

- SCR-AD04 (Admin) deferred to Feature 12's frontend pass.
- No live/push updates on the return status page (no return-specific Socket.IO channel exists,
  unlike Feature 8's `/tracking` namespace) — status changes require a manual refresh.
- Return-pickup booking has no retry/fallback on the backend (per its own handoff) — a real
  courier failure leaves the return at `APPROVED` for manual attention; the frontend doesn't
  special-case this stuck state differently from a normal "not yet decided" view.
