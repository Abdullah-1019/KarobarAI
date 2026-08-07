# Handoff — F13 AI Store Builder (Backend, both services)

**Status:** Backend complete — 2026-08-04. New AI Service module (`app/llm/`: `client.py`,
`gemini_client.py`, `mock_client.py`, `fallback_orchestrator.py`, `errors.py`; rewired
`app/routers/listing.py`) and new Core API module (`apps/backend/src/modules/ai-store-builder/`).
Full suite green: Core API **740/740 tests, 74/74 suites** (39 new to this feature), confirmed
non-flaky across 2 consecutive runs; AI Service **29/29 pytest tests**, mypy/flake8/black clean.
Zero new Prisma models/migrations — only `products.ai_generated` (already existed) gets set.

**Read this whole doc before touching this feature again** — it resolves two real internal
contradictions in the module doc itself (not just gaps), on top of the user-directed Gemini
deviation. Module doc verified complete before starting (Tasks 1–6 + Validation + Consistency
Review all present, 3 appended "Response" batches, learned from the Feature 10→11 mistake logged
in `docs/DoneTillNow.md`).

---

## The Gemini deviation (explicit, user-directed)

D3 (binding) specifies GPT-4 Vision primary → GPT-3.5-turbo fallback. **By explicit user
instruction**, this implementation runs Google Gemini Flash on both sides of that pair instead,
purely for development cost (Gemini's free tier: 1,500 requests/day, no credit card; OpenAI has
no comparable free tier). Concretely:
- `app/llm/client.py`'s `LlmClient` ABC and `app/llm/fallback_orchestrator.py`'s
  `LlmFallbackOrchestrator` are built exactly per Task 1.2/1.4's architecture — provider-agnostic,
  primary-then-fallback, config-only model switch.
- `GeminiVisionClient` (`app/llm/gemini_client.py`) is the **sole concrete provider
  implementation**. `LLM_PRIMARY_MODEL`/`LLM_FALLBACK_MODEL` name two independent Gemini model
  strings (defaults: `gemini-1.5-flash` / `gemini-1.5-flash-8b`) — two instances of the same
  class stand in for D3's primary/fallback pair, so a capacity limit or transient failure on one
  genuinely has a different model to fail over to, not just a retry of an identical call.
- **Retry-with-backoff, not a second provider, is the resilience mechanism per the user's own
  framing**: `GeminiVisionClient.generate()` retries its own call (1 retry by default = 2
  attempts, exponential backoff starting at 1s) before the orchestrator ever switches to the
  fallback client. Two layers: retry the same model, then fail over to the other configured one.
- **Zero hardcoded model names anywhere.** `GEMINI_API_KEY`/`LLM_PRIMARY_MODEL`/
  `LLM_FALLBACK_MODEL` (`app/config.py`) are the only place model identity is configured — grep-
  audited in both services' reuse-audit tests. Renamed the config field from `openai_api_key` to
  `gemini_api_key` (the old field was never read by any code — this is the first real LLM
  implementation; the mock stub never touched config at all).
- **Migration path to a paid provider at launch** (the user's own stated plan): add one new class
  implementing `LlmClient` (e.g. `GptVisionClient`, `ClaudeVisionClient`) and change
  `LLM_PRIMARY_MODEL`/`LLM_FALLBACK_MODEL` — plus, only if the new provider isn't Gemini,
  `fallback_orchestrator.py`'s `build_default_orchestrator()` needs its two `if`-branches updated
  to construct the new class. No other file in either service changes.
- `MockLlmClient` (`app/llm/mock_client.py`) exists purely as a dev/test double — same D2
  mock/live role every Core API adapter already has. Selected automatically when
  `GEMINI_API_KEY` is empty, so local dev/CI never needs a real key to boot the AI Service.
- Implemented against Gemini's REST API directly via `httpx` (not the `google-generativeai`/
  `google-genai` SDK) — no new unverified third-party dependency, and trivially mockable in tests
  without needing to mock an SDK's internal client object.

## Two real contradictions found *inside the module doc itself*, resolved (not silently picked)

1. **Task 2.4 vs. Task 3.2 disagree on where staging state lives.** Task 2.4 says the upload
   response's `images` array is something "the frontend carries forward into the generation
   call"; Task 3.2 says the Core API "resolves stagingId → cdnUrl" — implying a server-side
   lookup the client never has to supply. These can't both be literally true without a
   server-side store. Resolved by keeping exactly one: **Redis, keyed
   `ai-store-builder:staging:{stagingId}`, TTL 1 hour**, written by the upload endpoint (Task 2),
   read by generate (Task 3) and save (Task 6), deleted after a successful save. No new Postgres
   table (schema stays frozen, as every task's own Engineering Decisions insist) — this also
   means the client only ever needs to remember `stagingId`, not the full images array, across
   the three-step flow, which is the more usable API shape anyway.
2. **Task 4.2's "exact shape Feature 4's product-create DTO already expects" doesn't actually
   exist as one DTO.** Feature 4's `createProductSchema` covers only `{titleEn, price,
   categoryId}` (the two NOT NULL-with-no-default columns); everything else a generated draft
   needs (`titleUr`, `descriptionEn/Ur`, `tags`, `stock`, `condition`) lives in the separate
   `updateProductSchema`. Task 6.1's save step calls **both** — `createProduct()` then
   `updateProduct()` — in sequence, exactly matching how Feature 4's own manual-entry flow
   already has to work in two steps (create the minimal Draft, then fill in the rest). Zero
   duplicate write logic; this is literal reuse of both existing functions, not a new one.

## A real, latent gap this feature exposed but doesn't fix: `AVATAR_TOO_LARGE` on non-avatar routes

Every multer instance in this codebase (`catalog.routes.ts`'s existing image upload, and this
feature's new `upload` instance) configures `limits.fileSize` at exactly `IMAGE_MAX_BYTES`
(10MB) — the same constant `validateImageFile()`'s own Sec-012 check uses. This means multer's
own size limit **always** rejects an oversized multipart file before `validateImageFile()` ever
runs, so the intended `PRODUCT_IMAGE_TOO_LARGE`/`AI`-equivalent error code is unreachable via a
real multipart request — `core/middleware/errorHandler.ts`'s generic `LIMIT_FILE_SIZE` branch
hardcodes `'AVATAR_TOO_LARGE'` regardless of which route's multer instance actually triggered it
(a name it was given when only the Avatar upload feature existed). Confirmed this isn't new:
Feature 4's own `tests/catalog/images.test.ts` never actually exercises an oversized-file test
for exactly this reason. Not fixed here — it would mean touching shared `errorHandler.ts` and
every existing multer instance's limits/messaging across several already-signed-off files, for a
UX-polish concern (the response is still a correct `400`, just with a slightly misleading code
name) outside this feature's own scope. Flagged for whoever next touches upload validation
broadly.

## Task 2 — Image Upload & Validation

`uploadStagingImages()` mirrors `catalog.service.ts`'s existing `uploadProductImages()` almost
exactly (validate-all-before-upload-any, `getStorageAdapter()`, incrementing position, first =
primary) but writes under `products/staging/{stagingId}/` — a real product doesn't exist yet
(`product_images.product_id` is `NOT NULL`), so nothing can be inserted into that table until
Task 6. `stagingId` is a fresh `randomUUID()`, purely a Redis key + storage-path correlation
value.

## Task 3 — AI Request Pipeline

`POST /api/v1/products/ai-generate` resolves `stagingId` via the Redis staging store (see above),
sends the position-0 image to the AI Service with a **28-second outer timeout**
(`CORE_API_AI_TIMEOUT_MS`, Assumption #3's own reasoning — near the 30s user-facing ceiling, with
headroom for network/mapping overhead). The AI Service's own per-client budget (10s × 2 attempts,
both primary and fallback clients) stays comfortably under that. Three distinct outer failure
modes are classified **by response shape, not `axios.isAxiosError()`** — that SDK type-guard gets
auto-mocked to a no-op under this codebase's established `jest.mock('axios')` whole-module test
convention (`tests/catalog/creation.test.ts`'s own precedent), which would have silently defeated
the timeout-vs-502-vs-unreachable distinction in tests. Checking `.code`/`.response.status`
directly works identically in production and is trivially mockable with plain objects:
- `err.code === 'ECONNABORTED'` → `503 AI_GENERATION_TIMEOUT`
- `err.response.status === 502` (the AI Service's own structured `{error: "GENERATION_FAILED"}`
  after exhausting both its clients) → `503 AI_GENERATION_FAILED`
- anything else (connection refused, DNS failure, ...) → `503 AI_SERVICE_UNAVAILABLE`

All three are `DependencyError` (503) — distinguished by `error.code`, not HTTP status, matching
this codebase's established convention (the frontend switches on `error.code`, never status text).
The AI Service's own response is **defensively re-validated with a local Zod schema** at the Core
API boundary (Task 1's Engineering Decision) — any shape drift is a full `AI_GENERATION_FAILED`,
never a partially-populated draft (Task 3.6). Retry is genuinely stateless: a second call with the
same `stagingId` re-resolves from Redis and re-calls the AI Service fresh — no failed-attempt
caching, exactly Task 3's Engineering Decision.

## Task 4 — Generate Product Content

`resolveCategory()` (`category-resolution.service.ts`) tries an exact `name_en`/`name_ur` match
first, then a simple substring-containment fallback (guarded against very short guesses like "a"
matching everything), returning `null` — never an error — when nothing confident matches. Tags
over 10 are truncated to the first 10 (assumed relevance-ordered, per the module doc's own
Assumption); under 5 pass through unmodified, never blocked (REQ-F-Store003 keeps every field
editable). `ai_generated` is only ever set via `catalog.service.ts`'s new `markAiGenerated()` —
see Task 6 below.

## Task 5 — SEO Metadata & Edit/Review

`seo-metadata.service.ts`'s `derivePreview()` is exactly the module doc's own resolution: an
ephemeral `{metaTitle, metaDescription}` derived from already-generated `titleEn`/`descriptionEn`,
folded into the generation response, never persisted (Doc 5 has no SEO-specific columns — tags
are the real, persisted SEO mechanism). `metaDescription` truncates at a word boundary at 155
characters (a general SEO convention, not sourced from any project document — Assumption #2,
carried forward unresolved). No new endpoint; no per-field edit-state tracking (Doc 5 has no such
provenance model beyond the single product-level `ai_generated` boolean).

## Task 6 — Save Product

`POST /api/v1/products/ai-generate/save` is the **only** write endpoint in this entire feature.
It composes, in order: `catalogService.createProduct()` (title + price + category — the two
NOT-NULL columns) → `catalogService.updateProduct()` (everything else) →
`prisma.productImage.createMany()` (staged-image promotion, the one genuinely new
persistence-adjacent code in this feature, per the module doc's own Artifacts note) →
`catalogService.markAiGenerated()` (a new, small, additive export on `catalog.service.ts` — `ai_
generated` is deliberately absent from `updateProductSchema`, never seller-settable via manual
PATCH, so it needs its own direct-update call; mirrors `generateListing()`'s own existing pattern
for the identical column) → `catalogService.publishProduct()` if `status=LIVE`, reusing its exact
existing `REQ-F-Store003` validation with **zero AI-path exception** (an AI-unresolved `null`
category blocks publish exactly like a manually-blank one would). `loadOwnedProduct` and
`getProductDetailByProductId` were also exported from `catalog.service.ts` (previously private) —
both were already exactly what this feature's save/promotion steps needed; no new query logic.

**Provenance is explicit, not inferred**: the save payload carries a required `aiGenerated:
boolean` field the client sets. This endpoint is stateless and doubles as the manual-entry
fallback path (REQ-F-Store005: "fields left blank... for manual entry" after a failure) — a
seller who never got AI content, or whose generation failed, still saves through this same
endpoint, so provenance can't be inferred server-side from the mere presence of a `stagingId`.

**Staged images use option (b) from the module doc's own Assumption 4**: `product_images` rows
point directly at the already-uploaded staging URLs, no physical object-storage relocation.

## Coexistence with Feature 4's existing `POST /:productId/generate-listing`

Feature 4 already shipped a **complete, different, already-tested** AI-generation entry point:
create a Draft product first (minimal title), upload an image to it, then call
`generate-listing` to overwrite that existing row's fields in place (category resolved by exact
**slug** match, not name-based fuzzy matching — a different, independently-correct strategy for a
different call site). This feature does **not** replace or duplicate that endpoint — both now
coexist:
- Feature 4's endpoint = "regenerate/redo AI for an already-created Draft," reached from the
  product edit screen.
- This feature's three-step flow = the flagship SCR-S02 wizard (App Flow), reached before any
  product exists at all.

Both call the **same** AI Service `/generate-listing` route, so Feature 4's existing endpoint
transparently benefits from this feature's Task 1/3 work — it now gets real Gemini-generated
content instead of the fixed mock stub, with **zero Core API changes** to Feature 4's own file.
Verified via the existing `tests/catalog/creation.test.ts` suite re-run unchanged and still green.

## Known limitations / carried-forward documentation gaps

1. **Orphaned staging images**: no cleanup job exists for a seller who uploads, then abandons the
   flow without saving — the Redis staging *key* expires after 1 hour, but the underlying
   object-storage files remain indefinitely (Documentation Gap #2, unresolved by design — no
   source document specifies a TTL/cleanup policy, analogous to `refresh_tokens`' own purge job).
2. **Category auto-creation policy is undefined** (Documentation Gap #3) — an AI guess with no
   confident match always falls back to `null`/manual-selection; no admin-moderated
   category-suggestion workflow exists.
3. **Core API/AI Service timeout budget split is an implementation judgment call** (Assumption
   #3/Documentation Gap #4), not derived from any documented split.
4. **`meta_description` truncation length (155 chars)** is an unsourced SEO convention
   (Assumption #2).
5. The `AVATAR_TOO_LARGE`-on-non-avatar-routes gap (above) — cosmetic, not fixed here.
6. No frontend for any of this — SCR-S02's upload/generate/edit/publish flow remains separate,
   not-yet-started work.
