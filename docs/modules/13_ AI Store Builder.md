# **KarobarAI — Engineering Execution Playbook**

## **Feature 13: AI Store Builder**

**Source of truth:** PRD (Doc 1) · TRD (Doc 2) · App Flow (Doc 3) · Backend Schema (Doc 5) · Implementation Plan (Doc 6) **Depends on:** Feature 1 (Auth/RBAC), Feature 3 (Store Management), Feature 4 (Product Management), Feature 9 (Notifications), Object Storage Adapter (existing)

**Status:** Draft — Response 1 of 3 (Tasks 1–2).

## **Table of Contents**

1.  [Feature Overview](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#1-feature-overview)
2.  [AI Store Builder Flow](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#2-ai-store-builder-flow)
3.  Task 1 — AI Store Builder Foundation
4.  Task 2 — Image Upload & Validation
5.  *(Deferred to Response 2)* Task 3 — AI Request Pipeline
6.  *(Deferred to Response 2)* Task 4 — Generate Product Content
7.  *(Deferred to Response 3)* Task 5 — SEO Metadata & Edit/Review
8.  *(Deferred to Response 3)* Task 6 — Save Product
9.  *(Deferred to Response 3)* Validation & Testing
10.  *(Deferred to Response 3)* Consistency Review, Assumptions, Documentation Gaps

## **1\. Feature Overview**

-   Implements PRD §12.1 (SRS §4.1) — the **flagship MVP differentiator**: photo → bilingual (UR/EN) title, 2–3 sentence description, category, 5–10 SEO tags (REQ-F-Store001–007, REQ-AI-Store001–002).
-   Lives across **two services per TRD §1/§5.2**: the **AI Service** (Python + FastAPI, apps/ai-service/) owns the LLM client + fallback chain + JSON-schema enforcement ({title\_en, title\_ur, description\_en, description\_ur, category, tags}, Pydantic-validated); the **Core API** (apps/api/) owns the seller-facing endpoint, image handling, draft-product orchestration, and persistence. This feature builds **both sides of that boundary**, not a new architecture — the two-service split and REST-over-private-network contract are already fixed by TRD §1/§11 and are **not renegotiated here**.
-   **LLM fallback (D3, binding):** GPT-4 Vision primary → GPT-3.5-turbo fallback, config-only switch, seller unaware of which model served the request (App Flow SCR-S02 edge case). This feature implements the fallback chain; it does **not** revisit D3's model choice.
-   **Edit AI Output** is not a separate screen — per App Flow SCR-S02, generated fields populate directly into the **same editable form** used for manual product entry (Feature 4's product-creation form). This feature does not build a new editing UI/data path; it only ensures AI output lands in Feature 4's existing editable field set and existing Product draft/publish flow.
-   **Explicitly out of scope:** ReturnsAI (Feature 8/R1.1, different AI Service router), self-hosted LLaMA fallback (F24/Future), AI analytics recommendation cards (Feature 11 follow-on/R1.1). This feature touches only the generate\_listing router path (TRD §12 ai-service/app/routers/generate\_listing).

## **2\. AI Store Builder Flow**

Seller @ /seller/products/new (SCR-S02, Feature 4's Add Product screen)

│

▼

Upload image(s) (JPEG/PNG/WebP, ≤10MB, REQ-F-Store001)

│ client-side compression before upload (REQ-F-Store007, <200KB target)

▼

Core API: POST /api/v1/products/ai-generate

│ validate file (type/size/magic-byte, Sec-012) ── reused Object Storage Adapter upload

│ fields lock, progress indicator shown (REQ-F-Store004)

▼

Core API ──REST, private network (TRD §1)──► AI Service: POST /generate-listing

│ │

│ LLM Client: GPT-4 Vision

│ │ success ──► JSON validated (Pydantic)

│ │ fail/timeout ──► GPT-3.5-turbo fallback (D3)

│ │ │ success ──► JSON validated

│ │ │ fail ──► error to Core API

◄──────────────────────────────────────────┘

│

├─ success: {title\_en, title\_ur, description\_en, description\_ur, category, tags\[5-10\]}

│ ▼

│ Core API maps AI JSON → Product draft fields, unlocks form (REQ-F-Store004)

│ ▼

│ Seller reviews/edits any field (Feature 4's existing editable form, no new UI)

│ ▼

│ Publish (requires title + ≥1 image + category, REQ-F-Store003) or Save Draft

│ ▼

│ Feature 4's existing product-create/update path persists (ai\_generated = true)

│

└─ failure/timeout: error shown, Retry button, fields left blank for manual entry (REQ-F-Store005)

Notes:

-   The AI Service is **never** reachable from the public internet (TRD §8) — Core API is the only caller.
-   No new database table is introduced; products.ai\_generated (Doc 5 §4.6) already exists precisely for this feature's provenance flag.

## **Task 1 — AI Store Builder Foundation**

### **Purpose**

-   Stand up the module skeleton on **both sides** of the service boundary: apps/ai-service/app/routers/generate\_listing (new) and a corresponding Core API module (apps/api/src/modules/ai-store-builder/ or extension of catalog/products module — see Engineering Decision).
-   Establish the **provider-agnostic LLM client + fallback chain** (D3) as a reusable component, and the **Pydantic/Zod schema contract** shared across the service boundary — built once, consumed by every generation task (Tasks 3–5).

### **Dependencies**

-   Feature 1: Auth middleware, JWT, RBAC (SELLER role), response envelope, error hierarchy, Zod validation framework (Core API side).
-   Feature 3: Store Management — seller must have completed Store-Setup Wizard before this endpoint is reachable (REQ-F-Auth005 ordering, already enforced by Feature 3's existing guard, **not reimplemented**).
-   Feature 4: Product Management — product draft schema, products.ai\_generated column, existing create/update service (this feature calls into it, does not duplicate it).
-   TRD §5.2 / §12: AI Service scaffold (Python 3.11, FastAPI, Pydantic) — if the AI Service container/base app does not yet exist from a prior feature, this task creates the **first** router in it; if it already exists (e.g., stood up generically in Phase 1/2 of the Implementation Plan), this task only adds the generate\_listing router — flagged as Assumption if unclear which is the case at implementation time.

### **Expected Deliverables**

-   \[ \] apps/ai-service/app/routers/generate\_listing.py (or module) mounted on the AI Service FastAPI app
-   \[ \] apps/ai-service/app/llm/ — provider-agnostic client interface + GPT-4V/GPT-3.5 concrete implementations + fallback orchestrator (D3)
-   \[ \] apps/ai-service/app/schemas/listing.py — Pydantic model enforcing {title\_en, title\_ur, description\_en, description\_ur, category, tags} (REQ-AI-Store002)
-   \[ \] Core API module scaffold (routes/controller/service/dto) for the seller-facing endpoint
-   \[ \] Shared error-code additions: AI\_GENERATION\_FAILED, AI\_GENERATION\_TIMEOUT, AI\_SERVICE\_UNAVAILABLE

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 1.1 | Confirm/create the AI Service base app (apps/ai-service/app/main.py) mounts a generate\_listing router at /generate-listing per TRD §12 folder layout | Router registered, stub returns 501 | uvicorn boots; GET /docs (FastAPI auto-OpenAPI) shows the route |
| --- | --- | --- | --- |
| 1.2 | Define LlmClient interface (Python, app/llm/client.py): abstract generate(image, hint) -> ListingResult — provider-agnostic per D2/D3 adapter philosophy already established for Core API adapters (TRD §3), mirrored here for the AI Service's LLM provider | Interface class, no concrete provider logic yet | Unit test: interface cannot be instantiated directly (ABC/Protocol enforcement) |
| --- | --- | --- | --- |
| 1.3 | Implement GptVisionClient (primary) and GptTurboClient (fallback) concrete classes, both implementing LlmClient, reading OPENAI\_API\_KEY/LLM\_PRIMARY\_MODEL/LLM\_FALLBACK\_MODEL from env (TRD §27 — **already-reserved env vars, not new ones**) | Two concrete client classes | Unit test with a mocked OpenAI SDK response: each client parses a valid completion into the expected shape |
| --- | --- | --- | --- |
| 1.4 | Implement LlmFallbackOrchestrator.generate(image, hint): tries GptVisionClient first; on exception/timeout, falls back to GptTurboClient (D3, config-only switch — no code change to switch models, TRD §5.2/REQ-AI-Store001); raises AiGenerationError if both fail | Single entry point used by all generation tasks (Tasks 3–5) | Unit test: primary-fails-fallback-succeeds path returns fallback's result; both-fail path raises typed error |
| --- | --- | --- | --- |
| 1.5 | Define ListingSchema (Pydantic, app/schemas/listing.py): title\_en: str, title\_ur: str, description\_en: str, description\_ur: str, category: str, tags: list\[str\] (5–10 items, REQ-F-Store002) — reject/repair malformed LLM JSON via Pydantic validation error | Schema enforces exact shape from REQ-AI-Store002 | Unit test: LLM output missing a field → ValidationError; valid output → parses cleanly |
| --- | --- | --- | --- |
| 1.6 | Core API: create module scaffold apps/api/src/modules/ai-store-builder/ (or extend catalog/products module — see Engineering Decision) with controller.ts, service.ts, routes.ts, dto.ts per TRD §12 layout | Folder scaffolded, stub route mounted | pnpm build compiles; /api/v1/products/ai-generate mounts (stub OK) |
| --- | --- | --- | --- |
| 1.7 | Register shared error codes AI\_GENERATION\_FAILED, AI\_GENERATION\_TIMEOUT, AI\_SERVICE\_UNAVAILABLE in packages/shared (TRD §9 pattern, reused from every prior feature's error-code registration) | Error codes available to both API and tests | Envelope emits correct code/status per case |
| --- | --- | --- | --- |

### **Common Errors**

-   Hard-coding the LLM model name inline instead of reading LLM\_PRIMARY\_MODEL/LLM\_FALLBACK\_MODEL from env — violates REQ-AI-Store001's "switching via config only, no code change" requirement.
-   Building the fallback logic in the **Core API** instead of the **AI Service** — TRD §5.2 explicitly places "LLM client + fallback" inside the AI Service; the Core API only calls /generate-listing once and receives a single result.
-   Skipping Pydantic schema validation and passing raw LLM JSON straight through — REQ-AI-Store002 requires strict schema conformance before the result ever reaches the Core API.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Core API module placement | New ai-store-builder module, calling into Feature 4's existing Product service for persistence (not a Feature 4 sub-folder) | Keeps AI-generation orchestration (upload, AI call, draft mapping) separable from core CRUD, matching TRD §12's modular-per-domain folder convention; Feature 4's product service remains the single writer of products |
| --- | --- | --- |
| Fallback chain location | Entirely inside AI Service (LlmFallbackOrchestrator), invisible to Core API | Matches TRD §5.2 exactly: "LLM client: Provider-agnostic wrapper: GPT-4 Vision → GPT-3.5-turbo fallback (D3)" is listed as an AI Service concern, not Core API |
| --- | --- | --- |
| Schema enforcement layer | Pydantic in AI Service (authoritative) + Zod DTO in Core API (defensive re-validation of the AI Service's response) | TRD §9 requires validation "at every boundary" (Zod/Pydantic); double-validating the AI Service's own output at the Core API boundary catches any contract drift between services |
| --- | --- | --- |

### **Artifacts Produced**

-   apps/ai-service/app/routers/generate\_listing.py, app/llm/client.py, app/llm/gpt\_vision\_client.py, app/llm/gpt\_turbo\_client.py, app/llm/fallback\_orchestrator.py, app/schemas/listing.py — reused unmodified by Task 3 (AI Request Pipeline wires the Core API call to this), Task 4 (Generate Product Content consumes this exact schema), Task 5 (SEO metadata may extend ListingSchema if tags/description double as SEO fields — see Task 5).
-   apps/api/src/modules/ai-store-builder/ scaffold — extended by every subsequent Core API–side task.
-   Shared error codes — reused by Tasks 2–6.

### **Definition of Done**

-   \[ \] AI Service generate\_listing router mounted and documented in FastAPI's auto-OpenAPI
-   \[ \] LlmFallbackOrchestrator unit-tested for primary-success, primary-fail-fallback-success, and both-fail paths
-   \[ \] ListingSchema rejects any LLM output missing a required field or with a malformed tags array
-   \[ \] Core API module scaffold compiles and mounts a stub route
-   \[ \] Model switching (LLM\_PRIMARY\_MODEL/LLM\_FALLBACK\_MODEL) provably requires zero code change (config-only test)
-   \[ \] Zero Prisma/schema drift — no new tables/columns introduced
-   \[ \] Lint/type-check clean on both services

## **Task 2 — Image Upload & Validation**

### **Purpose**

-   Accept and validate the seller's product photo(s) before any AI call is made (REQ-F-Store001), rejecting oversized/invalid files early and cheaply.
-   Persist the (compressed) image via the **existing Object Storage Adapter** — no new storage integration — so the same cdn\_url is usable both for the AI Vision call and for the eventual product\_images row (Feature 4).

### **Dependencies**

-   Task 1 (Foundation): Core API module scaffold, error codes.
-   Object Storage Adapter (existing, reused per Feature 10/11 playbooks' precedent — upload()/getUrl()).
-   Feature 1: server-side file validation utility (magic-byte + size, Sec-012) — reused, not reimplemented (same utility used by Feature 10's return-image upload).
-   Feature 4: product\_images schema (Doc 5 §4.7) — this task stages images for eventual attachment; final persistence happens in Task 6 (Save Product).

### **Expected Deliverables**

-   \[ \] POST /api/v1/products/ai-generate/upload (or combined with generation call — see Engineering Decision) — accepts image(s), validates, stores, returns cdn\_url(s)
-   \[ \] Server-side validation: file type (JPEG/PNG/WebP), ≤10MB (REQ-F-Store001), magic-byte check (Sec-012)
-   \[ \] Confirmation that client-side compression (REQ-F-Store007, <200KB) is a **frontend** responsibility; this task documents the server-side contract it depends on, not the frontend compression code itself
-   \[ \] Swagger entry

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 2.1 | Implement multipart upload handling in the ai-store-builder controller: accept 1–N image files, validate each via the **existing** magic-byte/size validation utility (reused from Feature 1/Feature 10 precedent, not rebuilt) | Invalid files rejected with 400 ValidationError before any storage/AI call | Integration test: oversized (>10MB) file → 400 before any adapter call is made (verify via spy — zero storage calls on rejection) |
| --- | --- | --- | --- |
| 2.2 | For each valid file, call ObjectStorageAdapter.upload() (existing adapter, mock in MVP per D2) — store under a **staging** key/prefix (e.g., products/staging/{tempId}/) distinct from a published product's final image path, since the product doesn't exist yet at this point in the flow | Files uploaded, cdn\_url(s) returned | Integration test against mock adapter: returned URLs are retrievable; staging prefix distinct from Feature 4's published-product image path convention |
| --- | --- | --- | --- |
| 2.3 | Designate the **first** uploaded image as primary (mirrors product\_images.position = 0 convention, Doc 5 §4.7) — this is the image sent to the Vision API in Task 3 | First image flagged/ordered as primary | Unit test: multi-image upload preserves upload order; first index = primary |
| --- | --- | --- | --- |
| 2.4 | Return a response containing {stagingId, images: \[{cdnUrl, position}\]} that the frontend carries forward into the generation call (Task 3) and, on publish, into Task 6's final save | Response envelope with staging reference | Integration test: response shape matches DTO; stagingId is unique per upload session |
| --- | --- | --- | --- |
| 2.5 | Swagger annotation for the upload endpoint | Visible in /api-docs | Manual check |
| --- | --- | --- | --- |

### **Common Errors**

-   Calling the AI Vision endpoint (Task 3) with an unvalidated file — always validate and stage first; never let an oversized/invalid file reach the AI Service or incur LLM cost.
-   Writing directly into a product's final product\_images rows before the product itself exists — must use a staging path; final product\_images rows are only created in Task 6 once the product record exists (Doc 5 §4.7 FK product\_id NOT NULL).
-   Re-validating file type/size with new, duplicate logic instead of reusing the existing Sec-012 validation utility.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Upload/generation endpoint shape | Separate upload step producing a stagingId, consumed by a subsequent generate call (Task 3) | Decouples "did the file validate/store correctly" from "did the AI call succeed," letting Retry (REQ-F-Store005) re-run generation without re-uploading; also avoids re-uploading on every AI retry attempt |
| --- | --- | --- |
| Staging storage location | Distinct staging prefix, not the final product\_images path | product\_images.product\_id is NOT NULL (Doc 5 §4.7) — no product exists yet at upload time, so a final row cannot be created until Task 6 |
| --- | --- | --- |

### **Artifacts Produced**

-   ImageUploadService (Core API) — staging-upload logic; reused by Task 3 (passes staged cdnUrl to the AI Service call) and Task 6 (promotes staged images to final product\_images rows on save).
-   POST /api/v1/products/ai-generate/upload — first live endpoint in the seller-facing flow.

### **Definition of Done**

-   \[ \] Oversized/invalid files rejected before any storage or AI call occurs
-   \[ \] Valid images stored via the existing Object Storage Adapter under a staging path
-   \[ \] First image correctly flagged as primary
-   \[ \] Response includes a stagingId usable by subsequent generation/save steps
-   \[ \] Swagger documents the endpoint
-   \[ \] No duplicate validation logic introduced (confirmed reuse of Sec-012 utility)

*End of Response 1 (Tasks 1–2). Say "continue" for Response 2 — Task 3 (AI Request Pipeline) and Task 4 (Generate Product Content).*

## **Table of Contents (updated)**

1.  [Feature Overview](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#1-feature-overview)
2.  [AI Store Builder Flow](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#2-ai-store-builder-flow)
3.  Task 1 — AI Store Builder Foundation
4.  Task 2 — Image Upload & Validation
5.  Task 3 — AI Request Pipeline
6.  Task 4 — Generate Product Content
7.  *(Deferred to Response 3)* Task 5 — SEO Metadata & Edit/Review
8.  *(Deferred to Response 3)* Task 6 — Save Product
9.  *(Deferred to Response 3)* Validation & Testing
10.  *(Deferred to Response 3)* Consistency Review, Assumptions, Documentation Gaps

**Status:** Draft — Response 2 of 3 (Tasks 1–4).

## **Task 3 — AI Request Pipeline**

### **Purpose**

-   Wire the Core API → AI Service call (POST /generate-listing) with the **progress-indicator/field-lock UX contract** (REQ-F-Store004: fields locked, progress shown until generation completes or fails) and the **30s soft-latency target** (REQ-NF-Perf002).
-   Implement the **failure/timeout → Retry** path (REQ-F-Store005) as a first-class pipeline outcome, not an afterthought — Retry re-runs generation against the already-staged image (Task 2), never re-uploads.

### **Dependencies**

-   Task 1 (Foundation): LlmFallbackOrchestrator (AI Service side), Core API module scaffold, error codes.
-   Task 2 (Image Upload & Validation): stagingId/cdnUrl from a completed upload — this task's precondition.
-   TRD §9: idempotency/timeout conventions; TRD §21 performance targets (AI generation <30s).

### **Expected Deliverables**

-   \[ \] POST /api/v1/products/ai-generate (Core API) — accepts {stagingId, categoryHint?}, calls AI Service, returns generated fields or a typed failure
-   \[ \] AI Service POST /generate-listing fully wired to LlmFallbackOrchestrator (Task 1), accepting {imageUrl, hint}
-   \[ \] Timeout enforcement (Core API → AI Service call has a bounded wait, distinct from the AI Service's own internal primary→fallback timeout budget)
-   \[ \] Retry semantics: re-invokes generation against the same stagingId without re-upload
-   \[ \] Swagger entries (Core API) + FastAPI auto-doc confirmation (AI Service)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 3.1 | Implement AI Service POST /generate-listing handler: accepts \`{imageUrl: str, hint: str | None}, calls LlmFallbackOrchestrator.generate()(Task 1.4), returnsListingSchema-validated JSON or a structured error ({error: "GENERATION\_FAILED" | "TIMEOUT"}\`) |
| --- | --- | --- | --- |
| 3.2 | Implement Core API AiGenerationService.generate(stagingId, hint?): resolves stagingId → cdnUrl (Task 2), calls AI Service via REST over the private Docker network (TRD §1, undici/axios per TRD §5.1, behind an adapter-style wrapper consistent with D2's adapter philosophy even though this is an internal service, not an external provider) | Core API successfully round-trips to AI Service and back | Integration test (Core API, AI Service mocked at HTTP layer): full round trip returns mapped fields |
| --- | --- | --- | --- |
| 3.3 | Set a Core API–side timeout on the AI Service call (e.g., 30s hard ceiling aligned to REQ-NF-Perf002's <30s **user-facing** target, minus network/mapping overhead — exact budget split flagged as Assumption if not documented elsewhere) — on timeout, map to AI\_GENERATION\_TIMEOUT (Task 1.7 error code) | Timeout enforced at the HTTP client level, not just relied upon from the AI Service side | Integration test: AI Service mock delays beyond the ceiling → Core API returns AI\_GENERATION\_TIMEOUT to the caller, does not hang |
| --- | --- | --- | --- |
| 3.4 | Implement POST /api/v1/products/ai-generate controller: AnalyticsOwnershipGuard-style seller-scoping is not needed here (no cross-seller data), but reuse authenticate → authorize(SELLER) (Feature 1) plus the Store-Setup-Wizard-completed guard (Feature 3, Task 1 dependency) before allowing the call | 200 with generated fields, or a typed 4xx/5xx per failure mode | Integration test: seller without completed store setup → blocked before AI call is attempted (no wasted LLM cost) |
| --- | --- | --- | --- |
| 3.5 | Implement Retry semantics: a second call to the same endpoint with the same stagingId re-invokes generation from scratch (no caching of a failed attempt); **do not** require re-upload (REQ-F-Store005: "leave fields blank for manual entry" on failure, but a subsequent Retry reuses the existing image) | Retry succeeds without a new upload call | Integration test: first call fails (mocked), second call with same stagingId succeeds independently |
| --- | --- | --- | --- |
| 3.6 | Map AI Service failure/timeout responses to the exact seller-facing UX contract (REQ-F-Store005): error message + "fields left blank for manual entry" — i.e., the endpoint must **never** partially populate fields on failure, only a clean success-or-failure boundary | Failure response contains no partial AI fields | Unit test: simulated partial/malformed AI Service response is treated as a full failure (fails Pydantic/Zod validation), not silently passed through with missing fields |
| --- | --- | --- | --- |
| 3.7 | Swagger annotation for POST /api/v1/products/ai-generate; confirm AI Service's /generate-listing is documented in its own FastAPI auto-OpenAPI (per TRD §5.2) — **not** exposed publicly (TRD §8: AI Service never reachable from the public internet) | Docs current on both sides; AI Service route confirmed unreachable externally (network policy) | Manual check + a network-level test confirming ai-service is not routed through Nginx's public /api proxy (TRD §2 diagram: AI Service only reachable via private REST from Core API) |
| --- | --- | --- | --- |

### **Common Errors**

-   Letting the Core API silently retry against **GPT-3.5 directly** on timeout instead of always calling the AI Service's /generate-listing, which owns the entire fallback chain internally — the Core API must never talk to OpenAI directly; that violates the two-service boundary (TRD §1/§5.2).
-   Passing through a partially-valid AI JSON response (e.g., missing title\_ur) as a "success" — any schema violation must be treated as a full failure per Task 1.5's Pydantic enforcement, re-validated defensively at the Core API's Zod boundary (Task 1 Engineering Decision).
-   Exposing /generate-listing on a public route or through Nginx — violates TRD §8's explicit "AI Service... never exposed publicly" rule.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Core API ↔ AI Service call style | Direct REST call (not queued/async via BullMQ) for the initial synchronous generation request | REQ-F-Store004 requires a live progress indicator with a bounded ~30s wait — this is a synchronous user-facing operation, unlike Notifications' async dispatch (Feature 9) or Return image analysis (R1.1, out of scope); matches TRD §2 diagram showing a direct REST (private net) arrow from Core API to AI Service |
| --- | --- | --- |
| Timeout ownership | Core API enforces its own outer timeout in addition to the AI Service's internal primary→fallback timeout budget | Prevents the Core API request from hanging indefinitely if the AI Service itself is slow/unresponsive, independent of whether the AI Service's own fallback logic is working correctly |
| --- | --- | --- |
| Retry mechanism | Stateless re-invocation of /generate-listing against the existing staged image; no failed-attempt caching | Matches REQ-F-Store005's "offer Retry" UX exactly; avoids added complexity of a retry-state table (no such table exists in Doc 5, and none is needed — schema stays frozen) |
| --- | --- | --- |

### **Artifacts Produced**

-   AI Service: generate\_listing route handler (completes Task 1's router stub) — this is the AI Service's final artifact for this feature; Task 4/5 only affect what the Core API does with the response, not the AI Service contract itself.
-   Core API: AiGenerationService, POST /api/v1/products/ai-generate — reused as-is by Task 4 (which defines exactly how the response fields map into the product draft) and Task 5 (SEO metadata, if generated in the same call — see Task 5).

### **Definition of Done**

-   \[ \] Full round trip (upload → generate → response) completes within the 30s soft target on mocked/test-tier LLM latency
-   \[ \] Timeout enforced at the Core API HTTP client level, independent of AI Service internals
-   \[ \] Failure responses never contain partial AI fields
-   \[ \] Retry re-runs generation without requiring re-upload
-   \[ \] AI Service /generate-listing confirmed unreachable from outside the private Docker network
-   \[ \] Store-Setup-Wizard-incomplete sellers blocked before any AI call is attempted
-   \[ \] Swagger/FastAPI docs current on both services

## **Task 4 — Generate Product Content**

### **Purpose**

-   Map the AI Service's validated ListingSchema response (title/description/category/tags) into **Feature 4's existing product draft fields** — no new field set, no new UI, just correct field-by-field mapping (REQ-F-Store002).
-   Ensure generated **category** resolves to an actual categories row (Doc 5 §4.5), not a free-text string, since products.category\_id is a real FK — this is the one place AI output must be reconciled against existing relational data, not just passed through.

### **Dependencies**

-   Task 3 (AI Request Pipeline): the raw ListingSchema response this task maps from.
-   Feature 4: categories repository/table (Doc 5 §4.5, slug, name\_en, name\_ur), product draft DTO/service (this task calls into it, does not duplicate it).

### **Expected Deliverables**

-   \[ \] ProductDraftMapper.fromAiResult(listingResult, stagingImages) → a draft object shaped exactly like Feature 4's existing "create product" input DTO
-   \[ \] CategoryResolutionService.resolve(aiCategoryString) → matches AI's free-text category guess to an existing categories row (best-effort match), or leaves category\_id = null for manual selection if no confident match
-   \[ \] Tag-count validation: enforce 5–10 tags (REQ-F-Store002) at the mapping layer, trimming/flagging if the AI over/under-produces
-   \[ \] Response to the seller-facing endpoint (Task 3) now includes the fully mapped draft, ready for the existing product form

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 4.1 | Implement CategoryResolutionService.resolve(aiCategoryString): fuzzy/exact match against categories.name\_en/name\_ur (reusing Feature 4's existing category repository read — no new category-matching infra beyond a simple string-similarity or exact-match-first strategy) | Returns a matched category\_id, or null if no confident match (seller must pick manually — this preserves REQ-F-Store003's "publishing requires... category" as a still-enforced, seller-confirmed step) | Unit test: AI returns "Women's Clothing" matching an existing category name\_en exactly → resolves; AI returns a nonsense/unmatched string → null, no error thrown |
| --- | --- | --- | --- |
| 4.2 | Implement ProductDraftMapper.fromAiResult(): maps title\_en/title\_ur → title\_en/title\_ur, description\_en/description\_ur → description\_en/description\_ur, resolved category\_id, tags (validated 5–10, REQ-F-Store002) into the **exact shape** Feature 4's product-create DTO already expects (no new field names invented) | Draft object directly consumable by Feature 4's existing create/update service | Unit test: mapper output passes Feature 4's existing product DTO Zod validation unmodified |
| --- | --- | --- | --- |
| 4.3 | Enforce tag-count bounds (5–10, REQ-F-Store002) at the mapping layer: if AI returns fewer than 5, keep as-is and flag (seller can add more manually — Feature 4's tag field is already editable, REQ-F-Store003); if more than 10, truncate to the top 10 (order as returned by the LLM, assumed relevance-ordered) — flagged as Assumption on truncation ordering | Tags array always ≤10 in the draft; count-below-5 case passed through, not blocked (editable, not fatal) | Unit test: 12-tag AI response truncated to 10; 3-tag response passed through unmodified with no error |
| --- | --- | --- | --- |
| 4.4 | Set ai\_generated = true on the mapped draft (Doc 5 §4.6 products.ai\_generated BOOLEAN) — this flag is **only** set by this pipeline; manual product creation (Feature 4's non-AI path) always sets it false (already Feature 4's existing default behavior, unchanged) | Draft object includes aiGenerated: true | Unit test: AI-path draft has aiGenerated: true; confirm Feature 4's manual-entry path is untouched by this feature (regression check) |
| --- | --- | --- | --- |
| 4.5 | Wire the Core API response (Task 3's endpoint) to return this fully mapped draft object — the seller's client then renders it into Feature 4's existing editable form fields (title/description/category/tags/price/stock), matching SCR-S02's "generated fields populate, all editable" behavior exactly | Endpoint response = ready-to-edit draft, not raw AI JSON | Integration test: end-to-end (upload → generate → response) produces a draft object structurally identical to what Feature 4's edit form expects |
| --- | --- | --- | --- |
| 4.6 | Confirm this task does **not** create a products row yet — the draft exists only in the response payload / client-side form state until the seller explicitly Publishes or Saves as Draft (Task 6) | No premature DB write | Code review: no ProductRepository.create() call exists anywhere in Tasks 3–4's code paths |
| --- | --- | --- | --- |

### **Common Errors**

-   Storing the AI's raw category **string** into a hypothetical text column instead of resolving it to categories.category\_id — products.category\_id is a real FK (Doc 5 §4.6); passing an unresolved string would violate referential integrity or require an unauthorized schema change.
-   Blocking generation entirely when the AI returns fewer than 5 tags — REQ-F-Store002 targets "5–10" but REQ-F-Store003 makes all fields editable; under-count should be a soft pass-through, not a hard failure, since the seller can add tags manually.
-   Persisting a products row directly from this task — premature; Task 6 (Save Product) owns the actual write, reusing Feature 4's existing create/update service, not a new one built here.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Category matching strategy | Best-effort exact/fuzzy match against existing categories, falling back to null (seller picks manually) rather than auto-creating a new category | categories (Doc 5 §4.5) has no "auto-created by AI" provenance concept and is treated as curated reference data; auto-creating categories from free-text LLM output risks category-list pollution and is not supported by any source document |
| --- | --- | --- |
| Over-count tag handling | Truncate to top 10, assume LLM output is roughly relevance-ordered | REQ-F-Store002 hard-caps at "5–10 SEO tags"; truncation preserves the requirement without discarding the AI call or forcing a re-generation |
| --- | --- | --- |
| Draft persistence timing | No DB write in this task; draft stays in-flight until seller action (Task 6) | Matches SCR-S02 exactly: "AI fail/timeout... fields left blank"; "Publish/Save Draft" are explicit seller-initiated buttons — the AI step never auto-saves |
| --- | --- | --- |

### **Artifacts Produced**

-   CategoryResolutionService — reused by Task 5 if SEO metadata generation also needs category context (e.g., for meta-description keyword alignment).
-   ProductDraftMapper — the exact same mapper is extended (not duplicated) in Task 5 to append SEO-specific fields to the same draft object, and consumed as-is by Task 6 to build the final Product create/update payload.

### **Definition of Done**

-   \[ \] AI category string resolves to a valid category\_id when a confident match exists; null (not an error) when it doesn't
-   \[ \] Mapped draft passes Feature 4's existing product DTO validation without modification to that DTO
-   \[ \] Tags array always ≤10; under-5 case passed through without error
-   \[ \] ai\_generated = true set only on AI-path drafts; manual path (Feature 4) unaffected
-   \[ \] No premature products row created by this task
-   \[ \] End-to-end integration test (upload → generate → mapped draft) passes

*End of Response 2 (Tasks 3–4). Say "continue" for Response 3 — Task 5 (SEO Metadata & Edit/Review), Task 6 (Save Product), Validation & Testing, and the final consistency review.*

## **Table of Contents (updated — final)**

1.  [Feature Overview](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#1-feature-overview)
2.  [AI Store Builder Flow](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#2-ai-store-builder-flow)
3.  Task 1 — AI Store Builder Foundation
4.  Task 2 — Image Upload & Validation
5.  Task 3 — AI Request Pipeline
6.  Task 4 — Generate Product Content
7.  Task 5 — SEO Metadata & Edit/Review
8.  Task 6 — Save Product
9.  Validation & Testing
10.  Consistency Review, Assumptions, Documentation Gaps

**Status:** Final — Response 3 of 3 (Tasks 1–6 + Validation & Consistency Review complete).

## **Task 5 — SEO Metadata & Edit/Review**

### **Purpose**

-   Address the Feature 13 brief's "Generate SEO Metadata" deliverable — **flagged upfront as a schema/requirements gap** (see Engineering Decision + final Documentation Gaps): no PRD requirement ID or Doc 5 column exists for SEO-specific fields (meta-title/meta-description/slug) beyond the **tags array** already produced in Task 4. This task resolves that gap conservatively rather than inventing new persisted fields.
-   Wire the **Edit/Review** contract (REQ-F-Store003: "all AI-generated fields are editable") as an explicit lock/unlock state machine on the draft, reusing Feature 4's existing editable-field DTOs — no new editing UI or data path.

### **Dependencies**

-   Task 4 (Generate Product Content): the mapped draft object (title/description/category/tags) this task augments and finalizes for seller review.
-   Feature 4: existing product-edit DTO/validation (the same fields sellers can already edit manually) — reused as the authoritative "what's editable" contract.

### **Expected Deliverables**

-   \[ \] SeoMetadataService.derivePreview(draft) — computes **ephemeral, non-persisted** SEO preview fields (meta-title, meta-description) from already-generated title\_en/description\_en/tags, for frontend display only
-   \[ \] Explicit confirmation/documentation that **no new database columns** are introduced for SEO metadata (schema frozen, Doc 5 has no such fields) — surfaced as a flagged gap, not silently resolved
-   \[ \] DraftEditState tracking: which fields are AI-generated-but-unedited vs. seller-edited (in-memory/response-level only, not persisted, unless Feature 4 already has an editing-audit concept — flagged as Assumption)
-   \[ \] Confirmation that field-lock/unlock UX (REQ-F-Store004) is fully satisfied by Task 3's synchronous request/response boundary — no additional backend state needed

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 5.1 | Confirm (do not invent) that products (Doc 5 §4.6) has no meta\_title/meta\_description/seo\_slug column — **stop and document this as a gap** per the instruction to flag conflicts before proceeding | Written confirmation in this playbook (see §11) that SEO metadata beyond tags has no storage target | Schema diff check: grep Doc 5 §4.6 column list — zero SEO-specific columns beyond tags |
| --- | --- | --- | --- |
| 5.2 | Implement SeoMetadataService.derivePreview(draft): computes a **non-persisted** metaTitle (= title\_en, or title\_en truncated to a sane length if a length convention exists — none documented, so pass through unmodified) and metaDescription (= first ~155 chars of description\_en, a common SEO convention **not sourced from any project document** — flagged as Assumption) purely for the API response, never written to products | Response includes seoPreview: {metaTitle, metaDescription} alongside the draft | Unit test: metaDescription truncates at a sane boundary (no mid-word cut) if description\_en exceeds the preview length; short descriptions pass through unmodified |
| --- | --- | --- | --- |
| 5.3 | Ensure seoPreview is clearly marked in the response/DTO as **derived/display-only**, never accepted back as writable input on save (Task 6) — prevents an accidental future assumption that these are persisted fields | DTO field documented/typed as read-only | Code review: Task 6's save-payload DTO has no metaTitle/metaDescription fields |
| --- | --- | --- | --- |
| 5.4 | Implement DraftEditState at the response-DTO level only: echo back which fields came from AI (aiGenerated: true per-field or per-draft, reusing Task 4's ai\_generated flag at the product level — Doc 5 has no per-field provenance column, so this is **draft-level only**, not per-field) — flagged as Assumption if per-field tracking is actually required | Draft response includes a single aiGenerated: boolean at product level (already Task 4.4's artifact); no fictitious per-field tracking invented | Code review: no new schema/columns invented for per-field edit tracking |
| --- | --- | --- | --- |
| 5.5 | Confirm field-lock UX (REQ-F-Store004: "all fields locked during generation") requires **no backend session/lock state** — it is fully satisfied by the synchronous request/response nature of Task 3's endpoint (frontend disables the form while awaiting the HTTP response; nothing to persist server-side) | No lock-state table/column/session introduced | Code review: confirm zero new stateful lock mechanism exists anywhere in this feature's code |
| --- | --- | --- | --- |
| 5.6 | Confirm re-edit-after-generation requires no new endpoint: seller edits the draft object client-side and submits via Task 6's existing save endpoint, exactly as Feature 4's manual product-creation flow already works | No new "edit AI draft" endpoint | Code review: Task 6 is the only write endpoint; edits are just different field values in the same save payload |
| --- | --- | --- | --- |
| 5.7 | Swagger annotation (if derivePreview is exposed as part of Task 3's generation response rather than a separate endpoint — recommended, avoids a new route) | Response schema documents seoPreview as derived/read-only | Manual check |
| --- | --- | --- | --- |

### **Common Errors**

-   Adding meta\_title/meta\_description columns to products to "properly" support this task — **forbidden**; schema is frozen per every prior playbook in this series, and no source document defines these fields. The correct resolution is a derived, non-persisted preview (5.2) plus a documented gap (§11), not a schema change.
-   Building a distinct "SEO Metadata" screen/endpoint separate from the generation response — SCR-S02 (App Flow) describes one unified generation result with editable fields; there is no separate SEO screen in the App Flow document.
-   Inventing per-field "AI vs. edited" tracking backed by new columns — Doc 5 has no such provenance model beyond the single products.ai\_generated boolean; anything finer-grained is out of scope without a schema change.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| SEO Metadata scope | Ephemeral, derived preview (metaTitle/metaDescription) computed from already-generated fields; **tags (Task 4) are the actual persisted SEO mechanism** per REQ-F-Store002's "5–10 SEO tags" | No PRD requirement ID or schema column exists for dedicated SEO metadata beyond tags; inventing persisted fields would violate the "never invent a different database design" instruction. This is the conservative, non-schema-altering interpretation |
| --- | --- | --- |
| Edit-state tracking granularity | Product-level ai\_generated flag only (reused from Task 4), no per-field tracking | Doc 5 has no per-field provenance column; building one would be an unauthorized schema change for a capability no source document requires |
| --- | --- | --- |
| Field-lock mechanism | None — fully satisfied by Task 3's synchronous HTTP boundary | REQ-F-Store004's UX requirement is a frontend concern (disable form while a request is in-flight); no backend session/lock state is implied by any source document |
| --- | --- | --- |

### **Artifacts Produced**

-   SeoMetadataService — the only new backend artifact in this task; its output is additive to Task 4's draft response, consumed solely by the (out-of-scope, frontend) display layer.
-   No new endpoint — derivePreview() is folded into Task 3's existing generation response.

### **Definition of Done**

-   \[ \] Response includes a derived seoPreview alongside the draft, clearly typed as read-only/non-persisted
-   \[ \] metaDescription truncation (if applied) never cuts mid-word
-   \[ \] No new products columns introduced for SEO metadata (schema-drift check passes)
-   \[ \] No new endpoint created for SEO metadata or edit-tracking
-   \[ \] Confirmed and documented (§11) that this resolves a genuine requirements/schema gap rather than silently inventing behavior

## **Task 6 — Save Product**

### **Purpose**

-   Finalize the AI Store Builder flow by persisting the (possibly seller-edited) draft via **Feature 4's existing product create/update service** — this task adds zero new persistence logic, only the glue that promotes a staged upload + AI/edited draft into a real products row.
-   Support both **Publish** and **Save Draft** outcomes (REQ-F-Store006), matching SCR-S02 exactly, and correctly promote staged images (Task 2) into final product\_images rows (Doc 5 §4.7) only now that a product\_id exists.

### **Dependencies**

-   Task 2 (Image Upload & Validation): staged cdnUrl(s) awaiting promotion.
-   Task 4 (Generate Product Content): the mapped draft (possibly further edited by the seller client-side) this task persists.
-   Task 5 (SEO Metadata & Edit/Review): confirms no additional persisted fields beyond Task 4's draft shape.
-   Feature 4: existing ProductService.create() / .update(), ProductRepository, publish/draft validation (REQ-F-Store003: "publishing requires at least title, one image, and category") — **reused verbatim, not duplicated**.

### **Expected Deliverables**

-   \[ \] POST /api/v1/products/ai-generate/save (or reuse Feature 4's existing POST /api/v1/products create endpoint with an additional stagingId field — see Engineering Decision) — persists the final product
-   \[ \] Staged images (Task 2) promoted to real product\_images rows once product\_id exists
-   \[ \] Publish-vs-Draft branching reuses Feature 4's existing product\_status validation (DRAFT/LIVE, Doc 5 §3) unchanged
-   \[ \] ai\_generated = true correctly persisted (Task 4.4's flag carried through to the final write)
-   \[ \] Notification hook (reuse Feature 9): confirm whether product-publish already triggers a notification in Feature 4/9; if so, this task triggers nothing new (flagged as Assumption if unclear)
-   \[ \] Swagger entry

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 6.1 | Confirm Feature 4's existing product-create service signature and **reuse it directly** rather than writing a parallel products insert — this task's controller is a thin adapter that assembles Feature 4's expected input from the AI draft (Task 4) + any seller edits + stagingId (Task 2), then calls Feature 4's service | Zero duplicate products-table write logic anywhere in this feature | Code review: only one code path in the entire codebase calls ProductRepository.create()/.update() — Feature 4's, invoked here, not reimplemented |
| --- | --- | --- | --- |
| 6.2 | Implement POST /api/v1/products/ai-generate/save: validates the final payload (title present, ≥1 image, category present if status=LIVE, per REQ-F-Store003 — reusing Feature 4's existing Zod schema for this exact rule, not a new one) | 200/201 on success; 422 if publish attempted without required fields (identical error behavior to Feature 4's manual-entry path) | Integration test: publish attempt missing category → same 422 error Feature 4's manual flow would produce for the identical omission |
| --- | --- | --- | --- |
| 6.3 | On successful validation, call ProductService.create({...mappedFields, aiGenerated: true, status}) (Feature 4's existing service) — status is DRAFT or LIVE per the seller's chosen action (Publish vs. Save Draft, REQ-F-Store006) | New products row created via the existing, unmodified Feature 4 code path | Integration test: status=LIVE requires all REQ-F-Store003 fields; status=DRAFT allows partial fields (matches Feature 4's existing Draft-save leniency) |
| --- | --- | --- | --- |
| 6.4 | Promote staged images (Task 2's stagingId → cdnUrl list) into real product\_images rows now that product\_id exists: either (a) call the Object Storage Adapter to move/copy from the staging path to the product's final path, then insert product\_images rows, or (b) simply insert product\_images rows pointing at the existing staging URL if the adapter's mock/live behavior makes physical relocation unnecessary — **flagged as Assumption**, defaulting to option (b) for MVP simplicity unless the Object Storage Adapter's existing contract (built in an earlier feature) requires relocation | product\_images rows created, position preserved from Task 2.3's primary-image ordering | Integration test: product\_images.product\_id correctly set post-creation; primary image (position=0) matches Task 2's first-uploaded file |
| --- | --- | --- | --- |
| 6.5 | Confirm cache-busting: creating/publishing a product via this path must trigger the **same** cache invalidation Feature 4's manual product-create/update already triggers (product listing cache, TRD §19) — reused, not reimplemented | Product cache correctly busted after AI-path save, identical to manual-path behavior | Integration test: newly AI-published product appears in a subsequent (uncached) storefront/search query (Feature 5) immediately |
| --- | --- | --- | --- |
| 6.6 | Confirm whether Feature 4's existing create/publish path already enqueues a notification (e.g., "product published" confirmation) — if so, this task does nothing further; if a distinct "AI-generated listing published" notification is required, flag as Assumption since no source document specifies one beyond the standard publish flow | Documented confirmation (no new notification code unless explicitly required) | Code review: no duplicate notification-enqueue call introduced beyond whatever Feature 4 already does |
| --- | --- | --- | --- |
| 6.7 | Swagger annotation for the save endpoint | Visible in /api-docs | Manual check |
| --- | --- | --- | --- |

### **Common Errors**

-   Writing a second, AI-specific products-insert code path instead of calling Feature 4's existing ProductService — directly violates the "Do NOT rebuild any of the above" instruction for Feature 4.
-   Relaxing REQ-F-Store003's publish validation for the AI path (e.g., allowing publish without a category because "the AI usually fills it in") — the rule applies identically regardless of how the fields were populated; AI-generated-but-unresolved category (Task 4.1's null case) must still block publish exactly as a manually-blank category would.
-   Leaving orphaned staged images (Task 2) if the seller abandons the flow without saving — flagged as a documentation gap (see §11); no cleanup job is specified in any source document for this feature.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Save endpoint design | Dedicated POST /api/v1/products/ai-generate/save that internally calls Feature 4's existing ProductService, rather than modifying Feature 4's own create endpoint to accept a stagingId | Keeps Feature 4's public contract ("DO NOT MODIFY... Shared Components" / "Routing Structure") completely untouched, per this feature's explicit "existing product creation workflow remains unchanged" deliverable; all AI-specific glue (staged-image promotion, draft mapping) stays isolated in this feature's own module |
| --- | --- | --- |
| Publish/Draft validation | Byte-identical reuse of Feature 4's existing REQ-F-Store003 validation, applied without exception to the AI path | The requirement is field-based, not origin-based ("publishing requires... title, one image, category" — regardless of how those fields were populated); no source document creates an AI-path exception |
| --- | --- | --- |
| Staged image promotion | Insert product\_images rows pointing at the already-uploaded staging URLs (no physical file relocation) unless the Object Storage Adapter's contract requires it | Simpler MVP path (D5 MVP-first principle); flagged as an explicit Assumption since neither TRD §28 nor Doc 5 specifies a staging-to-final relocation requirement for the Object Storage Adapter |
| --- | --- | --- |

### **Artifacts Produced**

-   POST /api/v1/products/ai-generate/save — final endpoint in the AI Store Builder flow; no further tasks in this feature build on it.
-   Staged-image-promotion glue logic — the only genuinely new persistence-adjacent code in this feature (everything else calls into Feature 4's existing service).
-   **No new artifacts** in ProductService/ProductRepository — explicitly confirmed reuse.

### **Definition of Done**

-   \[ \] Only Feature 4's existing ProductService/ProductRepository ever writes to products — confirmed via code review, no duplicate write path
-   \[ \] Publish validation (title + ≥1 image + category) enforced identically to Feature 4's manual path, including for AI-path products with an unresolved (null) category
-   \[ \] Staged images correctly promoted to product\_images with correct position/primary-image ordering
-   \[ \] Product cache invalidation fires identically to the manual-creation path
-   \[ \] ai\_generated = true correctly persisted on all AI-path products
-   \[ \] End-to-end test: upload → generate → edit → publish → product appears in storefront search (Feature 5) with correct ai\_generated flag
-   \[ \] Swagger documents the save endpoint

## **Validation & Testing**

| **Layer** | **Coverage Target** | **Tooling (reused)** | **Key Scenarios** |
| --- | --- | --- | --- |
| Unit | LLM fallback orchestration, schema validation, category resolution, tag truncation, SEO preview derivation | Jest (Core API) / pytest (AI Service) — both reused per existing per-service test setups (TRD §5.1/§5.2) | Primary-fail-fallback-succeed path; malformed LLM JSON rejected; category no-match → null, not error; 12-tag truncation to 10; meta-description truncation at word boundary |
| --- | --- | --- | --- |
| Integration | Full upload→generate→save round trip, both services | Jest + Supertest (Core API), pytest + mocked OpenAI SDK (AI Service), ephemeral Postgres/Redis (reused CI setup, TRD §23) | Publish blocked without category (AI-unresolved or manual); Save Draft succeeds with partial fields; Retry re-generates without re-upload; timeout produces clean failure, no partial fields |
| --- | --- | --- | --- |
| Cross-service | Core API ↔ AI Service contract, network isolation | Docker Compose integration harness (reused Implementation Plan Phase 1/11 setup) | AI Service unreachable via public route/Nginx; Core API correctly times out and surfaces a typed error if AI Service is down |
| --- | --- | --- | --- |
| Regression | Feature 4's manual product-creation path unaffected | Existing Feature 4 test suite (rerun, not modified) | Manual product creation still defaults ai\_generated = false; manual path's own validation/cache-busting behavior unchanged |
| --- | --- | --- | --- |
| Performance | <30s AI generation target (REQ-NF-Perf002), <200KB image target (REQ-F-Store007, frontend-owned but server-side size acceptance verified here) | k6/JMeter (reused, directionally checked; full validation Deferred to Feature 12-equivalent Optimization phase per Implementation Plan Phase 12) | Mocked/test-tier LLM round trip completes well within 30s; oversized (>10MB) upload rejected before any AI cost is incurred |
| --- | --- | --- | --- |

### **Coverage Gate**

-   \[ \] ≥80% backend coverage maintained across both Core API and AI Service new code (REQ-NF-Quality-003), verified via existing Istanbul/c8 (Core API) and pytest-cov (AI Service) — no new tooling.
-   \[ \] Zero lint/type errors (ESLint/tsc --noEmit for Core API; Flake8/Black/mypy for AI Service — all reused per TRD §13).
-   \[ \] Full production-scale performance benchmarking of the AI pipeline is formally owned by **Deferred to Feature 12-equivalent Optimization phase** (Implementation Plan Phase 12); this feature's Definition of Done items require only directional verification on seeded/mocked-latency test data.

## **Consistency Review, Assumptions, Documentation Gaps**

### **Consistency Review vs Features 0–12**

| **Check** | **Result** |
| --- | --- |
| No new database tables/columns/enums introduced | ✅ Pass — only products (ai\_generated, category\_id, tags, title/description fields), categories, product\_images used, all pre-existing (Doc 5); no SEO-specific columns added (Task 5 resolved as derived/ephemeral instead) |
| --- | --- |
| No new routing conventions introduced | ✅ Pass — follows /api/v1/products/ai-generate\* (TRD §9); AI Service follows its own existing /generate-listing router convention (TRD §12) |
| --- | --- |
| No new authentication mechanism introduced | ✅ Pass — reuses Feature 1's authenticate → authorize(SELLER) chain, plus Feature 3's Store-Setup-Wizard-completion guard |
| --- | --- |
| No duplicate shared components rebuilt | ✅ Pass — Object Storage Adapter, response envelope, error hierarchy, Repository pattern, validation framework, Feature 4's ProductService/ProductRepository, Feature 9's notification mechanism (referenced, not duplicated) all reused |
| --- | --- |
| Two-service architecture (Core API / AI Service) respected | ✅ Pass — LLM client + fallback chain live entirely in the AI Service (TRD §5.2); Core API only calls /generate-listing once per request, never talks to OpenAI directly |
| --- | --- |
| D3 fallback strategy correctly implemented | ✅ Pass — GPT-4 Vision primary → GPT-3.5-turbo fallback, config-only model switch (LLM\_PRIMARY\_MODEL/LLM\_FALLBACK\_MODEL), seller unaware of which model served the request, matching App Flow SCR-S02's edge case exactly |
| --- | --- |
| Existing product creation workflow unchanged | ✅ Pass — Task 6 explicitly reuses Feature 4's ProductService unmodified; Feature 4's manual-entry path and its own tests are unaffected (regression-tested) |
| --- | --- |
| AI Service network isolation respected | ✅ Pass — /generate-listing confirmed never routed through the public Nginx /api proxy (TRD §2/§8) |
| --- | --- |

**No conflicts found with Features 0–12 or with the PRD/TRD/App Flow/Schema/Implementation Plan**, with one flagged requirements/schema gap (SEO Metadata, resolved conservatively — see below) rather than silently invented.

### **Assumptions Made (flagged, not invented as fact)**

1.  **"SEO Metadata" storage** (Task 5): the Feature 13 brief lists "Generate SEO Metadata" as a distinct deliverable, but no PRD requirement ID or Doc 5 column supports dedicated SEO fields (meta\_title/meta\_description/seo\_slug) beyond the tags array (REQ-F-Store002). This playbook resolves this by treating **tags as the actual persisted SEO mechanism** and generating metaTitle/metaDescription as an ephemeral, non-persisted response field derived from already-generated title\_en/description\_en. **Action for implementers:** confirm with the product owner whether dedicated SEO fields are actually required (which would need a schema-change request, out of this feature's authority) or whether this derived-preview interpretation is sufficient.
2.  **Meta-description truncation length** (Task 5.2): the ~155-character convention used is a general SEO industry practice, **not sourced from any project document**. Flagged for confirmation if a specific length is intended.
3.  **Core API timeout budget split** (Task 3.3): REQ-NF-Perf002 specifies a <30s **end-to-end** user-facing target, but no document specifies how that budget splits between the AI Service's internal primary→fallback attempt and the Core API's outer HTTP timeout. This playbook assumes the Core API's outer timeout is set at/near the full 30s ceiling (accounting for minimal network/mapping overhead), with the AI Service's own internal fallback logic expected to resolve well within that window. Implementers should tune the exact split empirically.
4.  **Staged-image promotion mechanism** (Task 6.4): assumed to be a simple product\_images row insertion pointing at the existing staging URL, without physical file relocation, since neither TRD §28 (Object Storage Adapter contract) nor Doc 5 specifies a staging-to-final-path relocation requirement. If the actual Object Storage Adapter implementation (built in an earlier feature) enforces path-based access rules that require relocation, this assumption should be revisited.
5.  **AI Service base app pre-existence** (Task 1): this playbook assumes the AI Service's FastAPI base app/container may or may not already exist from a generic Phase 1/2 setup (per Implementation Plan); Task 1.1 handles both cases (create-if-absent, extend-if-present) without assuming which applies at actual implementation time.
6.  **Product-publish notification on the AI path** (Task 6.6): assumed to be identical to whatever Feature 4's existing manual-publish path already does (no new notification invented). If a distinct "AI-generated listing published" notification is genuinely required by product intent, this should be raised as a follow-up rather than assumed.

### **Unresolved Documentation Gaps**

1.  **No dedicated SEO metadata storage exists in the schema** (Assumption 1) — this is the most significant gap in this feature. The Feature 13 brief names "Generate SEO Metadata" as a first-class deliverable, but Doc 5's products table has no supporting columns beyond tags. Recommend a future documentation addendum (or explicit schema-change request, since "DO NOT MODIFY Database Schema" governs this playbook) clarifying whether SEO metadata is meant to be: (a) synonymous with tags (this playbook's working interpretation), (b) a genuinely new persisted field set requiring a schema amendment, or (c) purely a frontend/rendering concern with no backend storage at all.
2.  **No orphaned-staging-image cleanup policy** (Task 6, Common Errors) — if a seller uploads images, triggers generation, and then abandons the flow without publishing or saving a draft, the staged images (Task 2) remain in object storage indefinitely. No source document specifies a cleanup/TTL policy for staged-but-unused uploads. Recommend a future documentation addendum (e.g., a scheduled cleanup job, analogous to the refresh\_tokens purge job in Doc 5 §11) — out of scope to invent here.
3.  **Category auto-creation policy is undefined** (Task 4.1) — no source document states whether an AI-suggested category with no confident match should ever result in a new categories row being created (vs. this playbook's chosen null-fallback-to-manual-selection). If curated-category-list integrity is a strict requirement, this should be explicitly confirmed; if flexible category growth is intended, a different (currently unbuilt) admin-moderated category-suggestion workflow might be needed.
4.  **Exact Core API/AI Service timeout budget split is undocumented** (Assumption 3) — recommend the TRD be amended with an explicit internal timeout budget (e.g., "AI Service internal fallback attempt: ≤25s; Core API outer ceiling: 28s") rather than leaving this to per-implementation judgment.

*End of Playbook — Feature 13: AI Store Builder. All three responses (Tasks 1–6, Validation & Testing, Consistency Review) are now complete. No section was rewritten after its initial generation.*