# **KarobarAI — Engineering Execution Playbook**

## **Feature 12: Admin Panel**

**Source of truth:** PRD (Doc 1) · TRD (Doc 2) · App Flow (Doc 3) · Backend Schema (Doc 5) · Implementation Plan (Doc 6) **Depends on:** Feature 1 (Auth/RBAC), Feature 2 (User Profiles), Feature 3 (Store Management), Feature 4 (Product Management), Feature 5 (Buyer Marketplace), Feature 7 (Orders), Feature 9 (Notifications), Feature 10 (Returns & Refunds), Feature 11 (Analytics Dashboard)

**Status:** Draft — Response 1 of 3 (Tasks 1–2).

## **Table of Contents**

1.  [Feature Overview](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#1-feature-overview)
2.  [Admin Panel Flow](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#2-admin-panel-flow)
3.  Task 1 — Admin Foundation
4.  Task 2 — Dashboard
5.  *(Deferred to Response 2)* Task 3 — User Management
6.  *(Deferred to Response 2)* Task 4 — Product Moderation
7.  *(Deferred to Response 3)* Task 5 — Reports & Returns Management
8.  *(Deferred to Response 3)* Task 6 — Platform Settings
9.  *(Deferred to Response 3)* Validation & Testing
10.  *(Deferred to Response 3)* Consistency Review, Assumptions, Documentation Gaps

## **1\. Feature Overview**

-   Implements the **Admin Console** (PRD §12.13, App Flow §5 SCR-AD01–AD08): Dashboard (KPIs), User Management, Product Moderation, Reports, Returns Management, Platform Settings — all **MVP** scope per PRD §16 ("Admin console … KPI view").
-   This feature is an **orchestration/composition layer**, not a new data domain. Every metric, record, and workflow already exists (Users/Feature 2, Stores/Feature 3, Products/Feature 4, Orders/Feature 7, Returns/Feature 10, Analytics/Feature 11). Feature 12 adds the **Admin/Support-facing views, RBAC gates, and privileged-action endpoints** on top — reusing repositories/services wherever they already exist and only adding admin-scoped queries or mutations where none exist yet (e.g., suspend/ban, config write).
-   **Reports** (SCR-AD01 KPI trend charts, admin-wide analytics) is explicitly **platform-wide**, unlike Feature 11's analytics which is **seller-scoped only** (Doc 5 §9 ownership rule). This feature does not rebuild Feature 11's aggregation logic; it composes/queries across all sellers using the same underlying repositories with the ownership filter *removed* (Admin bypasses ownership per Doc 5 §9: "Admin/Support bypass ownership but every privileged write lands in audit\_logs").
-   **Returns Management** here refers strictly to the **Admin Review** capability already fully specified and built in Feature 10 (Task 5 — Admin Review, /api/v1/admin/returns/\*). This feature does **not** rebuild return logic; it only ensures the Admin Console surfaces/links to what Feature 10 already exposes, and confirms RBAC parity.
-   **Platform Settings** = the Config Panel (SCR-AD06, REQ-F-Admin-006): commission rate, courier weights, return window, minimum order value — backed entirely by the existing platform\_config table (Doc 5 §4.25), **already seeded** in Feature 2/Admin-config-foundation (per Feature 10 Task 1 dependency notes). This feature adds the **read/write API + validation** over that existing table; it does not add new config keys unless a documented gap requires it (flagged as Assumption if so).
-   **RBAC boundary:** all endpoints in this feature require role IN (ADMIN, SUPPORT), with **Support read-only** and **Admin read+write**, per PRD §11 Permission Matrix (Admin ✅ everywhere; Support 🟡³ "read access, prepare cases; final destructive/financial actions require Admin").

## **2\. Admin Panel Flow**

Admin/Support Login (reuses Feature 1 auth) → RBAC gate (role ∈ {ADMIN, SUPPORT})

│

▼

Admin Dashboard (SCR-AD01) ── KPI tiles: GMV, active users, adapter/API uptime, trend charts, alert feed

│ reuses: Feature 11 aggregation patterns (platform-wide, ownership bypassed)

│ reuses: TRD §24 adapter/health counters

▼

┌───────────────┬──────────────────┬─────────────┬────────────────────┬──────────────────┐

│ User Mgmt │ Product Moderation│ Reports │ Returns Management │ Platform Settings │

│ (SCR-AD02) │ (SCR-AD05) │ (SCR-AD01/ │ (links to Feature │ (SCR-AD06) │

│ │ │ new views) │ 10 Admin Review) │ │

│ suspend/ban/ │ takedown/restore │ platform- │ queue + decision │ commission/ │

│ reactivate │ (reason, audited) │ wide GMV, │ (Feature 10 reuse) │ weights/window/ │

│ (reason, │ │ order/return│ │ min-order │

│ audited) │ │ trend │ │ (reason, audited) │

└───────────────┴──────────────────┴─────────────┴────────────────────┴──────────────────┘

│ │ │ │ │

▼ ▼ ▼ ▼ ▼

Every privileged write ─────────────────────────────────────────────────────► audit\_logs

(mandatory reason where applicable, Doc 5 §10, reused from Feature 1/Admin-audit foundation)

Notes:

-   **Every** mutation in this feature (suspend, ban, takedown, config change, return override — the last already built in Feature 10) writes to the same immutable audit\_logs table (Doc 5 §4.24) in the same transaction as the mutation — one audit mechanism, reused everywhere, never duplicated per sub-module.
-   Dashboard/Reports are **read-only** composition over existing data; only User Management, Product Moderation, and Platform Settings introduce new **write** endpoints in this feature (Returns Management write path already exists per Feature 10).

## **Task 1 — Admin Foundation**

### **Purpose**

-   Stand up the admin module skeleton (routes/controller/service/repository) inside the existing Core API structure (TRD §12: apps/api/src/modules/admin/), consistent with every other domain module.
-   Establish the **shared Admin/Support RBAC guard** and **audit-write helper** that every subsequent task (Dashboard, User Mgmt, Product Moderation, Reports, Returns Mgmt link, Platform Settings) will reuse — built once, not per sub-feature.

### **Dependencies**

-   Feature 1: Auth middleware, JWT, RBAC middleware (authorize(roles)), ownership-bypass pattern for Admin/Support (Doc 5 §9), response envelope, error hierarchy, Zod validation framework, existing audit\_logs write pattern (already used by Feature 10 Task 5 Admin Review — **reused, not reinvented**).
-   Feature 2: User Profiles (for User Management, Task 3).
-   Feature 3: Store Management (for seller-account context in User Management).
-   Feature 10 Task 5: the existing Admin Review audit-write transaction pattern this feature's guard/helper generalizes.

### **Expected Deliverables**

-   \[ \] admin module scaffold under apps/api/src/modules/admin/
-   \[ \] Shared AdminRbacGuard — authorize(\[ADMIN, SUPPORT\]) + a writeGuard sub-check restricting mutating routes to ADMIN only (Support = read-only)
-   \[ \] Shared AuditedMutation helper/decorator — wraps a mutation + mandatory-reason validation + audit\_logs insert in one DB transaction, generalized from Feature 10's existing pattern
-   \[ \] Shared AdminScopeRepository base — read helpers that intentionally **omit** the seller/buyer ownership filter (Admin/Support bypass, Doc 5 §9), for reuse by Dashboard/Reports/User Mgmt

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 1.1 | Create admin module folder (controller.ts, service.ts, routes.ts, dto.ts, repository.ts, subfolders per sub-feature) under apps/api/src/modules/admin/ per TRD §12 layout | Folder scaffolded, empty handlers wired to router | pnpm build compiles; base route /api/v1/admin mounts (stub OK) |
| --- | --- | --- | --- |
| 1.2 | Implement AdminRbacGuard: authenticate → authorize(\[ADMIN, SUPPORT\]) (reused Feature 1 middleware, no new auth logic) → attach role to request context for downstream write-gating | Reusable middleware/guard | Integration test: Buyer/Seller roles → 403 on any /api/v1/admin/\* route |
| --- | --- | --- | --- |
| 1.3 | Implement writeGuard sub-check: mutating routes (POST/PATCH/DELETE under /admin/\*) additionally require role = ADMIN; SUPPORT receives 403 with a clear "read-only" error code | Distinct 403 for Support-attempting-write vs. non-admin-attempting-any-access | Integration test: Support hits a write endpoint → 403 ADMIN\_WRITE\_REQUIRED; Support hits a read endpoint → 200 |
| --- | --- | --- | --- |
| 1.4 | Implement AuditedMutation helper: given {actorId, action, entity, entityId, reason, before, after}, wraps the target mutation and the audit\_logs insert in a single Prisma transaction — generalizing the transaction pattern already used in Feature 10 Task 5.6 (rollback on audit-write failure) | Reusable transactional helper, callable from any admin mutation | Integration test: simulated audit-write failure rolls back the paired mutation (same test pattern as Feature 10 Task 5.6) |
| --- | --- | --- | --- |
| 1.5 | Implement AdminScopeRepository base: exposes findAllUsers(), findAllOrders(), findAllProducts() etc. wrapping existing Feature 2/4/7 repositories but **without** injecting a seller\_id/buyer\_id filter (explicit ownership bypass per Doc 5 §9), with pagination per TRD §9 standard | Base repository class other admin sub-repos extend | Unit test: findAllUsers() returns records across multiple sellers/buyers in a seeded multi-tenant test DB |
| --- | --- | --- | --- |
| 1.6 | Register admin-specific error codes: ADMIN\_WRITE\_REQUIRED, REASON\_REQUIRED, INVALID\_CONFIG\_VALUE in the shared error-code enum (TRD §9), reusing the existing enum extension pattern from Feature 10 | Error codes added to packages/shared | Envelope emits correct code/status per case |
| --- | --- | --- | --- |

### **Common Errors**

-   Reimplementing RBAC checks per admin sub-route instead of the shared AdminRbacGuard/writeGuard — risks a Support-role write slipping through on a missed route.
-   Writing directly to audit\_logs ad hoc per mutation instead of the shared AuditedMutation helper — risks an un-audited privileged write, violating Doc 5 §10's "mandatory-reason writes... insert an audit\_logs row in the same transaction... or the transaction rolls back" rule.
-   Building new "admin views" of Users/Products/Orders that duplicate Feature 2/4/7 repository logic instead of extending AdminScopeRepository over the existing repositories.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| RBAC granularity | Single AdminRbacGuard (read: Admin+Support) + writeGuard sub-check (write: Admin only) | Matches PRD §11 Permission Matrix exactly (Support = 🟡³ read/prepare only; Admin = ✅ everywhere); avoids per-endpoint duplicated role logic |
| --- | --- | --- |
| Audit mechanism | Single shared AuditedMutation helper generalized from Feature 10's existing transaction pattern | Doc 5 §10 mandates the mutation+audit-write happen atomically; reusing the proven Feature 10 pattern avoids reinventing transaction/rollback logic |
| --- | --- | --- |
| Ownership bypass implementation | Explicit AdminScopeRepository base with no ownership filter, layered over existing Feature 2/4/7 repositories | Doc 5 §9 explicitly authorizes Admin/Support ownership bypass; implementing it as an explicit, auditable repository layer (not a silent filter-removal per call site) keeps the bypass visible and reviewable |
| --- | --- | --- |

### **Artifacts Produced**

-   apps/api/src/modules/admin/ (base controller, service, routes, dto, repository) — reused by every subsequent task in this feature.
-   AdminRbacGuard + writeGuard — reused by all six admin sub-features (Dashboard, User Mgmt, Product Moderation, Reports, Returns Mgmt, Platform Settings).
-   AuditedMutation helper — reused by Task 3 (suspend/ban), Task 4 (product takedown), Task 6 (config changes); Task 5's Returns Management already has its own audited-mutation path from Feature 10 and is not re-wrapped.
-   AdminScopeRepository base — extended by Task 2 (Dashboard/Reports) and Task 3 (User Management) read queries.

### **Definition of Done**

-   \[ \] admin module compiles and mounts under /api/v1/admin with stub handlers
-   \[ \] Buyer/Seller roles blocked from all /api/v1/admin/\* routes (403)
-   \[ \] Support role blocked from write routes, allowed on read routes
-   \[ \] AuditedMutation helper proven atomic (rollback-on-audit-failure) in an integration test
-   \[ \] AdminScopeRepository proven to bypass ownership filters correctly in a seeded multi-tenant test
-   \[ \] Zero Prisma schema drift — no new tables/columns introduced
-   \[ \] Lint/type-check clean

## **Task 2 — Dashboard**

### **Purpose**

-   Deliver SCR-AD01 (REQ-F-Admin-005): platform KPI tiles (GMV, active users, adapter/API uptime), trend charts, and an alert feed (manual-logistics orders, stuck payments, disputes, fraud flags).
-   Compose this **entirely from existing data/services** — GMV/trend from Feature 11's aggregation patterns applied platform-wide, adapter uptime from TRD §24 health counters, alerts from existing Order/Payment/Return/User states — introducing **no new source-of-truth data**, only a platform-wide read/composition layer.

### **Dependencies**

-   Task 1 (Admin Foundation): AdminRbacGuard, AdminScopeRepository.
-   Feature 11: Revenue/Sales aggregation patterns (RevenueAnalyticsRepository, SalesAnalyticsRepository query shapes) — **reused with the ownership filter removed** via AdminScopeRepository, not reimplemented.
-   Feature 7: Order repository (PENDING\_MANUAL\_LOGISTICS count — same field surfaced seller-side in Feature 11 Task 4.6, now aggregated platform-wide).
-   Feature 10: Admin Review queue (MANUAL\_REVIEW/UNDER\_DISPUTE counts) for the alert feed.
-   TRD §24: /health//ready endpoints and adapter success/failure counters (already implemented per Implementation Plan Phase 14) — reused as the uptime data source, not rebuilt.

### **Expected Deliverables**

-   \[ \] AdminDashboardService.getKpis(range) → {gmv, activeUsers, adapterUptime, pctChangeVsPrevious}
-   \[ \] AdminDashboardService.getAlertFeed() → {manualLogisticsOrders, stuckPayments, openDisputes, fraudFlaggedSellers}
-   \[ \] GET /api/v1/admin/dashboard/kpis endpoint
-   \[ \] GET /api/v1/admin/dashboard/alerts endpoint
-   \[ \] Swagger entries

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 2.1 | Implement AdminDashboardRepository.platformGmv(from, to): reuses Feature 11's RevenueAnalyticsRepository query shape (SUM(net) over settlements where status = SETTLED) via AdminScopeRepository, **without** the seller\_id filter | Platform-wide GMV figure for the range | Unit test: seeded settlements across multiple sellers sum correctly platform-wide |
| --- | --- | --- | --- |
| 2.2 | Implement AdminDashboardRepository.activeUsers(from, to): COUNT(DISTINCT user\_id) from users with last\_login\_at BETWEEN from AND to (or an order-activity proxy for buyers, if last\_login\_at is judged insufficient — flagged as Assumption if ambiguous) | Active-user count | Unit test against seeded users.last\_login\_at data |
| --- | --- | --- | --- |
| 2.3 | Implement AdminDashboardService.getKpis(): combines GMV, active users, and pctChangeVsPrevious (reusing Task 2/Feature 11's zero-guard % pattern), plus adapter uptime pulled from the existing TRD §24 health-counter source (read-only call into that existing monitoring data, no new instrumentation) | KPI summary DTO | Unit test: zero-previous-period case handled safely (reused pattern from Feature 11) |
| --- | --- | --- | --- |
| 2.4 | Implement AdminDashboardRepository.alertCounts(): PENDING\_MANUAL\_LOGISTICS order count (Feature 7), stuck-payment count (Payments Feature — payments in PENDING/aged beyond a threshold, reusing Feature 10 Task 6's "refund pending >24h"-style admin-queue filter pattern), open disputes count (Feature 10 Task 5 UNDER\_DISPUTE/MANUAL\_REVIEW queue), fraud-flagged sellers (seller\_profiles.fraud\_rate\_30d ≥ 0.20, BR-006 threshold, Doc 5 §4.2) | Alert-feed counts object | Unit test: each counter matches manual verification against seeded data across all four categories |
| --- | --- | --- | --- |
| 2.5 | Implement GET /api/v1/admin/dashboard/kpis?range= and GET /api/v1/admin/dashboard/alerts controllers — AdminRbacGuard (read-only, both Admin and Support) applied | 200 enveloped responses | Integration test: both Admin and Support roles can read; Buyer/Seller blocked |
| --- | --- | --- | --- |
| 2.6 | Swagger annotations for both endpoints | Visible in /api-docs | Manual check |
| --- | --- | --- | --- |

### **Common Errors**

-   Recomputing GMV/revenue logic from scratch instead of reusing Feature 11's query shape via AdminScopeRepository — risks metric drift between seller-facing and admin-facing revenue figures for the same underlying data.
-   Building new instrumentation for adapter uptime instead of reading the existing TRD §24 health/monitoring counters (already scoped and built in Implementation Plan Phase 14).
-   Treating the alert feed as a new mutable table — it must be computed live from existing tables (orders, payments, returns/disputes, seller\_profiles), never persisted redundantly.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| GMV computation reuse | Same SUM(net) over settlements query shape as Feature 11 Task 2, applied without ownership filter | Ensures platform-wide GMV and seller-level revenue are always computed from an identical, consistent source-of-truth definition — no metric drift between the two dashboards |
| --- | --- | --- |
| Alert feed data sourcing | Computed live at request time from existing tables (orders, payments/settlements aging, returns/disputes, seller\_profiles.fraud\_rate\_30d); no new alert-log table | Doc 5 has no reserved "alerts" table; TRD §24 already frames KPI/alert surfacing as a live read over existing operational data, consistent with "product metrics, distinct from ops monitoring" (TRD §24) |
| --- | --- | --- |

### **Artifacts Produced**

-   AdminDashboardRepository, AdminDashboardService — the platform-wide, ownership-bypassed aggregation pattern here is reused directly by Task 5 (Reports), which extends the same repository with additional breakdowns (by seller, by category, by time period).
-   GET /api/v1/admin/dashboard/kpis, GET /api/v1/admin/dashboard/alerts — live endpoints for SCR-AD01.

### **Definition of Done**

-   \[ \] Platform GMV matches a manual SUM(net) check across all sellers' settled settlements for a given range
-   \[ \] Active-user count matches manual verification against seeded users data
-   \[ \] Alert-feed counts (manual-logistics, stuck payments, open disputes, fraud-flagged) each match manual verification
-   \[ \] Adapter uptime figure sourced from existing TRD §24 counters, not new instrumentation
-   \[ \] Both endpoints accessible to Admin and Support (read-only); blocked for Buyer/Seller
-   \[ \] Swagger documents both endpoints

*End of Response 1 (Tasks 1–2). Say "continue" for Response 2 — Task 3 (User Management) and Task 4 (Product Moderation).*

## **Table of Contents (updated)**

1.  [Feature Overview](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#1-feature-overview)
2.  [Admin Panel Flow](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#2-admin-panel-flow)
3.  Task 1 — Admin Foundation
4.  Task 2 — Dashboard
5.  Task 3 — User Management
6.  Task 4 — Product Moderation
7.  *(Deferred to Response 3)* Task 5 — Reports & Returns Management
8.  *(Deferred to Response 3)* Task 6 — Platform Settings
9.  *(Deferred to Response 3)* Validation & Testing
10.  *(Deferred to Response 3)* Consistency Review, Assumptions, Documentation Gaps

**Status:** Draft — Response 2 of 3 (Tasks 1–4).

## **Task 3 — User Management**

### **Purpose**

-   Deliver SCR-AD02 (REQ-F-Admin-001): admin can search, suspend, ban, and reactivate Buyer/Seller/Admin/Support accounts.
-   Ensure suspension/ban **immediately invalidates active sessions** (REQ-F-Auth006) by reusing Feature 1's existing session-revocation mechanism (Redis jti denylist) — not a new revocation path.

### **Dependencies**

-   Task 1 (Admin Foundation): AdminRbacGuard, writeGuard, AuditedMutation helper, AdminScopeRepository.
-   Feature 1: users repository, RS256 JWT verification, Redis jti denylist / refresh-token revocation mechanism (TRD §7/§11, Doc 5 §11) — **reused as-is**.
-   Feature 2: User Profiles (seller\_profiles/buyer\_profiles joins for account detail view).

### **Expected Deliverables**

-   \[ \] GET /api/v1/admin/users — searchable list (role, status, fraud rate for sellers), paginated
-   \[ \] GET /api/v1/admin/users/:id — account detail drawer (profile + role-specific extension data)
-   \[ \] POST /api/v1/admin/users/:id/suspend / /ban / /reactivate — reason mandatory, audited, session-revoking
-   \[ \] Swagger entries

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 3.1 | Implement AdminUserRepository.search(filters, pagination) extending AdminScopeRepository (Task 1): filter by role, status, free-text on phone/email **blind index** (phone\_bidx/email\_bidx, Doc 5 §4.1 — never query ciphertext directly), join seller\_profiles.fraud\_rate\_30d when role = SELLER | Paginated user list, envelope-wrapped | Integration test: search by role/status returns correct filtered set; searching by phone matches via blind index, not plaintext scan |
| --- | --- | --- | --- |
| 3.2 | Implement GET /api/v1/admin/users/:id: returns base users row + role-specific extension (seller\_profiles/buyer\_profiles) reusing Feature 2's existing profile repositories (no new joins duplicated) | Full account detail payload | Integration test: seller account detail includes store\_name, fraud\_rate\_30d; buyer account includes address count |
| --- | --- | --- | --- |
| 3.3 | Implement POST /api/v1/admin/users/:id/suspend: body {reason} (mandatory) → AuditedMutation wraps users.status = SUSPENDED update + audit\_logs insert (action = SUSPEND) in one transaction (Task 1.4) | 200 on success; 400 if reason missing | Integration test: suspend without reason → 400 REASON\_REQUIRED; with reason → status updates + audit row created |
| --- | --- | --- | --- |
| 3.4 | On suspend/ban: immediately invoke Feature 1's existing session-revocation routine — add all active jtis for that user to the Redis denylist and set refresh\_tokens.revoked\_at (reused mechanism, Doc 5 §11, **not reimplemented**) | Active sessions die immediately | Integration test: a logged-in user's next authenticated request after suspension → 401 (reused Feature 1 denylist check) |
| --- | --- | --- | --- |
| 3.5 | Implement POST /api/v1/admin/users/:id/ban (same pattern as 3.3–3.4, action = BAN, users.status = BANNED) and POST /api/v1/admin/users/:id/reactivate (users.status = ACTIVE, reason optional — flagged as Assumption if reason should be mandatory here too) | Ban/reactivate endpoints functioning identically in transaction/session-revocation pattern | Integration test: full suspend→reactivate→ban lifecycle produces 3 correct audit rows and correct final users.status |
| --- | --- | --- | --- |
| 3.6 | Add a guard: banning a **seller** with open (non-terminal) orders triggers a reconciliation flag rather than silently banning (App Flow SCR-AD02 edge case: "banning a seller with open orders triggers reconciliation flow") — for MVP, this playbook implements it as a **warning returned in the response** (openOrdersCount) rather than a blocking reconciliation workflow, since no reconciliation workflow is specified elsewhere in the source docs (flagged as Assumption) | Ban response includes openOrdersCount when >0; ban still proceeds | Integration test: banning a seller with 2 open orders returns openOrdersCount: 2 in the response envelope |
| --- | --- | --- | --- |
| 3.7 | Swagger annotations for all four endpoints | Visible in /api-docs | Manual check |
| --- | --- | --- | --- |

### **Common Errors**

-   Querying phone/email columns directly (ciphertext) for search instead of the phone\_bidx/email\_bidx blind-index columns (Doc 5 §4.1) — will silently return zero results.
-   Reimplementing session revocation instead of reusing Feature 1's Redis jti denylist + refresh\_tokens.revoked\_at mechanism — risks a suspended user retaining access via a still-valid access token.
-   Allowing suspend/ban without a mandatory reason — violates Doc 5 §10 "mandatory-reason writes... insert an audit\_logs row... or the transaction rolls back."

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Search mechanism for encrypted fields | Blind-index columns (phone\_bidx, email\_bidx) | Doc 5 §4.1 explicitly reserves these for lookup/uniqueness on encrypted PII; this is the only compliant search path |
| --- | --- | --- |
| Seller-ban-with-open-orders handling | Non-blocking warning (openOrdersCount in response), ban proceeds | No reconciliation workflow is specified in PRD/TRD/Schema/App Flow beyond naming the edge case; blocking the ban entirely isn't documented either. Flagged as Assumption — a full reconciliation workflow, if required, is a documentation gap (see final review) |
| --- | --- | --- |
| Reactivate reason requirement | Reason optional (unlike suspend/ban) | No source document explicitly requires a reason for reactivation, unlike suspend/ban's explicit "mandatory reason" framing (REQ-F-Admin-003 language applies to overrides/suspensions); flagged as Assumption, revisit if stricter audit policy is intended |
| --- | --- | --- |

### **Artifacts Produced**

-   AdminUserRepository, AdminUserService — blind-index search pattern reused by Task 5 (Reports, if seller-level drill-down search is needed).
-   POST /api/v1/admin/users/:id/{suspend,ban,reactivate} — the AuditedMutation + session-revocation combination here is the template reused verbatim by Task 4 (Product Moderation takedown/restore) and Task 6 (Platform Settings config changes).

### **Definition of Done**

-   \[ \] Admin can search/filter users by role, status, and phone/email (via blind index)
-   \[ \] Suspend/ban require a mandatory reason; missing reason → 400
-   \[ \] Suspend/ban immediately invalidate the user's active sessions (verified via a live-session test)
-   \[ \] Every suspend/ban/reactivate produces exactly one audit\_logs row
-   \[ \] Banning a seller with open orders surfaces openOrdersCount without silently hiding the condition
-   \[ \] Support role blocked from all write endpoints in this task; read endpoint accessible to both roles
-   \[ \] Swagger documents all four endpoints

## **Task 4 — Product Moderation**

### **Purpose**

-   Deliver SCR-AD05 (REQ-F-Admin-004, BR-001): admin can take down or restore listings that violate the prohibited-item policy, **without altering seller ownership** of the product record.
-   Ensure moderation is a **status-only** action (soft removal from storefront) — it must never delete, reassign, or mutate seller-owned product data beyond status, per the Feature 12 brief's explicit "without modifying seller ownership rules."

### **Dependencies**

-   Task 1 (Admin Foundation): AdminRbacGuard, writeGuard, AuditedMutation helper.
-   Feature 4: products repository (product\_status enum: DRAFT | LIVE | OUT\_OF\_STOCK | REMOVED, Doc 5 §3/§4.6) — **reused, not extended**; no new status value needed since REMOVED already exists.
-   Feature 5: Buyer Marketplace (storefront visibility rules — confirms takedown correctly hides listings from idx\_products\_live partial index scope, Doc 5 §4.6).

### **Expected Deliverables**

-   \[ \] GET /api/v1/admin/moderation/products — reported/flagged listings queue (filterable)
-   \[ \] GET /api/v1/admin/moderation/products/:id — listing preview + seller context
-   \[ \] POST /api/v1/admin/moderation/products/:id/takedown — reason mandatory, audited, status → REMOVED
-   \[ \] POST /api/v1/admin/moderation/products/:id/restore — reason mandatory, audited, status → LIVE (or DRAFT, see Engineering Decision)
-   \[ \] Swagger entries

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 4.1 | Implement AdminModerationRepository.listFlagged(filters, pagination) extending AdminScopeRepository: reuses Feature 4's product repository queries **without** the seller\_id = self filter, filterable by status and (if a report/flag mechanism exists elsewhere — flagged as Assumption below) a reported flag | Paginated product list across all sellers | Integration test: admin sees products from multiple sellers in one list |
| --- | --- | --- | --- |
| 4.2 | Implement GET /api/v1/admin/moderation/products/:id: returns full product detail (reusing Feature 4's existing product-detail repository call) + seller context (seller\_profiles.store\_name, joined via AdminUserRepository pattern from Task 3) | Full listing + seller identity for review | Integration test: response includes both product fields and seller store name |
| --- | --- | --- | --- |
| 4.3 | Implement POST /api/v1/admin/moderation/products/:id/takedown: body {reason} (mandatory, BR-001 policy reference) → AuditedMutation wraps products.status = REMOVED update + audit\_logs insert (action = MODERATION) in one transaction (reuses Task 1.4/Task 3.3 pattern exactly) | 200 on success; product disappears from storefront (idx\_products\_live partial index no longer matches) | Integration test: takedown without reason → 400; with reason → status = REMOVED, product excluded from a subsequent Feature 5 storefront query |
| --- | --- | --- | --- |
| 4.4 | Implement POST /api/v1/admin/moderation/products/:id/restore: same transactional pattern, status → LIVE if the product was previously LIVE before takedown (track prior status via the audit\_logs.before snapshot already captured in 4.3 — no new column needed) | Product restored to its pre-takedown status | Integration test: a product taken down from LIVE restores to LIVE; one taken down from DRAFT (edge case) restores to DRAFT, sourced from the audit before snapshot |
| --- | --- | --- | --- |
| 4.5 | Guard: takedown/restore must **never** modify products.seller\_id, price, title\_\*, description\_\*, tags, or any seller-authored field — only status — enforced by scoping the update statement to the status column exclusively | Update statement touches only status | Code review: UPDATE targets a single column; unit test confirms all other fields byte-identical before/after |
| --- | --- | --- | --- |
| 4.6 | Swagger annotations for all four endpoints | Visible in /api-docs | Manual check |
| --- | --- | --- | --- |

### **Common Errors**

-   Hard-deleting or soft-deleting (deleted\_at) the product on takedown instead of using the existing status = REMOVED value — conflates moderation with seller-initiated deletion (SCR-S03 edge case) and would incorrectly affect the product's own soft-delete lifecycle.
-   Restoring every takedown to LIVE unconditionally instead of restoring to the pre-takedown status (a DRAFT product taken down should not become LIVE on restore).
-   Allowing the takedown/restore mutation to touch seller-authored fields — must be a single-column (status) update only, per the feature brief's explicit ownership-preservation requirement.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Takedown mechanism | Reuse existing product\_status = REMOVED enum value (Doc 5 §3/§4.6) | Schema already reserves this exact value; no new enum/column needed, consistent with "DO NOT MODIFY Database Schema" constraint |
| --- | --- | --- |
| Restore target status | Restore to the pre-takedown status, sourced from audit\_logs.before snapshot | Avoids incorrectly promoting a DRAFT product to LIVE on restore; reuses the audit snapshot already captured by the mandatory-reason write, no new tracking column required |
| --- | --- | --- |
| Ownership preservation | Single-column (status-only) update statement, enforced at the repository method signature level (method only accepts a status value, no other fields) | Directly satisfies the Feature 12 brief's "moderate products without modifying seller ownership rules" requirement |
| --- | --- | --- |

### **Artifacts Produced**

-   AdminModerationRepository, AdminModerationService — status-only mutation pattern (restore-from-audit-snapshot technique) reused conceptually by Task 5 if any report-resolution workflow needs a similar "revert to prior state" mechanic.
-   POST /api/v1/admin/moderation/products/:id/{takedown,restore} — completes SCR-AD05's endpoint set.

### **Definition of Done**

-   \[ \] Takedown/restore require a mandatory reason; missing reason → 400
-   \[ \] Takedown sets status = REMOVED only; all other product fields unchanged (byte-identical)
-   \[ \] Restore returns the product to its correct pre-takedown status (not unconditionally LIVE)
-   \[ \] Taken-down products are excluded from Feature 5's storefront queries
-   \[ \] Every takedown/restore produces exactly one audit\_logs row
-   \[ \] Support role blocked from write endpoints; read endpoint accessible to both roles
-   \[ \] Swagger documents all four endpoints

*End of Response 2 (Tasks 3–4). Say "continue" for Response 3 — Task 5 (Reports & Returns Management), Task 6 (Platform Settings), Validation & Testing, and the final consistency review.*

## **Table of Contents (updated — final)**

1.  [Feature Overview](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#1-feature-overview)
2.  [Admin Panel Flow](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#2-admin-panel-flow)
3.  Task 1 — Admin Foundation
4.  Task 2 — Dashboard
5.  Task 3 — User Management
6.  Task 4 — Product Moderation
7.  Task 5 — Reports & Returns Management
8.  Task 6 — Platform Settings
9.  Validation & Testing
10.  Consistency Review, Assumptions, Documentation Gaps

**Status:** Final — Response 3 of 3 (Tasks 1–6 + Validation & Consistency Review complete).

## **Task 5 — Reports & Returns Management**

### **Purpose**

-   Deliver platform-wide **Reports** (SCR-AD01 trend charts extended into dedicated report views) — GMV/order/return trends across all sellers, using the same aggregation shapes as Task 2 (Dashboard) and Feature 11, just with additional breakdown dimensions (by seller, by category, by time bucket).
-   Deliver **Returns Management** by **linking to, not rebuilding**, Feature 10's already-complete Admin Review capability (GET/POST /api/v1/admin/returns/\*) — this task's job is to confirm RBAC parity with this feature's AdminRbacGuard/writeGuard and surface it correctly in the Admin Console navigation, not to re-implement return decision logic.

### **Dependencies**

-   Task 1 (Admin Foundation): AdminRbacGuard, writeGuard, AdminScopeRepository.
-   Task 2 (Dashboard): AdminDashboardRepository/Service (GMV/alert query shapes) — extended, not duplicated.
-   Feature 11: Revenue/Sales/Order Analytics aggregation patterns — reused platform-wide via AdminScopeRepository.
-   Feature 10 Task 5 (Admin Review): existing /api/v1/admin/returns endpoints, ReturnDecisionService, dispute-resolution transaction logic — **reused entirely, zero new return logic**.

### **Expected Deliverables**

-   \[ \] GET /api/v1/admin/reports/gmv-trend — platform GMV over time, filterable by range, optional groupBy=seller|category
-   \[ \] GET /api/v1/admin/reports/order-return-trend — order volume vs. return volume over time (fraud/quality signal)
-   \[ \] GET /api/v1/admin/reports/seller-performance — ranked seller list (GMV, return-fraud rate, fulfilment success) for BR-006 fraud-flag visibility
-   \[ \] **Returns Management:** confirmed RBAC parity check + navigation wiring only (no new endpoints) — explicit "reuse-only" checklist
-   \[ \] Swagger entries for the three new report endpoints

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 5.1 | Implement AdminReportsRepository.gmvTrend(from, to, groupBy?): extends AdminDashboardRepository.platformGmv() (Task 2.1) with a GROUP BY on either DATE(settled\_at) (default), seller\_id, or category\_id (via order\_items → products.category\_id join, reusing Feature 11 Task 3's category-join pattern) | Grouped GMV series | Unit test: groupBy=seller returns per-seller GMV rows summing to the platform total from Task 2.1 |
| --- | --- | --- | --- |
| 5.2 | Implement AdminReportsRepository.orderReturnTrend(from, to): daily/period counts of orders (via placed\_at, reusing Feature 11 Task 4's status-breakdown query shape platform-wide) alongside returns counts (via returns.created\_at, joined through orders.seller\_id bypassed) for the same buckets | Parallel time series: {date, orderCount, returnCount, returnRate} | Unit test: returnRate = returnCount/orderCount per bucket, zero-guarded (reused pattern from Feature 11 Task 2.2) |
| --- | --- | --- | --- |
| 5.3 | Implement AdminReportsRepository.sellerPerformance(from, to, limit): ranks sellers by GMV (reusing 5.1's per-seller grouping) joined with seller\_profiles.fraud\_rate\_30d (Doc 5 §4.2) and a fulfilment-success proxy (% orders reaching DELIVERED/COMPLETED vs. CANCELLED, reusing Feature 11 Task 4's status-breakdown shape per seller) | Ranked seller list with GMV, fraud rate, fulfilment rate | Unit test: seller exceeding BR-006's 20%/40% fraud thresholds is correctly flagged in the response (\`fraudFlag: 'WARNING' |
| --- | --- | --- | --- |
| 5.4 | Implement the three GET /api/v1/admin/reports/\* controllers — AdminRbacGuard (read-only, Admin + Support) applied, reusing ChartResponseFormatter (Feature 11 Task 5) for chart-shaped output where applicable | 200 enveloped responses, chart-ready | Integration test: both Admin and Support can read; Buyer/Seller blocked |
| --- | --- | --- | --- |
| 5.5 | **Returns Management reuse-only checklist:** (a) confirm /api/v1/admin/returns, /api/v1/admin/returns/:id, /api/v1/admin/returns/:id/decision (Feature 10 Task 5) already enforce role ∈ {ADMIN, SUPPORT} with write restricted to ADMIN; (b) confirm no duplicate route is created under /api/v1/admin/moderation-returns or similar; (c) confirm Admin Console navigation (out of backend scope, noted for frontend) links directly to Feature 10's existing endpoints | Confirmation checklist, zero new returns-decision code | Code review: grep for any new return-status-mutating code introduced in this feature returns zero matches |
| --- | --- | --- | --- |
| 5.6 | Swagger annotations for the three new report endpoints; **do not** re-annotate Feature 10's existing returns endpoints (already documented) | /api-docs updated for reports only | Manual check |
| --- | --- | --- | --- |

### **Common Errors**

-   Reimplementing GMV/order/return counting logic instead of extending Task 2's/Feature 11's existing query shapes — causes metric drift across Dashboard, Reports, and seller-facing Analytics for what should be the same underlying numbers.
-   Building a second, parallel "admin returns" endpoint set instead of reusing Feature 10 Task 5 verbatim — directly violates the "Do NOT rebuild any of the above" instruction for Feature 10.
-   Computing seller fraud-flag thresholds locally instead of reading seller\_profiles.fraud\_rate\_30d (Doc 5 §4.2, already maintained as "rolling metric BR-006" by whatever process updates it — out of this feature's scope to (re)compute that rolling metric itself).

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Report aggregation reuse | All three report endpoints extend Task 2/Feature 11 query shapes with additional GROUP BY dimensions, no parallel aggregation logic | Guarantees GMV/order/return figures are identical whether viewed on Dashboard, Reports, or (bypassed-ownership version of) seller Analytics — single source of truth per metric |
| --- | --- | --- |
| Returns Management scope in this feature | Zero new endpoints; reuse-and-verify only | Feature 10 already fully implements Admin Review (queue, decision, dispute resolution, audit); rebuilding any part would violate both the "Do NOT rebuild" instruction and the single-source-of-truth principle for return state |
| --- | --- | --- |
| Fraud-rate source | Read seller\_profiles.fraud\_rate\_30d directly, never recomputed here | Doc 5 §4.2 already designates this column as the authoritative rolling metric; recomputing it in Reports would risk divergence from whatever scheduled process maintains it |
| --- | --- | --- |

### **Artifacts Produced**

-   AdminReportsRepository, AdminReportsService — extends AdminDashboardRepository (Task 2); no further extension needed within this feature.
-   GET /api/v1/admin/reports/{gmv-trend,order-return-trend,seller-performance} — new endpoints backing an extended SCR-AD01 reporting view.
-   **No new artifacts** for Returns Management — explicitly confirmed reuse of Feature 10's existing module.

### **Definition of Done**

-   \[ \] GMV trend (grouped by date/seller/category) matches manual verification and sums consistently with Task 2's platform GMV figure
-   \[ \] Order/return trend returnRate computed safely per bucket
-   \[ \] Seller performance ranking correctly flags sellers at/above BR-006 thresholds using the existing fraud\_rate\_30d column
-   \[ \] Both Admin and Support can read all three report endpoints; Buyer/Seller blocked
-   \[ \] Zero new return-decision endpoints or logic introduced (reuse-only confirmed via code review)
-   \[ \] Swagger documents the three new report endpoints only

## **Task 6 — Platform Settings**

### **Purpose**

-   Deliver SCR-AD06 (REQ-F-Admin-006): admin-configurable commission rate, courier weights, return window, minimum order value — without a deployment (SRS §5.5 "no magic values" principle).
-   Operate entirely over the **existing, already-seeded** platform\_config table (Doc 5 §4.25) — this task adds the read/write API and validation layer only; it does not introduce new config keys beyond what Doc 5 §4.25 already seeds unless a documented gap requires it (see Assumptions).

### **Dependencies**

-   Task 1 (Admin Foundation): AdminRbacGuard, writeGuard, AuditedMutation helper.
-   Doc 5 §4.25: platform\_config table, already seeded with commission\_rate\_default, courier\_weights, return\_window\_days, min\_order\_value\_pkr, returns\_confidence\_threshold (the last one is R1.1-scoped, read-only exposure only, no MVP UI control needed for it here — flagged as Assumption if the Admin Console is expected to expose it in MVP).
-   Feature 10 Task 1: reference to platform\_config.return\_window\_days already being consumed elsewhere — confirms this table's read path is proven; this task adds the **write** path for the first time.

### **Expected Deliverables**

-   \[ \] GET /api/v1/admin/config — current values for all admin-configurable keys
-   \[ \] PATCH /api/v1/admin/config/:key — update a single config value, reason mandatory, audited
-   \[ \] Validation: courier weights sum to 100%, rates/values within sane bounds
-   \[ \] Swagger entries

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 6.1 | Implement PlatformConfigRepository.getAll() / getByKey(key): reads platform\_config (Doc 5 §4.25) directly, no new table | Current config values | Unit test: seeded defaults (commission\_rate\_default=0.05, etc.) returned correctly |
| --- | --- | --- | --- |
| 6.2 | Implement ConfigValidationSchema (Zod) per key: commission\_rate\_default ∈ \[0, 1\]; courier\_weights object with 4 numeric fields summing to exactly 1.0 (±0.001 tolerance); return\_window\_days positive integer; min\_order\_value\_pkr ≥ 0 | Per-key validation rules | Unit test: courier weights summing to 0.9 → rejected; summing to 1.0 → accepted |
| --- | --- | --- | --- |
| 6.3 | Implement PATCH /api/v1/admin/config/:key: body {value, reason} (reason mandatory) → validate via 6.2 → AuditedMutation wraps platform\_config upsert + audit\_logs insert (action = CONFIG\_CHANGE) in one transaction (reuses Task 1.4/Task 3.3/Task 4.3 pattern exactly) | 200 on success; 422 INVALID\_CONFIG\_VALUE on validation failure; 400 REASON\_REQUIRED if reason missing | Integration test: invalid courier-weights sum → 422; valid update with reason → 200, config row updated, audit row created |
| --- | --- | --- | --- |
| 6.4 | Confirm (do not re-implement) that **existing consumers** of platform\_config (e.g., Feature 10's return\_window\_days read, Feature 2/7's commission\_rate\_default/min\_order\_value\_pkr reads, Logistics' courier\_weights read) pick up the new value on next read — since platform\_config has no caching layer specified in Doc 5, confirm no stale-cache issue; if any consumer caches config, note the invalidation requirement as a **cross-feature dependency**, not rebuilt here | Confirmation note; no new caching code added in this task | Integration test: updating return\_window\_days via this task's PATCH endpoint, then re-reading it through Feature 10's existing eligibility check (Task 2 of Feature 10), reflects the new value |
| --- | --- | --- | --- |
| 6.5 | Explicitly **exclude** returns\_confidence\_threshold from the MVP-writable key set (R1.1-scoped per Doc 5 §4.25 seed comment) unless the Admin Console is confirmed to need R1.1-readiness now — expose it as **read-only** in GET /api/v1/admin/config for forward visibility only | returns\_confidence\_threshold visible in GET response, rejected on PATCH attempt | Integration test: PATCH /admin/config/returns\_confidence\_threshold → 403/422 "not configurable in MVP" |
| --- | --- | --- | --- |
| 6.6 | Swagger annotations for both endpoints, listing all configurable keys and their validation rules | Visible in /api-docs | Manual check |
| --- | --- | --- | --- |

### **Common Errors**

-   Adding new columns to platform\_config instead of using its existing JSONB value column (Doc 5 §4.25 value JSONB NN) — the table is intentionally generic key/value; no schema change is ever needed to add a new *key*, only a new seed row (out of this task's scope to add new keys without a documented requirement).
-   Allowing courier weights to be saved without validating they sum to 100% — directly contradicts SCR-AD06's explicit validation rule ("weights sum to 100%").
-   Allowing returns\_confidence\_threshold to be admin-editable in MVP when the AI automation it drives isn't built yet (Feature 8/R1.1) — would let admins configure a knob with no effect, misleading UX.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Config storage | Existing platform\_config key/JSONB table (Doc 5 §4.25), no schema change | Table is explicitly designed as generic, admin-tunable key/value storage; adding a config key is a seed-data concern, not a migration |
| --- | --- | --- |
| returns\_confidence\_threshold exposure | Read-only in MVP Admin Console | The value only takes effect once Feature 8 (R1.1 ReturnsAI automation) is built; exposing it as writable now would configure a non-functional control, contradicting D5/PRD's MVP-first "cuttable scope" framing (Implementation Plan Phase 8 note) |
| --- | --- | --- |
| Stale-config-read risk | Flagged as a cross-feature verification step (6.4), not a new caching mechanism | Doc 5/TRD do not specify a platform\_config cache; adding one would be new infrastructure outside this feature's "reuse-only" mandate — if a consumer is found to cache it, that consumer's owning feature should add invalidation, not this feature |
| --- | --- | --- |

### **Artifacts Produced**

-   PlatformConfigRepository, PlatformConfigService, ConfigValidationSchema — final new repository/service/validation set in this feature.
-   GET /api/v1/admin/config, PATCH /api/v1/admin/config/:key — completes SCR-AD06's endpoint set.

### **Definition of Done**

-   \[ \] All five seeded config keys readable via GET /api/v1/admin/config
-   \[ \] Courier-weights-sum-to-100% validation enforced; invalid sums rejected with 422
-   \[ \] Config updates require a mandatory reason; missing reason → 400
-   \[ \] Every config change produces exactly one audit\_logs row (action = CONFIG\_CHANGE)
-   \[ \] returns\_confidence\_threshold is read-only (PATCH rejected) in this MVP implementation
-   \[ \] A config change is confirmed visible to at least one existing consumer (Feature 10's return-window check) without requiring a deploy
-   \[ \] Support role blocked from PATCH; both roles can GET
-   \[ \] Swagger documents both endpoints

## **Validation & Testing**

| **Layer** | **Coverage Target** | **Tooling (reused)** | **Key Scenarios** |
| --- | --- | --- | --- |
| Unit | RBAC guard logic, audit-transaction helper, config validation, report aggregation math | Jest (reused, Feature 1 setup) | Support-write-blocked; audit rollback-on-failure; courier-weights-sum validation; zero-guard % calcs (reused Feature 11 patterns) |
| --- | --- | --- | --- |
| Integration | All admin endpoints across Tasks 2–6, RBAC parity, audit-row creation | Jest + Supertest, ephemeral Postgres/Redis (reused CI setup, TRD §23) | Buyer/Seller blocked everywhere; Support read-only everywhere; every mutating action (suspend/ban/takedown/restore/config-change) produces exactly one audit row; session revocation on suspend/ban verified live |
| --- | --- | --- | --- |
| Regression | Feature 10 Returns Management untouched | Existing Feature 10 test suite (rerun, not modified) | Confirm zero new/duplicate returns-decision endpoints or logic were introduced by this feature |
| --- | --- | --- | --- |
| Regression | Feature 11 Analytics untouched; Admin Dashboard/Reports produce figures consistent with seller-facing analytics for shared underlying data | Existing Feature 11 test suite (rerun) + new cross-check tests | A seller's own settled GMV (Feature 11) matches their contribution to platform GMV (Task 2/5) for the same range |
| --- | --- | --- | --- |
| Security | Ownership-bypass correctness (Admin/Support see all; still cannot forge actions as another admin) | Reused RBAC/ownership test harness (Feature 1) | Admin cannot suspend/ban/takedown/config-change without authentication; JWT tampering rejected (reused Feature 1 signature checks) |
| --- | --- | --- | --- |

### **Coverage Gate**

-   \[ \] ≥80% backend coverage maintained for all new admin module code (REQ-NF-Quality-003), verified in CI via existing Istanbul/c8 gate — no new tooling.
-   \[ \] Zero lint/type errors (ESLint/tsc --noEmit, reused CI job).
-   \[ \] Full OWASP-relevant review of privileged admin endpoints folded into **Deferred to Feature 13 (Testing/System Hardening)** per Implementation Plan Phase 11 — not repeated here, referenced only.

## **Consistency Review, Assumptions, Documentation Gaps**

### **Consistency Review vs Features 0–11**

| **Check** | **Result** |
| --- | --- |
| No new database tables/columns/enums introduced | ✅ Pass — this feature reads/writes only users, seller\_profiles, buyer\_profiles, products, platform\_config, audit\_logs (all pre-existing, Doc 5); product\_status.REMOVED already existed, no enum change |
| --- | --- |
| No new routing conventions introduced | ✅ Pass — follows /api/v1/admin/<sub-feature> (TRD §9), mirrors the role-scoped pattern already used in Feature 10's /admin/returns |
| --- | --- |
| No new authentication mechanism introduced | ✅ Pass — reuses Feature 1's authenticate → authorize(\[ADMIN,SUPPORT\]) → writeGuard chain throughout |
| --- | --- |
| No duplicate shared components rebuilt | ✅ Pass — response envelope, error hierarchy, Repository pattern, validation framework, session-revocation (Feature 1), audit mechanism (generalized from Feature 10), analytics aggregation shapes (Feature 11) all reused, not rebuilt |
| --- | --- |
| Returns Management correctly reuses Feature 10 | ✅ Pass — Task 5.5 explicitly confirms zero new return-decision endpoints/logic; only RBAC-parity verification and navigation reference performed |
| --- | --- |
| Product Moderation preserves seller ownership | ✅ Pass — Task 4 enforces single-column (status-only) updates; seller\_id and all seller-authored fields provably untouched |
| --- | --- |
| Session revocation on suspend/ban reuses existing mechanism | ✅ Pass — Task 3.4 reuses Feature 1's Redis jti denylist + refresh\_tokens.revoked\_at, per Doc 5 §11 / REQ-F-Auth006 |
| --- | --- |
| Config changes apply without redeploy | ✅ Pass — Task 6 operates on the existing platform\_config table already designed for exactly this purpose (Doc 5 §4.25 / SRS §5.5 "no magic values") |
| --- | --- |
| Ownership bypass for Admin/Support correctly scoped | ✅ Pass — AdminScopeRepository (Task 1) implements the Doc 5 §9-authorized bypass explicitly and auditably, not as a silent filter removal |
| --- | --- |
| Mandatory-reason + audit rule applied consistently | ✅ Pass — every mutating endpoint across Tasks 3, 4, 6 uses the same AuditedMutation transactional helper (Task 1.4), matching Doc 5 §10 |
| --- | --- |

**No conflicts found with Features 0–11 or with the PRD/TRD/App Flow/Schema/Implementation Plan.**

### **Assumptions Made (flagged, not invented as fact)**

1.  **Active-user metric basis** (Task 2.2): no source document defines precisely how "active users" is computed for the KPI tile (REQ-F-Admin-005 names the metric but not its formula). This playbook assumes users.last\_login\_at within the selected range as the basis, falling back to an order-activity proxy for buyer-side activity if last\_login\_at proves insufficient. **Action for implementers:** confirm the intended definition before finalizing Task 2.
2.  **Seller-ban-with-open-orders handling** (Task 3.6): App Flow SCR-AD02 names this edge case ("triggers reconciliation flow") but no source document defines what that reconciliation workflow consists of. This playbook implements a non-blocking warning (openOrdersCount in the response) rather than inventing a blocking reconciliation process. If a real reconciliation workflow is required, it should be scoped as a documented gap (see below), not built ad hoc here.
3.  **Reactivation reason requirement** (Task 3.5): suspend/ban explicitly require a mandatory reason per REQ-F-Admin-003's override/suspension language; reactivation is not explicitly covered. This playbook treats reactivation's reason as optional. Flagged for confirmation — a stricter audit policy may want it mandatory too.
4.  **"Reported/flagged" product queue mechanism** (Task 4.1): SCR-AD05 references "reported/flagged listings" but **no source document defines a report-submission mechanism** (no reports/flags table exists in Doc 5, and no buyer-facing "report this listing" flow appears in App Flow §4 Buyer Storefront screens). This playbook implements the moderation **queue** as "all products, filterable by status," with a reported filter parameter reserved but **non-functional** until a reporting mechanism is built elsewhere. This is escalated as a **documentation gap**, not silently assumed away (see below).
5.  **returns\_confidence\_threshold MVP exposure** (Task 6.5): treated as read-only in the MVP Admin Console since its consuming feature (R1.1 ReturnsAI automation, Feature 8) is not yet built. If the Admin Console is expected to allow pre-configuring this value ahead of Feature 8's build, this assumption should be revisited.

### **Unresolved Documentation Gaps**

1.  **No product-reporting mechanism exists in the schema or any prior feature.** SCR-AD05 (App Flow) presumes listings arrive in the moderation queue via "reported/flagged" status, but no table, buyer-facing action, or event captures a report. This is a **genuine gap** between the App Flow's UI description and the Backend Schema/PRD, not resolvable within this feature alone (would require a new table, e.g., product\_reports, which is out of scope for "DO NOT MODIFY Database Schema" here). Recommend raising this to the schema owner before Product Moderation is considered fully spec-complete; in the interim, this playbook's Task 4 supports admin-initiated review of **any** product regardless of report status.
2.  **No defined reconciliation workflow for banning a seller with open orders** (referenced in Task 3.6/Assumption 2) — App Flow names the edge case without defining the workflow (who processes stuck orders, whether buyers are refunded automatically, whether orders reassign or simply complete under the banned seller's existing fulfilment chain). Recommend a future documentation addendum before this becomes a real operational path.
3.  **No explicit definition of "active users" for the KPI dashboard** (Assumption 1) — recommend PRD/TRD clarification distinguishing DAU/MAU-style definitions from simple login-recency, especially since buyers and sellers may have very different login cadences (sellers daily per PRD §10, buyers "frequent" but not defined numerically).
4.  **platform\_config cache-invalidation ownership across consumers** (Task 6.4) — no source document specifies whether any existing feature caches config values (e.g., in-process or Redis) in a way that would delay a config change from taking effect. This playbook flags but does not resolve the cross-feature verification; if any consumer is found to cache, that consumer's feature owner should add invalidation logic, and this should be tracked as a cross-cutting follow-up.

*End of Playbook — Feature 12: Admin Panel. All three responses (Tasks 1–6, Validation & Testing, Consistency Review) are now complete. No section was rewritten after its initial generation.*