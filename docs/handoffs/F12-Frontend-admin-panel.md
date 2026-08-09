# Handoff — F12 Admin Panel (Frontend)

**Status:** Complete — 2026-08-09. Built against `F12-admin-panel-backend.md` (already real,
701/701 backend tests, 70/70 suites). `tsc --noEmit` and `vite build` both clean. Login/RBAC
verified end-to-end against a real running stack this session (see "Verified" below), including
creating the first ADMIN/SUPPORT accounts this codebase has ever had.

## Screens built

| Route | Screen |
|---|---|
| `/admin` | SCR-AD01 — Dashboard: KPI tiles (GMV, active users, adapter uptime, %-change), alert feed (manual-logistics orders, stuck payments, open disputes, fraud-flagged sellers) |
| `/admin/users` | SCR-AD02 — User Management: role/status filter, blind-index exact search, detail drawer, suspend/ban/reactivate |
| `/admin/moderation` | SCR-AD05 — Product Moderation: status-filterable queue, detail drawer, takedown/restore |
| `/admin/reports` | Extended SCR-AD01 report views: GMV trend (date/seller/category grouping), order-vs-return trend, seller-performance table with BR-006 fraud-flag tags |
| `/admin/returns`, `/admin/returns/:id` | Returns Management — links into Feature 10's own admin-review backend (queue + case detail + Approve/Reject) |
| `/admin/config` | SCR-AD06 — Config Panel: commission rate, courier weights, return window, min order value (mandatory-reason writes); `returns_confidence_threshold` shown read-only |

SCR-AD03 (Payment Management) and SCR-AD07 (Broadcast Tool) are **not in this feature's scope at
all** — confirmed against the module doc's own task list, not just "not built yet." SCR-AD03 has
no backend endpoints anywhere in this codebase; SCR-AD07 is explicitly `[R1.1]`/Future.

## Key files

`apps/frontend/src/features/admin/`: `adminApi.ts` (query/mutation fns for all 12 admin
endpoints + the 3 reused Feature 10 admin-returns ones), `adminErrors.ts`, `AdminLayout.tsx`
(nav shared by Admin/Support), `AdminDashboardPage.tsx`, `UserManagementPage.tsx`,
`ProductModerationPage.tsx`, `ConfigPanelPage.tsx`, `ReportsPage.tsx`, `AdminReturnsPage.tsx`,
`AdminReturnDetailPage.tsx`. Plus a new `admin` i18n namespace (`locales/en|ur/index.ts`,
registered in `app/i18n.ts`), 4 new `common:nav` keys (`adminUsers`/`adminModeration`/
`adminReports`/`adminConfig`), and the full `/admin/*` route tree in `app/router.tsx` (replacing
the old `/admin/*` → `AdminPlaceholder` catch-all, which is kept as the tree's own fallback for
anything unmatched).

## RBAC handled the way the backend actually enforces it, not at the route level

Every admin read endpoint is `authorize('ADMIN', 'SUPPORT')`; only mutations require
`requireAdminWrite()` (Admin-only, distinct `403 ADMIN_WRITE_REQUIRED` for Support). Mirrored
exactly: `ProtectedRoute` for the whole `/admin/*` tree allows both roles, and each page
individually reads `useAuthStore().user?.role === 'ADMIN'` to hide write buttons (Suspend/Ban/
Reactivate, Takedown/Restore, Config Save, Approve/Reject) and show a shared `supportReadOnly`
banner instead — Support never gets routed away from a page, only loses the actions on it, same
shape as the backend's own gate.

## Reuse, not rebuilt

- `DateRangeFilter`/`toRangeParams` (Feature 11) imported directly into
  `AdminDashboardPage.tsx`/`ReportsPage.tsx` — `AdminRangeParams` and `AnalyticsRangeParams` are
  the identical `{range,startDate,endDate}` shape, so this is a straight reuse, not a second
  date-range picker.
- `ReturnStatusTag` (Feature 10) reused in both `AdminReturnsPage.tsx` and
  `AdminReturnDetailPage.tsx` instead of a second status-color map.
- `AdminReturnDetailPage.tsx`'s decision flow deliberately **differs** from the Seller's own
  `SellerReturnDetailPage.tsx`: `adminDecisionSchema` makes `reason` mandatory on **both**
  approve and reject (BR-008/REQ-F-Admin-003), not just reject — the confirm modal always
  requires text before the button enables, on either decision.

## A real, standing gap found this session (not fixed — out of any feature's scope)

**"Contact support" has no backing mechanism anywhere in this codebase.** It appears twice in
App Flow (`ACCOUNT_SUSPENDED`'s login message, and a button on the Buyer tracking page) as literal
UI copy, but no source document — PRD, TRD, or Schema — ever defines what it does. Confirmed via
schema grep: no `support_tickets`/conversation table, no support email/phone anywhere in config.
Not invented a fix for it here — flagging it the same way this project flags every other
unspecified-mechanism gap, since building one (new table, endpoint, admin queue) would be
feature-sized work no numbered feature currently owns.

## Dev/test tooling added (not part of the app)

`apps/backend/scripts/seed-admin-users.ts` — this codebase had **zero** ADMIN/SUPPORT accounts
before this session (confirmed via direct DB query: 0 rows for `role IN ('ADMIN','SUPPORT')`).
There is no public registration path for either role by design (`packages/shared/src/schemas/
auth.ts`'s register schema only accepts `BUYER`/`SELLER`) — mirrors `tests/helpers/factories.ts`'s
`createUserRow()`: a plain `User` row, `ACTIVE`, properly `encryptField()`-encrypted email (not a
plaintext shortcut that would break `resolveRecipient()` later, the exact mistake
`seed-return-test.ts` made and had to patch in Feature 10's session). Creates:
- Admin: `test-admin@karobarai.test` / `Test1234!`
- Support: `test-support@karobarai.test` / `Test1234!`

Both logins verified live via `curl` against `/api/v1/auth/login`, confirmed correct `role` claim
in the returned JWT for each.

## One pre-existing bug fixed in passing (not this feature's own new code, but exposed by it)

`/notifications`'s route only allowed `['BUYER','SELLER','ADMIN']` — missing `SUPPORT`. Never
surfaced before because no Support account existed to hit it. `AdminLayout.tsx` renders the same
`NotificationBell` (Feature 9) for Support as for Admin, so left unfixed a Support user clicking
it would have 403'd. Added `SUPPORT` to that route's `allowedRoles` in `app/router.tsx`.

## Environment notes (same as F10/F11's handoffs — not new this pass)

No Docker on this dev machine; Postgres (18) and Redis (via Memurai) run as native Windows
services. MinIO runs as a plain background `minio.exe` process, not a registered service — does
not survive a reboot, needs restarting each session until `install-minio-service.ps1` is run
elevated.

## Known limitations / not built

- SCR-AD03 (Payment Management) and SCR-AD07 (Broadcast Tool) — out of scope, see above.
- "Contact support" mechanism — standing gap, see above, not this feature's to invent.
- No live/push updates on any admin page (no Socket.IO channel for admin data) — same as
  Analytics, widgets only refetch on filter change or manual reload.
- `AdminReturnDetailPage.tsx` shows the audit trail Feature 10's backend already returns for
  admin reads, but has no separate "Escalate" action — escalation is a Seller-side action
  (Feature 10's own `SellerReturnDetailPage.tsx`), not something Admin does to their own queue.
- Revenue-derived figures (GMV) will read low/zero against current dev data — real numbers exist
  now (Settlement Engine gap-closure, 2026-08-04), but nothing in the current seeded dataset has
  cleared the 14-day return window yet.
