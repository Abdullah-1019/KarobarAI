# **KarobarAI — Engineering Execution Playbook**

## **Feature 14: AI Returns**

**Source of truth:** PRD (Doc 1) · TRD (Doc 2) · App Flow (Doc 3) · Backend Schema (Doc 5) · Implementation Plan (Doc 6) **Depends on:** Feature 1 (Auth/RBAC), Feature 4 (Product Management), Feature 9 (Notifications), Feature 10 (Returns & Refunds), Object Storage Adapter (existing)

**Status:** Draft — Response 1 of 3 (Tasks 1–2).

## **Table of Contents**

1.  [Feature Overview](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#1-feature-overview)
2.  [AI Returns Flow](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#2-ai-returns-flow)
3.  Task 1 — AI Returns Foundation
4.  Task 2 — Return Image Validation
5.  *(Deferred to Response 2)* Task 3 — AI Image Analysis Pipeline
6.  *(Deferred to Response 2)* Task 4 — Damage Detection
7.  *(Deferred to Response 3)* Task 5 — Confidence Score Generation
8.  *(Deferred to Response 3)* Task 6 — AI Recommendation Engine
9.  *(Deferred to Response 3)* Task 7 — Seller/Admin Review Integration
10.  *(Deferred to Response 3)* Validation & Testing
11.  *(Deferred to Response 3)* Consistency Review, Assumptions, Documentation Gaps

## **1\. Feature Overview**

-   Implements **R1.1 ReturnsAI automation** (PRD §12.4: REQ-F-Return-003/004/005/008; REQ-AI-Return-001/002; D3) — the AI layer Feature 10 explicitly **reserved but never invoked**. This feature **activates** that reservation; it does not redesign the returns workflow.
-   **This feature builds no new returns workflow.** Feature 10 already built the complete state machine (INITIATED → IMAGES\_SUBMITTED → UNDER\_AI\_REVIEW → MANUAL\_REVIEW → APPROVED/REJECTED → ...), the image-upload pipeline, the AiReviewDispatcher **stub interface** (Feature 10 Task 3.6, explicitly unused in MVP), and the Seller/Admin decision endpoints (Feature 10 Tasks 4–5). Feature 14's entire job is to **implement the stub** and feed its output into the **existing** decision surfaces — never to add a parallel decision path.
-   Lives across the same **two-service boundary** established in Feature 13 (AI Store Builder): AI Service (apps/ai-service/) gets a new router — analyze\_return (TRD §5.2/§12: app/routers/analyze\_return.py, app/vision/ Cloud Vision adapter, app/cnn/ model+inference+confidence) — and Core API gets the orchestration glue that calls it and writes results back onto the **existing** returns row.
-   **Schema is fully pre-provisioned for this feature** (Doc 5 §4.15): returns.ai\_condition (return\_condition enum), returns.ai\_authenticity (DECIMAL(5,4)), returns.ai\_confidence (DECIMAL(5,4)), returns.decision (return\_decision: APPROVED|REJECTED|MANUAL). **No schema change is needed or permitted** — this feature only populates columns that already exist.
-   **Confidence-threshold routing (D3, binding):** ai\_confidence ≥ platform\_config.returns\_confidence\_threshold (default 0.85, Doc 5 §4.25) → auto-decision (APPROVED/REJECTED); below threshold, AI failure, or image/listing mismatch → **always** MANUAL\_REVIEW (REQ-F-Return-004/007, REQ-AI-Return-002). This feature implements the routing rule; it does **not** revisit D3's threshold philosophy or Feature 10's manual-review floor.
-   **Cross-feature note (flagged, not silently fixed):** Feature 12 (Admin Panel) Task 6.5 deliberately made platform\_config.returns\_confidence\_threshold **read-only** in the MVP Admin Console, reasoning that "its consuming feature (R1.1 ReturnsAI automation, Feature 8/14) is not yet built." Now that this feature builds that consumer, **Feature 12's config-write restriction should be revisited** — this is called out explicitly in this feature's final consistency review (Response 3) as a follow-up, not fixed here since Feature 12's code is out of this feature's scope to modify.

## **2\. AI Returns Flow**

Buyer submits return (Feature 10, Returns Wizard SCR-B10) — ≥3 photos, unchanged

│

▼

returns.status = IMAGES\_SUBMITTED (Feature 10, existing)

│

▼

\[THIS FEATURE ACTIVATES\] returns.status → UNDER\_AI\_REVIEW

│ (Feature 10's AiReviewDispatcher stub, now implemented)

▼

Core API ──REST, private network (TRD §1, same pattern as Feature 13)──► AI Service: POST /analyze-return

│ │

│ Image Preprocessing

│ │

│ ┌──────────────────┴──────────────────┐

│ ▼ ▼

│ Cloud Vision (labels, Custom CNN (damage/condition

│ authenticity signals) classification + confidence, D3)

│ └──────────────────┬──────────────────┘

│ ▼

│ {condition, authenticity, confidence,

│ imageMatchFlag}

◄──────────────────────────────────────────────────────────────────────────┘

│

▼

Recommendation Engine (this feature, Core API or AI Service — see Task 6):

confidence ≥ threshold (platform\_config.returns\_confidence\_threshold) AND imageMatch=true

│yes │no / fail / mismatch

▼ ▼

auto-decision (APPROVED/REJECTED) MANUAL\_REVIEW (D3 floor, REQ-AI-Return-002)

│ │

▼ ▼

returns.ai\_condition/ai\_authenticity/ai\_confidence/decision persisted (Doc 5 §4.15, existing columns)

│ │

▼ ▼

\[Auto-approved\] → Feature 10's EXISTING \[Manual\] → Feature 10's EXISTING Seller

pickup/refund path (Task 4/6, unchanged) Review (Task 4) / Admin Review (Task 5) queues,

now displaying the AI badge + report (SCR-S07/AD04)

Notes:

-   **Every** downstream action (pickup booking, refund trigger, seller/admin decision UI, dispute resolution) is **Feature 10's existing code**, unmodified. This feature only writes AI columns and, where confidence permits, calls Feature 10's **existing** ReturnDecisionService.approve()/reject() (built in Feature 10 Tasks 4–5) — it does not reimplement approval/rejection logic.
-   The AI Service is **never** reachable from the public internet (TRD §8), identical constraint to Feature 13's AI Store Builder.

## **Task 1 — AI Returns Foundation**

### **Purpose**

-   Stand up the AI Service's new analyze\_return router (app/routers/analyze\_return.py, TRD §5.2/§12) and the Core API–side glue module, mirroring the exact two-service pattern already proven in Feature 13 (AI Store Builder Foundation) — no new architectural pattern invented.
-   **Implement Feature 10's reserved AiReviewDispatcher stub** (Feature 10 Task 3.6) for the first time — this is the single most important integration point in this feature, since it's the only place Feature 10's existing state machine was left intentionally incomplete pending this feature.

### **Dependencies**

-   Feature 13 Task 1: the provider-agnostic adapter pattern, AI Service module-scaffolding approach, and Core API↔AI Service REST-over-private-network wiring convention — **reused verbatim**, not reinvented, for this feature's own AI Service router and Core API glue.
-   Feature 10 Task 1: returnStateMachine.ts (must now accept the MANUAL\_REVIEW ↔ UNDER\_AI\_REVIEW transition it already reserved), ReturnRepository, error-code registration pattern.
-   Feature 10 Task 3: AiReviewDispatcher stub interface (the exact extension point this task implements), ReturnImageRepository (image URLs this feature consumes).
-   Feature 10 Task 4/5: ReturnDecisionService.approve()/reject() — this feature's Recommendation Engine (Task 6) will call into this **existing** service, not duplicate it.
-   Doc 5 §4.15: returns.ai\_condition, ai\_authenticity, ai\_confidence, decision columns; §4.25: platform\_config.returns\_confidence\_threshold — both already provisioned, read/write access only, no schema change.

### **Expected Deliverables**

-   \[ \] apps/ai-service/app/routers/analyze\_return.py mounted (TRD §5.2 /analyze-return)
-   \[ \] apps/ai-service/app/vision/ — Cloud Vision adapter interface + mock implementation (D2, mock-first)
-   \[ \] apps/ai-service/app/cnn/ — CNN model-load + inference module skeleton (interface only in this task; concrete inference logic in Task 4)
-   \[ \] Core API ai-returns module scaffold, implementing Feature 10's AiReviewDispatcher interface for the first time
-   \[ \] Shared error codes: AI\_RETURN\_ANALYSIS\_FAILED, AI\_RETURN\_ANALYSIS\_TIMEOUT

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 1.1 | Create apps/ai-service/app/routers/analyze\_return.py, mounted on the **same** AI Service FastAPI app Feature 13 Task 1.1 already stood up (do not create a second app instance) | Router registered at /analyze-return, stub returns 501 | GET /docs (FastAPI auto-OpenAPI) shows both /generate-listing (Feature 13) and /analyze-return on the same app |
| --- | --- | --- | --- |
| 1.2 | Define VisionAdapter interface (app/vision/client.py): abstract analyze(imageUrls: list\[str\]) -> VisionResult{labels, authenticitySignals} — same adapter-interface philosophy as Feature 13's LlmClient (D2/TRD §3) | Interface class, no concrete provider logic yet | Unit test: interface cannot be instantiated directly |
| --- | --- | --- | --- |
| 1.3 | Implement MockVisionAdapter (D2, mock-first — mirrors every other adapter in this project): returns deterministic, demo-friendly labels/authenticity signals from a fixture, **including simulated failure/timeout modes** (TRD §28: "mocks... incl. simulated failures/timeouts to exercise degradation paths") | Mock adapter usable for all subsequent development/testing without real GCP credentials | Unit test: mock returns consistent output for a given fixture image; simulated-failure mode raises the expected exception |
| --- | --- | --- | --- |
| 1.4 | Define CnnInferenceEngine interface (app/cnn/inference.py): abstract classify(imageUrls) -> CnnResult{condition, confidence} — concrete model-loading/inference logic deferred to Task 4 (Damage Detection); this task only establishes the interface + a mock implementation | Interface + MockCnnInference (deterministic fixture-based output, incl. a configurable-confidence mock for testing threshold routing in Task 5/6) | Unit test: mock returns condition ∈ {UNDAMAGED,MINOR,MAJOR,DESTROYED} (Doc 5 §3 return\_condition enum) and a confidence float in \[0,1\] |
| --- | --- | --- | --- |
| 1.5 | Implement **Core API** AiReturnDispatcher class **implementing Feature 10's existing AiReviewDispatcher interface** (Feature 10 Task 3.6) — this is the activation point; the method signature is already fixed by Feature 10, this task only supplies the real (adapter-calling) implementation in place of the no-op | AiReviewDispatcher interface now has a live implementation wired into Feature 10's state machine | Code review: confirm Feature 10's returnStateMachine.ts UNDER\_AI\_REVIEW transition is now reachable in code (previously dead per Feature 10 Task 3.6's explicit note) |
| --- | --- | --- | --- |
| 1.6 | Register AI\_RETURN\_ANALYSIS\_FAILED, AI\_RETURN\_ANALYSIS\_TIMEOUT in the shared error-code enum (packages/shared), reusing the exact registration pattern from Feature 13 Task 1.7 | Error codes available to both services | Envelope emits correct code/status per case |
| --- | --- | --- | --- |

### **Common Errors**

-   Creating a **second** AI Service FastAPI app/container instead of adding this router to the existing one Feature 13 stood up — TRD §1 specifies **one** AI Service, not one per AI capability.
-   Bypassing Feature 10's AiReviewDispatcher interface and wiring the AI call directly into a new, parallel path — this would leave Feature 10's state machine and this feature's implementation out of sync; the interface **must** be the single integration seam.
-   Building live Cloud Vision/CNN integration before the mock — violates D2's "mock now, real later" adapter philosophy already binding on this entire project.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| AI Service app topology | Single shared FastAPI app across generate\_listing (Feature 13) and analyze\_return (this feature) routers | TRD §1/§5.2 specifies one AI Service; splitting into multiple apps/containers per capability contradicts the fixed two-service architecture |
| --- | --- | --- |
| Integration seam with Feature 10 | Implement the **existing** AiReviewDispatcher interface (Feature 10 Task 3.6), not a new dispatch mechanism | Feature 10 explicitly reserved this exact extension point for this feature; using it (rather than a parallel path) is the only way to guarantee the state machine, audit trail, and decision services stay singular |
| --- | --- | --- |
| Vision + CNN adapter pattern | Two independent adapters (VisionAdapter, CnnInferenceEngine), each with its own mock, matching TRD §5.2's explicit separation ("CV (R1.1): Google Cloud Vision... CNN (R1.1): PyTorch... inference + confidence score") | TRD treats Cloud Vision and the custom CNN as two distinct concerns with different providers/lifecycles; keeping them as separate adapters (rather than one merged "AI Returns client") matches the documented architecture exactly |
| --- | --- | --- |

### **Artifacts Produced**

-   apps/ai-service/app/routers/analyze\_return.py, app/vision/client.py + mock\_vision\_adapter.py, app/cnn/inference.py + mock\_cnn\_inference.py — reused unmodified by Task 3 (AI Image Analysis Pipeline wires these together) and Task 4 (Damage Detection implements the real CnnInferenceEngine).
-   Core API AiReturnDispatcher (implements Feature 10's AiReviewDispatcher) — the single integration point every subsequent task in this feature extends; **no other class may call into Feature 10's state machine for AI purposes**.
-   Shared error codes — reused by Tasks 2–7.

### **Definition of Done**

-   \[ \] AI Service analyze\_return router mounted on the existing single FastAPI app (confirmed via /docs, not a new app instance)
-   \[ \] VisionAdapter/CnnInferenceEngine interfaces defined with working mock implementations, including simulated-failure modes
-   \[ \] Feature 10's AiReviewDispatcher interface has a live implementation for the first time; UNDER\_AI\_REVIEW transition is now reachable in code
-   \[ \] Zero Prisma schema drift — no new tables/columns introduced (all target columns pre-exist per Doc 5 §4.15)
-   \[ \] Zero parallel/duplicate return-decision code paths introduced (single dispatcher confirmed via code review)
-   \[ \] Lint/type-check clean on both services

## **Task 2 — Return Image Validation**

### **Purpose**

-   Confirm and **reuse** (not rebuild) Feature 10 Task 3's existing image-upload/validation pipeline as the sole source of images this feature analyzes — this task adds only the **AI-pipeline-specific** readiness checks (are the ≥3 images accessible to the AI Service, in a supported format for Vision/CNN calls) on top of what Feature 10 already validated at upload time.
-   Gate AI dispatch so it **never** fires on a return that hasn't actually reached IMAGES\_SUBMITTED with the required minimum photo count — reusing Feature 10's existing state-machine guard, not a new one.

### **Dependencies**

-   Task 1 (AI Returns Foundation): AiReturnDispatcher, error codes.
-   Feature 10 Task 3: return\_images rows + cdn\_urls (already validated for type/size/magic-byte at upload time, Sec-012) — **this feature does not re-run that validation**; it only confirms readiness for AI consumption.
-   Feature 10 Task 1: returnStateMachine.ts — the IMAGES\_SUBMITTED → UNDER\_AI\_REVIEW transition guard.

### **Expected Deliverables**

-   \[ \] AiReadinessCheck.verify(returnId) — confirms return\_images count ≥3 (REQ-F-Return-002, already enforced by Feature 10, re-checked defensively here) and all cdn\_urls resolve/are fetchable
-   \[ \] Explicit confirmation that **no new upload endpoint, validation rule, or storage call** is introduced in this task — pure readiness-gate logic only
-   \[ \] Wiring of AiReadinessCheck into AiReturnDispatcher (Task 1.5) as the precondition before any AI Service call is attempted

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 2.1 | Implement AiReadinessCheck.verify(returnId): loads return\_images via Feature 10's **existing** ReturnImageRepository (Feature 10 Task 3, reused unmodified), confirms count ≥3 and returns.status = IMAGES\_SUBMITTED (defensive re-check; Feature 10's own submit-flow already enforces this at REQ-F-Return-002) | {ready: boolean, reasonCode?} | Unit test: a return with 2 images (should be impossible per Feature 10, but defensively checked) → ready: false, reasonCode: INSUFFICIENT\_IMAGES; a return with 3+ images in the correct state → ready: true |
| --- | --- | --- | --- |
| 2.2 | Add a lightweight fetchability check: HEAD (or equivalent) request against each cdn\_url to confirm the AI Service (and the external Vision API, once live) will be able to retrieve the image — **reuses the Object Storage Adapter's existing getUrl()**, no new storage logic | Confirms URLs are live/accessible before spending AI Service cycles | Integration test (mock adapter): a deliberately broken/unreachable mock URL → ready: false, reasonCode: IMAGE\_UNREACHABLE, without ever calling the AI Service |
| --- | --- | --- | --- |
| 2.3 | Wire AiReadinessCheck.verify() as the **first** step inside AiReturnDispatcher (Task 1.5): if not ready, **do not** transition to UNDER\_AI\_REVIEW at all — instead route directly to MANUAL\_REVIEW (D3's manual-review floor applies to readiness failures exactly as it applies to AI-call failures, REQ-F-Return-007) | Unready returns skip AI analysis entirely and land in manual review, never silently stuck | Integration test: an unready return short-circuits directly to MANUAL\_REVIEW with a logged reason, and the AI Service is never called (verified via a spy/mock-call-count assertion) |
| --- | --- | --- | --- |
| 2.4 | Confirm (code review, not new code) that this task introduces **no** changes to Feature 10's POST /api/v1/returns/:id/images or POST /api/v1/returns/:id/submit endpoints — those remain exactly as built in Feature 10 Task 3 | Zero diffs to Feature 10 Task 3's files | Code review / git diff check |
| --- | --- | --- | --- |

### **Common Errors**

-   Re-implementing file-type/size/magic-byte validation "for AI purposes" — that validation already happened at upload time (Feature 10 Task 3.1); this task only checks **readiness for analysis**, not file validity from scratch.
-   Letting an unreachable/broken image URL cause the AI Service call to hang or error ambiguously — must be caught by the readiness check **before** dispatch, with a clean, logged route to MANUAL\_REVIEW.
-   Treating "not ready" as a hard failure/exception instead of the documented manual-review floor — per D3/REQ-F-Return-007, **any** inability to complete AI analysis (including a pre-flight readiness failure) must land in MANUAL\_REVIEW, never block the return or throw an unhandled error to the buyer.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Scope of "image validation" in this feature | Readiness/fetchability check only; all file-type/size/magic-byte validation remains exclusively Feature 10 Task 3's responsibility | Feature 10 already fully implements REQ-F-Return-002 image validation; duplicating it here would violate the "Do NOT rebuild any of the above" instruction for Feature 10 |
| --- | --- | --- |
| Readiness-failure routing | Route directly to MANUAL\_REVIEW, same as any other AI-failure mode (Task 1/D3) | Consistent, single failure-handling philosophy across this entire feature — readiness failures are just another form of "AI could not complete analysis," not a distinct error class requiring separate handling |
| --- | --- | --- |

### **Artifacts Produced**

-   AiReadinessCheck — reused directly by Task 3 (AI Image Analysis Pipeline) as its mandatory first gate before any Vision/CNN call is made.

### **Definition of Done**

-   \[ \] Readiness check confirms ≥3 images and correct returns.status before any AI Service call
-   \[ \] Unreachable/broken image URLs are caught pre-dispatch, not left to fail inside the AI Service call
-   \[ \] Readiness failures route to MANUAL\_REVIEW via the same mechanism as any other AI-failure mode (no new failure-handling path)
-   \[ \] Zero modifications introduced to Feature 10 Task 3's upload/submit endpoints (confirmed via diff)
-   \[ \] Unit + integration tests cover both the ready and not-ready paths without ever invoking the AI Service in the not-ready case

*End of Response 1 (Tasks 1–2). Say "continue" for Response 2 — Task 3 (AI Image Analysis Pipeline) and Task 4 (Damage Detection).*

## **Table of Contents (updated)**

1.  [Feature Overview](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#1-feature-overview)
2.  [AI Returns Flow](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#2-ai-returns-flow)
3.  Task 1 — AI Returns Foundation
4.  Task 2 — Return Image Validation
5.  Task 3 — AI Image Analysis Pipeline
6.  Task 4 — Damage Detection
7.  *(Deferred to Response 3)* Task 5 — Confidence Score Generation
8.  *(Deferred to Response 3)* Task 6 — AI Recommendation Engine
9.  *(Deferred to Response 3)* Task 7 — Seller/Admin Review Integration
10.  *(Deferred to Response 3)* Validation & Testing
11.  *(Deferred to Response 3)* Consistency Review, Assumptions, Documentation Gaps

**Status:** Draft — Response 2 of 3 (Tasks 1–4).

## **Task 3 — AI Image Analysis Pipeline**

### **Purpose**

-   Wire the Core API → AI Service call (POST /analyze-return) with the exact synchronous request/response pattern proven in Feature 13 Task 3 (AI Request Pipeline) — reused architecture, new payload/domain.
-   Enforce the **≤60-second** analysis window (REQ-F-Return-004: "produce an automated approve/reject decision within 60 seconds") as a hard timeout, distinct from Feature 13's 30s image-generation ceiling — a **different** budget for a **different** requirement, not a copy-paste of the same constant.

### **Dependencies**

-   Task 1 (AI Returns Foundation): AiReturnDispatcher, VisionAdapter/CnnInferenceEngine interfaces + mocks, error codes.
-   Task 2 (Return Image Validation): AiReadinessCheck — the mandatory precondition before this pipeline runs.
-   Feature 13 Task 3: the Core API↔AI Service REST-call pattern (private network, TRD §1, timeout enforcement at the HTTP client level) — **reused verbatim** for this feature's own call, not reinvented.

### **Expected Deliverables**

-   \[ \] AI Service POST /analyze-return handler: accepts {returnId, imageUrls: list\[str\]}, orchestrates VisionAdapter.analyze() + CnnInferenceEngine.classify() calls, returns a combined AnalysisResult
-   \[ \] Core API AiReturnAnalysisService.analyze(returnId): resolves images via AiReadinessCheck (Task 2), calls the AI Service, enforces the 60s ceiling, maps the response
-   \[ \] Timeout/failure handling identical in philosophy to Feature 13 Task 3 (clean typed failure, never a partial/ambiguous result)
-   \[ \] Swagger + FastAPI auto-doc entries

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 3.1 | Implement AI Service POST /analyze-return handler: accepts {returnId, imageUrls}, calls VisionAdapter.analyze(imageUrls) (Task 1.2/1.3) and CnnInferenceEngine.classify(imageUrls) (Task 1.4) — **in parallel** (both are independent inputs to the final result, no sequential dependency), combines into AnalysisResult{visionLabels, authenticitySignals, condition, cnnConfidence} | Endpoint returns a combined result or a structured error, never a partial one | Integration test (AI Service, mocked adapters): both adapters succeed → combined result; either adapter fails → structured error, not a 500 |
| --- | --- | --- | --- |
| 3.2 | Implement Core API AiReturnAnalysisService.analyze(returnId): calls AiReadinessCheck.verify() (Task 2) first — if not ready, short-circuit to MANUAL\_REVIEW (Task 2.3, no AI Service call); if ready, resolve imageUrls and call the AI Service's /analyze-return over the private network (same REST/adapter-style wrapper convention as Feature 13 Task 3.2) | Full round trip from returnId to a mapped analysis result | Integration test (Core API, AI Service mocked at HTTP layer): ready return → full round trip; not-ready return → AI Service never called (spy assertion, reused pattern from Task 2.3) |
| --- | --- | --- | --- |
| 3.3 | Set a Core API–side hard timeout at **60 seconds** (REQ-F-Return-004's explicit ceiling — distinct constant from Feature 13's 30s image-generation timeout; do not reuse the same config value) — on timeout, treat identically to any other AI-failure mode and route to MANUAL\_REVIEW (D3/REQ-F-Return-007) | Timeout enforced at the HTTP client level; return transitions to MANUAL\_REVIEW on breach | Integration test: AI Service mock delays beyond 60s → Core API returns AI\_RETURN\_ANALYSIS\_TIMEOUT (Task 1.6) and the return's status becomes MANUAL\_REVIEW, not stuck in UNDER\_AI\_REVIEW |
| --- | --- | --- | --- |
| 3.4 | Implement the UNDER\_AI\_REVIEW state transition explicitly: AiReturnDispatcher (Task 1.5) sets returns.status = UNDER\_AI\_REVIEW via Feature 10's **existing** returnStateMachine.ts/ReturnRepository.updateStatus() (Feature 10 Task 1.3/1.4, reused unmodified) immediately before calling the AI Service, so the state is correctly visible even mid-analysis | returns.status observably UNDER\_AI\_REVIEW during the (≤60s) analysis window | Integration test: querying the return mid-call (simulated via a delayed mock) shows UNDER\_AI\_REVIEW, not still IMAGES\_SUBMITTED |
| --- | --- | --- | --- |
| 3.5 | Map any AI Service failure/timeout/malformed response to a full failure (never partial fields) — reusing the exact "fail-closed" philosophy from Feature 13 Task 3.6, applied here to AnalysisResult instead of ListingSchema | Failure responses never partially populate returns.ai\_condition/ai\_authenticity/ai\_confidence | Unit test: a malformed/partial AI Service response is treated as a full failure, not silently mapped with missing fields |
| --- | --- | --- | --- |
| 3.6 | Swagger annotation for the Core API side; confirm /analyze-return is documented in AI Service's own auto-OpenAPI and — identically to Feature 13 Task 3.7 — confirmed unreachable via the public Nginx /api proxy (TRD §2/§8) | Docs current on both sides; network isolation reconfirmed for the second AI Service route | Manual check + reused network-level test from Feature 13, extended to cover this second route |
| --- | --- | --- | --- |

### **Common Errors**

-   Reusing Feature 13's 30-second timeout constant for this feature's 60-second requirement — REQ-F-Return-004 and REQ-NF-Perf002 are two distinct, independently-sourced targets; conflating them is a silent requirements error.
-   Calling the AI Service **before** AiReadinessCheck passes — wastes AI/Vision/CNN cost on a return that was never going to be analyzable, and risks an ambiguous failure instead of the clean, logged manual-review routing Task 2.3 already provides.
-   Running VisionAdapter and CnnInferenceEngine sequentially when they have no data dependency on each other — unnecessarily inflates the 60s budget; TRD §2 diagram shows both as parallel inputs into the AI Service's /analyze-return response.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Vision/CNN call ordering | Parallel invocation inside the AI Service handler | Neither adapter's output feeds the other as input (Vision provides labels/authenticity signals; CNN independently classifies condition/confidence from the same images) — parallelizing directly supports the 60s ceiling, mirroring the "call all courier adapters in parallel" precedent already established for Logistics (TRD §3 Strategy pattern, REQ-F-Logistics-002) |
| --- | --- | --- |
| Timeout value | 60 seconds, sourced from REQ-F-Return-004 specifically, kept as a distinct config constant from Feature 13's 30s AI-generation timeout | The two requirements (REQ-NF-Perf002 for listing generation, REQ-F-Return-004 for return decisions) are independently specified in the PRD with different numeric targets; using one constant for both would be a latent bug if either target changes independently |
| --- | --- | --- |
| UNDER\_AI\_REVIEW write timing | Set immediately before the AI Service call, using Feature 10's existing repository method | Ensures the return's visible state accurately reflects "analysis in progress" for the full duration of the (up to 60s) call, consistent with Feature 10's state machine being the single source of truth for return status |
| --- | --- | --- |

### **Artifacts Produced**

-   AI Service: /analyze-return route handler (completes Task 1's router stub) — final AI Service artifact for the raw analysis call; Tasks 4–6 refine what happens to the CNN/confidence/decision logic *within* this same handler and its downstream Core API consumers, not a new endpoint.
-   Core API: AiReturnAnalysisService — reused as-is by Task 5 (Confidence Score Generation, which consumes cnnConfidence from this service's output) and Task 6 (Recommendation Engine, which consumes the full AnalysisResult).

### **Definition of Done**

-   \[ \] Full round trip (readiness check → parallel Vision+CNN call → mapped result) completes within 60s on mocked/test-tier latency
-   \[ \] Timeout enforced at exactly 60s, independently configured from Feature 13's 30s constant
-   \[ \] returns.status = UNDER\_AI\_REVIEW observably set for the duration of the analysis call
-   \[ \] Failure/timeout responses never contain partial AI fields; always route to MANUAL\_REVIEW
-   \[ \] Readiness check (Task 2) confirmed as a hard precondition — AI Service never called for a not-ready return
-   \[ \] AI Service /analyze-return confirmed unreachable from outside the private Docker network
-   \[ \] Swagger/FastAPI docs current on both services

## **Task 4 — Damage Detection**

### **Purpose**

-   Implement the **real** CnnInferenceEngine (replacing Task 1.4's mock with actual model-load + inference logic) that classifies return-photo condition into the existing return\_condition enum (UNDAMAGED | MINOR | MAJOR | DESTROYED, Doc 5 §3) — REQ-AI-Return-001's **target**, not a hard gate (D3).
-   Implement **image-authenticity/mismatch detection** (REQ-AI-Return-002: "images not visually matching the listing are flagged for manual review, never auto-approved") by cross-referencing the return's images against the **original product listing images** (Feature 4's product\_images), using Cloud Vision's label output (Task 1.3) as the comparison signal.

### **Dependencies**

-   Task 1 (Foundation): CnnInferenceEngine interface + mock, VisionAdapter interface + mock.
-   Task 3 (AI Image Analysis Pipeline): the orchestration call site this task's real implementation plugs into (no new call site — same /analyze-return handler).
-   Feature 4: products.id → product\_images (Doc 5 §4.6/§4.7) — the original listing images this task compares return photos against, via orders.order\_items.product\_id → products (reusing Feature 7/10's existing order→product join, not a new query pattern).
-   TRD §5.2: PyTorch (or TF) inference stack — the model-hosting/runtime choice is **already fixed** by the TRD; this task does not reopen that decision.

### **Expected Deliverables**

-   \[ \] CnnInferenceEngine real implementation: loads a trained model (path/version from config, TRD §27-style env convention), runs inference on return images, outputs {condition, cnnConfidence}
-   \[ \] ImageMismatchDetector.check(returnImages, listingImages) → {imageMatch: boolean, matchConfidence} — the REQ-AI-Return-002 mechanism
-   \[ \] Model-loading failure handling: a missing/uninitialized model must fail closed to MANUAL\_REVIEW (D3), never crash the request or silently skip classification
-   \[ \] Confirmation that **CNN training/dataset curation itself is out of scope** for this playbook (Implementation Plan's "parallel dataset track," Doc 6 §0) — this task consumes an already-trained model artifact, it does not build the training pipeline

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 4.1 | Implement CnnInferenceEngine.classify(imageUrls): load the trained model (path/version from env, e.g. CNN\_MODEL\_PATH/CNN\_MODEL\_VERSION — **new env vars**, flagged as an addition since TRD §27's table does not enumerate them explicitly; consistent in spirit with GCP\_VISION\_CREDENTIALS already reserved there), run inference per image, aggregate to a single {condition, cnnConfidence} per return (e.g., worst-case condition across images, confidence = model's own output — aggregation strategy flagged as Assumption if not otherwise specified) | Real classification replacing Task 1.4's mock | Unit test (model mocked at the PyTorch-call boundary, not re-mocking the whole engine): given a fixture tensor/output, classify() correctly maps model output indices to the return\_condition enum values |
| --- | --- | --- | --- |
| 4.2 | Implement model-load failure handling: if the model file/version is missing or fails to initialize at service startup or first call, CnnInferenceEngine.classify() raises a typed ModelUnavailableError — caught by AiReturnAnalysisService (Task 3) and treated as a full analysis failure → MANUAL\_REVIEW (same fail-closed philosophy as Task 3.5) | No unhandled exception/crash; clean routing to manual review | Integration test: simulated missing-model condition → return lands in MANUAL\_REVIEW, AI Service does not crash or 500 |
| --- | --- | --- | --- |
| 4.3 | Implement ImageMismatchDetector.check(returnImages, listingImages): uses VisionAdapter.analyze()'s label output (Task 1.2/1.3, e.g., detected object categories/attributes) on both the return photos and the **original product's** product\_images (resolved via orders.order\_items.product\_id → products → product\_images, reusing Feature 4/7's existing relations, no new join logic invented beyond a straightforward Prisma include), computes a simple label-overlap/similarity signal | {imageMatch: boolean, matchConfidence} | Unit test: identical/near-identical label sets between return and listing photos → imageMatch: true; wildly divergent label sets (e.g., listing = "shoes", return photo = "laptop") → imageMatch: false |
| --- | --- | --- | --- |
| 4.4 | Wire imageMatch = false to **always** force MANUAL\_REVIEW regardless of cnnConfidence (REQ-AI-Return-002: "never auto-approved") — this is a **hard override**, not merely a factor lowering confidence | Mismatch detection cannot be "outvoted" by a high CNN confidence score | Unit test: cnnConfidence = 0.99 but imageMatch = false → recommendation engine (Task 6) still routes to MANUAL\_REVIEW, confirmed via a direct call into Task 4's detector + Task 6's engine together |
| --- | --- | --- | --- |
| 4.5 | Persist returns.ai\_condition (Doc 5 §4.15, existing column, return\_condition enum) from CnnInferenceEngine's output, via Feature 10's **existing** ReturnRepository update method (no new repository method beyond, at most, extending the existing updateStatus-adjacent method to also accept AI-result fields — reused, not duplicated) | returns.ai\_condition correctly populated post-analysis | Integration test: end-to-end analysis run populates ai\_condition with a value matching the mock/real CNN output |
| --- | --- | --- | --- |
| 4.6 | Persist returns.ai\_authenticity (Doc 5 §4.15, DECIMAL(5,4)) from ImageMismatchDetector's matchConfidence | ai\_authenticity correctly populated | Integration test: value stored matches the detector's computed similarity score, within expected decimal precision |
| --- | --- | --- | --- |

### **Common Errors**

-   Treating a low/failed CNN confidence as "damage = undamaged by default" instead of failing closed to MANUAL\_REVIEW — REQ-AI-Return-001 explicitly frames 95% as a **target**, with D3's confidence floor catching everything below threshold; a missing/failed model must never silently default to an optimistic classification.
-   Allowing a high CNN confidence to override a failed image-match check — REQ-AI-Return-002 is explicit that mismatched images are "never auto-approved," making this a hard gate, not a weighted factor.
-   Building a new product-image lookup query instead of reusing the existing orders → order\_items → products → product\_images relational path already established across Feature 4/7/10.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| CNN confidence aggregation across multiple images | Worst-case condition wins; confidence = model's own reported value for the selected worst-case image (flagged as Assumption — see final review) | No source document specifies multi-image aggregation strategy; "worst-case wins" is the conservative choice consistent with the platform's fraud-protection intent (PRD Goal 4: "protect seller livelihoods") |
| --- | --- | --- |
| Image-mismatch handling | Hard override — imageMatch = false forces MANUAL\_REVIEW unconditionally, independent of cnnConfidence | REQ-AI-Return-002's wording ("never auto-approved") is unambiguous and stronger than the general confidence-threshold rule (D3); implemented as a distinct, higher-priority gate in the Recommendation Engine (Task 6) |
| --- | --- | --- |
| Model artifact sourcing | This task consumes an already-trained model (path/version via env config); training/dataset curation is out of scope | Implementation Plan (Doc 6) explicitly frames CNN dataset curation as a **separate, parallel workstream** starting Week 3, independent of feature-by-feature playbooks; this playbook only covers integrating a trained model into the serving pipeline |
| --- | --- | --- |

### **Artifacts Produced**

-   CnnInferenceEngine (real implementation, replacing Task 1.4's mock) — consumed by Task 3's /analyze-return handler and Task 5 (Confidence Score Generation, which formalizes how cnnConfidence becomes the return's canonical ai\_confidence).
-   ImageMismatchDetector — consumed by Task 6 (Recommendation Engine) as a hard gate input.
-   Model-load failure handling (ModelUnavailableError) — reused by Task 5/6's failure-routing logic as just another instance of the fail-closed pattern.

### **Definition of Done**

-   \[ \] Real CnnInferenceEngine classifies images into the exact return\_condition enum values, no new enum values invented
-   \[ \] Model-load/inference failure routes cleanly to MANUAL\_REVIEW, never crashes or defaults to an optimistic result
-   \[ \] ImageMismatchDetector correctly resolves original listing images via the existing order→product relation (no new join logic)
-   \[ \] imageMatch = false provably overrides any confidence level, forcing MANUAL\_REVIEW (tested directly)
-   \[ \] returns.ai\_condition and returns.ai\_authenticity persist correctly via Feature 10's existing repository, no new columns/tables
-   \[ \] Multi-image aggregation strategy documented and tested (worst-case-wins, per Engineering Decision)

*End of Response 2 (Tasks 3–4). Say "continue" for Response 3 to complete the feature — Task 5 (Confidence Score Generation), Task 6 (AI Recommendation Engine), Task 7 (Seller/Admin Review Integration), Validation & Testing, and the final consistency review.*

## **Table of Contents (updated — final)**

1.  [Feature Overview](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#1-feature-overview)
2.  [AI Returns Flow](https://claude.ai/chat/b13a8388-d84f-4e30-8abb-cda3dc3cbc6d#2-ai-returns-flow)
3.  Task 1 — AI Returns Foundation
4.  Task 2 — Return Image Validation
5.  Task 3 — AI Image Analysis Pipeline
6.  Task 4 — Damage Detection
7.  Task 5 — Confidence Score Generation
8.  Task 6 — AI Recommendation Engine
9.  Task 7 — Seller/Admin Review Integration
10.  Validation & Testing
11.  Consistency Review, Assumptions, Documentation Gaps

**Status:** Final — Response 3 of 3 (Tasks 1–7 + Validation & Consistency Review complete).

## **Task 5 — Confidence Score Generation**

### **Purpose**

-   Formalize how Task 3/4's raw signals (cnnConfidence, matchConfidence) become the return's single, canonical returns.ai\_confidence (Doc 5 §4.15) — the one number D3's threshold routing (platform\_config.returns\_confidence\_threshold) actually compares against.
-   Ensure confidence generation is **deterministic and auditable**: given the same AI Service response, the same ai\_confidence value must always be computed — no hidden randomness, no client-side recomputation.

### **Dependencies**

-   Task 3 (AI Image Analysis Pipeline): the AnalysisResult this task derives a single confidence figure from.
-   Task 4 (Damage Detection): cnnConfidence (from CnnInferenceEngine) and matchConfidence (from ImageMismatchDetector) — the two inputs combined here.
-   Doc 5 §4.25: platform\_config.returns\_confidence\_threshold (default 0.85) — the value this task's output is later compared against (Task 6), not modified here.

### **Expected Deliverables**

-   \[ \] ConfidenceScoreService.compute(cnnConfidence, matchConfidence, imageMatch) → single ai\_confidence: DECIMAL(5,4) value
-   \[ \] Deterministic combination formula, documented and unit-tested (no ML randomness leaking into the persisted score)
-   \[ \] returns.ai\_confidence persistence via Feature 10's existing repository (same method extended in Task 4.5/4.6, not a new one)
-   \[ \] Confirmation that this score is **read-only** to Seller/Admin (Feature 10 Tasks 4–5's decision endpoints never accept a client-supplied confidence override — only a human decision)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 5.1 | Implement ConfidenceScoreService.compute(cnnConfidence, matchConfidence, imageMatch): if imageMatch = false, force ai\_confidence = 0 (or a documented low sentinel — flagged as Assumption) regardless of cnnConfidence, since Task 4.4 already hard-routes mismatches to manual review independent of this score; otherwise ai\_confidence = min(cnnConfidence, matchConfidence) (conservative combination — flagged as Assumption on exact formula, see final review) | Single deterministic float in \[0, 1\], rounded to DECIMAL(5,4) precision (Doc 5 §4.15) | Unit test: imageMatch=false → confidence forced to sentinel regardless of high cnnConfidence; imageMatch=true with cnn=0.90, match=0.80 → ai\_confidence=0.80 (min-combination) |
| --- | --- | --- | --- |
| 5.2 | Enforce DECIMAL(5,4) rounding/precision at the mapping boundary (matches the existing column type exactly, Doc 5 §4.15) — avoid float-precision drift between the AI Service's raw output and the persisted Postgres value | Persisted value matches computed value to 4 decimal places | Unit test: a raw float like 0.853333... persists as exactly 0.8533 (or the project's documented rounding rule — round-half-up assumed, flagged if not specified) |
| --- | --- | --- | --- |
| 5.3 | Persist ai\_confidence via the same repository-extension point used in Task 4.5/4.6 (single atomic write of ai\_condition, ai\_authenticity, ai\_confidence together, not three separate updates) — reduces write amplification and keeps the AI-result write atomic | One combined update call per completed analysis | Integration test: after a full analysis run, all three AI columns are populated in a single transaction/update (verified via a DB-level single-statement or single-transaction check) |
| --- | --- | --- | --- |
| 5.4 | Confirm (code review) that no endpoint in Feature 10 (Tasks 2–5) or this feature accepts a client-supplied ai\_confidence value — this field is **exclusively AI-Service-derived**, never settable via API input | Zero write paths to ai\_confidence other than this service | Code review: grep for ai\_confidence write sites — exactly one, inside this task's service |
| --- | --- | --- | --- |

### **Common Errors**

-   Letting the image-mismatch override (Task 4.4) apply only in the Recommendation Engine (Task 6) while leaving a misleadingly high ai\_confidence persisted on the returns row itself — the persisted score and the routing decision must agree; a seller/admin viewing the raw score later should not see a high number that contradicts a manual-review outcome.
-   Applying non-deterministic rounding (e.g., banker's rounding vs. round-half-up) without documenting the choice — creates untestable, inconsistent persisted values across runs.
-   Writing ai\_condition/ai\_authenticity/ai\_confidence as three separate UPDATE statements — increases the risk of a partial write if the process is interrupted mid-sequence.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Confidence combination formula | min(cnnConfidence, matchConfidence) when imageMatch=true; forced low sentinel when imageMatch=false | No source document specifies an exact multi-signal combination formula (flagged as Assumption); min() is the conservative choice — a return is only as trustworthy as its **weakest** signal, consistent with the platform's fraud-protection framing (PRD Goal 4) and D3's "confidence floor" philosophy of erring toward manual review |
| --- | --- | --- |
| Write pattern | Single combined update for all three AI columns | Avoids partial-write risk and keeps the AI-analysis outcome atomic and consistent with Doc 5's general transactional-integrity philosophy (already applied to mutations across Features 10–12) |
| --- | --- | --- |

### **Artifacts Produced**

-   ConfidenceScoreService — the sole producer of returns.ai\_confidence; consumed directly by Task 6 (Recommendation Engine) as its primary routing input.

### **Definition of Done**

-   \[ \] ai\_confidence computed deterministically from cnnConfidence/matchConfidence/imageMatch, with the combination formula documented and unit-tested
-   \[ \] Image mismatch forces a low confidence value consistent with Task 4.4's hard-override routing (no contradiction between persisted score and eventual decision)
-   \[ \] ai\_condition, ai\_authenticity, ai\_confidence persisted in a single atomic write
-   \[ \] No API endpoint anywhere accepts a client-supplied ai\_confidence value (confirmed via code review)
-   \[ \] Rounding/precision behavior matches DECIMAL(5,4) exactly, documented and tested

## **Task 6 — AI Recommendation Engine**

### **Purpose**

-   Implement the actual **routing decision** — APPROVED | REJECTED | MANUAL (Doc 5 §3 return\_decision enum) — by comparing Task 5's ai\_confidence against platform\_config.returns\_confidence\_threshold (D3, REQ-F-Return-004), with Task 4.4's image-mismatch hard override taking precedence over everything.
-   **Call Feature 10's existing ReturnDecisionService.approve()/reject()** (built in Feature 10 Tasks 4–5) for any auto-decided case — this task never implements its own approval/rejection side-effects (pickup booking, refund trigger); it only decides *which* of Feature 10's existing methods to call, or defers to the human queue.

### **Dependencies**

-   Task 5 (Confidence Score Generation): ai\_confidence — the primary routing input.
-   Task 4 (Damage Detection): imageMatch — the hard-override input.
-   Doc 5 §4.25: platform\_config.returns\_confidence\_threshold (default 0.85) — read-only consumption here (see Feature Overview's flagged cross-feature note on Feature 12's config-write restriction).
-   Feature 10 Tasks 4–5: ReturnDecisionService.approve()/reject() — the **only** methods this task is permitted to invoke for state-changing outcomes; **reused verbatim, not duplicated** (Feature 12's playbook already established this exact reuse principle for Admin-vs-Seller approval parity — this task extends the same principle to AI-vs-human parity).

### **Expected Deliverables**

-   \[ \] RecommendationEngine.decide(returnId, aiConfidence, imageMatch, condition) → {decision: APPROVED|REJECTED|MANUAL, autoActioned: boolean}
-   \[ \] Routing rule implemented exactly per D3: imageMatch=false → MANUAL (hard override); else aiConfidence ≥ threshold → APPROVED/REJECTED (condition-based); else → MANUAL
-   \[ \] For auto-decided outcomes, calls Feature 10's **existing** ReturnDecisionService.approve()/.reject() — reusing its pickup-booking/refund-trigger/audit side-effects unmodified
-   \[ \] For MANUAL outcomes, transitions returns.status: UNDER\_AI\_REVIEW → MANUAL\_REVIEW (Feature 10's existing state machine, Feature 10 Task 1.3) and notifies seller+admin (reusing Feature 10 Task 3.7's return\_under\_review notification event, not a new one)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 6.1 | Implement RecommendationEngine.decide(): first check imageMatch (Task 4.4) — if false, return MANUAL immediately, **before** even reading the threshold (hard override, REQ-AI-Return-002) | imageMatch=false always yields MANUAL, regardless of confidence | Unit test: imageMatch=false, aiConfidence=0.99 → MANUAL (confirms override precedence over threshold) |
| --- | --- | --- | --- |
| 6.2 | If imageMatch=true, read platform\_config.returns\_confidence\_threshold (via the existing PlatformConfigRepository.getByKey() — Feature 12 Task 6.1, reused, not a new config-read path) and compare: aiConfidence < threshold → MANUAL | Sub-threshold confidence routes to manual review | Unit test: threshold=0.85, aiConfidence=0.80 → MANUAL |
| --- | --- | --- | --- |
| 6.3 | If aiConfidence ≥ threshold, derive APPROVED/REJECTED from condition (Task 4.1): UNDAMAGED/MINOR → APPROVED; MAJOR/DESTROYED → REJECTED (business-rule mapping — **flagged as Assumption**, since no source document explicitly maps return\_condition values to return\_decision values; this is the most defensible default interpretation, see final review) | Deterministic condition→decision mapping | Unit test: each of the four return\_condition values maps to the expected return\_decision when confidence is sufficient |
| --- | --- | --- | --- |
| 6.4 | On APPROVED/REJECTED, call Feature 10's **existing** ReturnDecisionService.approve(returnId, {reason: 'AI auto-decision', decidedBy: 'AI'}) / .reject(returnId, {reason: <ai-derived plain-language reason>, decidedBy: 'AI'}) — reusing its pickup-booking (on approve) and rejection-notification (on reject) side-effects **exactly as built for seller/admin decisions** (Feature 10 Tasks 4.4/4.5, Feature 12 Task 5.4's reuse precedent) | Auto-decision produces identical downstream effects to a human decision of the same type | Integration test: an AI-APPROVED return books pickup via the same courier-adapter call path as a seller-approved return (Feature 10 Task 4.4); an AI-REJECTED return notifies the buyer with a plain-language reason identically to a seller rejection |
| --- | --- | --- | --- |
| 6.5 | On MANUAL, transition returns.status: UNDER\_AI\_REVIEW → MANUAL\_REVIEW via Feature 10's existing state machine/repository (no new transition logic — this exact transition was already reserved in Feature 10 Task 1.3's enum-defined state machine) and enqueue the **existing** return\_under\_review notification (Feature 10 Task 3.7, reused, not duplicated) to seller + admin | Return correctly lands in Feature 10's existing manual-review queue (Feature 10 Task 5's GET /api/v1/admin/returns) | Integration test: a MANUAL-routed return appears in Feature 10's existing admin manual-review queue query, with no new queue/table introduced |
| --- | --- | --- | --- |
| 6.6 | Ensure audit\_logs is written for **every** AI auto-decision (action per Doc 5 §3 enum — reuse the closest existing value, e.g. AI\_OVERRIDE is reserved for a human overriding AI, so an AI auto-decision itself should log under the **same transactional pattern** ReturnDecisionService already uses internally for human decisions — confirm Feature 10's existing service already logs on every approve()/reject() call regardless of caller identity, so no new audit code is needed here, only correct decidedBy/reason metadata) | Every AI decision has a corresponding, correctly-attributed audit row | Integration test: AI-decided return's audit entry shows reason containing the AI-derived justification and is distinguishable from a human decision's audit entry (e.g., via the reason text or an added metadata field within the existing before/after JSONB — no new column) |
| --- | --- | --- | --- |
| 6.7 | Wire RecommendationEngine.decide() as the final step inside AiReturnDispatcher (Task 1.5) / AiReturnAnalysisService (Task 3.2) — the single call site that ties Tasks 2–6 together end to end | Complete pipeline: readiness → analysis → confidence → recommendation → action, one call chain | End-to-end integration test: submit → analyze (mocked) → correct final returns.status/decision in one traced flow |
| --- | --- | --- | --- |

### **Common Errors**

-   Building a new "AI-approved" pickup-booking or refund-trigger code path instead of calling Feature 10's existing ReturnDecisionService.approve() — this would directly violate the "Do NOT rebuild any of the above" instruction and risk behavioral drift between AI-decided and human-decided approvals (the exact anti-pattern Feature 12 Task 5 already called out for Admin-vs-Seller parity).
-   Checking the confidence threshold **before** the image-mismatch override — order matters; REQ-AI-Return-002's language ("never auto-approved") is a stronger, higher-priority rule than the general D3 threshold and must be evaluated first.
-   Inventing a new return\_status/return\_decision enum value for "AI-approved" vs. "human-approved" — Doc 5 §3 has a single APPROVED value regardless of decider; schema is frozen, and distinguishing AI vs. human decisions belongs in the audit trail/reason text, not a new enum.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Condition→decision mapping | UNDAMAGED/MINOR → APPROVED; MAJOR/DESTROYED → REJECTED (only applied when confidence clears threshold and image match holds) | No source document explicitly defines this mapping (flagged as Assumption, see final review); this is the most defensible reading of "damage detection" driving an approve/reject outcome, consistent with typical returns-fraud logic (visibly undamaged/lightly-worn goods are refundable; majorly damaged/destroyed goods are not) |
| --- | --- | --- |
| AI-decision attribution | AI auto-decisions call the exact same ReturnDecisionService.approve()/reject() methods as human decisions, differentiated only by reason/decidedBy metadata within the existing audit JSONB, not a new column or enum | Directly extends the Admin-vs-Seller reuse principle already established in Feature 12 Task 5 ("Admin and Seller decision endpoints call the same underlying ReturnDecisionService... methods") to a third decider type (AI) — same single-source-of-truth rationale |
| --- | --- | --- |
| Manual-review routing mechanism | Reuse Feature 10's existing MANUAL\_REVIEW state + return\_under\_review notification unmodified | These are the exact artifacts Feature 10 built for precisely this destination state; this feature only needed to make them *reachable* via a new upstream path, not rebuild them |
| --- | --- | --- |

### **Artifacts Produced**

-   RecommendationEngine — the final new orchestration artifact in this feature's Core API side; ties together Tasks 2–6 and is the single call site invoking Feature 10's existing decision/notification services.
-   **No new artifacts** in ReturnDecisionService, pickup-booking, or refund-trigger logic — explicitly confirmed reuse (per Feature 10 Task 4/6 and Feature 12 Task 5).

### **Definition of Done**

-   \[ \] Image-mismatch override evaluated **before** confidence threshold in every code path (order-of-operations tested explicitly)
-   \[ \] Threshold comparison correctly reads the **live** platform\_config.returns\_confidence\_threshold value (not a hardcoded constant) — confirms this feature is the intended consumer Feature 12 anticipated
-   \[ \] Auto-APPROVED/REJECTED outcomes produce identical downstream effects (pickup booking, refund trigger, notifications, audit) to seller/admin-decided outcomes of the same type
-   \[ \] MANUAL outcomes land correctly in Feature 10's existing manual-review queue, indistinguishable in queue structure from any other manually-routed return
-   \[ \] Every AI decision produces exactly one correctly-attributed audit\_logs row
-   \[ \] Zero new return\_status/return\_decision enum values introduced
-   \[ \] End-to-end integration test traces a return from IMAGES\_SUBMITTED through to a final APPROVED/REJECTED/MANUAL\_REVIEW state entirely through this feature's pipeline

## **Task 7 — Seller/Admin Review Integration**

### **Purpose**

-   Ensure the AI results this feature now produces are correctly **surfaced** in Feature 10's existing Seller Review (Task 4) and Admin Review (Task 5) screens/endpoints — the "AI assessment badge + image-analysis report" placeholders App Flow SCR-S07/SCR-AD04 already reserved for R1.1.
-   Confirm **zero new decision endpoints** are introduced — sellers/admins continue using Feature 10's exact existing POST .../decision endpoints; this task only enriches what those existing GET endpoints *return*, and confirms the manual-override path (REQ-F-Return-008: "sellers may override AI decisions") works correctly against AI-produced data.

### **Dependencies**

-   Task 6 (AI Recommendation Engine): the AI decision/confidence/condition data this task surfaces.
-   Feature 10 Task 4: GET /api/v1/seller/returns/:id, POST /api/v1/seller/returns/:id/decision — extended (response shape only) and reused (decision logic), respectively.
-   Feature 10 Task 5: GET /api/v1/admin/returns/:id, POST /api/v1/admin/returns/:id/decision — same extension/reuse split.
-   Feature 10 Task 7 (History): ReturnHistoryItemDto — extended to include AI fields for consistency across all three ownership-scoped history views.

### **Expected Deliverables**

-   \[ \] Feature 10's existing GET /api/v1/seller/returns/:id and GET /api/v1/admin/returns/:id responses **extended** (additive fields only) with aiCondition, aiAuthenticity, aiConfidence, aiDecision — no breaking change to their existing contracts
-   \[ \] Confirmation that a seller/admin **overriding** an AI MANUAL-routed (or even AI-APPROVED/REJECTED, per REQ-F-Return-008) return still uses Feature 10's exact existing POST .../decision endpoint, with the override correctly logged as a human decision superseding the AI one
-   \[ \] ReturnHistoryItemDto (Feature 10 Task 7) extended with the same AI fields for consistency
-   \[ \] Swagger updates (additive only) for the three extended endpoints

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 7.1 | Extend Feature 10's GET /api/v1/seller/returns/:id and GET /api/v1/admin/returns/:id response DTOs (additive fields: aiCondition, aiAuthenticity, aiConfidence, aiDecision, sourced directly from the returns row's existing columns, Doc 5 §4.15) — this is the **same additive-field pattern** already used in Feature 10 Task 6.6 (refund status) and Feature 11 Task 5.6 (chart field retrofit) | Existing endpoints gain AI fields without breaking their current contracts | Regression test: Feature 10 Task 4/5's existing integration tests still pass unmodified; new assertions confirm AI fields present when populated, null/absent gracefully when not yet analyzed |
| --- | --- | --- | --- |
| 7.2 | Confirm (integration test, not new code) that POST /api/v1/seller/returns/:id/decision and POST /api/v1/admin/returns/:id/decision (Feature 10 Tasks 4.3/5.3) work correctly when called on a return whose **current** status is MANUAL\_REVIEW as a result of this feature's routing (Task 6.5) — i.e., the state-machine guard Feature 10 already built (only valid from MANUAL\_REVIEW) naturally accepts AI-routed manual reviews without modification | Seller/Admin can decide on AI-routed manual-review cases exactly as they would any other manual-review case | Integration test: an AI-MANUAL-routed return is successfully approved/rejected via Feature 10's existing endpoints, unmodified |
| --- | --- | --- | --- |
| 7.3 | Confirm/implement the REQ-F-Return-008 override path: if a seller/admin calls POST .../decision on a return that was **already** AI-auto-decided (APPROVED/REJECTED via Task 6.4, not yet in a terminal CLOSED/REFUND\_ISSUED state) — verify Feature 10's existing state-machine guard's behavior here; if the state machine currently only allows decisions **from** MANUAL\_REVIEW (per Feature 10 Task 1.3/4.3), an AI-auto-APPROVED return already past that state cannot be "re-decided" through the existing endpoint, meaning REQ-F-Return-008's override intent for **already-auto-decided** cases requires either (a) accepting Feature 10's existing guard as sufficient — auto-decisions only being overridable while still reachable (e.g., before PICKUP\_BOOKED/REFUND\_ISSUED), or (b) flagging a gap if broader override capability is required | Documented, tested behavior for the override path — **flagged as Assumption/gap if Feature 10's existing state machine doesn't support overriding a terminal-adjacent AI decision** | Integration test: attempt to call .../decision on an AI-APPROVED, already-PICKUP\_BOOKED return — confirm current (Feature 10) behavior (likely rejected as invalid-state) and document this as the confirmed override boundary, not silently patched here |
| --- | --- | --- | --- |
| 7.4 | Extend ReturnHistoryItemDto (Feature 10 Task 7) with the same additive AI fields (7.1), applied consistently across buyer/seller/admin history views | AI data visible in return history, not just live case detail | Regression test: Feature 10 Task 7's existing history endpoint tests still pass; new assertion confirms AI fields appear in historical (closed) return records |
| --- | --- | --- | --- |
| 7.5 | Confirm the **AI report** surfaced to Seller/Admin (App Flow SCR-S07/AD04 "AI assessment badge + image-analysis report") maps directly to the fields from 7.1 — no additional backend artifact needed beyond what Tasks 4–6 already persist (the "report" is a frontend rendering of aiCondition/aiAuthenticity/aiConfidence, not a separate generated document) | Confirmed: no new "report" artifact/table required | Code review: confirm no new report-generation service was introduced beyond the existing persisted AI columns |
| --- | --- | --- | --- |
| 7.6 | Swagger updates (additive only) for the three extended endpoints | Docs current, no breaking changes flagged | Manual check |
| --- | --- | --- | --- |

### **Common Errors**

-   Building a new "override AI decision" endpoint separate from Feature 10's existing POST .../decision — REQ-F-Return-008 describes overriding within the **existing** decision surface, not a parallel one.
-   Silently patching Feature 10's state machine to allow decisions on terminal-adjacent states without flagging it — any such change would modify Feature 10's existing, already-signed-off state-machine rules and must be raised as an explicit cross-feature conflict (per this feature's binding instruction to "stop and clearly identify" conflicts), not silently implemented.
-   Treating the "AI report" as requiring new generated-document infrastructure (e.g., a PDF) — no source document (App Flow, PRD) describes anything beyond an on-screen badge/summary of already-persisted fields.

### **Engineering Decisions**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| AI-field exposure mechanism | Additive fields on Feature 10's existing return detail/history DTOs | Matches the established additive-retrofit pattern (Feature 10 Task 6.6, Feature 11 Task 5.6) — extends without breaking existing consumers |
| --- | --- | --- |
| Override-of-terminal-AI-decision scope | Deferred to Feature 10's existing state-machine boundary; not modified here | Feature 10's state machine (Task 1.3) already defines which transitions are legal; broadening it to permit "undo an auto-decision post-pickup-booking" is a materially different business rule change that must be explicitly raised, not silently patched inside this feature |
| --- | --- | --- |

### **Artifacts Produced**

-   **No new endpoints.** Only additive DTO extensions to Feature 10's existing GET /api/v1/seller/returns/:id, GET /api/v1/admin/returns/:id, and the shared ReturnHistoryItemDto (Feature 10 Task 7).

### **Definition of Done**

-   \[ \] AI fields (aiCondition, aiAuthenticity, aiConfidence, aiDecision) visible on seller/admin return detail and history views, additive-only
-   \[ \] Feature 10's existing decision endpoints correctly and unmodifiedly accept decisions on AI-routed MANUAL\_REVIEW cases
-   \[ \] Override behavior for already-auto-decided (non-MANUAL\_REVIEW) returns is tested and documented against Feature 10's existing state-machine boundary — not silently modified
-   \[ \] Zero new endpoints introduced in this task
-   \[ \] Feature 10 Tasks 4/5/7's existing test suites pass unmodified after the additive retrofit

## **Validation & Testing**

| **Layer** | **Coverage Target** | **Tooling (reused)** | **Key Scenarios** |
| --- | --- | --- | --- |
| Unit | Confidence combination math, condition→decision mapping, image-mismatch override precedence, model-load failure handling | Jest (Core API) / pytest (AI Service) — reused per Feature 13's precedent | imageMatch=false overrides high confidence; sub-threshold confidence → MANUAL; each return\_condition maps correctly; missing-model → MANUAL, no crash |
| --- | --- | --- | --- |
| Integration | Full pipeline: submit → readiness → analyze → confidence → recommendation → Feature 10 action | Jest + Supertest (Core API), pytest + mocked Vision/CNN (AI Service), ephemeral Postgres/Redis (reused CI, TRD §23) | AI-APPROVED books pickup identically to seller-approved; AI-REJECTED notifies buyer identically to seller-rejected; AI-MANUAL lands in existing admin queue; 60s timeout routes to manual review |
| --- | --- | --- | --- |
| Cross-service | Core API ↔ AI Service contract, network isolation (second route) | Docker Compose harness (reused Feature 13 precedent) | /analyze-return unreachable via public route; Core API times out cleanly if AI Service is down |
| --- | --- | --- | --- |
| Regression | Feature 10's existing endpoints/tests unaffected | Existing Feature 10 Task 1–7 test suites (rerun, not modified) | All pre-existing Feature 10 tests pass unchanged after this feature's additive retrofits |
| --- | --- | --- | --- |
| Regression | Feature 12's Reports (seller-performance/fraud-flag) still function correctly now that AI-decided returns exist | Existing Feature 12 Task 5 test suite (rerun) | Fraud-rate calculations correctly include AI-auto-rejected returns alongside human-rejected ones (no special-casing needed, since both write through the same returns/seller\_profiles.fraud\_rate\_30d path) |
| --- | --- | --- | --- |
| Performance | ≤60s analysis window (REQ-F-Return-004) | k6/JMeter (reused, directionally checked; full validation Deferred to Feature 12-equivalent Optimization phase) | Mocked/test-tier Vision+CNN parallel call completes well within 60s |
| --- | --- | --- | --- |

### **Coverage Gate**

-   \[ \] ≥80% backend coverage maintained across both Core API and AI Service new code (REQ-NF-Quality-003), verified via existing Istanbul/c8 (Core API) and pytest-cov (AI Service) — no new tooling.
-   \[ \] Zero lint/type errors (ESLint/tsc --noEmit; Flake8/Black/mypy — all reused per TRD §13).
-   \[ \] Full production-scale CNN accuracy validation (REQ-AI-Return-001's ≥95% target) is owned by the Implementation Plan's separate CNN dataset/training workstream (Doc 6 §0, Phase 8) — out of this playbook's scope; this feature's tests validate the **serving pipeline's correctness**, not model accuracy itself.

## **Consistency Review, Assumptions, Documentation Gaps**

### **Consistency Review vs Features 0–13**

| **Check** | **Result** |
| --- | --- |
| No new database tables/columns/enums introduced | ✅ Pass — this feature populates only pre-existing returns.ai\_condition/ai\_authenticity/ai\_confidence/decision columns (Doc 5 §4.15) and reads pre-existing platform\_config.returns\_confidence\_threshold (Doc 5 §4.25) |
| --- | --- |
| No new routing conventions introduced | ✅ Pass — AI Service /analyze-return follows the exact TRD §5.2/§12 reserved path; no new Core API routes beyond the existing Feature 10 endpoints (additively extended only in Task 7) |
| --- | --- |
| No new authentication mechanism introduced | ✅ Pass — reuses Feature 1's auth chain throughout; AI Service remains internally-callable-only (TRD §8), consistent with Feature 13's precedent |
| --- | --- |
| No duplicate shared components rebuilt | ✅ Pass — Object Storage Adapter, response envelope, error hierarchy, Repository pattern, validation framework, Feature 10's entire state machine/decision service/notification hooks, Feature 4's product-image relations all reused, not rebuilt |
| --- | --- |
| Feature 10's reserved extension point correctly activated | ✅ Pass — AiReviewDispatcher (Feature 10 Task 3.6, explicitly a no-op stub) now has its first real implementation; UNDER\_AI\_REVIEW state is reachable for the first time, exactly as designed |
| --- | --- |
| D3 confidence-threshold routing correctly implemented | ✅ Pass — ai\_confidence < threshold → MANUAL\_REVIEW; image mismatch is a hard override taking precedence, matching REQ-AI-Return-002's "never auto-approved" language exactly |
| --- | --- |
| Auto-decisions reuse Feature 10's existing decision service | ✅ Pass — ReturnDecisionService.approve()/reject() (Feature 10 Tasks 4–5) invoked unmodified for AI-derived outcomes, extending the Admin-vs-Seller reuse precedent (Feature 12 Task 5) to a third decider (AI) |
| --- | --- |
| Two-service architecture respected | ✅ Pass — Vision/CNN logic lives entirely in the AI Service; Core API only orchestrates and persists results, mirroring Feature 13's proven pattern exactly |
| --- | --- |
| Seller/Admin review surfaces correctly extended | ✅ Pass — Task 7 confirms additive-only DTO extensions, zero new decision endpoints, consistent with the additive-retrofit pattern already used in Feature 10 Task 6.6 and Feature 11 Task 5.6 |
| --- | --- |

**No conflicts found with Features 0–13 or with the PRD/TRD/App Flow/Schema/Implementation Plan**, with one flagged cross-feature follow-up (Feature 12's config-write restriction on returns\_confidence\_threshold — see below) surfaced rather than silently patched.

### **Assumptions Made (flagged, not invented as fact)**

1.  **Multi-image CNN confidence aggregation** (Task 4.1): no source document specifies how per-image classifications combine into one return-level condition/confidence. This playbook assumes "worst-case condition wins," confidence = the model's own reported value for that worst-case image. Implementers should confirm this against actual model output characteristics once training is complete.
2.  **Confidence combination formula** (Task 5.1): min(cnnConfidence, matchConfidence) is not sourced from any project document — it is the conservative default consistent with D3's "err toward manual review" philosophy. A different weighting (e.g., weighted average) may be intended and should be confirmed.
3.  **return\_condition → return\_decision mapping** (Task 6.3): PRD/Schema define both enums but **never explicitly map one to the other**. This playbook's UNDAMAGED/MINOR → APPROVED, MAJOR/DESTROYED → REJECTED mapping is the most defensible default but is an interpretive choice, not a documented rule — flagged for explicit confirmation before production use, since it directly drives automated financial outcomes (refunds).
4.  **New CNN model-config env vars** (Task 4.1): CNN\_MODEL\_PATH/CNN\_MODEL\_VERSION-style variables are introduced by necessity (a trained model must be loaded from somewhere) but are **not** enumerated in TRD §27's existing env-var table. This is a additive, non-breaking documentation gap, not a schema/architecture conflict — flagged for TRD §27 to be updated to include them.
5.  **AI-decision audit attribution** (Task 6.6): assumed that Feature 10's existing ReturnDecisionService already logs to audit\_logs on every approve()/reject() call regardless of caller identity (human or AI), and that distinguishing "AI decided" from "human decided" is achievable via the reason/before/after JSONB content alone, with no new column. If Feature 10's actual implementation requires an explicit decidedBy actor field that only accepts a users.user\_id (FK, Doc 5 §4.24 actor\_id BIGINT FK → users), then AI-attributed audit rows have **no valid actor** to reference — this is flagged as a genuine potential schema-interaction issue requiring confirmation (see Documentation Gaps below), not silently resolved.

### **Unresolved Documentation Gaps**

1.  **audit\_logs.actor\_id has no representation for a non-human ("AI") actor** (Assumption 5) — Doc 5 §4.24 defines actor\_id BIGINT FK → users (SET NULL). No source document describes how a system/AI-initiated audit entry should populate this field. Options include: (a) actor\_id = NULL with the AI attribution captured only in reason/JSONB text (this playbook's working assumption), (b) a reserved system-user account acting as a "virtual" AI actor, or (c) a schema amendment (out of this feature's authority). **This is the most significant open gap in this feature** and should be resolved before production use, since it affects audit-trail integrity for every AI auto-decision.
2.  **return\_condition → return\_decision mapping is undocumented** (Assumption 3) — as this mapping directly triggers refunds, it should be explicitly confirmed by the product owner (or documented in a PRD/TRD addendum) rather than left to this playbook's interpretive default.
3.  **Feature 12's Platform Settings restricts returns\_confidence\_threshold to read-only** (Feature Overview note) — now that this feature builds the R1.1 consumer Feature 12 Task 6.5 was waiting for, Feature 12's config-write restriction should be revisited so admins can actually tune the threshold this feature depends on. This is a cross-feature follow-up, not fixable within this feature's own scope (Feature 12's code is out of bounds here per the "DO NOT MODIFY... unless explicitly required" instruction — flagging it is the correct action, not silently editing Feature 12).
4.  **Multi-image aggregation and confidence-combination formulas are both interpretive defaults** (Assumptions 1–2) — recommend a future TRD/PRD addendum formalizing both once real model behavior is characterized during the CNN training workstream (Doc 6 §0).
5.  **CNN model config env vars undocumented in TRD §27** (Assumption 4) — recommend adding CNN\_MODEL\_PATH/CNN\_MODEL\_VERSION (or equivalent) to the TRD's environment-variable table for completeness.

*End of Playbook — Feature 14: AI Returns. All three responses (Tasks 1–7, Validation & Testing, Consistency Review) are now complete. No section was rewritten after its initial generation.*