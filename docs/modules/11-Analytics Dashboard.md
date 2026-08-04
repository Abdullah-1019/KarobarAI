# **KarobarAI — Engineering Execution Playbook**

## **Feature 11: Analytics Dashboard**

**Source of truth:** PRD (Doc 1) · TRD (Doc 2) · App Flow (Doc 3) · Backend Schema (Doc 5) · Implementation Plan (Doc 6) **Depends on:** Feature 1 (Auth/RBAC), Feature 4 (Product Management), Feature 7 (Orders), Feature 10 (Payments)

**Status:** Draft — Response 1 of 3 (Tasks 1–2).

## **Table of Contents**

1.  [Feature Overview](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#1-feature-overview)
2.  [Analytics Flow](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#2-analytics-flow)
3.  Task 1 — Analytics Foundation
4.  Task 2 — Revenue Aggregation
5.  *(Deferred to Response 2)* Task 3 — Sales Analytics
6.  *(Deferred to Response 2)* Task 4 — Order Analytics
7.  *(Deferred to Response 3)* Task 5 — Customer Analytics & Charts
8.  *(Deferred to Response 3)* Task 6 — Top Products
9.  *(Deferred to Response 3)* Validation & Testing
10.  *(Deferred to Response 3)* Consistency Review, Assumptions, Documentation Gaps

## **1\. Feature Overview**

-   Implements the **MVP core analytics metrics** (REQ-F-Analytics-001/002/003/005, SCR-S08): revenue (month/prev/YTD + % change), daily sales trend, revenue-by-category, top-products, date-range filter with **<3s reload**.
-   Explicitly excludes/reserves **R1.1 AI recommendation cards** (REQ-F-Analytics-004, F7) and **Future** analytics export (REQ-F-Analytics-006, F25) — this playbook does not build either.
-   This is a **read-only aggregation layer** over data already owned by Orders (Feature 7), Payments/Settlements (Feature 10), and Products (Feature 4). No new source-of-truth tables are introduced; per Doc 5 §7 and TRD §19, **pre-aggregated/materialized views** are the documented mechanism for meeting the <3s reload target — this feature builds that aggregation layer, not new transactional tables.
-   **Customer Analytics** is named in the Feature 11 brief but is **not an explicit PRD requirement** (PRD §12.5 lists only revenue/sales-trend/top-products/AI-cards/export). It is treated here as a natural extension derived from existing orders/buyer\_profiles data (e.g., unique buyers, new vs. repeat) and flagged as an **Assumption** (see final consistency review in Response 3) rather than invented as a hard requirement.
-   **Ownership rule (Doc 5 §9):** a seller may only read analytics derived from orders/products where seller\_id = self. Admin sees platform-wide KPIs via the **existing** Admin Dashboard (SCR-AD01) — that is a separate, already-scoped screen and is **not rebuilt or duplicated** here; this feature is seller-scoped analytics only (SCR-S08).

## **2\. Analytics Flow**

Seller @ /seller/analytics (SCR-S08)

│

▼

Date-range selector (7d / 30d / 3m / custom) ──► validate (start ≤ end)

│

▼

Analytics Query Layer (this feature)

│

├──► Revenue Aggregation ──reads──► settlements + orders (Feature 10/7, RESTRICT/immutable)

├──► Sales Analytics ──reads──► orders + order\_items (Feature 7)

├──► Order Analytics ──reads──► orders (status breakdown, Feature 7)

├──► Customer Analytics ──reads──► orders + buyer\_profiles (unique/repeat buyers)

├──► Top Products ──reads──► order\_items + products (Feature 4/7)

│

▼

Pre-aggregated / cached response (Redis + materialized view, TRD §19/Doc 5 §7)

│

▼

Charts & Cards rendered (SCR-S08) — reload <3s (REQ-F-Analytics-005)

│

▼

\[R1.1, reserved — not built\] AI Recommendation Card

\[Future, reserved — not built\] Export PDF/Excel

Notes:

-   All reads are **RESTRICT/append-only** sources (orders, order\_items, settlements — Doc 5 §8); this feature **never writes** to those tables, only aggregates from them.
-   Ownership filtering (seller\_id = self) is applied at the **repository query level**, reusing the same ownership pattern as Feature 7/Feature 10 — not reinvented.

## **Task 1 — Analytics Foundation**

### **Purpose**

-   Stand up the analytics module skeleton (routes/controller/service/repository) inside the existing Core API structure (TRD §12), following the same modular-monolith pattern as every other domain module.
-   Establish the **shared query-scoping utility** (date-range parsing + seller-ownership filter) that every subsequent analytics task (Revenue, Sales, Order, Customer, Top Products) will reuse — built once, not per-metric.

### **Dependencies**

-   Feature 1: Auth middleware, JWT, RBAC (SELLER role) + ownership middleware, response envelope, error hierarchy, Zod validation framework.
-   Feature 4: Product repository (for later Top Products joins).
-   Feature 7: Order repository/schema (orders, order\_items).
-   Feature 10: Settlement repository/schema (settlements).
-   TRD §19 caching strategy (Redis, per-range TTL) and Doc 5 §7 (materialized views/pre-aggregation) — reused patterns, not new infrastructure choices.

### **Expected Deliverables**

-   \[ \] analytics module scaffold under apps/api/src/modules/analytics/
-   \[ \] Shared DateRangeDto (Zod) supporting 7d | 30d | 3m | custom(start,end)
-   \[ \] AnalyticsOwnershipGuard — reusable seller-scoping utility for all analytics queries
-   \[ \] AnalyticsRepository base class/interface other analytics repos extend
-   \[ \] Redis cache-key convention for analytics responses (per seller, per range)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 1.1 | Create analytics module folder (controller.ts, service.ts, routes.ts, dto.ts, repository.ts) under apps/api/src/modules/analytics/ per TRD §12 layout | Folder scaffolded, empty handlers wired to router | pnpm build compiles; route /api/v1/seller/analytics mounts (stub OK) |
| --- | --- | --- | --- |
| 1.2 | Define DateRangeDto (Zod): presets 7d/30d/3m, or custom requiring startDate ≤ endDate (SCR-S08 validation rule) | Reusable DTO exported from dto.ts | Unit test: custom with start > end rejected; presets resolve to correct date boundaries |
| --- | --- | --- | --- |
| 1.3 | Implement AnalyticsOwnershipGuard: derives sellerId from authenticated principal (reuses Feature 1 ownership middleware pattern), injects seller\_id = self filter into every downstream repository call | Single reusable guard/decorator | Integration test: seller A's request never returns seller B's data, across all analytics endpoints |
| --- | --- | --- | --- |
| 1.4 | Define AnalyticsRepository base (Prisma-backed) exposing a shared resolveDateRange() helper (preset → concrete Date boundaries) used by all metric-specific repos | Base class/interface | Unit test: 7d/30d/3m presets resolve to correct Date ranges relative to now() |
| --- | --- | --- | --- |
| 1.5 | Establish Redis cache-key convention: analytics:{sellerId}:{metric}:{rangeHash}, TTL aligned to "pre-aggregated analytics | per-range" (TRD §19) | Cache-key builder utility |
| --- | --- | --- | --- |
| 1.6 | Register analytics-specific error codes: INVALID\_DATE\_RANGE, ANALYTICS\_RANGE\_TOO\_LARGE (if a max lookback is enforced — flagged as Assumption if no source doc specifies a cap) in shared error-code enum (TRD §9) | Error codes added to packages/shared | Envelope emits correct code or 400 on invalid range |
| --- | --- | --- | --- |

### **Common Errors**

-   Re-implementing ownership filtering per-metric instead of the shared AnalyticsOwnershipGuard — risks a metric accidentally leaking cross-seller data.
-   Creating a new database table for "analytics" instead of aggregating from existing orders/order\_items/settlements/products — schema is frozen (Doc 5); only materialized views/cache layers are permitted (Doc 5 §7).

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Aggregation storage mechanism | Redis cache + optional Postgres materialized view, no new base tables | Doc 5 §7 explicitly reserves "pre-aggregated analytics tables/materialized views" as the mechanism for <3s reload; schema is otherwise frozen |
| --- | --- | --- |
| Ownership enforcement point | Single shared AnalyticsOwnershipGuard applied at repository level | Consistent with Repository pattern (TRD §3) already used across the codebase; avoids per-endpoint duplication |
| --- | --- | --- |
| Date-range model | Shared DateRangeDto with presets + custom, validated once in Task 1 | Reused unmodified by Tasks 2–6; matches SCR-S08 UI spec exactly (7d/30d/3m/custom) |
| --- | --- | --- |

### **Artifacts Produced**

-   apps/api/src/modules/analytics/ (controller, service, routes, dto, repository) — reused by every subsequent task in this feature.
-   DateRangeDto — reused by Revenue, Sales, Order, Customer, Top Products tasks (Tasks 2–6).
-   AnalyticsOwnershipGuard — reused by all analytics endpoints; no per-metric reimplementation.
-   AnalyticsRepository base + Redis cache-key convention — extended (not duplicated) by every metric-specific repository below.

### **Definition of Done**

-   \[ \] analytics module compiles and mounts under /api/v1/seller/analytics with stub handlers
-   \[ \] DateRangeDto validated by unit tests for all four range types
-   \[ \] Ownership guard proven to block cross-seller access in an integration test
-   \[ \] Cache-key builder unit-tested for determinism and uniqueness
-   \[ \] Zero Prisma schema drift — no new tables/columns introduced
-   \[ \] Lint/type-check clean

## **Task 2 — Revenue Aggregation**

### **Purpose**

-   Deliver REQ-F-Analytics-001: current month / previous month / YTD revenue with % change — the first metric card on SCR-S08.
-   Source revenue strictly from **immutable, settled** data (settlements) rather than pending/unconfirmed orders, to avoid showing revenue that could later reverse.

### **Dependencies**

-   Task 1 (Analytics Foundation): module scaffold, DateRangeDto, AnalyticsOwnershipGuard, AnalyticsRepository base, cache-key convention.
-   Feature 10: settlements table/repository (gross, commission, net, status, settled\_at — Doc 5 §4.13), already implemented and immutable once SETTLED.

### **Expected Deliverables**

-   \[ \] RevenueAnalyticsService.getSummary(sellerId, range) → {current, previous, ytd, pctChangeVsPrevious}
-   \[ \] GET /api/v1/seller/analytics/revenue endpoint
-   \[ \] Cached response (per Task 1 convention) with correct invalidation on new settlement writes
-   \[ \] Swagger entry

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 2.1 | Implement RevenueAnalyticsRepository.sumSettledRevenue(sellerId, from, to): SUM(net) over settlements where seller\_id = self and status = SETTLED and settled\_at BETWEEN from AND to | Aggregate query, ownership-scoped | Unit test against seeded settlements: correct sum for a known date range |
| --- | --- | --- | --- |
| 2.2 | Implement RevenueAnalyticsService.getSummary(): computes **current month**, **previous month**, and **YTD** by calling the repository three times (or one grouped query), then pctChange = (current - previous) / previous (guard divide-by-zero → null/0% when previous = 0) | Service returns {current, previous, ytd, pctChangeVsPrevious} | Unit test: zero-previous-month case returns a safe percentage (no Infinity/NaN) |
| --- | --- | --- | --- |
| 2.3 | Implement GET /api/v1/seller/analytics/revenue?range= controller: applies AnalyticsOwnershipGuard, DateRangeDto, calls service, returns enveloped response | 200 with revenue summary | Integration test: seller sees only their own settled revenue |
| --- | --- | --- | --- |
| 2.4 | Wire Redis caching (Task 1 key convention analytics:{sellerId}:revenue:{rangeHash}), TTL per-range (TRD §19 "pre-aggregated analytics | per-range") | Cached responses served on repeat calls within TTL | Integration test: second call within TTL does not re-hit DB (mock/spy on repository) |
| --- | --- | --- | --- |
| 2.5 | Define cache invalidation trigger: bust analytics:{sellerId}:revenue:\* when a **new settlements row transitions to SETTLED** (hook into Feature 10's settlement-status-change event, reusing its existing event/queue mechanism — no new event bus) | Cache busts on new settlement | Integration test: settling a new order updates the revenue figure on next (uncached) read |
| --- | --- | --- | --- |
| 2.6 | Swagger annotation for GET /api/v1/seller/analytics/revenue | Visible in /api-docs | Manual check |
| --- | --- | --- | --- |

### **Common Errors**

-   Computing revenue from orders.total\_amount directly instead of settlements.net — conflates gross order value with actual seller payout and ignores commission/settlement status, contradicting Doc 5's settlements design intent.
-   Including PENDING/ON\_HOLD settlements in the revenue sum — only SETTLED rows represent confirmed, immutable revenue.
-   Missing divide-by-zero guard on % change when the previous period has no revenue.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Revenue source of truth | settlements.net where status = SETTLED | settlements (Doc 5 §4.13) is the immutable, authoritative payout record post-commission; orders.total\_amount includes shipping/unsettled/cancellable value and would overstate revenue |
| --- | --- | --- |
| Cache invalidation trigger | Reuse Feature 10's existing settlement-status-change signal | Avoids inventing a new event mechanism; consistent with TRD §3 Queue/Producer-Consumer pattern already in place |
| --- | --- | --- |

### **Artifacts Produced**

-   RevenueAnalyticsRepository, RevenueAnalyticsService — the aggregation pattern (repository sums immutable data → service computes derived %, cached, invalidated on source event) is **reused verbatim** by Task 3 (Sales) and Task 4 (Order Analytics).
-   GET /api/v1/seller/analytics/revenue — first live endpoint on SCR-S08's revenue cards.

### **Definition of Done**

-   \[ \] Revenue figures match a manual SUM(net) check against seeded settlements data for current/previous/YTD
-   \[ \] % change handles zero-previous-period without error
-   \[ \] Only SETTLED settlements counted; PENDING/ON\_HOLD excluded
-   \[ \] Response scoped to authenticated seller only (cross-seller test passes)
-   \[ \] Cached response invalidates correctly on new settlement
-   \[ \] Swagger documents the endpoint
-   \[ \] Reload well under 3s target on seeded test data (REQ-F-Analytics-005 directionally verified; full perf validation deferred to Task 7 Validation & Testing)

*End of Response 1 (Tasks 1–2). Say "continue" for Response 2 — Task 3 (Sales Analytics) and Task 4 (Order Analytics).*

## **Table of Contents (updated)**

1.  [Feature Overview](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#1-feature-overview)
2.  [Analytics Flow](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#2-analytics-flow)
3.  Task 1 — Analytics Foundation
4.  Task 2 — Revenue Aggregation
5.  Task 3 — Sales Analytics
6.  Task 4 — Order Analytics
7.  *(Deferred to Response 3)* Task 5 — Customer Analytics & Charts
8.  *(Deferred to Response 3)* Task 6 — Top Products
9.  *(Deferred to Response 3)* Validation & Testing
10.  *(Deferred to Response 3)* Consistency Review, Assumptions, Documentation Gaps

**Status:** Draft — Response 2 of 3 (Tasks 1–4).

## **Task 3 — Sales Analytics**

### **Purpose**

-   Deliver REQ-F-Analytics-002: daily sales trend chart and revenue breakdown by category — the trend/category cards on SCR-S08.
-   Reuse the exact aggregation pattern established in Task 2 (repository sums immutable source data → service derives series/breakdown → cached, invalidated on source event), applied to a time-series and a category grouping instead of a single summary figure.

### **Dependencies**

-   Task 1 (Analytics Foundation): module scaffold, DateRangeDto, AnalyticsOwnershipGuard, AnalyticsRepository base, cache-key convention.
-   Task 2 (Revenue Aggregation): reused aggregation/caching/invalidation pattern (not reimplemented).
-   Feature 7: orders, order\_items (line-item snapshots incl. title\_snapshot, unit\_price, quantity — Doc 5 §4.11).
-   Feature 4: products.category\_id → categories (Doc 5 §4.5/§4.6) for the category breakdown join.

### **Expected Deliverables**

-   \[ \] SalesAnalyticsService.getDailyTrend(sellerId, range) → array of {date, revenue, orderCount}
-   \[ \] SalesAnalyticsService.getCategoryBreakdown(sellerId, range) → array of {categoryId, categoryNameEn, categoryNameUr, revenue, pctOfTotal}
-   \[ \] GET /api/v1/seller/analytics/sales-trend endpoint
-   \[ \] GET /api/v1/seller/analytics/category-breakdown endpoint
-   \[ \] Cached, ownership-scoped, invalidated per Task 2 pattern
-   \[ \] Swagger entries

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 3.1 | Implement SalesAnalyticsRepository.dailyRevenueSeries(sellerId, from, to): groups **delivered/completed orders** (orders.status IN (DELIVERED, COMPLETED), seller\_id = self) by DATE(delivered\_at) (or placed\_at — see Engineering Decisions), summing order\_items line totals per day | Ordered array of {date, revenue, orderCount} covering every day in range (zero-filled gaps) | Unit test: seeded orders across 3 distinct days produce 3 correct buckets; days with no orders return 0, not omitted |
| --- | --- | --- | --- |
| 3.2 | Implement SalesAnalyticsRepository.categoryRevenue(sellerId, from, to): joins order\_items → products → categories, sums unit\_price × quantity grouped by category\_id, computes pctOfTotal server-side | Array of category rows summing to ~100% | Unit test: category totals sum to overall period revenue (within rounding tolerance) |
| --- | --- | --- | --- |
| 3.3 | Implement SalesAnalyticsService.getDailyTrend() / getCategoryBreakdown(): call repository methods, apply DateRangeDto resolution (Task 1), zero-fill missing days for the trend chart | Service-level DTOs ready for chart consumption | Unit test: 7d range with only 2 days of data returns a 7-length array, 5 zero-value entries |
| --- | --- | --- | --- |
| 3.4 | Implement GET /api/v1/seller/analytics/sales-trend?range= and GET /api/v1/seller/analytics/category-breakdown?range= controllers — AnalyticsOwnershipGuard + DateRangeDto applied identically to Task 2 | 200 responses, enveloped | Integration test: ownership isolation holds for both endpoints |
| --- | --- | --- | --- |
| 3.5 | Wire Redis caching using Task 1's key convention (analytics:{sellerId}:sales-trend:{rangeHash}, analytics:{sellerId}:category-breakdown:{rangeHash}) | Cached responses | Integration test: repeat call within TTL served from cache |
| --- | --- | --- | --- |
| 3.6 | Reuse Task 2's cache-invalidation hook: bust sales-trend/category-breakdown keys on the same order-lifecycle event that marks an order DELIVERED/COMPLETED (reuse Feature 7's existing status-transition event, no new event bus) | Cache busts on new delivered order | Integration test: newly delivered order appears in next (uncached) trend read |
| --- | --- | --- | --- |
| 3.7 | Swagger annotations for both endpoints | Visible in /api-docs | Manual check |
| --- | --- | --- | --- |

### **Common Errors**

-   Aggregating from orders.status = PAYMENT\_CONFIRMED/PROCESSING instead of DELIVERED/COMPLETED — would count sales that could still be cancelled or fail delivery, inconsistent with Task 2's "confirmed data only" principle.
-   Omitting zero-revenue days from the trend array — breaks chart rendering (SCR-S08 expects a continuous series; App Flow §3 SCR-S08 explicitly notes "charts handle gaps gracefully").
-   Recomputing category % on the client instead of server-side — pushes business logic out of the service layer (TRD §3 Service-layer pattern).

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Sales "date" basis for trend | delivered\_at (fallback to placed\_at only if delivered\_at IS NULL, e.g., in-flight orders excluded from trend but visible in Order Analytics, Task 4) | Matches Task 2's "confirmed, non-reversible" principle — a placed-but-undelivered order isn't yet realized sales; kept consistent with revenue's SETTLED-only basis |
| --- | --- | --- |
| Category source | order\_items.product\_id → products.category\_id, not a category snapshot on order\_items | Doc 5 §4.11 does not snapshot category on order\_items; current category assignment is used, consistent with schema as designed (no schema change) |
| --- | --- | --- |

### **Artifacts Produced**

-   SalesAnalyticsRepository, SalesAnalyticsService — the zero-filled time-series pattern here is reused by Task 5 (Customer Analytics trend, if needed) and referenced by Task 6 (Top Products uses the same order\_items join style).
-   GET /api/v1/seller/analytics/sales-trend, GET /api/v1/seller/analytics/category-breakdown — live endpoints for SCR-S08's trend chart and category breakdown.

### **Definition of Done**

-   \[ \] Daily trend array is zero-filled and continuous across the full selected range
-   \[ \] Category breakdown percentages sum to ~100% of period revenue
-   \[ \] Only DELIVERED/COMPLETED orders counted
-   \[ \] Ownership isolation verified for both endpoints
-   \[ \] Cache invalidates correctly on newly delivered orders
-   \[ \] Swagger documents both endpoints

## **Task 4 — Order Analytics**

### **Purpose**

-   Provide order-count/status-breakdown statistics that support the dashboard's order-related summary cards (SCR-S01 "Total Orders" and SCR-S08 context) — distinct from Revenue (money) and Sales (delivered-trend), this task covers **order volume and lifecycle-state distribution**.
-   Give sellers visibility into operationally relevant states (e.g., PENDING\_MANUAL\_LOGISTICS, CANCELLED rate) alongside completed-order counts.

### **Dependencies**

-   Task 1 (Analytics Foundation): shared scaffold/guard/DTO/cache convention.
-   Task 2/3 pattern: reused aggregation → service → cache → invalidate structure.
-   Feature 7: orders.status (full order\_status enum, Doc 5 §3), order repository.

### **Expected Deliverables**

-   \[ \] OrderAnalyticsService.getSummary(sellerId, range) → {totalOrders, byStatus: {...}, cancelledRate, avgOrderValue}
-   \[ \] GET /api/v1/seller/analytics/orders endpoint
-   \[ \] Cached, ownership-scoped, invalidated per established pattern
-   \[ \] Swagger entry

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 4.1 | Implement OrderAnalyticsRepository.countByStatus(sellerId, from, to): groups orders by status where seller\_id = self and placed\_at BETWEEN from AND to, returns count per enum value (schema §3 order\_status) | Map of {status: count} covering all 10 enum values (zero for unused) | Unit test: seeded orders across 4 distinct statuses return correct counts; untouched statuses return 0 |
| --- | --- | --- | --- |
| 4.2 | Implement OrderAnalyticsRepository.avgOrderValue(sellerId, from, to): AVG(total\_amount) over non-cancelled orders in range | Numeric average | Unit test against seeded orders: matches manual calculation |
| --- | --- | --- | --- |
| 4.3 | Implement OrderAnalyticsService.getSummary(): combines total count, per-status breakdown, cancelledRate = cancelledCount / totalOrders (zero-guard), avgOrderValue | Single summary DTO | Unit test: zero-orders-in-range case returns safe defaults (0s, not errors) |
| --- | --- | --- | --- |
| 4.4 | Implement GET /api/v1/seller/analytics/orders?range= controller — same guard/DTO pattern as Tasks 2–3 | 200 enveloped response | Integration test: ownership isolation holds |
| --- | --- | --- | --- |
| 4.5 | Wire caching (analytics:{sellerId}:orders:{rangeHash}) and invalidation on **any** order-status-change event (reuse Feature 7's existing status-transition mechanism — broadest trigger of the three analytics caches since every status change affects this metric) | Cache busts on any order status change | Integration test: a status transition (e.g., PROCESSING → CANCELLED) updates counts on next uncached read |
| --- | --- | --- | --- |
| 4.6 | Surface PENDING\_MANUAL\_LOGISTICS count distinctly in the response (operationally significant per TRD §14/REQ-F-Logistics-007) so it can be highlighted on the dashboard | Field present in response payload | Integration test: seeded manual-logistics order appears in the correct bucket |
| --- | --- | --- | --- |
| 4.7 | Swagger annotation for GET /api/v1/seller/analytics/orders | Visible in /api-docs | Manual check |
| --- | --- | --- | --- |

### **Common Errors**

-   Excluding CANCELLED orders from totalOrders — total should reflect all orders placed in range; cancellation rate is a derived ratio, not an exclusion filter.
-   Using delivered\_at as the range anchor here (as Task 3 does) instead of placed\_at — Order Analytics measures order **volume/lifecycle at placement**, not realized/delivered sales; using the wrong anchor would undercount in-flight and cancelled orders.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Order Analytics date anchor | orders.placed\_at (not delivered\_at) | This metric measures order volume and lifecycle distribution as they occur, not realized sales (that's Task 3's job); using placed\_at ensures cancelled/in-flight/manual-logistics orders are correctly counted in the period they occurred |
| --- | --- | --- |
| Cache invalidation scope | Any orders.status transition busts this cache | Broadest of the three metrics' invalidation triggers, since every lifecycle event changes the status distribution; still reuses Feature 7's existing event mechanism, no new infra |
| --- | --- | --- |

### **Artifacts Produced**

-   OrderAnalyticsRepository, OrderAnalyticsService — status-breakdown aggregation pattern; the countByStatus grouping approach is referenced by Task 5 (Customer Analytics may reuse similar grouping for new-vs-repeat buyer classification).
-   GET /api/v1/seller/analytics/orders — feeds SCR-S01 dashboard's "Total Orders"/"Return Requests"-adjacent context and SCR-S08.

### **Definition of Done**

-   \[ \] Status breakdown counts sum to totalOrders
-   \[ \] cancelledRate computed safely (no divide-by-zero) and matches manual check
-   \[ \] PENDING\_MANUAL\_LOGISTICS surfaced distinctly
-   \[ \] Ownership isolation verified
-   \[ \] Cache invalidates on any status change
-   \[ \] Swagger documents the endpoint

*End of Response 2 (Tasks 3–4). Say "continue" for Response 3 — Task 5 (Customer Analytics & Charts), Task 6 (Top Products), Validation & Testing, and the final consistency review.*

## **Table of Contents (updated — final)**

1.  [Feature Overview](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#1-feature-overview)
2.  [Analytics Flow](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#2-analytics-flow)
3.  Task 1 — Analytics Foundation
4.  Task 2 — Revenue Aggregation
5.  Task 3 — Sales Analytics
6.  Task 4 — Order Analytics
7.  Task 5 — Customer Analytics & Charts
8.  Task 6 — Top Products
9.  Validation & Testing
10.  Consistency Review, Assumptions, Documentation Gaps

**Status:** Final — Response 3 of 3 (Tasks 1–6 + Validation & Consistency Review complete).

## **Task 5 — Customer Analytics & Charts**

### **Purpose**

-   Provide buyer-side metrics (unique buyers, new vs. repeat) that support the dashboard's customer context — treated as an **Assumption-driven extension** since it is not an explicit PRD requirement ID (see §11).
-   Consolidate the **Charts & Visualizations** requirement (SCR-S08's chart rendering needs) as a data-shaping layer over Tasks 2–4's outputs, rather than a separate metrics domain — charts are a presentation contract on existing aggregates, not new source data.

### **Dependencies**

-   Task 1 (Analytics Foundation): shared scaffold/guard/DTO/cache convention.
-   Task 3 (Sales Analytics): reuses its zero-filled time-series pattern for any chart-shaped customer trend.
-   Feature 7: orders.buyer\_id (order repository).
-   Feature 1: buyer\_profiles/users (read-only join for buyer identity — no new PII exposure; only aggregate counts, never individual buyer PII, per Doc 5 §17 encryption rules).

### **Expected Deliverables**

-   \[ \] CustomerAnalyticsService.getSummary(sellerId, range) → {uniqueBuyers, newBuyers, repeatBuyers, repeatRate}
-   \[ \] GET /api/v1/seller/analytics/customers endpoint
-   \[ \] ChartResponseFormatter — shared shaping utility converting Task 2/3/4/5 service outputs into a single chart-friendly contract (labels/series arrays) reused across all chart-bearing endpoints
-   \[ \] Cached, ownership-scoped, invalidated per established pattern
-   \[ \] Swagger entries

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 5.1 | Implement CustomerAnalyticsRepository.uniqueBuyers(sellerId, from, to): COUNT(DISTINCT buyer\_id) over orders where seller\_id = self, placed\_at BETWEEN from AND to | Integer count | Unit test: seeded orders from 3 distinct buyers (one placing 2 orders) → uniqueBuyers = 3 |
| --- | --- | --- | --- |
| 5.2 | Implement CustomerAnalyticsRepository.newVsRepeat(sellerId, from, to): classify each buyer in range as **new** (their earliest-ever order with this seller falls inside the range) vs **repeat** (earliest-ever order predates the range start) | {newBuyers, repeatBuyers} counts | Unit test: a buyer whose first-ever order is inside range → counted new; a buyer with a prior order before range start → counted repeat |
| --- | --- | --- | --- |
| 5.3 | Implement CustomerAnalyticsService.getSummary(): combines unique/new/repeat counts, repeatRate = repeatBuyers / uniqueBuyers (zero-guard) | Summary DTO | Unit test: zero-buyers-in-range → safe defaults, no divide-by-zero |
| --- | --- | --- | --- |
| 5.4 | Implement GET /api/v1/seller/analytics/customers?range= controller — identical guard/DTO pattern as Tasks 2–4 | 200 enveloped response | Integration test: ownership isolation holds |
| --- | --- | --- | --- |
| 5.5 | Implement ChartResponseFormatter.toSeries(data, labelKey, valueKey): a single reusable utility that converts any of Task 2 (revenue), Task 3 (daily trend, category breakdown), Task 4 (status breakdown), Task 5 (customer summary) outputs into a uniform {labels: string\[\], series: number\[\]} shape for chart consumption (SCR-S08: Recharts/AntD Charts, TRD §4) | One shared formatter used by all chart-bearing endpoints | Unit test: feeding Task 3's daily-trend array and Task 4's status-breakdown map both produce valid {labels, series} output via the same function |
| --- | --- | --- | --- |
| 5.6 | Retrofit **Task 3's** sales-trend/category-breakdown and **Task 4's** orders (status-breakdown) endpoints to optionally return the ChartResponseFormatter-shaped payload alongside the raw data (e.g., {raw: {...}, chart: {labels, series}}) — additive change, no breaking change to Tasks 3–4's existing contracts | Existing endpoints gain a chart field, backward-compatible | Regression test: Task 3/4 existing integration tests still pass unmodified; new assertion confirms chart field present |
| --- | --- | --- | --- |
| 5.7 | Wire caching for the customer endpoint (analytics:{sellerId}:customers:{rangeHash}) and invalidation on new-order-placed event (reuse Feature 7's existing event, no new infra) | Cache busts on new order placement | Integration test: a new order from a first-time buyer updates newBuyers on next uncached read |
| --- | --- | --- | --- |
| 5.8 | Swagger annotation for GET /api/v1/seller/analytics/customers; update Task 3/4 Swagger docs to reflect the additive chart field | Visible/current in /api-docs | Manual check |
| --- | --- | --- | --- |

### **Common Errors**

-   Exposing individual buyer identity (name/phone/email) in the customer analytics response — this task returns **aggregate counts only**; buyer PII must never surface here (Doc 5 §17 encryption/PII rules apply regardless of aggregation context).
-   Building a separate, one-off chart-shaping function per endpoint instead of the single shared ChartResponseFormatter — causes inconsistent chart contracts across the dashboard.
-   Classifying "new vs repeat" using only orders **within** the selected range (ignoring order history before the range start) — this would misclassify long-time buyers as "new" whenever a narrow date filter is applied.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Customer Analytics scope | Aggregate counts only (unique/new/repeat/repeat-rate); no per-buyer PII in response | Matches Doc 5 §17 PII-protection principle; no PRD requirement calls for buyer-level seller-facing profiles, and exposing them would be a scope/privacy overreach |
| --- | --- | --- |
| Chart shaping approach | Single shared ChartResponseFormatter, retrofitted additively onto Tasks 2–4 outputs | Avoids duplicated shaping logic per metric; additive chart field preserves backward compatibility with Tasks 2–4's already-defined contracts |
| --- | --- | --- |
| New-vs-repeat classification basis | Buyer's all-time order history with this seller (not range-bounded) determines new/repeat status | Prevents misclassification when a narrow date range is applied; consistent with how "new seller" onboarding nudges (SCR-S01) are similarly lifetime-based, not range-based |
| --- | --- | --- |

### **Artifacts Produced**

-   CustomerAnalyticsRepository, CustomerAnalyticsService — new-vs-repeat classification logic; no further tasks in this feature build on it directly, but it is the natural extension point for any future buyer-segmentation feature (out of scope here).
-   GET /api/v1/seller/analytics/customers — new endpoint for SCR-S08 customer context.
-   ChartResponseFormatter — retroactively adopted by Task 3 (sales-trend, category-breakdown) and Task 4 (orders) endpoints; will also be used by Task 6 (Top Products) below.

### **Definition of Done**

-   \[ \] Unique/new/repeat buyer counts match manual verification against seeded order history (including orders **outside** the selected range for classification purposes)
-   \[ \] No individual buyer PII present in any response payload
-   \[ \] repeatRate computed safely (no divide-by-zero)
-   \[ \] ChartResponseFormatter produces valid {labels, series} for at least Revenue, Sales-trend, Order-status, and Customer data
-   \[ \] Tasks 3–4 existing tests still pass after additive chart field retrofit
-   \[ \] Ownership isolation verified
-   \[ \] Swagger current for all affected endpoints

## **Task 6 — Top Products**

### **Purpose**

-   Deliver REQ-F-Analytics-003: top-performing products list, with drill-through support noted in SCR-S08 ("click-through to product analytics").
-   Reuse the order\_items/products join pattern already established in Task 3's category breakdown, applied at product granularity instead of category granularity.

### **Dependencies**

-   Task 1 (Analytics Foundation): shared scaffold/guard/DTO/cache convention.
-   Task 3 (Sales Analytics): reused order\_items → products join pattern.
-   Task 5 (Customer Analytics & Charts): reused ChartResponseFormatter for any chart-shaped top-products view (e.g., bar chart of top 5).
-   Feature 4: Product repository (products.title\_en/title\_ur, product\_images for thumbnails).
-   Feature 7: order\_items (line-item snapshots).

### **Expected Deliverables**

-   \[ \] TopProductsService.getTopProducts(sellerId, range, limit) → ranked array {productId, titleEn, titleUr, thumbnailUrl, unitsSold, revenue}
-   \[ \] GET /api/v1/seller/analytics/top-products endpoint (supports limit query param, default per SCR-S08 table size)
-   \[ \] Drill-through support: response includes productId sufficient for the frontend to navigate to per-product analytics (no new per-product analytics endpoint required unless explicitly requested — flagged if ambiguous)
-   \[ \] Cached, ownership-scoped, invalidated per established pattern
-   \[ \] Swagger entry

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 6.1 | Implement TopProductsRepository.rankByRevenue(sellerId, from, to, limit): joins order\_items → products (RESTRICT FK, Doc 5 §4.11/§4.6) filtered to orders.seller\_id = self and orders.status IN (DELIVERED, COMPLETED) (consistent with Task 3's "realized sales" basis), grouped by product\_id, summing unit\_price × quantity as revenue and quantity as units sold, ordered DESC, limited | Ranked array of top-N products | Unit test: seeded order\_items across 5 products → correct top-3 ranking by revenue |
| --- | --- | --- | --- |
| 6.2 | Join product\_images (Doc 5 §4.7, position = 0 = primary) for thumbnail URL per product in the ranked list (reuse Feature 4's product-image repository query, not a new one) | Thumbnail URL present per row | Unit test: product with no images returns null/placeholder, not an error |
| --- | --- | --- | --- |
| 6.3 | Implement TopProductsService.getTopProducts(): applies DateRangeDto, calls repository, optionally shapes via ChartResponseFormatter (Task 5) for a bar-chart view alongside the raw ranked list | Service DTO: {list: \[...\], chart: {labels, series}} | Unit test: chart labels correspond to product titles in correct rank order |
| --- | --- | --- | --- |
| 6.4 | Implement GET /api/v1/seller/analytics/top-products?range=&limit= controller — same guard/DTO pattern as Tasks 2–5; validate limit (positive integer, sane upper bound e.g. ≤50 — flagged as Assumption if no source doc specifies a cap) | 200 enveloped response | Integration test: ownership isolation holds; invalid limit (e.g., negative) → 400 |
| --- | --- | --- | --- |
| 6.5 | Wire caching (analytics:{sellerId}:top-products:{rangeHash}:{limit}) and invalidation on the same delivered-order event reused in Task 3 | Cache busts on newly delivered order | Integration test: newly delivered order affecting product ranking updates on next uncached read |
| --- | --- | --- | --- |
| 6.6 | Swagger annotation for GET /api/v1/seller/analytics/top-products | Visible in /api-docs | Manual check |
| --- | --- | --- | --- |

### **Common Errors**

-   Ranking by quantity alone when the dashboard card is revenue-oriented (SCR-S08 lists it under revenue/sales context) — default sort must be by **revenue** unless the UI/UX Brief (Doc 4, not in this session) specifies otherwise; units-sold should be a secondary field, not the sort key, unless confirmed.
-   Re-querying product images with a bespoke query instead of reusing Feature 4's existing image-lookup repository method.
-   Including soft-deleted products (products.deleted\_at IS NOT NULL) in rankings — must respect the existing soft-delete middleware (Doc 5 §8) that scopes reads to deleted\_at IS NULL by default.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Top Products ranking basis | Revenue (unit\_price × quantity sum), unitsSold returned as secondary field | Consistent with the revenue-first framing of Task 2/3 and SCR-S08's placement of Top Products alongside revenue cards; units-sold remains available for sellers who want that view |
| --- | --- | --- |
| Order status filter | DELIVERED/COMPLETED only (same basis as Task 3) | Keeps all "sales-realized" metrics (Sales Analytics, Top Products) on a consistent, non-reversible data basis, distinct from Order Analytics' placed\_at/all-statuses basis (Task 4) |
| --- | --- | --- |

### **Artifacts Produced**

-   TopProductsRepository, TopProductsService — final new repository/service pair in this feature.
-   GET /api/v1/seller/analytics/top-products — completes the SCR-S08 screen's full endpoint set alongside Tasks 2–5.

### **Definition of Done**

-   \[ \] Top-N ranking matches manual verification against seeded order\_items data, sorted by revenue
-   \[ \] Soft-deleted products excluded from rankings
-   \[ \] Thumbnail resolution reuses Feature 4's existing image repository (no duplicate query logic)
-   \[ \] limit parameter validated with a sane bound
-   \[ \] Ownership isolation verified
-   \[ \] Cache invalidates on newly delivered orders affecting ranking
-   \[ \] Swagger documents the endpoint

## **Validation & Testing**

| **Layer** | **Coverage Target** | **Tooling (reused)** | **Key Scenarios** |
| --- | --- | --- | --- |
| Unit | Date-range resolution, aggregation math (%, zero-guards), ranking/grouping logic | Jest (reused, Feature 1 setup) | Zero-previous-period % change; zero-orders-in-range defaults; category %s summing to 100%; new-vs-repeat classification across range boundary |
| --- | --- | --- | --- |
| Integration | All 6 endpoints, ownership isolation, cache hit/miss/invalidation | Jest + Supertest, ephemeral Postgres/Redis (reused CI setup, TRD §23) | Seller A never sees Seller B's data on any of the 6 endpoints; each metric's designated invalidation event correctly busts its own cache key only |
| --- | --- | --- | --- |
| Performance | <3s reload target (REQ-F-Analytics-005) | k6/JMeter (reused Feature 11-adjacent harness from Implementation Plan Phase 11/12) | Cached and uncached response times measured against a seeded dataset approximating realistic seller order volume; validated fully in Deferred to Feature 12 (Optimization) per Implementation Plan, directionally checked here |
| --- | --- | --- | --- |
| Security | AuthZ/ownership on every analytics endpoint | Reused RBAC/ownership test harness (Feature 1) | Buyer/Admin roles cannot access /seller/analytics/\* routes meant for SELLER role; cross-seller data leakage tests for all 6 endpoints |
| --- | --- | --- | --- |
| Regression | No writes introduced to orders/order\_items/settlements/products | Existing Feature 4/7/10 test suites (rerun, not modified) | Confirm this feature is strictly read-only against all source tables |
| --- | --- | --- | --- |

### **Coverage Gate**

-   \[ \] ≥80% backend coverage maintained for all new analytics module code (REQ-NF-Quality-003), verified in CI via existing Istanbul/c8 gate — no new tooling.
-   \[ \] Zero lint/type errors (ESLint/tsc --noEmit, reused CI job).
-   \[ \] Full performance benchmarking against the <3s target is formally owned by **Deferred to Feature 12 (Optimization)** per Implementation Plan Phase 12 ("pre-aggregated analytics" tuning); this feature's Definition of Done items only require directional verification on seeded test data, not production-scale benchmarking.

## **Consistency Review, Assumptions, Documentation Gaps**

### **Consistency Review vs Features 0–10**

| **Check** | **Result** |
| --- | --- |
| No new database tables/columns/enums introduced | ✅ Pass — this feature is a pure read/aggregation layer over orders, order\_items, settlements, products, product\_images, categories, buyer\_profiles (all pre-existing, Doc 5) |
| --- | --- |
| No new routing conventions introduced | ✅ Pass — follows /api/v1/seller/analytics/<metric> (TRD §9), mirrors the role-scoped route pattern used elsewhere (e.g., Feature 10's /seller/returns in the prior playbook) |
| --- | --- |
| No new authentication mechanism introduced | ✅ Pass — reuses Feature 1's authenticate → authorize(SELLER) → ownership chain throughout, via the shared AnalyticsOwnershipGuard |
| --- | --- |
| No duplicate shared components rebuilt | ✅ Pass — response envelope, error hierarchy, Repository pattern, validation framework, Product/Order/Payment repositories all reused, not rebuilt |
| --- | --- |
| Revenue sourced from immutable data only | ✅ Pass — settlements.net where status = SETTLED, respecting Doc 5 §8 append-only/immutability rules; no direct reads of in-flight payments used as "revenue" |
| --- | --- |
| Ownership rules respected | ✅ Pass — every endpoint scoped to seller\_id = self per Doc 5 §9; no admin-wide aggregation built here (that already exists at SCR-AD01, out of scope) |
| --- | --- |
| Performance target acknowledged, not over-promised | ✅ Pass — <3s target (REQ-F-Analytics-005) addressed via caching/materialized-view pattern already reserved in Doc 5 §7/TRD §19; full load-bearing validation correctly deferred to Feature 12 (Optimization) per Implementation Plan |
| --- | --- |
| R1.1/Future scope correctly excluded | ✅ Pass — AI recommendation cards (REQ-F-Analytics-004, F7) and export (REQ-F-Analytics-006, F25) are named as explicitly out of scope, not stubbed or partially built |
| --- | --- |

**No conflicts found with Features 0–10 or with the PRD/TRD/App Flow/Schema/Implementation Plan.**

### **Assumptions Made (flagged, not invented as fact)**

1.  **"Customer Analytics" as a requirement** (Task 5): the Feature 11 brief lists "Customer Analytics" and "Customers" as in-scope, but PRD §12.5 (REQ-F-Analytics-001 through 006) does **not** define a customer/buyer metric explicitly. This playbook treats it as a reasonable, low-risk extension (aggregate unique/new/repeat buyer counts only, no PII) derived from existing orders/buyer\_profiles relations. **Action for implementers:** confirm this scope with the product owner before building Task 5's customer service; if rejected, Task 5 reduces to Charts-only (dropping the customer summary sub-section).
2.  **New-vs-repeat classification window** (Task 5.2): no source document defines whether "repeat" buyer status should be evaluated against the buyer's lifetime order history or only within the selected date range. This playbook assumes **lifetime history** (see Engineering Decision, Task 5) as the more useful and less misleading interpretation. Flagged as an assumption, not a documented certainty.
3.  **Top Products ranking basis** (Task 6): SCR-S08 lists "Top-products list" without specifying sort criteria (revenue vs. units sold). This playbook defaults to **revenue-sorted**, with units sold as a secondary field, based on the card's placement alongside revenue-oriented metrics. If the UI/UX Brief (Doc 4, not available in this session) specifies otherwise, this should be revisited.
4.  **top-products limit upper bound** (Task 6.4): no source document specifies a maximum page size for this list. This playbook assumes a conservative cap (≤50) consistent with general pagination discipline (TRD §9, default limit 20) rather than an unbounded query.
5.  **Analytics max lookback range** (Task 1.6): no source document specifies whether custom date ranges have an upper bound (e.g., max 1 year). ANALYTICS\_RANGE\_TOO\_LARGE was registered as an available error code but is **not enforced** by default in this playbook absent a confirmed limit — flagged for implementer confirmation before activating that validation.

### **Unresolved Documentation Gaps**

1.  **Per-product drill-through analytics (SCR-S08 "click-through to product analytics"):** the App Flow document references this navigation target but does not define what that per-product analytics screen/endpoint contains. This playbook's Top Products response includes productId sufficient to support such navigation, but the actual per-product analytics endpoint (if one is required beyond what Task 6 already returns) is **not built** here and should be raised as a scope question before a future feature attempts it.
2.  **Category breakdown for products with category\_id = NULL** (Task 3.2): Doc 5 §4.6 allows products.category\_id to be NULL (SET NULL on category deletion). No source document specifies how "uncategorized" revenue should be represented in the category breakdown (a synthetic "Uncategorized" bucket vs. silent exclusion). This playbook does not resolve this ambiguity; implementers should confirm before finalizing Task 3's category grouping query.
3.  **Materialized view vs. Redis-only caching decision** (Task 1): Doc 5 §7 mentions both "pre-aggregated analytics tables" and "materialized views" as options alongside Redis caching (TRD §19), but does not mandate which combination is required for MVP vs. which is a Future/Feature-12-only optimization. This playbook implements Redis caching as the MVP mechanism and treats materialized views as a **Deferred to Feature 12 (Optimization)** enhancement; this interpretation should be confirmed against the Implementation Plan owner's intent if a stricter reading is required.

*End of Playbook — Feature 11: Analytics Dashboard. All three responses (Tasks 1–6, Validation & Testing, Consistency Review) are now complete. No section was rewritten after its initial generation.*