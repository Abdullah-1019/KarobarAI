# Handoff — F12 Admin Panel (Backend → Frontend)

**Status:** Backend complete — 2026-08-04. New `admin/` module (`dashboard/`, `users/`,
`moderation/`, `reports/`, `config/` submodules, plus shared `admin.middleware.ts`/
`admin.mutation.ts`). Full backend suite green: **701/701 tests, 70/70 suites**, confirmed
non-flaky across 2 consecutive full-suite runs. Zero new Prisma models/migrations — every table
this feature touches (`users`, `seller_profiles`, `buyer_profiles`, `products`, `settlements`,
`platform_config`, `audit_logs`) already existed.

**This feature's own module doc assumes more prior infrastructure exists than actually does —
read the whole doc before building against it, not just the endpoint list. Same pattern as every
prior feature this session — this time correctly identified as complete on first read (Tasks 1–6
+ Validation + Consistency Review all genuinely present across 3 appended "Response" batches),
learned directly from the Feature 10→11 mistake logged in `docs/DoneTillNow.md`.**

---

## Real gaps found and resolved before building

1. **`AuditedMutation` didn't need reinventing — Feature 10's `createAuditLog()` (Task 5.6's own
   gap closure) already accepted an optional transaction client.** Built `admin.mutation.ts`'s
   `runAuditedMutation()` as a thin wrapper: `prisma.$transaction(async (tx) => { await mutate(tx);
   await createAuditLog(..., tx); })`. Every privileged write in this feature (suspend/ban/
   reactivate, takedown/restore, config change) goes through this one function.
2. **Session revocation needed zero new code.** `revokeAllRefreshTokensForUser(userId, publicId)`
   already existed in `auth.tokens.ts` — literally comment-flagged "admin suspend/ban later" when
   Auth (Phase 3) built it. `users.service.ts` imports it directly (same deep cross-module import
   precedent `profile.service.ts`'s change-password flow already established).
3. **`writeGuard` needed a genuinely new, small piece**: the module doc wants a distinct
   `403 ADMIN_WRITE_REQUIRED` for "you're Support, this write needs Admin" vs. the generic
   `403 FORBIDDEN` a Buyer/Seller gets for "you can't see this surface at all." Built
   `admin.middleware.ts`'s `requireAdminWrite()` — a few lines, layered onto every mutating route
   in addition to the router-level `authorize('ADMIN', 'SUPPORT')` gate (same composition pattern
   Feature 10's `POST /admin/returns/:id/decision` already used for its own Admin-only write).
4. **No adapter/dependency-uptime counter infrastructure exists anywhere** — the module doc's
   Task 2 dependency line claims "TRD §24 adapter/health counters... already implemented per
   Implementation Plan Phase 14." Confirmed false (grepped for `uptime`/`successCount`/
   `failureCount`/`adapterSuccess` across `apps/backend/src` — zero hits); only `/health` (static)
   and `/ready` (binary Postgres+Redis reachability, no history) exist. Building real adapter
   call-counters would mean instrumenting every mock adapter across Features 6/7/8/9/10's
   already-signed-off files — disproportionate for one KPI tile. Resolved by extracting `/ready`'s
   existing check into `core/health/checkDependencies.ts` (used by both `/ready` and the new
   dashboard KPI) and reporting `adapterUptime` as an **instantaneous reachability snapshot**
   (0/50/100), not a true rolling percentage. Documented as a known limitation, not silently
   passed off as the real thing.

## A real bug this feature's own tests caught: stale `audit_logs` rows leaking across test runs

Every prior feature's audit-row tests scoped their assertions by a fresh `entityId` each test run
(a new `bigint` order/return/product ID every time), so `tests/helpers/reset.ts` never needed to
truncate `audit_logs` between tests — old rows were always naturally excluded by the `entityId`
filter. Feature 12's config-change audits are the first to break that assumption:
`platform_config`'s primary key is a string (`config_key`), not a `bigint`, so
`config.service.ts`'s `entityId` is always `null` for every `CONFIG_CHANGE` row — there's no
per-test discriminator. Running the admin test suite repeatedly surfaced old `CONFIG_CHANGE` rows
from earlier runs leaking into a later run's assertions. Fixed by adding
`await prisma.auditLog.deleteMany();` to `resetDb()` (`tests/helpers/reset.ts`) — audit_logs now
resets between every test like every other table, closing a latent test-isolation gap that simply
never had a way to surface before this feature.

## Task 1 — Admin Foundation, in practice

- `admin.middleware.ts`'s `requireAdminWrite()` — see gap #3 above.
- `admin.mutation.ts`'s `runAuditedMutation()` — see gap #1 above.
- **"AdminScopeRepository base class"** (the module doc's literal OOP-flavored wording): not
  built as a class hierarchy — every admin sub-repository (`dashboard.repository.ts`,
  `users.repository.ts`, `moderation.repository.ts`, `reports.repository.ts`,
  `config.repository.ts`) is a set of plain exported functions that simply omit the seller/buyer
  ownership filter, same shape as every other repository in this codebase (Feature 11's own
  `analytics.repository.ts` made the identical deviation for the identical reason).

## Task 2 — Dashboard

- `platformGmv()` deliberately duplicates Feature 11's `sumSettledRevenue()` query shape rather
  than importing it directly — that function is sellerId-scoped by signature (Doc 5 §9's
  ownership rule for the seller-facing endpoint it serves); this is the explicit ownership-bypass
  version. Same conscious minimal-duplication choice Feature 10's `returns.service.ts` already
  made for a comparably small (~5-line) predicate.
- `activeUsers` (Task 2.2/Assumption #1): no source document defines "active users" precisely.
  Implemented as distinct `BUYER`/`SELLER` accounts (Admin/Support logins aren't a platform-
  activity signal) with `last_login_at` in the selected range. Flagged, not silently assumed.
- `adapterUptime`: see gap #4 above.
- Alert feed (`GET /dashboard/alerts`) computed live every request, never persisted (Common
  Errors' explicit warning against a new mutable "alerts" table): `PENDING_MANUAL_LOGISTICS`
  order count (Feature 7), payments `PENDING` for >24h (a self-contained definition — the module
  doc's reference to "Feature 10 Task 6's refund-pending pattern" doesn't literally exist as
  reusable code, Feature 10's refund is synchronous/immediate), `MANUAL_REVIEW`/`UNDER_DISPUTE`
  return counts (Feature 10), and `fraud_rate_30d >= 0.20` seller counts (BR-006).

## Task 3 — User Management

- Search (Task 3.1) is a **blind-index EXACT match only** — `phoneBidx`/`emailBidx` equality,
  never a ciphertext scan (Doc 5 §4.1). This is a real, permanent limitation: an admin searching
  "030012" (a partial number) will find nothing; only the complete, correctly-normalized
  phone/email matches. No fuzzy/partial search over encrypted PII is possible without a different
  indexing strategy (out of this feature's scope — the schema is frozen).
- Suspend/ban/reactivate share one `changeUserStatus()` internal helper (audit + optional session
  revocation), rather than three near-duplicate implementations — reactivate never revokes
  sessions (nothing to revoke; the account had none while suspended/banned).
- Ban-with-open-orders (Task 3.6/Assumption #2): a **non-blocking warning**
  (`openOrdersCount` in the response), ban still proceeds. No source document defines what a
  "reconciliation workflow" would actually do (who processes stuck orders, whether buyers are
  auto-refunded) — inventing one would be exactly the kind of unspecified business logic this
  project has consistently declined to guess at.
- Reactivation's `reason` is optional (Task 3.5/Assumption #3) — only suspend/ban's mandatory-
  reason language appears in REQ-F-Admin-003.

## Task 4 — Product Moderation

- Takedown/restore write **only** the `status` column — enforced at the repository method
  signature (`updateProductStatus(tx, productId, status)` accepts nothing else), so it's
  structurally impossible to smuggle a seller-authored field into a moderation write.
- Restore targets the **pre-takedown status**, sourced from the takedown's own `audit_logs.before`
  snapshot (`findLastTakedownAudit()`) — never unconditionally `LIVE`. A `DRAFT` product taken
  down restores to `DRAFT`, tested directly (the exact edge case Task 4.4 names).
- **"Reported/flagged" queue mechanism (Task 4.1/Assumption #4/Documentation Gap #1): does not
  exist anywhere in this codebase** — no table, no buyer-facing "report this listing" flow. Rather
  than expose a `reported` query parameter that would silently do nothing, the moderation queue is
  exactly what's real: **all products, filterable by status only**, across every seller. This
  matches the module doc's own Assumption #4 literally, and is called out again here so a future
  session doesn't rediscover it as a surprise.

## Task 5 — Reports & Returns Management

- **Returns Management: zero new endpoints, confirmed by grep** (`tests/admin/reuseAudit.test.ts`)
  — `/api/v1/admin/returns*` is still exclusively Feature 10's own router; this feature only
  verified RBAC parity (already correct) and does not touch return-decision logic anywhere.
- `gmv-trend`'s default (by date) and `groupBy=seller` shapes both extend Task 2.1's exact
  `SUM(net) OVER settlements` query with an added `GROUP BY` — both sum consistently to the
  platform GMV total (tested directly).
- **`groupBy=category` is a genuine, real gap in the module doc itself**, not just an
  implementation shortcut: `Settlement` has no per-item breakdown (one row per order, not per
  `order_item`), so a category-level split of *settled net revenue* isn't representable in the
  current schema at all. The module doc asks for one `groupBy` parameter spanning two
  incompatible revenue bases without acknowledging the mismatch. Resolved by implementing
  `groupBy=category` on the same **realized order-item revenue** basis Feature 11 Task 3 already
  uses for its own category breakdown — a genuinely different number from settlement-based GMV.
  The response carries an explicit `basisNote` field when `groupBy=category` is used, so this
  isn't a silent inconsistency a frontend developer could miss.
- Seller-performance's `fraudFlag` (BR-006: 20% warning / 40% auto-suspend) is **visibility only**
  — this feature does not implement automatic seller suspension when a seller crosses 40%; that
  would be a distinct Admin write action outside Task 5's explicitly read-only Reports scope.
- `fraud_rate_30d` is always read directly from `seller_profiles`, never recomputed here (Task 5's
  own Engineering Decision) — grep-audited that no admin code ever writes it.

## Task 6 — Platform Settings

- `INVALID_CONFIG_VALUE` (422) and `REASON_REQUIRED`/`ADMIN_WRITE_REQUIRED` needed to be genuine,
  distinct error codes per the module doc's own Verify columns, not the generic `400
  VALIDATION_ERROR` this codebase's Zod `validateBody` pipeline always emits (the same code
  Feature 10's own mandatory-reason Zod refinements settle for). `courier_weights`'
  sum-to-1.0-within-tolerance check is a genuine cross-field business rule Zod's generic 400
  doesn't fit well, so it's a manual service-layer check (`validateConfigValue()`) throwing
  `BusinessRuleError(..., 'INVALID_CONFIG_VALUE')` directly — 422, matching the doc literally.
  `reason` mandatory-field checks stayed on the existing Zod pipeline (generic 400
  `VALIDATION_ERROR`, same as Feature 10's own choice) rather than building bespoke per-field
  code plumbing that no other feature in this codebase has.
- `returns_confidence_threshold` is exposed **read-only** in `GET /config` and rejected (`403
  CONFIG_KEY_NOT_WRITABLE`) on `PATCH` (Task 6.5) — its consuming feature (R1.1 ReturnsAI
  automation) isn't built yet; making it writable now would configure a control with no effect.
- **A real, previously-unused gap discovered while implementing this task**: `platform_config.
  commission_rate_default` is seeded and now admin-editable via this feature's generic
  `GET`/`PATCH /config`, but **no code anywhere in this codebase actually reads it** —
  `checkout.service.ts`'s `commissionRateSnapshot` comes from `seller_profiles.commission_rate`
  (a per-seller column, defaulting `0.0500` via the Prisma schema itself), never from
  `platform_config`. Changing `commission_rate_default` through this feature's new endpoint will
  have **zero live effect** on anything. This is a genuine, standing gap in Auth's own
  seller-activation flow (Phase 3) — it should read `platform_config.commission_rate_default` at
  `SellerProfile` creation time instead of relying on the column's hardcoded schema default — not
  something this feature invents a fix for (would mean touching Auth's already-signed-off code
  for a business-parameter wiring decision outside this feature's own scope). Task 6.4's own
  "confirm a config change is visible to an existing consumer" requirement is satisfied instead
  using `return_window_days` (a real, live-read consumer via Feature 10's eligibility check,
  tested directly), not this one.

## Endpoints

| Method + Path | RBAC | Notes |
|---|---|---|
| `GET /api/v1/admin/dashboard/kpis` | Admin+Support | `{gmv, activeUsers, adapterUptime, pctChangeVsPrevious}` |
| `GET /api/v1/admin/dashboard/alerts` | Admin+Support | `{manualLogisticsOrders, stuckPayments, openDisputes, fraudFlaggedSellers}` |
| `GET /api/v1/admin/users` | Admin+Support | role/status filter, blind-index exact search |
| `GET /api/v1/admin/users/:id` | Admin+Support | full detail incl. role-specific extension |
| `POST /api/v1/admin/users/:id/suspend` \| `/ban` \| `/reactivate` | **Admin only** | reason mandatory (suspend/ban), audited, session-revoking (suspend/ban) |
| `GET /api/v1/admin/moderation/products` | Admin+Support | all products, status-filterable (no `reported` filter — doesn't exist) |
| `GET /api/v1/admin/moderation/products/:id` | Admin+Support | + seller store name |
| `POST /api/v1/admin/moderation/products/:id/takedown` \| `/restore` | **Admin only** | reason mandatory, status-only, restore-from-audit-snapshot |
| `GET /api/v1/admin/reports/gmv-trend` | Admin+Support | `?groupBy=seller\|category` |
| `GET /api/v1/admin/reports/order-return-trend` | Admin+Support | zero-filled, zero-guarded returnRate |
| `GET /api/v1/admin/reports/seller-performance` | Admin+Support | BR-006 `fraudFlag` visibility |
| `GET /api/v1/admin/config` | Admin+Support | all 5 keys, `writable` flag per entry |
| `PATCH /api/v1/admin/config/:key` | **Admin only** | reason mandatory, per-key validated, `returns_confidence_threshold` rejected |

## Known limitations / assumptions

1. `adapterUptime` is an instantaneous Postgres+Redis reachability snapshot, not a true rolling
   percentage (gap #4 above) — no adapter-call counter infrastructure exists to compute one.
2. `activeUsers`'s definition (Assumption #1) is unconfirmed against any source document.
3. Seller-ban-with-open-orders is a non-blocking warning, not a reconciliation workflow
   (Assumption #2/Documentation Gap #2) — no source document defines what one would do.
4. Product-report/flag mechanism doesn't exist (Assumption #4/Documentation Gap #1) — moderation
   queue is all-products-filterable-by-status only.
5. `groupBy=category` on `gmv-trend` uses a different revenue basis than the platform GMV total
   (see Task 5 above) — carries an explicit `basisNote`, not silent.
6. `platform_config.commission_rate_default` has zero live consumers anywhere in this codebase —
   editable via this feature's new endpoint, but changing it currently does nothing (see Task 6
   above) — a standing gap in Auth's seller-activation flow, not this feature's to fix.
7. No frontend for any of this — SCR-AD01/AD02/AD05/AD06 (and the Reports/Returns-link views)
   remain separate, not-yet-started work.
