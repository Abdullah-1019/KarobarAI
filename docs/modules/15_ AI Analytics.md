# **KarobarAI — Engineering Execution Playbook**

## **Feature 15: AI Analytics**

**Source of truth:** PRD (Doc 1) · TRD (Doc 2) · App Flow (Doc 3) · Backend Schema (Doc 5) · Implementation Plan (Doc 6) **Depends on:** Feature 1 (Auth/RBAC), Feature 4 (Product Management), Feature 7 (Orders), Feature 9 (Notifications), Feature 11 (Analytics Dashboard), Feature 13 (AI Store Builder — two-service/fallback pattern)

**Status:** Draft — Response 1 of 3 (Tasks 1–2).

## **⚠️ Conflict/Gap Flagged Before Proceeding**

Per this playbook's binding instruction ("If you discover any conflict with Features 0–14, stop and clearly identify it before continuing"), the following is flagged **now**, before any task detail:

-   PRD §12.5 (REQ-F-Analytics-004) and App Flow SCR-S08 describe an **"AI Recommendation card"** that sellers can **dismiss for 14 days** ("dismiss AI card \[R1.1\] (suppress 14 days)"). This implies **persisted state** (what was generated, when, and whether/until-when it's dismissed) that outlives a single request.
-   **Doc 5 (Backend Schema) has no table reserved for AI recommendations, sales insights, forecasts, or dismissal state** — unlike Feature 10/14's returns.ai\_\* columns, which were explicitly pre-provisioned, there is no equivalent for this feature anywhere in the 25 core entities (Doc 5 §1) or the R1.1/Future-marked reservations (Doc 5 §0).
-   Given the binding **"DO NOT MODIFY Database Schema"** constraint, this playbook resolves the gap **conservatively**: AI Analytics content is treated as **ephemeral, regenerable, and cached in Redis only** (no new Postgres table), with dismissal state also tracked in Redis (TTL-based, naturally expiring — a good structural fit for a "suppress for 14 days" requirement). This mirrors the resolution pattern already used in Feature 13 Task 5 (SEO Metadata) for an analogous schema gap.
-   This is **not silently invented** — it is called out here, applied consistently through every task below, and re-flagged in the final consistency review (Response 3) as an open documentation gap requiring product-owner confirmation (should this data ever need to be durable/auditable/historical, a schema amendment would be required, which is outside this feature's authority).

## **Table of Contents**

1.  [Feature Overview](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#1-feature-overview)
2.  [AI Analytics Flow](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#2-ai-analytics-flow)
3.  Task 1 — AI Analytics Foundation
4.  Task 2 — Analytics Data Preparation
5.  *(Deferred to Response 2)* Task 3 — Sales Insights Generation
6.  *(Deferred to Response 2)* Task 4 — Recommendation Engine
7.  *(Deferred to Response 3)* Task 5 — Sales Forecasting
8.  *(Deferred to Response 3)* Task 6 — Business Suggestions
9.  *(Deferred to Response 3)* Task 7 — Dashboard Integration
10.  *(Deferred to Response 3)* Validation & Testing
11.  *(Deferred to Response 3)* Consistency Review, Assumptions, Documentation Gaps

## **1\. Feature Overview**

-   Implements **R1.1 AI analytics recommendation cards** (PRD §12.5 REQ-F-Analytics-004; App Flow SCR-S08 "AI Recommendation card \[R1.1\]"; F7 in the Complete Feature List) — a **plain-language, data-derived** insight surfaced on top of Feature 11's existing Analytics Dashboard.
-   **"Sales Forecasts" and "Business Suggestions"** (named in the Feature 15 brief) are **not independently-numbered PRD requirements** — only REQ-F-Analytics-004's single "AI recommendation" is explicit. This playbook treats them as **sub-categories of that one requirement** (a recommendation can be insight-flavored, forecast-flavored, or suggestion-flavored), not three separate features/endpoints — flagged as an interpretive extension, consistent with how Feature 11 treated "Customer Analytics" as a derived extension of its own explicit requirements.
-   **Zero new data sources.** This feature reads exclusively from Feature 11's **existing** aggregation repositories (RevenueAnalyticsRepository, SalesAnalyticsRepository, OrderAnalyticsRepository, TopProductsRepository — Feature 11 Tasks 2–6) and Feature 4/7's product/order data. It does not recompute or duplicate any aggregation logic Feature 11 already built.
-   **Reuses Feature 13's two-service architecture wholesale**: a new AI Service router at the path **already reserved by TRD §5.2's own architecture table** — /recommend (TRD §2 diagram explicitly lists AI SERVICE (FastAPI) ... /recommend (R1.1) alongside /generate-listing and /analyze-return) — plus the identical GPT-4V→GPT-3.5 fallback chain (D3), provider-agnostic client pattern, and Core API↔AI Service private-REST call convention Feature 13 Task 1 and Feature 14 Task 1 already established. **No new architectural pattern is introduced** — this is the third and final consumer of that shared pattern (Store Builder, Returns, now Analytics).
-   **Output integration point:** Feature 11's GET /api/v1/seller/analytics/\* endpoints and SCR-S08's dashboard — this feature adds a **new, additive** endpoint (GET /api/v1/seller/analytics/ai-recommendations) alongside Feature 11's existing ones, never modifying them (Task 7).
-   **Explicitly out of scope:** any change to Feature 11's core metrics (Revenue/Sales/Order/Customer/Top-Products), any new database table/column, any change to the AI Store Builder (Feature 13) or ReturnsAI (Feature 14) pipelines beyond reusing their established *patterns*.

## **2\. AI Analytics Flow**

Seller @ /seller/analytics (SCR-S08, Feature 11's existing dashboard)

│

▼

Dashboard loads core metrics (Feature 11, UNCHANGED) + requests AI Recommendation card

│

▼

Core API: GET /api/v1/seller/analytics/ai-recommendations

│

├─► Check Redis: has this seller dismissed their current card? (dismissal TTL, this feature's gap-resolution)

│ │ yes → return {dismissed: true}, no AI call made

│ │ no ↓

▼

Check Redis: cached recommendation for this seller still fresh (e.g. weekly refresh cadence)?

│ │ yes → return cached result, no AI call made

│ │ no ↓

▼

Analytics Data Preparation (this feature, Task 2)

│ pulls from Feature 11's EXISTING repositories only — no new aggregation logic

│ {revenue trend, top products, category mix, order volume, cancellation rate}

▼

Core API ──REST, private network (TRD §1, same pattern as Features 13/14)──► AI Service: POST /recommend

│ │

│ LLM Client: GPT-4 (text)

│ primary → GPT-3.5-turbo fallback (D3)

│ │

│ Structured JSON: {insights\[\],

│ recommendations\[\], forecast?,

│ suggestions\[\]}

◄──────────────────────────────────────────────────────────────────────────────┘

│

▼

Cache result in Redis (per-seller, TTL-bound) ──► return to dashboard

│

▼

Seller sees AI Recommendation card (SCR-S08) → can dismiss (suppress 14 days, Redis TTL)

Notes:

-   **No AI call is made** if a fresh cached result exists or the seller has an active dismissal — this bounds LLM cost per PRD Risk R4 ("LLM API cost overrun... cache") and TRD T2, both already-established project-wide mitigations this feature must honor, not reinvent.
-   The AI Service is **never** reachable from the public internet (TRD §8), identical constraint to Features 13/14.

## **Task 1 — AI Analytics Foundation**

### **Purpose**

-   Stand up the AI Service's /recommend router (TRD §5.2/§2's already-named, R1.1-reserved path) and the Core API–side glue module, reusing the **exact** two-service scaffolding pattern from Feature 13 Task 1 / Feature 14 Task 1 — no new pattern invented for the third time this architecture is used.
-   Establish the **text-only** LLM client variant needed here (this feature has no image input, unlike Feature 13's Vision call or Feature 14's Vision+CNN call) — a lighter-weight reuse of the same provider-agnostic LlmClient interface Feature 13 Task 1 already defined.

### **Dependencies**

-   Feature 13 Task 1: LlmClient interface, GptVisionClient/GptTurboClient pattern, LlmFallbackOrchestrator — this task defines a **text-only sibling** implementation reusing the same interface and orchestrator shape, not a divergent new client hierarchy.
-   Feature 14 Task 1: confirms the AI Service is a **single shared FastAPI app** across all routers (generate\_listing, analyze\_return, now recommend) — reused, not re-decided.
-   Feature 11: RevenueAnalyticsRepository, SalesAnalyticsRepository, OrderAnalyticsRepository, TopProductsRepository, ChartResponseFormatter — this feature's Task 2 reads from these directly.
-   Feature 1: Auth middleware, JWT, RBAC (SELLER role), response envelope, error hierarchy, Zod validation framework.

### **Expected Deliverables**

-   \[ \] apps/ai-service/app/routers/recommend.py mounted on the **existing** shared AI Service FastAPI app (TRD §2/§5.2's reserved path)
-   \[ \] apps/ai-service/app/llm/gpt\_text\_client.py (or reuse of GptTurboClient/GptVisionClient in text-only mode — see Engineering Decision) implementing the existing LlmClient interface for **text-in, JSON-out** calls (no image)
-   \[ \] apps/ai-service/app/schemas/recommendation.py — Pydantic model enforcing {insights: list\[str\], recommendations: list\[str\], forecastNote: str | None, suggestions: list\[str\]} (structured, plain-language output per REQ-F-Analytics-004)
-   \[ \] Core API ai-analytics module scaffold, reusing the Feature 13/14 module-per-domain convention
-   \[ \] Shared error codes: AI\_ANALYTICS\_GENERATION\_FAILED, AI\_ANALYTICS\_TIMEOUT
-   \[ \] Redis key convention for this feature's cache + dismissal state (this feature's schema-gap resolution, flagged above)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 1.1 | Create apps/ai-service/app/routers/recommend.py, mounted on the **same** shared FastAPI app Features 13/14 already use (TRD §1: one AI Service) | Router registered at /recommend, stub returns 501 | GET /docs shows /generate-listing, /analyze-return, and /recommend all on one app |
| --- | --- | --- | --- |
| 1.2 | Implement GptTextClient implementing the **existing** LlmClient interface (Feature 13 Task 1.2): generate(prompt: str) -> RecommendationResult — no image parameter, since this call is text-only (structured metrics in, structured JSON out) | New client variant, same interface contract | Unit test (mocked OpenAI SDK): given a prompt string, parses a valid completion into the expected shape |
| --- | --- | --- | --- |
| 1.3 | Reuse LlmFallbackOrchestrator (Feature 13 Task 1.4) **unmodified**, parameterized with GptTextClient (primary, per LLM\_PRIMARY\_MODEL) and its GPT-3.5 fallback counterpart (D3) — confirms the orchestrator's generic design (primary→fallback, config-only model switch) already supports a non-Vision client without any code change | Same orchestrator class, new client instances passed in | Unit test: primary-fails-fallback-succeeds path works identically to Feature 13's own test of the same orchestrator, confirming zero modification needed |
| --- | --- | --- | --- |
| 1.4 | Define RecommendationSchema (Pydantic): insights: list\[str\] (1+ items), recommendations: list\[str\] (1+ items, REQ-F-Analytics-004's "≥1 AI recommendation"), \`forecastNote: str | None, suggestions: list\[str\]\` — reject malformed LLM JSON via Pydantic, same fail-closed philosophy as Feature 13 Task 1.5/Feature 14 Task 1 | Schema enforces REQ-F-Analytics-004's "≥1 recommendation" minimum |
| --- | --- | --- | --- |
| 1.5 | Core API: create apps/api/src/modules/ai-analytics/ scaffold (controller.ts, service.ts, routes.ts, dto.ts) per TRD §12 layout, mirroring Feature 13/14's module structure | Folder scaffolded, stub route mounted | pnpm build compiles; /api/v1/seller/analytics/ai-recommendations mounts (stub OK) |
| --- | --- | --- | --- |
| 1.6 | Establish Redis key convention (extending Feature 11 Task 1.5's analytics:{sellerId}:{metric}:{rangeHash} pattern): ai-analytics:{sellerId}:recommendation (cached result) and ai-analytics:{sellerId}:dismissed-until (dismissal TTL key) | Two new, clearly-scoped Redis key namespaces | Unit test: key builder produces deterministic, seller-scoped keys; no collision with Feature 11's existing analytics cache keys |
| --- | --- | --- | --- |
| 1.7 | Register AI\_ANALYTICS\_GENERATION\_FAILED, AI\_ANALYTICS\_TIMEOUT in the shared error-code enum (packages/shared), reusing the exact registration pattern from Feature 13 Task 1.7/Feature 14 Task 1.6 | Error codes available to both services | Envelope emits correct code/status per case |
| --- | --- | --- | --- |

### **Common Errors**

-   Building a **new** LLM client hierarchy for this feature instead of reusing LlmClient/LlmFallbackOrchestrator — the orchestrator is already provider-agnostic and text/image-agnostic at the interface level; a parallel hierarchy would duplicate proven fallback logic for no reason.
-   Creating a **second** AI Service app/container for this feature's router — violates TRD §1's single-AI-Service architecture, the same violation flagged in Feature 14 Task 1.
-   Persisting recommendation content to Postgres "to be safe" despite the flagged schema gap — this task's Redis-only resolution is the deliberate, documented answer; introducing a new table here would violate "DO NOT MODIFY Database Schema" without the explicit sign-off this playbook flags as required.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| LLM client reuse for text-only calls | Reuse LlmClient interface + LlmFallbackOrchestrator (Feature 13 Task 1) via a new GptTextClient implementation, not a parallel hierarchy | The orchestrator's interface (generate() -> Result) was already designed generically; a Vision-specific parameter (image) is optional at the call site, not baked into the interface contract — reuse is directly supported |
| --- | --- | --- |
| AI Analytics content persistence | Redis-only (cache + dismissal TTL), **no new Postgres table** | Resolves the flagged schema gap (see top of this document) conservatively, consistent with the "DO NOT MODIFY Database Schema" constraint and Feature 13 Task 5's precedent for an analogous gap |
| --- | --- | --- |
| Cache key namespace | New ai-analytics:\* prefix, distinct from but adjacent to Feature 11's analytics:\* convention | Keeps this feature's ephemeral AI content clearly separated from Feature 11's metric caches, avoiding any risk of key collision or conceptual conflation between "computed metrics" and "AI-generated commentary on those metrics" |
| --- | --- | --- |

### **Artifacts Produced**

-   apps/ai-service/app/routers/recommend.py, app/llm/gpt\_text\_client.py, app/schemas/recommendation.py — reused unmodified by Task 3 (Sales Insights), Task 4 (Recommendation Engine), Task 5 (Forecasting), Task 6 (Business Suggestions) — all of which are sub-categories of the **same** /recommend call and RecommendationSchema, not separate endpoints (see Feature Overview).
-   apps/api/src/modules/ai-analytics/ scaffold — extended by every subsequent Core API–side task.
-   Redis cache/dismissal key convention — reused by Task 4 (caching the generated recommendation) and Task 7 (dismissal-check on dashboard load).

### **Definition of Done**

-   \[ \] AI Service /recommend router mounted on the existing single shared FastAPI app (confirmed via /docs, not a new app instance)
-   \[ \] GptTextClient + reused LlmFallbackOrchestrator unit-tested for primary-success, primary-fail-fallback-success, and both-fail paths
-   \[ \] RecommendationSchema rejects any LLM output with zero recommendations or malformed structure
-   \[ \] Core API module scaffold compiles and mounts a stub route
-   \[ \] Redis key conventions for cache and dismissal are unit-tested for determinism and non-collision with Feature 11's keys
-   \[ \] Zero Prisma schema drift — no new tables/columns introduced (confirms the flagged gap was resolved without a schema change)
-   \[ \] Lint/type-check clean on both services

## **Task 2 — Analytics Data Preparation**

### **Purpose**

-   Build the **single, reusable data-preparation step** that pulls everything the AI needs from Feature 11's existing repositories, shapes it into a compact prompt-ready payload, and hands it to the AI Service — built once here, consumed by every generation task (Tasks 3–6) that follows.
-   Guarantee this task **never recomputes** a metric Feature 11 already owns — it only **reads and reshapes** existing aggregation outputs (revenue trend, top products, category mix, order volume, cancellation rate) into a compact, LLM-friendly summary.

### **Dependencies**

-   Task 1 (Foundation): AI Service /recommend router, Core API module scaffold, Redis key convention.
-   Feature 11 Task 2: RevenueAnalyticsService.getSummary() (current/previous/YTD, % change).
-   Feature 11 Task 3: SalesAnalyticsService.getDailyTrend(), .getCategoryBreakdown().
-   Feature 11 Task 4: OrderAnalyticsService.getSummary() (status breakdown, cancellation rate).
-   Feature 11 Task 6: TopProductsService.getTopProducts().

### **Expected Deliverables**

-   \[ \] AnalyticsDataPreparationService.buildSellerSnapshot(sellerId) → a single compact object combining Feature 11's existing outputs (default range: trailing 30 days, matching SCR-S08's default filter — flagged as Assumption if a different default is intended for AI purposes specifically)
-   \[ \] PromptBuilder.fromSnapshot(snapshot) — converts the snapshot into a **deterministic, structured text prompt** for the AI Service call (not free-form narrative construction, to keep LLM cost/latency bounded)
-   \[ \] Confirmation this task performs **zero direct database aggregation queries** — it only calls Feature 11's existing services

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 2.1 | Implement AnalyticsDataPreparationService.buildSellerSnapshot(sellerId, range = '30d'): calls Feature 11's RevenueAnalyticsService.getSummary(), SalesAnalyticsService.getDailyTrend()/.getCategoryBreakdown(), OrderAnalyticsService.getSummary(), TopProductsService.getTopProducts(limit=5) — in parallel (Promise.all, reusing the same parallel-fan-out pattern already established for courier scoring, TRD §3/REQ-F-Logistics-002, and Feature 14 Task 3's Vision+CNN parallel call) | Single SellerSnapshot object combining four independent Feature-11 outputs | Unit test (Feature 11 services mocked): snapshot correctly combines all four outputs; a failure in any one service is caught and does not crash the whole snapshot build (see 2.2) |
| --- | --- | --- | --- |
| 2.2 | Handle partial data gracefully: if a seller has insufficient history (e.g., zero orders in range — Feature 11's own "new seller" empty-state case, SCR-S08), buildSellerSnapshot() returns a snapshot with explicit insufficientData: true rather than throwing, so Task 3–6 can short-circuit to a "not enough data yet" message rather than forcing an LLM call on empty data | Graceful empty-state handling, no wasted LLM cost on a snapshot with nothing to analyze | Unit test: a seller with zero orders in the 30-day range produces insufficientData: true; no AI Service call is triggered downstream (verified via a call-count spy in Task 4's tests) |
| --- | --- | --- | --- |
| 2.3 | Implement PromptBuilder.fromSnapshot(snapshot): renders the snapshot into a compact, structured (not verbose-narrative) text block — e.g., labeled key metrics and a top-5 product/category list — designed for token-efficiency (PRD Risk R4/TRD T2: "LLM cost overrun... cache") | Deterministic prompt string, same snapshot always yields the same prompt (no LLM-side randomness leaking into prompt construction) | Unit test: identical snapshot input produces byte-identical prompt output across repeated calls |
| --- | --- | --- | --- |
| 2.4 | Confirm (code review) that AnalyticsDataPreparationService contains **zero** Prisma/direct-query calls — every data point flows through an existing Feature 11 service method | Zero new aggregation queries in this task's code | Code review: grep for direct Prisma calls in the new service file — zero matches beyond calls into Feature 11's own service classes |
| --- | --- | --- | --- |
| 2.5 | Add category/product identifiers (bilingual title\_en, category name\_en) to the snapshot in **English only** for the prompt (the AI's output will itself be plain-language and is not required to be bilingual per REQ-F-Analytics-004 — flagged as Assumption, since REQ-F-Analytics-004 doesn't specify UR/EN for this particular output, unlike REQ-AI-Store002's explicit bilingual mandate for listings) | Snapshot uses English labels for prompt construction | Unit test: snapshot never includes title\_ur/name\_ur fields, confirming the English-only prompt-construction decision is applied consistently |
| --- | --- | --- | --- |

### **Common Errors**

-   Querying orders/order\_items/products/settlements directly from this new service instead of going through Feature 11's existing repository/service layer — this would duplicate aggregation logic Feature 11 already owns and risks metric drift between the Analytics Dashboard and whatever numbers the AI narrates about.
-   Building a verbose, unstructured narrative prompt (e.g., dumping raw JSON of every order) instead of a compact, structured summary — inflates LLM token cost/latency for no accuracy benefit, contradicting the project's explicit cost-control risk mitigation (T2/R4).
-   Forcing an LLM call on a snapshot with insufficientData: true — wastes cost on a call that cannot produce a meaningful recommendation.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Data source reuse | 100% reuse of Feature 11's existing analytics services; zero new aggregation queries | Directly satisfies the Feature 15 brief's "MUST reuse... Analytics Dashboard (Feature 11)... Do NOT rebuild" instruction; also guarantees the AI's narrative and the dashboard's numbers can never diverge, since they're the same underlying computation |
| --- | --- | --- |
| Default snapshot range | Trailing 30 days | Matches SCR-S08's most common/default date-range filter (7d/30d/3m/custom); a monthly-cadence snapshot is a reasonable default for a weekly-refresh recommendation card — flagged as Assumption since no source document specifies an AI-specific default range |
| --- | --- | --- |
| Prompt format | Structured, labeled key-metric summary (not raw JSON dump, not free narrative) | Balances LLM comprehension quality against token cost, directly addressing PRD Risk R4/TRD T2's cost-overrun concern, which is a project-wide constraint this feature must respect |
| --- | --- | --- |

### **Artifacts Produced**

-   AnalyticsDataPreparationService — the single data-gathering entry point reused unmodified by Task 3 (Sales Insights), Task 4 (Recommendation Engine), Task 5 (Forecasting), and Task 6 (Business Suggestions) — all four consume the **same** SellerSnapshot.
-   PromptBuilder — reused identically by Tasks 3–6; only the **instruction portion** of the prompt (what kind of output is requested) varies per task, not the data-shaping logic.

### **Definition of Done**

-   \[ \] buildSellerSnapshot() correctly combines all four Feature 11 outputs via parallel calls, with zero direct database queries
-   \[ \] Sellers with insufficient data produce a graceful insufficientData: true result, never a crash or a wasted LLM call
-   \[ \] PromptBuilder output is deterministic and token-conscious (structured, not verbose)
-   \[ \] No duplicate aggregation logic introduced anywhere in this task (confirmed via code review)
-   \[ \] Unit tests cover both the sufficient-data and insufficient-data paths

*End of Response 1 (Tasks 1–2). Say "continue" for Response 2 — Task 3 (Sales Insights Generation) and Task 4 (Recommendation Engine).*

## **Table of Contents (updated)**

1.  [Feature Overview](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#1-feature-overview)
2.  [AI Analytics Flow](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#2-ai-analytics-flow)
3.  Task 1 — AI Analytics Foundation
4.  Task 2 — Analytics Data Preparation
5.  Task 3 — Sales Insights Generation
6.  Task 4 — Recommendation Engine
7.  *(Deferred to Response 3)* Task 5 — Sales Forecasting
8.  *(Deferred to Response 3)* Task 6 — Business Suggestions
9.  *(Deferred to Response 3)* Task 7 — Dashboard Integration
10.  *(Deferred to Response 3)* Validation & Testing
11.  *(Deferred to Response 3)* Consistency Review, Assumptions, Documentation Gaps

**Status:** Draft — Response 2 of 3 (Tasks 1–4).

## **Task 3 — Sales Insights Generation**

### **Purpose**

-   Implement the **first** of the four RecommendationSchema output categories (insights: list\[str\]) — plain-language observations about *what happened* in the seller's data (e.g., "Revenue grew 18% this month, driven mainly by Category X"), derived strictly from Task 2's snapshot.
-   Establish the **single shared call-and-cache flow** (Core API → AI Service /recommend → Redis cache) that Task 4 (Recommendations), Task 5 (Forecasting), and Task 6 (Suggestions) all reuse — this task builds the call site once; later tasks extend the *prompt instruction* and *response field consumed*, not the call mechanism itself.

### **Dependencies**

-   Task 1 (Foundation): AI Service /recommend router, GptTextClient/LlmFallbackOrchestrator, RecommendationSchema, Redis key convention.
-   Task 2 (Analytics Data Preparation): SellerSnapshot, PromptBuilder.

### **Expected Deliverables**

-   \[ \] AI Service POST /recommend handler fully wired: accepts {snapshot, instructionType}, builds the prompt via a shared prompt template, calls LlmFallbackOrchestrator, validates via RecommendationSchema, returns the full structured result
-   \[ \] Core API AiAnalyticsService.generate(sellerId) — the single orchestration entry point: readiness check (via Task 2.2's insufficientData flag) → cache check (Task 1.6's Redis convention) → AI Service call → cache write
-   \[ \] insights field specifically populated and validated (≥1 item, plain-language, no raw numbers dumped verbatim without context — flagged as a soft quality guideline, not a hard schema rule)
-   \[ \] Swagger + FastAPI auto-doc entries

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 3.1 | Implement AI Service POST /recommend handler: accepts {snapshot: dict, instructionType: str} (a discriminator telling the prompt template which output emphasis to request — reused unchanged by Tasks 4–6, each passing a different instructionType into the **same** handler), builds the final prompt (PromptBuilder's data section + a per-instructionType instruction suffix), calls LlmFallbackOrchestrator.generate() (Task 1.3), validates via RecommendationSchema (Task 1.4) | One endpoint serving all four output categories via a discriminator, not four endpoints | Integration test (AI Service, mocked LLM): instructionType="insights" produces a response with a populated insights array; other fields present but possibly minimal/empty depending on prompt emphasis |
| --- | --- | --- | --- |
| 3.2 | Implement Core API AiAnalyticsService.generate(sellerId): (a) build snapshot via Task 2; (b) if insufficientData, short-circuit to a typed "not enough data" response, no AI call; (c) check Redis cache (ai-analytics:{sellerId}:recommendation) — if fresh, return cached; (d) otherwise call AI Service /recommend with instructionType="full" (requesting all four fields in one call — see Engineering Decision) | Single orchestration method reused by Task 7's endpoint | Integration test: insufficient-data seller never triggers an AI Service call (spy assertion, same pattern as Feature 14 Task 2.3's readiness gate) |
| --- | --- | --- | --- |
| 3.3 | Enforce a timeout on the Core API → AI Service call — reuse the **pattern** from Feature 13 Task 3.3/Feature 14 Task 3.3 (Core API–side hard ceiling, distinct config value per feature) — this feature's target is **not explicitly specified** by any PRD requirement (unlike Feature 13's 30s or Feature 14's 60s), so a conservative default (e.g., 30s, matching Feature 13's generation-latency ceiling as the closest analogous non-realtime-critical AI call) is used and **flagged as Assumption** | Timeout enforced; on breach, typed failure returned, cached-nothing (do not cache a failure) | Integration test: AI Service mock delays beyond the ceiling → Core API returns AI\_ANALYTICS\_TIMEOUT (Task 1.7); no Redis cache entry is written for a failed attempt |
| --- | --- | --- | --- |
| 3.4 | On successful generation, write the full result to Redis (ai-analytics:{sellerId}:recommendation) with a TTL matching the intended refresh cadence (weekly — flagged as Assumption, see Engineering Decision) | Cached result available for subsequent dashboard loads without re-calling the AI Service | Integration test: second call within TTL does not re-hit the AI Service (spy/mock call-count assertion, same pattern as Feature 11 Task 2.4) |
| --- | --- | --- | --- |
| 3.5 | Map any AI Service failure/timeout/malformed response to a full failure (never partial fields) — same fail-closed philosophy as Feature 13 Task 3.6/Feature 14 Task 3.5, applied to RecommendationSchema | Failure responses never partially populate insights/recommendations/etc. | Unit test: a malformed/partial AI Service response is treated as a full failure, not silently mapped with missing array fields |
| --- | --- | --- | --- |
| 3.6 | Swagger annotation for the Core API side; confirm /recommend is documented in AI Service's own auto-OpenAPI and confirmed unreachable via the public Nginx /api proxy (TRD §2/§8) — reusing the exact network-isolation test pattern from Features 13/14 | Docs current on both sides; network isolation reconfirmed for the **third** AI Service route | Manual check + reused network-level test, extended to cover this third route |
| --- | --- | --- | --- |

### **Common Errors**

-   Building **four separate AI Service endpoints** (/recommend/insights, /recommend/recommendations, /recommend/forecast, /recommend/suggestions) instead of one /recommend endpoint with an instructionType discriminator — contradicts TRD §2's explicit single /recommend (R1.1) path in the architecture diagram; also quadruples LLM calls/cost for what should be one request producing structured, multi-field output.
-   Caching a **failed** or partial AI Service response — must only cache confirmed-successful, schema-valid results (Task 3.4/3.5 order matters: validate first, cache second).
-   Re-triggering an AI call on every dashboard page load without checking the Redis cache first — directly contradicts the project-wide LLM-cost-control mitigation (R4/T2) this entire feature is built around.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Endpoint shape (one call, four fields, vs. four calls) | Single /recommend call with instructionType="full" requesting all of insights/recommendations/forecastNote/suggestions in one structured response | TRD §2 diagram lists exactly one /recommend (R1.1) route; requesting all four categories in a single LLM call is also far more cost-efficient than four separate calls per seller per refresh cycle (directly serves R4/T2's cost-control mandate) |
| --- | --- | --- |
| Cache TTL / refresh cadence | Weekly (flagged as Assumption) | No source document specifies a refresh cadence for this card; "weekly" is a reasonable default matching the general cadence of business-analytics recommendations (daily would be excessive LLM cost for slow-changing seller trends; monthly may feel stale) — should be confirmed with product owner |
| --- | --- | --- |
| Core API timeout ceiling | 30s (flagged as Assumption, borrowed from Feature 13's precedent as the closest analogous non-realtime AI call) | No PRD requirement specifies a latency target for this feature (unlike REQ-NF-Perf002 for listings or REQ-F-Return-004 for returns); a dashboard-card refresh is not a blocking, in-the-moment user action the way listing generation or a return decision is, so a generous-but-bounded ceiling is used pending confirmation |
| --- | --- | --- |

### **Artifacts Produced**

-   AI Service: /recommend route handler (completes Task 1's router stub) — the single, final AI Service artifact for this entire feature; Tasks 4–6 only change *what instruction/field* is requested/consumed, never the endpoint itself.
-   Core API: AiAnalyticsService — the central orchestration service reused as-is by Task 4 (which formalizes how recommendations specifically gets surfaced), Task 5 (forecastNote), Task 6 (suggestions), and called directly by Task 7's dashboard-facing endpoint.

### **Definition of Done**

-   \[ \] Single /recommend endpoint serves all four output categories via one call (confirmed: not four separate routes)
-   \[ \] Insufficient-data sellers never trigger an AI Service call
-   \[ \] Fresh cached results served without re-calling the AI Service within the TTL window
-   \[ \] Failures/timeouts never cached; never produce partial-field results
-   \[ \] /recommend confirmed unreachable from outside the private Docker network
-   \[ \] Swagger/FastAPI docs current on both services

## **Task 4 — Recommendation Engine**

### **Purpose**

-   Formalize the **recommendations field** specifically — actionable, plain-language suggestions (products, pricing, inventory, marketing per the Feature 15 brief's "Expected Deliverables") derived from the same snapshot/AI call Task 3 already wired — this task is about **prompt-instruction design and output-field validation**, not a new call mechanism.
-   Ensure recommendations are **grounded** in the snapshot's actual data (e.g., referencing a real top/bottom product by name) rather than generic, non-actionable filler — enforced via prompt design and a lightweight post-validation check, not a new AI model.

### **Dependencies**

-   Task 3 (Sales Insights Generation): the single /recommend call site, AiAnalyticsService.generate(), Redis cache — this task extends the **prompt content**, not the call flow.
-   Task 2 (Analytics Data Preparation): SellerSnapshot's product/category/order data — the grounding source recommendations must reference.

### **Expected Deliverables**

-   \[ \] Prompt template extended (within the same /recommend handler, Task 3.1) with explicit instruction to cover: **product** (e.g., promote a top performer, address a low-mover), **pricing** (e.g., a category underperforming on margin/volume), **inventory** (e.g., a frequently-out-of-stock top product), and **marketing** (e.g., a category with rising but under-promoted demand) — per the Feature 15 brief's explicit categories
-   \[ \] RecommendationValidator.checkGrounding(recommendations, snapshot) — lightweight post-check confirming referenced product/category names actually exist in the snapshot (catches LLM hallucination of nonexistent products)
-   \[ \] Confirmation recommendations always has ≥1 item (REQ-F-Analytics-004's explicit minimum, already enforced at the schema level by Task 1.4 — this task adds the grounding check on top)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 4.1 | Extend the prompt template (used by Task 3.1's handler) with explicit categorical instruction: "Generate 1–3 actionable recommendations covering any of: product strategy, pricing, inventory management, or marketing — each grounded in a specific product, category, or metric from the data provided" — a **prompt-engineering** change, not a code-path change | Richer, categorized instruction text feeding the same /recommend call | Unit test: prompt string includes the four named categories verbatim (product/pricing/inventory/marketing), confirming the instruction was correctly appended |
| --- | --- | --- | --- |
| 4.2 | Implement RecommendationValidator.checkGrounding(recommendations, snapshot): for each recommendation string, perform a simple substring/fuzzy check against the snapshot's known product titles and category names — flag (not reject) recommendations that reference no identifiable entity from the snapshot, logging a low-confidence signal (informational only, not a hard failure — flagged as Assumption on strictness level, see Engineering Decision) | {groundedCount, ungroundedCount} diagnostic alongside the recommendations array | Unit test: a recommendation mentioning a real snapshot product name → counted as grounded; a recommendation with no matching entity → counted as ungrounded, but **not dropped from the response** |
| --- | --- | --- | --- |
| 4.3 | Ensure recommendations array is **never** empty after schema validation (Task 1.4 already enforces ≥1 at the Pydantic level) — this task only adds the diagnostic grounding signal on top, it does not re-validate count | Existing ≥1 guarantee unchanged, now with an additional quality signal | Regression test: Task 1's existing schema-validation test (empty array → ValidationError) still passes unmodified |
| --- | --- | --- | --- |
| 4.4 | Confirm this task introduces **no new endpoint** — recommendations is simply one field of the same RecommendationSchema response Task 3 already returns; RecommendationValidator runs as a Core API–side post-processing step on the response before caching (Task 3.4) | Grounding diagnostic attached to the cached/returned payload, e.g., {recommendations: \[...\], groundingDiagnostic: {...}} | Code review: confirm RecommendationValidator is called once, inside AiAnalyticsService.generate(), between AI Service response receipt and Redis cache write |
| --- | --- | --- | --- |
| 4.5 | Add a fallback phrasing rule: if a recommendation is flagged ungrounded, the frontend (out of this backend-only playbook's scope) can choose to deprioritize/label it — this task only produces the diagnostic; **it does not rewrite or discard the LLM's text**, since altering AI-generated content post-hoc would itself risk introducing inaccuracies not sourced from the model | Diagnostic-only output; original LLM text preserved verbatim | Code review: confirm no string-mutation logic exists in RecommendationValidator beyond the diagnostic count |
| --- | --- | --- | --- |

### **Common Errors**

-   Hard-**rejecting** (re-triggering a retry/regeneration call) any recommendation flagged as "ungrounded" — this would risk an unbounded retry loop and additional LLM cost for a soft-quality signal that doesn't necessarily indicate a wrong answer (the LLM may reference an aggregate trend not tied to one specific product name).
-   Rewriting/sanitizing the LLM's recommendation text based on the grounding check — turns a diagnostic signal into unauthorized content alteration; the model's own words should reach the seller unmodified (matching the "no partial/altered AI output" philosophy already established in Features 13/14).
-   Treating "product/pricing/inventory/marketing" as four separate required output slots (e.g., exactly one recommendation per category) — the Feature 15 brief lists these as the **range** of topics recommendations may cover, not a mandatory one-per-category quota; REQ-F-Analytics-004 only requires "≥1" total.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Grounding-check strictness | Diagnostic/informational only — flagged, never blocking or triggering retry | No source document defines a hallucination-prevention requirement with this level of rigor; a soft diagnostic avoids both unbounded retry-cost risk and unauthorized alteration of AI-generated text, while still surfacing a useful quality signal for future tuning |
| --- | --- | --- |
| Recommendation category coverage | Product/pricing/inventory/marketing as prompt guidance (a *range* of possible topics), not a mandatory per-category quota | REQ-F-Analytics-004 only requires "≥1 AI recommendation... plain-language, data-derived" — no per-category minimum is specified anywhere in the PRD; treating the Feature 15 brief's four bullet points as a strict quota would over-specify beyond the actual binding requirement |
| --- | --- | --- |

### **Artifacts Produced**

-   RecommendationValidator — the only new artifact in this task; a lightweight, non-blocking diagnostic layer consumed by AiAnalyticsService.generate() (Task 3.2) before caching.
-   Extended prompt template (within Task 3.1's existing handler) — reused as the base that Task 5 (Forecasting) and Task 6 (Business Suggestions) further extend with their own additional instruction clauses in the same prompt.

### **Definition of Done**

-   \[ \] Prompt instructs the LLM across the four named topic areas without mandating a fixed quota per category
-   \[ \] RecommendationValidator correctly flags (but never discards or rewrites) ungrounded recommendations
-   \[ \] recommendations array's existing ≥1 schema guarantee (Task 1.4) remains intact and unmodified
-   \[ \] No new endpoint introduced; grounding check runs as a post-processing step within the existing AiAnalyticsService.generate() flow
-   \[ \] Unit + integration tests cover both grounded and ungrounded recommendation cases without altering LLM output text

*End of Response 2 (Tasks 3–4). Say "continue" for Response 3 to complete the feature — Task 5 (Sales Forecasting), Task 6 (Business Suggestions), Task 7 (Dashboard Integration), Validation & Testing, and the final consistency review.*

## **Table of Contents (updated — final)**

1.  [Feature Overview](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#1-feature-overview)
2.  [AI Analytics Flow](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#2-ai-analytics-flow)
3.  Task 1 — AI Analytics Foundation
4.  Task 2 — Analytics Data Preparation
5.  Task 3 — Sales Insights Generation
6.  Task 4 — Recommendation Engine
7.  Task 5 — Sales Forecasting
8.  Task 6 — Business Suggestions
9.  Task 7 — Dashboard Integration
10.  Validation & Testing
11.  Consistency Review, Assumptions, Documentation Gaps

**Status:** Final — Response 3 of 3 (Tasks 1–7 + Validation & Consistency Review complete).

## **Task 5 — Sales Forecasting**

### **Purpose**

-   Formalize the **forecastNote field** — a plain-language, directional forward-looking statement (e.g., "Based on your last 30 days, expect steady demand in Category X heading into next month") derived from Task 2's snapshot trend data, **not a numeric time-series prediction model**.
-   Explicitly bound this task's ambition to what the project's AI architecture actually supports (D3: GPT-4V/GPT-3.5 text generation) — **no statistical/ML forecasting model** (e.g., ARIMA, Prophet) is introduced, since none is named anywhere in the PRD/TRD's AI architecture (§5.2 only names the LLM client and, for R1.1, Cloud Vision + a custom CNN for *returns*, not sales forecasting).

### **Dependencies**

-   Task 3 (Sales Insights Generation): the single /recommend call site and AiAnalyticsService.generate() — this task extends the **prompt content** for the forecastNote field, same as Task 4 did for recommendations.
-   Task 2 (Analytics Data Preparation): SellerSnapshot's daily revenue trend (from Feature 11's SalesAnalyticsService.getDailyTrend()) — the only trend signal available to ground a forecast statement.

### **Expected Deliverables**

-   \[ \] Prompt template extended with explicit instruction to produce a **qualitative, directional** forecastNote (e.g., "likely to grow/hold steady/soften") based strictly on the trailing trend already in the snapshot — never a specific numeric prediction (e.g., never "you will sell 47 units next week"), since no forecasting model backs such precision
-   \[ \] forecastNote explicitly typed/documented as **nullable** (str | None, per Task 1.4's schema) — absent when the snapshot has insufficient trend history (e.g., a seller with <2 weeks of data) rather than fabricating a confident-sounding forecast on thin data
-   \[ \] A disclaimer convention (e.g., a fixed suffix phrase or a separate isEstimate: true flag) confirming to the seller this is a **directional AI note, not a guaranteed prediction** — flagged as Assumption on exact wording/mechanism, since no source document specifies disclaimer language

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 5.1 | Extend the shared prompt template (Task 3.1/4.1) with an explicit forecasting instruction: "If the data shows a clear trailing trend (≥2 weeks), provide one qualitative, directional forecast note (e.g., growing/steady/softening) with a brief reason; otherwise omit this field entirely — never state a precise numeric prediction" | Prompt instructs directional-only, trend-gated forecasting language | Unit test: prompt string includes the "qualitative... never numeric prediction" instruction verbatim |
| --- | --- | --- | --- |
| 5.2 | Add a **pre-check** in AnalyticsDataPreparationService (Task 2, extended) or a thin wrapper here: flag snapshot.trendSufficient: boolean based on whether the snapshot's daily-trend series (Feature 11 Task 3) spans ≥14 days of non-zero data (threshold flagged as Assumption — no source document specifies a minimum trend-history requirement for forecasting) | trendSufficient flag added to the snapshot, consumed by the prompt/response-handling logic | Unit test: a snapshot with 8 days of trend data → trendSufficient: false; ≥14 days → true |
| --- | --- | --- | --- |
| 5.3 | If trendSufficient = false, instruct the prompt (or post-process the response) to force forecastNote = null regardless of what the LLM returns — a hard override, mirroring Feature 14 Task 4.4's "hard override beats confidence" pattern (there: image mismatch overrides CNN confidence; here: insufficient trend history overrides any LLM-generated forecast text) | forecastNote is null whenever trendSufficient = false, no exceptions | Unit test: even if a mocked LLM response contains a populated forecastNote string, a trendSufficient=false snapshot forces it to null before the result is cached/returned |
| --- | --- | --- | --- |
| 5.4 | Implement the disclaimer mechanism: append a fixed, code-owned suffix to any non-null forecastNote (e.g., " (AI estimate based on recent trends, not a guarantee.)") rather than trusting the LLM to self-disclaim — ensures the disclaimer is always present and consistently worded, independent of LLM output variance | Every non-null forecastNote reaching the seller includes the fixed disclaimer suffix | Unit test: a forecastNote returned from the AI Service without a disclaimer gets the suffix appended deterministically by Core API code, not left to LLM discretion |
| --- | --- | --- | --- |
| 5.5 | Confirm no new endpoint, no new field beyond forecastNote (already reserved in Task 1.4's schema) — this task is prompt-instruction + post-processing only | No new artifacts beyond a data-preparation flag and a disclaimer-append utility | Code review: confirm RecommendationSchema (Task 1.4) is unmodified; only the Core API's post-processing step changed |
| --- | --- | --- | --- |

### **Common Errors**

-   Building or integrating an actual statistical forecasting model (ARIMA/Prophet/similar) — no source document (PRD/TRD/App Flow/Schema/Implementation Plan) names any forecasting model or library; the AI architecture (§5.2) only supports the GPT-4V/GPT-3.5 LLM client. Introducing one would be inventing a different AI architecture, explicitly forbidden by this playbook's binding instructions.
-   Letting the LLM produce a confident numeric forecast (e.g., "expect 52 orders next week") — contradicts the qualitative-only prompt instruction and risks misleading a seller with false precision the underlying data/model cannot actually support.
-   Trusting the LLM to self-include a disclaimer — must be a deterministic, code-owned suffix (5.4) to guarantee consistent presence and wording regardless of LLM output variance.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Forecasting mechanism | Qualitative, LLM-generated directional note only — no statistical/ML forecasting model | No source document names a forecasting model or library anywhere in the AI architecture (TRD §5.2); the project's entire AI capability is the LLM client (D3) plus, for R1.1 returns only, Cloud Vision + CNN (Feature 14) — neither applies to sales forecasting. Introducing a new model type would violate the "never invent a different Architecture" instruction |
| --- | --- | --- |
| Trend-sufficiency threshold | ≥14 days of non-zero trend data | No source document specifies this threshold (flagged as Assumption); two weeks is a conservative minimum to say anything directional without over-fitting to a handful of data points |
| --- | --- | --- |
| Disclaimer mechanism | Fixed, code-appended suffix string, not LLM self-disclosure | Guarantees consistent presence/wording independent of LLM variance — matches the general project principle of not trusting free-form LLM output for anything requiring guaranteed structure (cf. Pydantic schema enforcement throughout Features 13–15) |
| --- | --- | --- |

### **Artifacts Produced**

-   Trend-sufficiency check (extension to AnalyticsDataPreparationService, Task 2) — reused conceptually by Task 6 if Business Suggestions also wants to gate on data sufficiency (see Task 6).
-   Disclaimer-append utility — a small, reusable Core API helper; no further tasks in this feature extend it, but it is available for reuse if a future feature needs the same "always append a fixed disclaimer" pattern.

### **Definition of Done**

-   \[ \] forecastNote is qualitative/directional only — no numeric predictions pass through, tested explicitly against a mocked LLM attempting to produce one
-   \[ \] forecastNote is null whenever trailing trend history is <14 days, regardless of LLM output
-   \[ \] Every non-null forecastNote includes the fixed, code-owned disclaimer suffix
-   \[ \] No new endpoint, schema field, or forecasting model/library introduced
-   \[ \] Unit tests cover both sufficient-trend and insufficient-trend paths

## **Task 6 — Business Suggestions**

### **Purpose**

-   Formalize the **suggestions field** — broader, non-transactional business advice (e.g., store presentation, response-time habits, seasonal timing) distinct from recommendations' narrower product/pricing/inventory/marketing actions (Task 4) — the Feature 15 brief's fourth named category.
-   Ensure suggestions remains genuinely **complementary** to recommendations rather than a duplicate list — enforced via prompt-instruction differentiation only, since both fields live in the same RecommendationSchema/response.

### **Dependencies**

-   Task 3 (Sales Insights Generation): the single /recommend call site — this task extends prompt content for the final schema field, same pattern as Tasks 4–5.
-   Task 4 (Recommendation Engine): the recommendations field's scope definition — this task's prompt instruction must explicitly differentiate from it to avoid redundant output.
-   Task 2 (Analytics Data Preparation): SellerSnapshot — the same data source, reused, not re-queried.

### **Expected Deliverables**

-   \[ \] Prompt template extended with an explicit instruction distinguishing suggestions (broader business/operational habits) from recommendations (specific product/pricing/inventory/marketing actions) — avoiding overlap between the two fields
-   \[ \] suggestions array validated as **optional/nullable-empty** (unlike recommendations' hard ≥1 minimum, REQ-F-Analytics-004 only mandates the recommendation count, not suggestions specifically — flagged as Assumption, see Engineering Decision) at the schema level (Task 1.4, confirmed not requiring modification)
-   \[ \] Confirmation this task introduces **zero new endpoints/fields beyond what Task 1.4 already reserved**

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 6.1 | Extend the shared prompt template (Task 3.1/4.1/5.1) with a differentiating instruction: "Separately, offer 0–3 broader business suggestions (e.g., store presentation, customer responsiveness, seasonal timing, notification/engagement habits) distinct from the specific product/pricing/inventory/marketing recommendations already requested — do not repeat the same point in both fields" | Prompt explicitly guards against recommendations/suggestions redundancy | Unit test: prompt string includes the differentiation instruction verbatim, referencing both field names |
| --- | --- | --- | --- |
| 6.2 | Confirm RecommendationSchema (Task 1.4) already permits an empty suggestions array (unlike recommendations' ≥1 requirement) — no schema modification needed; this task only confirms the existing schema's leniency is correct for this field's actual requirement (no PRD requirement mandates ≥1 suggestion, only ≥1 recommendation) | Confirmed: suggestions: list\[str\] accepts \[\] without validation error | Regression test: Task 1.4's existing schema test suite already covers this; re-run to confirm no change needed |
| --- | --- | --- | --- |
| 6.3 | Apply RecommendationValidator's grounding check (Task 4.2) to suggestions as well, **if** a suggestion references a specific product/category (many won't, being more operational/behavioral in nature — the grounding check simply won't flag non-referencing suggestions, which is expected and correct, not a bug) | Grounding diagnostic extended to cover suggestions without forcing every suggestion to reference an entity | Unit test: an operational suggestion ("respond to buyer messages within 24h") with no product/category reference → not flagged as "ungrounded" in a way that implies an error; the diagnostic simply reports zero groundable-entity matches, which is expected for this field's nature |
| --- | --- | --- | --- |
| 6.4 | Confirm no new endpoint, no new Redis key, no new caching logic — suggestions rides in the same cached RecommendationSchema payload as insights/recommendations/forecastNote (Task 3.4's single cache write already covers it) | Single cache entry contains all four fields together | Code review: confirm zero additional Redis keys or cache-write calls introduced by this task |
| --- | --- | --- | --- |

### **Common Errors**

-   Duplicating content between recommendations and suggestions because the prompt doesn't explicitly differentiate them — without Step 6.1's guard, an LLM has no signal that these are meant to be distinct categories and may simply repeat itself across both fields.
-   Applying recommendations' ≥1-item hard requirement to suggestions — no source document requires a minimum suggestion count; over-constraining this field risks the LLM padding with low-value filler just to satisfy an invented quota.
-   Treating a "no groundable entity found" result from RecommendationValidator as an error for suggestions specifically — this field is expected to often be operational/behavioral rather than product-specific, so an ungrounded diagnostic here is normal, not a quality problem.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| suggestions minimum count | No minimum (0–3, may be empty) | REQ-F-Analytics-004 only specifies "≥1 AI recommendation" — it does not name "suggestions" as a separately-mandated minimum; treating them identically to recommendations would over-specify beyond the actual binding PRD requirement |
| --- | --- | --- |
| Redundancy prevention mechanism | Prompt-instruction differentiation only (no post-hoc deduplication code) | A code-level similarity/deduplication check between two LLM-generated free-text arrays would be complex and error-prone (false positives on legitimately-related-but-distinct points); prompt-level guidance is the simpler, sufficient first line of defense, consistent with this feature's overall philosophy of not algorithmically rewriting LLM output (Task 4.5) |
| --- | --- | --- |

### **Artifacts Produced**

-   No new backend artifacts — this task is entirely prompt-instruction extension (within Task 3.1's existing handler) plus confirmation that Task 1.4's schema and Task 4.2's grounding validator already correctly accommodate this field's more lenient, non-product-specific nature.

### **Definition of Done**

-   \[ \] Prompt explicitly differentiates suggestions from recommendations to minimize redundancy
-   \[ \] suggestions array correctly permits zero items without validation error (confirmed via regression test, no schema change made)
-   \[ \] Grounding diagnostic (Task 4.2) applied without penalizing suggestions that have no product/category reference
-   \[ \] Zero new endpoints, Redis keys, or caching logic introduced

## **Task 7 — Dashboard Integration**

### **Purpose**

-   Wire the finished AiAnalyticsService.generate() (Tasks 3–6's combined output) into a **new, additive** endpoint consumed by SCR-S08's dashboard, and implement the **dismissal** mechanic (App Flow: "dismiss AI card \[R1.1\] (suppress 14 days)") using this feature's Redis-only gap resolution (flagged at the top of this document).
-   Guarantee **zero modification** to any of Feature 11's existing endpoints/services — this is purely an additive integration point, consistent with the Feature 15 brief's explicit "Existing analytics functionality remains unchanged" deliverable.

### **Dependencies**

-   Task 1 (Foundation): Redis dismissal-key convention (ai-analytics:{sellerId}:dismissed-until).
-   Tasks 3–6: AiAnalyticsService.generate() producing the full {insights, recommendations, forecastNote, suggestions} payload.
-   Feature 11 Task 1: AnalyticsOwnershipGuard, DateRangeDto — reused for RBAC/seller-scoping consistency, though this endpoint doesn't take a date-range parameter itself (it always operates on Task 2's fixed internal snapshot range).
-   Feature 9: Notifications — **not used for this feature** (no PRD requirement calls for notifying sellers when a new recommendation is ready; the card is pull-based, loaded on dashboard visit) — explicitly confirmed as out of scope rather than assumed silently.

### **Expected Deliverables**

-   \[ \] GET /api/v1/seller/analytics/ai-recommendations — new, additive endpoint returning {dismissed: boolean, recommendation: RecommendationSchema | null, insufficientData: boolean}
-   \[ \] POST /api/v1/seller/analytics/ai-recommendations/dismiss — sets the 14-day Redis dismissal TTL (App Flow SCR-S08's exact dismissal duration)
-   \[ \] Confirmation that Feature 11's existing GET /api/v1/seller/analytics/{revenue,sales-trend,category-breakdown,orders,customers,top-products} endpoints are **completely untouched** (zero diffs)
-   \[ \] Swagger entries for the two new endpoints

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 7.1 | Implement GET /api/v1/seller/analytics/ai-recommendations: AnalyticsOwnershipGuard (Feature 11 Task 1.3, reused) → check Redis dismissal key first (ai-analytics:{sellerId}:dismissed-until — if present and unexpired, return {dismissed: true, recommendation: null} **without** calling AiAnalyticsService.generate() at all, saving both compute and any risk of an unwanted AI call during a dismissal window) → otherwise call AiAnalyticsService.generate(sellerId) (Task 3.2, which itself checks its own separate cache before any AI call) | 200 enveloped response, ownership-scoped | Integration test: a seller with an active dismissal never triggers AiAnalyticsService.generate() (spy assertion); a seller without dismissal gets the full flow |
| --- | --- | --- | --- |
| 7.2 | Implement POST /api/v1/seller/analytics/ai-recommendations/dismiss: sets ai-analytics:{sellerId}:dismissed-until in Redis with a **14-day TTL** (App Flow SCR-S08's exact figure — sourced directly from the App Flow document, not an assumption) | Dismissal recorded; subsequent GET calls short-circuit per 7.1 until the TTL naturally expires | Integration test: calling dismiss, then GET again within 14 days → {dismissed: true}; after TTL expiry (simulated via a shortened TTL in tests) → GET resumes normal generation flow |
| --- | --- | --- | --- |
| 7.3 | Confirm (code review + diff check) that **zero lines** of Feature 11's existing controllers/services/repositories/routes were modified by this feature — this task's endpoints live entirely in the new ai-analytics module (Task 1.5), calling **into** Feature 11's read-only services (Task 2) but never altering Feature 11's own files | Zero diff against Feature 11's codebase | git diff (or equivalent) against Feature 11's module files shows no changes |
| --- | --- | --- | --- |
| 7.4 | Confirm the response shape cleanly signals all three states to the frontend: dismissed: true (card suppressed), insufficientData: true (seller too new — matches SCR-S08's existing "Your analytics will appear here once your first order is placed" empty-state philosophy, extended here to the AI card specifically), or a populated recommendation object | Three-state response contract, unambiguous for frontend rendering | Integration test: each of the three states independently reproducible and distinguishable in the response payload |
| --- | --- | --- | --- |
| 7.5 | Swagger annotations for both new endpoints | Visible in /api-docs, clearly marked as additive/new (not modifying any existing Feature 11 Swagger entries) | Manual check: confirm Feature 11's existing Swagger entries are unchanged, only two new paths added |
| --- | --- | --- | --- |

### **Common Errors**

-   Calling AiAnalyticsService.generate() **before** checking the dismissal key — wastes a cache-lookup (or worse, an AI call, if Task 3's own cache also happens to be stale) on a seller who has explicitly asked not to see the card; dismissal must be the very first check.
-   Modifying Feature 11's existing dashboard-loading logic to "inject" the AI card server-side — this task's endpoint is a **separate** additive route; the frontend (out of this backend playbook's scope) is responsible for calling it alongside, not instead of, Feature 11's existing calls.
-   Setting the dismissal TTL to a value other than 14 days — App Flow SCR-S08 states this exact duration explicitly; it is not an assumption to be re-derived.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Dismissal-check ordering | Dismissal check strictly precedes any call into AiAnalyticsService.generate() | Guarantees a dismissed seller incurs zero computation/AI cost, maximizing the cost-control benefit of the dismissal feature exactly as intended by App Flow's UX description |
| --- | --- | --- |
| Endpoint additivity | Two brand-new routes under the ai-analytics module; zero modification to Feature 11's existing routes/controllers | Directly satisfies the Feature 15 brief's "Existing analytics functionality remains unchanged" deliverable and this playbook's "Do NOT rebuild any of the above" instruction for Feature 11 |
| --- | --- | --- |

### **Artifacts Produced**

-   GET /api/v1/seller/analytics/ai-recommendations, POST /api/v1/seller/analytics/ai-recommendations/dismiss — the final, seller-facing endpoints of this entire feature; no further tasks build on these.

### **Definition of Done**

-   \[ \] Dismissed sellers never trigger AiAnalyticsService.generate() (verified via spy/mock)
-   \[ \] Dismissal TTL is exactly 14 days, matching App Flow SCR-S08
-   \[ \] Feature 11's existing endpoints/controllers/services show zero diffs after this feature is implemented
-   \[ \] Three response states (dismissed, insufficientData, populated recommendation) are each independently testable and distinguishable
-   \[ \] Swagger documents both new endpoints without altering any existing Feature 11 documentation

## **Validation & Testing**

| **Layer** | **Coverage Target** | **Tooling (reused)** | **Key Scenarios** |
| --- | --- | --- | --- |
| Unit | Snapshot building, prompt construction, schema validation, grounding diagnostic, trend-sufficiency gating, disclaimer append | Jest (Core API) / pytest (AI Service) — reused per Features 13/14's precedent | Insufficient-data snapshot skips AI call; malformed LLM JSON rejected; forecastNote forced null on thin trend history regardless of LLM output; disclaimer always appended deterministically |
| --- | --- | --- | --- |
| Integration | Full pipeline: dismissal check → cache check → snapshot → AI call → cache write → response | Jest + Supertest (Core API), pytest + mocked LLM (AI Service), ephemeral Postgres/Redis (reused CI, TRD §23) | Dismissed seller short-circuits before any generation; cached-fresh seller skips AI call; cache-miss seller completes full round trip; timeout routes to a clean typed failure, nothing cached |
| --- | --- | --- | --- |
| Cross-service | Core API ↔ AI Service contract, network isolation (third route) | Docker Compose harness (reused Features 13/14 precedent) | /recommend unreachable via public route; Core API times out cleanly if AI Service is down |
| --- | --- | --- | --- |
| Regression | Feature 11's existing endpoints/tests completely unaffected | Existing Feature 11 Task 1–7 test suites (rerun, not modified) | All pre-existing Feature 11 tests pass unchanged; zero diffs confirmed against Feature 11's module files |
| --- | --- | --- | --- |
| Cost/behavior | LLM call frequency bounded (R4/T2 cost-control) | Call-count spies across Core API test suite | Across a simulated multi-day/multi-load-test window, AI Service call count matches expected cache-hit ratio (roughly one call per seller per refresh cadence, not one per dashboard page view) |
| --- | --- | --- | --- |

### **Coverage Gate**

-   \[ \] ≥80% backend coverage maintained across both Core API and AI Service new code (REQ-NF-Quality-003), verified via existing Istanbul/c8 (Core API) and pytest-cov (AI Service) — no new tooling.
-   \[ \] Zero lint/type errors (ESLint/tsc --noEmit; Flake8/Black/mypy — all reused per TRD §13).
-   \[ \] Full production-scale LLM-cost monitoring (PRD Risk R4: "Monitor from Week 2... cap usage") is owned by the project-wide cost-monitoring practice already established across Features 13/14/15 collectively, not re-implemented per feature.

## **Consistency Review, Assumptions, Documentation Gaps**

### **Consistency Review vs Features 0–14**

| **Check** | **Result** |
| --- | --- |
| No new database tables/columns/enums introduced | ✅ Pass — this feature is entirely Redis-backed (cache + dismissal TTL); zero Postgres schema changes. This directly resolves the schema gap flagged at the top of this document via the most conservative available option |
| --- | --- |
| No new routing conventions introduced | ✅ Pass — follows /api/v1/seller/analytics/ai-recommendations\[/dismiss\] (TRD §9), additive alongside Feature 11's existing /seller/analytics/\* paths |
| --- | --- |
| No new authentication mechanism introduced | ✅ Pass — reuses Feature 1's authenticate → authorize(SELLER) chain and Feature 11's AnalyticsOwnershipGuard |
| --- | --- |
| No duplicate shared components rebuilt | ✅ Pass — response envelope, error hierarchy, validation framework, Feature 11's four analytics services, Feature 13's LlmClient/LlmFallbackOrchestrator, Feature 14's shared-AI-Service-app precedent all reused, not rebuilt |
| --- | --- |
| Two/three-service architecture respected | ✅ Pass — /recommend is the **third** router on the same single AI Service app (alongside /generate-listing and /analyze-return), confirming TRD §2's diagram is now fully realized across Features 13–15 |
| --- | --- |
| D3 fallback strategy correctly reused | ✅ Pass — GPT-4 (text) primary → GPT-3.5-turbo fallback via the exact same, unmodified LlmFallbackOrchestrator class Feature 13 built |
| --- | --- |
| Existing Analytics Dashboard (Feature 11) unchanged | ✅ Pass — confirmed via explicit diff-check step (Task 7.3); this feature only adds two new routes and reads Feature 11's services, never writes to or modifies them |
| --- | --- |
| No forecasting model/architecture invented | ✅ Pass — Task 5 explicitly constrains "forecasting" to qualitative LLM narrative only, avoiding any statistical/ML model not named in any source document |
| --- | --- |
| Cost-control risk (R4/T2) addressed | ✅ Pass — dismissal-first ordering, per-seller caching, and a single combined /recommend call (not four) all directly serve this project-wide, already-established risk mitigation |
| --- | --- |

**No conflicts found with Features 0–14 or with the PRD/TRD/App Flow/Schema/Implementation Plan**, with one schema/requirements gap flagged upfront (no persistence reserved for AI Analytics content) and resolved conservatively (Redis-only), consistent with the precedent Feature 13 Task 5 established for an analogous gap.

### **Assumptions Made (flagged, not invented as fact)**

1.  **No persisted storage for AI Analytics content** (flagged at the top of this document): Doc 5 has no table/columns reserved for recommendations, insights, forecasts, or dismissal state, unlike Feature 10/14's pre-provisioned returns.ai\_\* columns. This playbook resolves this via Redis-only, ephemeral, regenerable content. **Action for implementers:** confirm with the schema owner whether historical/durable AI-recommendation records are actually required (e.g., for audit, trend-of-recommendations-over-time, or compliance purposes) — if so, a schema amendment is required, which is outside this playbook's authority.
2.  **"Sales Forecasts" and "Business Suggestions" as sub-fields of one requirement, not separate features** (Feature Overview): REQ-F-Analytics-004 only names one "AI recommendation" capability; the Feature 15 brief's four-part breakdown (Insights/Recommendations/Forecasts/Suggestions) is treated as four facets of that single requirement's structured output, not four independently-mandated capabilities.
3.  **Cache/refresh cadence: weekly** (Task 3.4): no source document specifies how often the AI card should regenerate. Flagged for product-owner confirmation.
4.  **Core API timeout ceiling: 30s** (Task 3.3): borrowed from Feature 13's precedent as the closest analogous non-realtime-critical AI call; no PRD requirement specifies a latency target for this feature specifically.
5.  **Default snapshot range: trailing 30 days** (Task 2, Engineering Decision): no source document specifies an AI-specific default range distinct from SCR-S08's general dashboard filter options.
6.  **Trend-sufficiency threshold for forecasting: ≥14 days** (Task 5.2): an interpretive minimum, not sourced from any document.
7.  **Disclaimer wording/mechanism for forecastNote** (Task 5.4): no source document specifies exact disclaimer language; a fixed, code-owned suffix was chosen as the safest, most consistent mechanism.
8.  **suggestions has no minimum count** (Task 6, Engineering Decision): REQ-F-Analytics-004 only mandates ≥1 for "recommendation," and this playbook does not extend that minimum to the brief's separately-named "suggestions" category absent explicit PRD support.

### **Unresolved Documentation Gaps**

1.  **No schema provisioning exists anywhere for AI Analytics content** (Assumption 1) — the single most significant gap in this feature, directly analogous to (but distinct from) the SEO-metadata gap flagged in Feature 13 Task 5. Recommend a future PRD/Schema addendum explicitly deciding whether this content should ever be durable (with corresponding Doc 5 table additions) or is intentionally meant to remain ephemeral/regenerable forever.
2.  **No refresh cadence, timeout ceiling, or trend-sufficiency threshold is documented anywhere in the PRD/TRD** (Assumptions 3, 4, 6) — unlike Features 13 (30s/REQ-NF-Perf002) and 14 (60s/REQ-F-Return-004), which have explicit numeric targets, this feature has none. Recommend the PRD/TRD be amended with explicit targets for AI Analytics latency and refresh cadence, rather than leaving these to implementer judgment as this playbook currently does.
3.  **No disclaimer/estimate-labeling convention exists anywhere in the source documents** for any AI-generated content across Features 13–15 (Assumption 7) — this feature is the first to introduce one (for forecastNote specifically, given its inherently predictive nature). Recommend considering whether a similar disclaimer convention should retroactively apply to AI Store Builder (Feature 13) or ReturnsAI (Feature 14) outputs, or whether this feature's forecast-specific disclaimer is sufficient in isolation — a product/documentation decision outside this playbook's authority.
4.  **Whether AI Analytics content should ever trigger a notification** (Task 7, Dependencies note) — this playbook explicitly assumes a pull-only (dashboard-visit-triggered) model with no Feature 9 notification hook, since no PRD requirement calls for one. If product intent is for sellers to be proactively notified ("Your weekly AI insights are ready"), this would require a new notification event, which is outside this feature's current scope and should be raised as a follow-up rather than silently added.

*End of Playbook — Feature 15: AI Analytics. All three responses (Tasks 1–7, Validation & Testing, Consistency Review) are now complete. No section was rewritten after its initial generation.*