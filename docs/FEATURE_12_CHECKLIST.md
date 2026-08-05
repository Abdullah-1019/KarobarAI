# Feature 12 — Admin Panel: Sign-off Checklist

Backend scope only (`apps/backend`) — SCR-AD01/AD02/AD05/AD06 frontend screens are a separate,
not-yet-started deliverable. Full narrative contract: `docs/handoffs/F12-admin-panel-backend.md`.
Progress-log entry: `docs/DoneTillNow.md`.

## Task 1 — Admin Foundation

- [x] `admin/` module scaffolded per TRD §12 layout (`dashboard/`, `users/`, `moderation/`,
      `reports/`, `config/` submodules, shared `admin.middleware.ts`/`admin.mutation.ts`).
- [x] `requireAdminWrite()` — layered onto every mutating route in addition to the router-level
      `authorize('ADMIN', 'SUPPORT')` gate; Buyer/Seller blocked everywhere (tested, 403).
- [x] Support blocked from every write route with a distinct `403 ADMIN_WRITE_REQUIRED` (tested,
      separately from the generic `FORBIDDEN` a Buyer/Seller gets).
- [x] `runAuditedMutation()` proven atomic — a simulated audit-write failure rolls back the paired
      mutation (tested: user status unchanged, zero audit rows, same pattern as Feature 10 Task 5.6).
- [x] "AdminScopeRepository" ownership bypass implemented as plain functions with no ownership
      filter (no class hierarchy — matches Feature 11's identical, already-established deviation).
- [x] `ADMIN_WRITE_REQUIRED`/`REASON_REQUIRED`/`INVALID_CONFIG_VALUE`/`USER_NOT_FOUND`/
      `CONFIG_KEY_NOT_FOUND`/`CONFIG_KEY_NOT_WRITABLE`/`PRODUCT_INVALID_MODERATION_STATE`
      registered in `packages/shared`.
- [x] Zero Prisma schema drift; `tsc --noEmit` clean.

## Task 2 — Dashboard

- [x] `platformGmv()` sums settlements across every seller (tested: two sellers' settlements both
      counted, matches the combined total).
- [x] `pctChangeVsPrevious` null (not a divide-by-zero crash) when the previous period is zero
      (tested).
- [x] `activeUsers` counts distinct Buyer/Seller accounts with `last_login_at` in range (tested);
      Assumption #1 flagged, unconfirmed against a source document.
- [x] `adapterUptime` reuses the existing `/ready` Postgres+Redis check (`checkDependencies()`),
      not new instrumentation — documented as an instantaneous snapshot, not true rolling uptime.
- [x] Alert feed: `manualLogisticsOrders`, `stuckPayments` (>24h `PENDING`, tested for both the
      aged-and-counted and recent-and-excluded cases), `openDisputes`, `fraudFlaggedSellers`
      (`fraud_rate_30d >= 0.20`) — all computed live, zero new persisted table (tested).
- [ ] **Frontend not built**: SCR-AD01 KPI tiles/alert feed.

## Task 3 — User Management

- [x] Search filters by role/status; blind-index exact-match search by phone or email (tested for
      both, decoy non-matching users correctly excluded).
- [x] Detail view includes seller-specific (`storeName`, `fraudRate30d`, `onboardingCompletedAt`,
      `commissionRate`) or buyer-specific (`addressCount`) extension data (tested for both).
- [x] Suspend/ban require a mandatory reason; missing reason → 400 (tested).
- [x] Suspend/ban immediately revoke active sessions — reuses Feature 1's existing Redis
      denylist/`revokeAllRefreshTokensForUser` verbatim (tested live: a suspended user's next
      authenticated request 401s).
- [x] Full suspend→reactivate→ban lifecycle produces exactly 3 audit rows and the correct final
      status (tested).
- [x] Banning a seller with open (non-terminal) orders surfaces `openOrdersCount` without
      blocking the ban (tested); omitted when zero or when the target is a buyer (tested both).
- [x] Support blocked from all three write endpoints; read endpoints accessible to both roles.
- [ ] **Frontend not built**: SCR-AD02 User Management.

## Task 4 — Product Moderation

- [x] Moderation queue lists products across every seller, filterable by status (tested) — no
      `reported` filter exposed (Documentation Gap #1: no reporting mechanism exists anywhere).
- [x] Takedown/restore require a mandatory reason; missing reason → 400 (tested).
- [x] Takedown sets `status=REMOVED` only — every other product field byte-identical before/after
      (tested directly against title/price/sellerId).
- [x] Restore returns to the **pre-takedown status**, sourced from the takedown's own audit
      snapshot — tested both the `LIVE→REMOVED→LIVE` and `DRAFT→REMOVED→DRAFT` cases (the exact
      edge case Task 4.4 names).
- [x] Taken-down products excluded from the storefront search (`idx_products_live`, tested via a
      live call to Feature 5's `/products/search`).
- [x] Invalid-state guards: takedown on an already-removed product → 422; restore on a
      not-removed product → 422 (both tested).
- [x] Every takedown/restore produces exactly one `audit_logs` row (`action=MODERATION`, tested).
- [x] Support blocked from write endpoints (403 `ADMIN_WRITE_REQUIRED`, tested).
- [ ] **Frontend not built**: SCR-AD05 Product Moderation.

## Task 5 — Reports & Returns Management

- [x] `gmv-trend` default and `groupBy=seller` both sum to the same platform total as Task 2's
      `platformGmv()` (tested directly).
- [x] `groupBy=category` carries an explicit `basisNote` — a real, documented gap in the module
      doc itself (settlement has no per-item breakdown; this basis is realized order-item
      revenue, not settlement net) — never silently inconsistent (tested: note present only on
      `groupBy=category`, absent on the default response).
- [x] `order-return-trend`'s `returnRate` is zero-guarded per bucket (tested: correct % and a
      finite value on every zero-order day).
- [x] `seller-performance` correctly flags `WARNING` (≥20%) and `AUTO_SUSPEND` (≥40%) per BR-006
      (tested all three tiers); `fulfilmentRate` zero-guarded (tested).
- [x] **Returns Management: zero new endpoints or return-decision logic introduced** — confirmed
      by grep (`tests/admin/reuseAudit.test.ts`); Feature 10's `/api/v1/admin/returns*` remains
      the only router at that path (also grep-confirmed: exactly one mount in `server.ts`).
- [x] `fraud_rate_30d` never written by this feature anywhere (grep-audited) — always read
      directly from `seller_profiles`.
- [x] Both Admin and Support can read all three report endpoints; Buyer/Seller blocked.
- [ ] **Frontend not built**: extended SCR-AD01 report views, Returns Management navigation link.

## Task 6 — Platform Settings

- [x] All 5 seeded config keys readable via `GET /config`, with correct `writable` flags per key
      (tested: `returns_confidence_threshold` is `writable: false`, the other 4 are `true`).
- [x] `courier_weights` summing to 0.9 → 422 `INVALID_CONFIG_VALUE` (tested); summing to exactly
      1.0 → accepted (tested).
- [x] Config updates require a mandatory reason; missing reason → 400 (tested).
- [x] Every config change produces exactly one `audit_logs` row (`action=CONFIG_CHANGE`, tested).
- [x] `returns_confidence_threshold` PATCH rejected with `403 CONFIG_KEY_NOT_WRITABLE` even with a
      valid-looking value (tested).
- [x] An unknown config key → `404 CONFIG_KEY_NOT_FOUND` (tested).
- [x] A config change (`return_window_days`) is confirmed visible to an existing live consumer
      (Feature 10's return-eligibility check) without a deploy (tested end-to-end: shrinking the
      window makes a previously-eligible order immediately ineligible).
- [x] **Real gap found and documented, not fixed here**: `commission_rate_default` has zero live
      consumers anywhere in this codebase (`checkout.service.ts` reads
      `seller_profiles.commission_rate` instead) — editable via this endpoint but currently inert.
      See the handoff doc; out of scope to fix (would touch Auth's already-signed-off code).
- [x] Support blocked from PATCH; both roles can GET.
- [ ] **Frontend not built**: SCR-AD06 Config Panel.

## Task 7 — Validation & Testing

- [x] Integration suite: `tests/admin/foundation.test.ts`, `dashboard.test.ts`, `users.test.ts`,
      `moderation.test.ts`, `reports.test.ts`, `config.test.ts`, `reuseAudit.test.ts` — 95 new
      tests (see `docs/DoneTillNow.md` for the exact final count).
- [x] RBAC parity verified structurally across all 8 read endpoints (401/403/403/200 for
      no-token/Buyer/Seller/Admin+Support) and all mutating routes (Support → `ADMIN_WRITE_REQUIRED`).
- [x] Full reuse audit (grep-based, recorded below).
- [x] **A real test-isolation bug found by this feature's own tests, fixed**:
      `tests/helpers/reset.ts` never truncated `audit_logs` (no prior feature's audit tests
      needed it — all scoped by a fresh bigint `entityId` per run). Feature 12's `CONFIG_CHANGE`
      audits have `entityId: null` (`platform_config`'s PK is a string), so stale rows from
      earlier suite runs leaked into later assertions. Fixed by adding
      `prisma.auditLog.deleteMany()` to `resetDb()`.
- [x] This checklist file.

### Reuse audit — grep results (verbatim, `tests/admin/reuseAudit.test.ts`, all passing)

```
ad hoc audit_logs write outside runAuditedMutation: none found — all 3 mutating services use it
second session-revocation/denylist implementation: none — reuses auth.tokens.ts verbatim
new return-decision endpoints/logic introduced by this feature: none found
second /admin/returns router mounted: none — exactly one mount, Feature 10's own
fraud_rate_30d written anywhere in the admin module: none — always read, never assigned
product moderation update call touches price/title/description/sellerId: none — status only
adapterUptime built on new instrumentation instead of the existing /ready check: none — reused
new Prisma model added for this feature: none — users/seller_profiles/products/platform_config/audit_logs all pre-existing
```

## Documentation Gaps — final status

| # | Item | Status |
|---|---|---|
| 1 | TRD §24 adapter/health call-counters claimed pre-existing, don't exist | Resolved: `adapterUptime` reuses `/ready`'s reachability check as an instantaneous snapshot, documented as not a true rolling percentage |
| 2 | Product report/flag mechanism (module doc's own Assumption #4/Gap #1) | Unresolved by design — no `reported` filter exposed; moderation queue is all-products-filterable-by-status only |
| 3 | Seller-ban-with-open-orders reconciliation workflow (Assumption #2/Gap #2) | Unresolved — non-blocking `openOrdersCount` warning only, per the module doc's own chosen resolution |
| 4 | "Active users" definition (Assumption #1/Gap #3) | Unresolved — implemented as Buyer/Seller `last_login_at` in range, flagged for confirmation |
| 5 | `platform_config` cache-invalidation ownership across consumers (Task 6.4) | N/A here — confirmed no consumer caches config (Feature 10's return-window read is live); flagged in the module doc as a cross-feature concern, not this feature's to resolve |
| 6 | `gmv-trend`'s `groupBy=category` mixes two incompatible revenue bases (module doc's own unacknowledged gap) | Resolved by implementation + explicit `basisNote` field — not silently inconsistent |
| 7 | `commission_rate_default` has zero live consumers anywhere in this codebase | Found this pass, documented, not fixed (Auth/Feature 1's seller-activation flow is out of this feature's scope) |

## Test results

**95/95 new Feature 12 tests pass. Full backend suite: 701/701 tests, 70/70 suites**, confirmed
non-flaky across 2 consecutive full-suite runs. See `docs/DoneTillNow.md`'s Feature 12 entry for
the breakdown.

## Sign-off

Backend scope: **complete**. Frontend scope (SCR-AD01/AD02/AD05/AD06): **not started**.
