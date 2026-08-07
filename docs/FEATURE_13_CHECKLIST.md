# Feature 13 — AI Store Builder: Sign-off Checklist

Backend scope only, both services (`apps/ai-service`, `apps/backend`) — the SCR-S02 frontend
wizard is a separate, not-yet-started deliverable. Full narrative contract:
`docs/handoffs/F13-ai-store-builder.md`. Progress-log entry: `docs/DoneTillNow.md`.

**Explicit user-directed deviation from D3**: Google Gemini Flash on both primary/fallback
(dev-cost reasons), not GPT-4V/GPT-3.5-turbo — see the handoff doc's full reasoning and the
documented migration path to a paid provider at launch.

## Task 1 — AI Store Builder Foundation

- [x] AI Service `generate_listing` router mounted, documented in FastAPI's auto-OpenAPI.
- [x] `LlmClient` (ABC) cannot be instantiated directly (tested); a subclass missing `generate()`
      also cannot be instantiated (tested).
- [x] `GeminiVisionClient` — the sole real `LlmClient` implementation, reads
      `LLM_PRIMARY_MODEL`/`LLM_FALLBACK_MODEL`/`GEMINI_API_KEY` via constructor params sourced
      from `app/config.py`, never hardcoded. `MockLlmClient` exists as a dev/test double only.
- [x] `LlmFallbackOrchestrator.generate()` unit-tested for all three paths: primary-success
      (fallback never touched, tested), primary-fail-fallback-succeeds (tested), both-fail
      raises `AiGenerationError` (tested).
- [x] `ListingSchema` (`GeneratedListing`) rejects any output missing a required field (tested,
      parametrized over all 6 fields) or with tags as a non-list (tested); deliberately does
      **not** enforce the 5-10 tag count itself (that's Task 4.3's mapping-layer job — tested
      that the schema alone accepts both under- and over-count arrays).
- [x] Core API module scaffold (`ai-store-builder/`) compiles, mounts at
      `/api/v1/products/ai-generate`.
- [x] `AI_GENERATION_TIMEOUT`/`AI_SERVICE_UNAVAILABLE`/`AI_STAGING_NOT_FOUND` registered in
      `packages/shared` (alongside Feature 4's existing `AI_GENERATION_FAILED`).
- [x] **Model switching is provably config-only**: `build_default_orchestrator()`'s own tests
      construct two `GeminiVisionClient`s from arbitrary monkeypatched model-name strings and
      assert those exact strings land in the constructed clients — zero code path branches on a
      literal model name anywhere (grep-audited in both services' reuse-audit tests).
- [x] Zero Prisma/schema drift. `tsc --noEmit` (Core API) and `mypy`/`flake8`/`black` (AI
      Service) all clean.

## Task 2 — Image Upload & Validation

- [x] `POST /api/v1/products/ai-generate/upload` — validates every file before uploading any
      (tested: an invalid file among several blocks the whole batch, zero storage calls).
- [x] Oversized/invalid files rejected before any storage call (tested; see the handoff doc's
      note on the pre-existing `AVATAR_TOO_LARGE`-code cosmetic imprecision this surfaced but
      doesn't fix).
- [x] Files stored via the existing Object Storage Adapter under a `products/staging/{stagingId}/`
      prefix, distinct from Feature 4's `products/{productId}/` published-image path (tested).
- [x] First uploaded image is position 0 = primary; order preserved across multi-image uploads
      (tested).
- [x] Response is `{stagingId, images: [{cdnUrl, position}]}` (tested).
- [x] Store-Setup-Wizard-incomplete sellers blocked before any storage call (tested, reusing
      Feature 3/4's `requireActiveSeller` verbatim).
- [x] Swagger documents the endpoint.

## Task 3 — AI Request Pipeline

- [x] AI Service `/generate-listing` fully wired to `LlmFallbackOrchestrator`, returns
      `ListingSchema`-validated JSON or a structured `502 {"error": "GENERATION_FAILED"}` (tested).
- [x] Core API enforces its own 28s outer timeout independent of the AI Service's internals
      (tested: a mocked `ECONNABORTED` maps to `503 AI_GENERATION_TIMEOUT`).
- [x] Failure responses never contain partial AI fields (tested: `data: null` on every failure
      path, never a partially-populated draft).
- [x] Retry re-runs generation against the same `stagingId` without requiring re-upload (tested:
      failure then success on the identical `stagingId`).
- [x] Store-Setup-Wizard-incomplete sellers blocked before any AI call (reused guard, same as
      Task 2 — tested there).
- [x] AI Service confirmed never routed through the public Nginx `/api` proxy (infra config has
      no such route — unchanged by this feature, verified by inspection).
- [x] Swagger (Core API) + FastAPI auto-doc (AI Service) both current.

## Task 4 — Generate Product Content

- [x] `resolveCategory()` — exact `name_en`/`name_ur` match resolves (tested); nonsense/unmatched
      guess → `null`, no error (tested); very short guesses guarded against false-positive
      substring matches.
- [x] Mapped draft passes through Feature 4's real `createProduct`/`updateProduct` service calls
      unmodified — proven directly by the end-to-end upload→generate→save test, not just a
      shape-comparison unit test.
- [x] 12-tag response truncated to top 10 (tested); 3-tag response passed through unmodified, no
      error (tested).
- [x] `ai_generated` set only via the new `markAiGenerated()` export, only on the AI path (the
      save payload's explicit `aiGenerated` flag) — Feature 4's manual-entry path is untouched
      (regression-verified: its own full suite re-run green).
- [x] No premature `products` row created by upload/generate — grep-confirmed zero
      `prisma.product.create/update` calls anywhere outside `catalog.service.ts`.

## Task 5 — SEO Metadata & Edit/Review

- [x] Generation response includes a derived `seoPreview` (`metaTitle`/`metaDescription`),
      clearly typed as read-only in `packages/shared`; the save DTO has no such fields at all
      (grep/type-confirmed, not just documented).
- [x] `metaDescription` truncation never cuts mid-word (word-boundary truncation, implemented and
      documented; not separately unit-tested at the Core API layer beyond the shared function's
      own logic — low-risk pure string function).
- [x] No new `products` columns for SEO metadata — schema-drift check passes (reuse-audit test).
- [x] No new endpoint for SEO metadata or edit-tracking — folded into Task 3's response.
- [x] Confirmed and documented (handoff doc) that this resolves a genuine requirements/schema gap
      rather than silently inventing persisted fields.

## Task 6 — Save Product

- [x] Only `catalog.service.ts` (Feature 4) ever writes to `products` — grep-confirmed
      (reuse-audit test), including the AI Store Builder's own new `markAiGenerated()` export,
      which itself lives in that same file, not a duplicate.
- [x] Publish validation (title + ≥1 image + category) enforced byte-identically to Feature 4's
      manual path — tested: publish without category → `422 PUBLISH_REQUIREMENTS_NOT_MET`,
      same code Feature 4's own manual flow produces for the identical omission.
- [x] Staged images correctly promoted to `product_images` with correct position/primary
      ordering (tested, 2-image case).
- [x] Product cache invalidation fires identically to the manual-creation path — implicit
      (reuses `catalogService.createProduct`/`publishProduct` verbatim, which already own that
      behavior; not re-tested here, would be redundant with Feature 4's own cache tests).
- [x] `ai_generated = true` persisted correctly on the AI path (tested) and `false` when the
      save payload explicitly says so — the manual-entry fallback through this same endpoint
      (tested).
- [x] End-to-end test: upload → generate → save (LIVE) → product appears in Feature 5's
      storefront search with the correct `ai_generated` flag (tested, full round trip).
- [x] Swagger documents the save endpoint.

## Task 7 — Validation & Testing

- [x] AI Service: 29 pytest tests (client ABC enforcement, `GeminiVisionClient` retry/backoff/
      malformed-JSON/non-2xx handling, orchestrator's 3 paths + config-driven client
      construction, schema validation, router success/failure/malformed-body). mypy/flake8/black
      all clean.
- [x] Core API: 39 new tests across `upload.test.ts`/`generate.test.ts`/`save.test.ts`/
      `reuseAudit.test.ts` — see `docs/DoneTillNow.md` for the exact final count.
- [x] Cross-service: AI Service response defensively re-validated at the Core API Zod boundary
      (tested: a field-missing mocked response is a full `AI_GENERATION_FAILED`, never partial).
- [x] Regression: Feature 4's full test suite (including its own `generate-listing` tests) rerun
      unchanged and green — confirms this feature's changes to `catalog.service.ts` (2 new
      exports, `loadOwnedProduct`/`getProductDetailByProductId` made public, `markAiGenerated`
      added) broke nothing.
- [x] Performance: mocked round trips complete in seconds, well within the 30s target (directional
      only, per the module doc's own Coverage Gate — full production-scale benchmarking is
      explicitly deferred elsewhere).

### Reuse audit — grep results (verbatim, `tests/ai-store-builder/reuseAudit.test.ts`, all passing)

```
direct products-table write outside catalog.service.ts: none found
save step calls Feature 4's createProduct/updateProduct/publishProduct/markAiGenerated: confirmed
Store-Setup-Wizard guard reuses requireActiveSeller: confirmed, not reimplemented
image validation reuses core/upload/imageValidation, no duplicate magic-byte check: confirmed
LLM model name hardcoded anywhere on the Core API side: none found
Core API calls an LLM provider directly (bypassing the AI Service): none found
new Prisma model added for this feature: none — products/product_images/categories all pre-existing
```

## Documentation Gaps — final status

| # | Item | Status |
|---|---|---|
| 1 | Task 2.4 ("frontend carries forward images") vs. Task 3.2 ("Core API resolves stagingId") — a real contradiction in the module doc itself | Resolved: Redis-backed staging store, TTL 1h, no new Postgres table |
| 2 | "Feature 4's exact product-create DTO" doesn't exist as one schema (title+price only) | Resolved: save step calls createProduct + updateProduct in sequence, both existing, unmodified |
| 3 | Orphaned staging images (no cleanup policy) | Unresolved — carried forward per the module doc's own §11 |
| 4 | Category auto-creation policy undefined | Unresolved — carried forward, null-fallback-to-manual is the chosen default |
| 5 | Core API/AI Service timeout budget split undocumented | Resolved by implementation judgment (28s outer / 10s×2 inner per client), flagged as Assumption |
| 6 | `meta_description` truncation length (155 chars) unsourced | Carried forward as Assumption, implemented anyway (harmless default) |
| 7 | `AVATAR_TOO_LARGE` code on non-avatar multer size-limit rejections | Found this pass (pre-existing, cross-feature), documented, not fixed — cosmetic only |

## Test results

**AI Service: 29/29 pytest tests, mypy/flake8/black clean. Core API: 39/39 new tests; full
backend suite 740/740 tests, 74/74 suites**, confirmed non-flaky across 2 consecutive full-suite
runs. See `docs/DoneTillNow.md`'s Feature 13 entry for the breakdown.

## Sign-off

Backend scope (both services): **complete**. Frontend scope (SCR-S02): **not started**.
