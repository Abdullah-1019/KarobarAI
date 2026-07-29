# **KarobarAI — Engineering Execution Playbook**

## **Feature 4: Product Management**

**Source of truth:** PRD · TRD · App Flow · Backend Schema · Implementation Plan (Docs 1–6). No architecture, field, workflow, or business rule is invented beyond what these documents specify. Gaps are marked **Assumption**; unsourced practices are marked **Recommended Enhancement (Optional)**.

**Depends on:** Feature 0 (Foundation), Feature 1 (Authentication), Feature 2 (User Profiles), Feature 3 (Store Management — specifically the hasStore gate and the Seller status write-restriction, both reused unchanged here).

## **Table of Contents**

1.  [Feature Overview](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#feature-overview) 0.1. [Documentation Gaps & Assumptions](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#documentation-gaps--assumptions) 0.2. [Product Management Flow](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#product-management-flow)
2.  [Task 1 — Product Foundation](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-1--product-foundation)
3.  [Task 2 — Category Integration](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-2--category-integration)
4.  [Task 3 — Product Creation](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-3--product-creation)
5.  Task 4 — Image Management *(pending)*
6.  Task 5 — Inventory Management *(pending)*
7.  Task 6 — Product Editing *(pending)*
8.  Task 7 — Product Search *(pending)*
9.  Task 8 — Product Validation & Testing *(pending)*

## **Feature Overview**

**What Feature 4 covers:** the full seller-side product lifecycle — App Flow **SCR-S02** (AI Store Builder / Add Product), **SCR-S03** (Products list/management), **SCR-S04** (Product Edit), plus the buyer/guest-facing read surfaces **SCR-B02** (Search Results/Browse) and **SCR-B03** (Product Detail, read-only in this feature — cart/purchase actions belong to the Cart & Checkout feature). Governed by **Schema §4.5 categories**, **§4.6 products**, **§4.7 product\_images**.

**What it explicitly excludes:**

-   Category **creation/editing** — categories are reference data, seeded in the Database phase (Implementation Plan Phase 4, Schema §12); this feature only **reads/selects** them, per the instruction "reuse categories, do not redesign them."
-   Cart, checkout, order placement — cart\_items/order\_items reference products by FK but are owned by the Cart & Checkout feature.
-   Reviews/ratings (reviews table, R1.1, REQ-F-Browse-004) — out of scope; noted as a known search-filter limitation (see Gaps).
-   Admin listing moderation (REQ-F-Admin-004, SCR-AD05) — Admin's takedown power is a separate Admin Console feature; this feature only enforces **seller-ownership**, not platform moderation.
-   The Wishlist feature (F17, Future) — not referenced anywhere here.

**Governing tables (Schema Doc §4):** categories (4.5, read-only here), products (4.6), product\_images (4.7). search\_vector is a Postgres-generated column (Schema §7) — no application code writes it directly.

### **Documentation Gaps & Assumptions**

| **Gap** | **What the docs say** | **Assumption taken** |
| --- | --- | --- |
| **product\_images position uniqueness** | Schema §4.7 lists UQ (product\_id, position) as a "composite **consideration**" — not stated as a firm mandate like other UQ constraints in the same document. | **Assumption:** enforce it as a real DB unique constraint. Without it, two images could claim position=0 (primary) simultaneously, breaking "first = primary" (App Flow SCR-S02). This is the only sane reading of "consideration" in context. |
| --- | --- | --- |
| **Max images per product** | No cap specified anywhere in PRD/TRD/Schema/App Flow. SCR-S02 only says "multi-image, first = primary." | No cap enforced (docs are silent, not restrictive). **Recommended Enhancement (Optional):** a soft cap (e.g., 8 images) for storage/perf hygiene — not implemented unless the team explicitly opts in, since it is not a documented requirement. |
| --- | --- | --- |
| **OUT\_OF\_STOCK status transition ownership** | product\_status enum includes OUT\_OF\_STOCK (Schema §3). REQ-F-Inv-003 says stock=0 listings display an out-of-stock state and are hidden from default results — but no document states *whether this is a seller-manual toggle or a system-derived transition*, and no dedicated product state-machine is named in TRD §3 (only Order and Return lifecycles are named there). | **Assumption:** LIVE ↔ OUT\_OF\_STOCK is **system-derived** from stock reaching/leaving zero (automatic, on every stock mutation) — not a seller-settable value. DRAFT and REMOVED remain explicit seller/system actions (publish, soft-delete). This keeps status consistent with stock at all times without a manual sync step. |
| --- | --- | --- |
| **Autocomplete trigger length** | REQ-F-Browse-002: "Autocomplete suggestions after **N** characters" — PRD leaves N as a literal placeholder, never resolved to a number. | **Assumption:** N = 2 characters, matching platform\_config-style tunability (stored as a frontend constant, not hardcoded magic-number-in-component, per Feature 0 Task 6's no-magic-values rule). Flagged for product/UX sign-off. |
| --- | --- | --- |
| **Seller-rating search filter** | REQ-F-Browse-003 lists "seller rating" as a filter dimension. Reviews/ratings (reviews table) are explicitly **R1.1** (REQ-F-Browse-004, F16) — no rating data exists in MVP. | **Assumption:** the filter UI element is scaffolded (per the full REQ-F-Browse-003 spec) but is a **no-op / disabled** control until the Reviews feature ships — it must not silently error or return empty results when touched prematurely; it is hidden or visibly marked "coming soon" instead. |
| --- | --- | --- |
| **Storefront image key convention** | TRD §28 names object storage adapter methods (upload(), getUrl()) but no key-naming convention for product images specifically (Feature 2/3 set precedents for avatars/branding, not products). | **Engineering Decision (consistent with prior precedent):** products/{product\_id}/{position}-{uuid}.ext, reusing the same adapter Feature 2/3 already wired (TRD §28, MinIO in dev per Feature 0's patch) — no new storage mechanism introduced. |
| --- | --- | --- |

### **Product Management Flow**

Product Foundation

(catalog module scaffold · ownership rules · public vs seller-scoped routing)

│

▼

Category Integration

(read-only category tree/list — no create/edit surface)

│

▼

Product Creation

(AI Store Builder: photo → AI listing → editable → Draft/Publish; product detail retrieval)

│

▼

Image Management

(upload/reorder/remove product images, reusing Feature 2/3's ImageUploader pattern)

│

▼

Inventory Management

(stock field, oversell-prevention hooks, system-derived OUT\_OF\_STOCK)

│

▼

Product Editing

(edit form reusing AI Store Builder's field set · Delete/soft-delete lifecycle)

│

▼

Product Search

(tsvector full-text query · filters · sort · autocomplete)

│

▼

Product Validation & Testing

(ownership adversarial tests · lifecycle integrity · search correctness · sign-off)

Each stage depends on the one before it: Category Integration needs the module skeleton (Task 1) to attach read routes to; Product Creation needs categories (Task 2) to populate its category picker; Image Management acts on a product row that must already exist (Task 3); Inventory fields are part of the same row Task 3 creates but is broken out because oversell-prevention hooks and the system-derived status logic are substantial enough to isolate; Editing reuses Creation's field set and only makes sense once a product exists; Search only makes sense once real product rows (with images, stock, and status) exist to be searched; Validation closes the loop only once every prior stage is real.

## **Task 1 — Product Foundation**

### **Purpose**

-   Fill TRD §12's already-reserved but empty modules/catalog/ folder (Feature 0 Task 5) with the controller/service/repository/dto/routes skeleton, following the same reference-module pattern Feature 2/3 used.
-   Establish the **dual-visibility** routing model this domain needs — unlike Feature 2/3's strictly self-only data, products have both **public read** (Guest/Buyer/Seller/Admin can browse LIVE products, PRD §11) and **owner-only write** (Seller mutates only their own products, Schema §9) — this split must be correct before any endpoint is built.
-   Confirm the hasStore + status=ACTIVE guards from Feature 3 (Tasks 2.3, 6.4) are inherited on all product-write routes, without rebuilding that logic.

### **Dependencies**

-   Feature 0 complete (module conventions, envelope, error middleware, ownership-middleware pattern, object-storage adapter).
-   Feature 3 complete (hasStore flag, Seller status guard — reused directly).
-   Database schema already migrated in full (Implementation Plan Phase 4) — products, product\_images, categories tables and their enums already exist; **no new migration is needed for this feature's baseline** (unlike Features 2/3, which each added one gap-fill column).

### **Expected Deliverables**

-   \[ \] apps/api/src/modules/catalog/ populated: catalog.controller.ts, catalog.service.ts, catalog.repository.ts, catalog.routes.ts, catalog.dto.ts
-   \[ \] Two route groups registered: GET /api/v1/products\* (public, no auth required) and /api/v1/seller/products\* (Seller-role-gated, owner-only)
-   \[ \] product\_images UQ (product\_id, position) constraint confirmed active (per the Documentation Gaps Assumption)
-   \[ \] Ownership + hasStore + status=ACTIVE guard chain applied to all seller/products\* write routes

### **Implementation Checklist**

**1.1 — Confirm the existing schema (no migration needed)**

-   **Objective:** verify products/product\_images/categories are already live in the DB exactly per Schema Doc §4.5–4.7, before writing any query code against them.
-   **Action:** Run prisma studio or \\d products against the dev DB; cross-check every column/enum/index against Schema §4.5–4.7 and §3 (product\_status, product\_condition enums).
-   **Expected Output:** confirmed 1:1 match, or a documented discrepancy escalated before proceeding.
-   **Verification:** all columns present with correct types/defaults/constraints, including the generated search\_vector (Schema §7).
-   **Next Step:** 1.2.

**1.2 — Enforce the product\_images position constraint**

-   **Objective:** close the Documentation Gaps item — turn Schema §4.7's "consideration" into an actual enforced constraint.
-   **Action:** Add @@unique(\[productId, position\]) to the ProductImage Prisma model if not already present; migrate.
-   **Expected Output:** DB-level uniqueness on (product\_id, position).
-   **Verification:** attempting to insert two images at position=0 for the same product fails at the DB layer, not just app validation.
-   **Next Step:** 1.3.

**1.3 — Scaffold the catalog module**

-   **Objective:** create the standard layered structure, matching the Feature 0 reference pattern used by every prior feature's module.
-   **Action:** Populate apps/api/src/modules/catalog/ with the five standard files. Register two Express routers: a **public** router (no authenticate middleware) mounted at /api/v1/products, and a **seller-scoped** router mounted at /api/v1/seller/products.
-   **Expected Output:** module boots; both route groups reserved, no active endpoints yet (stubs return 501).
-   **Verification:** apps/api starts cleanly; both base paths exist.
-   **Next Step:** 1.4.

**1.4 — Apply the write-route guard chain**

-   **Objective:** every seller/products\* write route must pass, in order: authenticate → authorize(\['SELLER'\]) → hasStore check (Feature 3 Task 2.3) → status === ACTIVE check (Feature 3 Task 6.4) → ownership (seller\_id === req.user.user\_id, Schema §9) — all reused, none rebuilt.
-   **Action:** Compose Feature 3's existing guard middlewares into a single requireActiveSeller chain, applied once at the router-group level rather than per-route, then add a catalog-specific ownProduct check (loads the target product\_id, confirms seller\_id match) for routes with a :productId param.
-   **Expected Output:** one reusable guard chain attached to the seller router group.
-   **Verification:** a suspended or non-onboarded Seller's token hitting any seller/products\* write route → correctly rejected (403/422) using Feature 3's existing tested logic, not a reimplementation.
-   **Next Step:** proceed to Task 2.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Public product routes accidentally inherit the authenticate middleware from a shared router base | Keep the public and seller-scoped Express routers genuinely separate at the top level — do not nest the public router under the authenticated one "for convenience" |
| --- | --- |
| ownProduct check queries the DB before the cheaper authorize/hasStore checks run | Order the guard chain cheapest-first (role/store checks are in-memory from the JWT/profile context; ownership requires a DB read) — matches TRD §8's middleware chain order (authenticate → authorize → ownership) |
| --- | --- |

## **Task 2 — Category Integration**

### **Purpose**

-   Expose the already-seeded categories table (Schema §4.5, seeded in Implementation Plan Phase 4) for product creation's category picker — **read-only**, per the instruction to reuse rather than redesign.
-   Support the parent\_id self-referencing tree structure (Schema §4.5) so the frontend can render a category hierarchy if one exists, without assuming a flat list.
-   Provide both EN/UR labels (name\_en/name\_ur) so the bilingual category picker (needed by SCR-S02's AI Store Builder) has what it needs from day one.

### **Dependencies**

-   Task 1 complete (module + public router exist)

### **Expected Deliverables**

-   \[ \] GET /api/v1/categories — public, returns full category list/tree
-   \[ \] Response shaped for both flat-list (dropdown) and tree (nested) frontend consumption
-   \[ \] Reusable CategorySelect component consumed later by both Add Product (Task 3) and the Search filter panel (Task 7)

### **Implementation Checklist**

**2.1 — Implement the read-only categories endpoint**

-   **Objective:** surface categories data with zero write surface, confirming the "do not redesign" instruction at the API boundary.
-   **Action:** In catalog.service.ts, add listCategories() — a simple Prisma findMany on categories (no soft-delete filter needed, since Schema §4.5 explicitly has no deleted\_at: "reference data"), ordered by name\_en, including parent\_id for tree reconstruction. Register GET /api/v1/categories on the **public** router (no auth — matches PRD §11: "Browse & search products" is ✅ for Guest).
-   **Expected Output:** working endpoint returning the seeded category set.
-   **Verification:** integration test — response matches the Phase-4-seeded category rows exactly; confirm no POST/PATCH/DELETE route exists on /categories anywhere in this module (explicit negative check, mirroring Feature 3 Task 6.2's pattern for status).
-   **Next Step:** 2.2.

**2.2 — Shape the response for tree consumption**

-   **Objective:** let the frontend render a nested category picker without doing tree-reconstruction logic itself for every screen that needs it.
-   **Action:** In the service layer, build the flat DB rows into a nested tree structure (root categories with children\[\]) before returning — a pure computation over already-fetched rows, not a recursive query. Cache the result (Redis, 5-min TTL, matching TRD §19's product-listing cache pattern — categories change rarely, same caching rationale applies).
-   **Expected Output:** tree-shaped JSON response; cached.
-   **Verification:** response structure verified against categories with and without a parent\_id (root vs. child); cache-hit confirmed on second call (no DB round-trip).
-   **Next Step:** 2.3.

**2.3 — Build the shared CategorySelect component**

-   **Objective:** one component, consumed by both Add/Edit Product (Task 3/6) and Search filters (Task 7) — avoiding two separate category-picker implementations.
-   **Action:** Add apps/web/src/components/CategorySelect/ (new addition to the Feature 0 Task 8 component catalogue — update COMPONENTS.md) — an AntD TreeSelect or Select (flat, if the seeded categories are shallow/no deep nesting — confirm actual seed depth before choosing tree vs. flat UI), bilingual label rendering (name\_en/name\_ur per active language, reusing Feature 0 Task 9's i18n/theme mechanism).
-   **Expected Output:** one reusable, typed component.
-   **Verification:** renders correctly in both UR (RTL) and EN; fetches via the Task 2.1/2.2 endpoint through a TanStack Query hook (cached client-side too, matching the 5-min server cache TTL).
-   **Next Step:** proceed to Task 3.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A category create/edit UI gets built "for admin convenience" inside this feature | Out of scope — category management belongs to the Database seed process (Phase 4) or a future Admin feature; this feature is read-only by explicit instruction |
| --- | --- |
| CategorySelect duplicated per screen instead of shared | Mirrors the exact drift Feature 3 Task 4.1 warned against for uploaders — one component, multiple consumers |
| --- | --- |

## **Task 3 — Product Creation**

### **Purpose**

-   Implement the AI Store Builder end-to-end (App Flow **SCR-S02**) — the platform's flagship differentiator (PRD §1, §16) — from photo upload through AI-generated bilingual listing to Draft/Publish, per **REQ-F-Store001–007** and **REQ-AI-Store001–002**.
-   Implement the LLM fallback chain (GPT-4 Vision → GPT-3.5-turbo, **D3**) inside apps/ai-service's previously-empty /generate-listing route (Feature 0 Task 4 deliberately left this unimplemented — this task fills it).
-   Provide the product-detail retrieval endpoint immediately, since App Flow's own navigation spec requires "→ Product Detail on publish."

### **Dependencies**

-   Task 2 complete (category picker available for the listing form)
-   Feature 0's ai-service scaffold (health-check only) and object-storage adapter (TRD §28, MinIO in dev)
-   Feature 3's hasStore/status=ACTIVE guard chain (Task 1.4) — a Seller must have an active store to create products

### **Expected Deliverables**

-   \[ \] ai-service: POST /generate-listing — accepts an image, returns {title\_en, title\_ur, description\_en, description\_ur, category, tags} (REQ-AI-Store002's exact schema)
-   \[ \] api: POST /api/v1/seller/products (create as Draft) and POST /api/v1/seller/products/:id/publish
-   \[ \] api: POST /api/v1/seller/products/:id/generate-listing (orchestrates the call to ai-service)
-   \[ \] GET /api/v1/products/:publicId — public product detail retrieval
-   \[ \] SCR-S02 frontend screen: upload → progress → AI-populated editable fields → Publish/Save Draft

### **Implementation Checklist**

**3.1 — Implement the LLM client + fallback chain in ai-service**

-   **Objective:** satisfy D3/REQ-AI-Store001 — GPT-4 Vision primary, GPT-3.5-turbo fallback, switchable via config only, no code change.
-   **Action:** In apps/ai-service/app/llm/, build a provider-agnostic client reading LLM\_PRIMARY\_MODEL/LLM\_FALLBACK\_MODEL (Feature 0's .env.example, TRD §27) — attempt primary, catch failure/timeout, retry once on fallback. Enforce the output JSON schema via a Pydantic model matching REQ-AI-Store002 exactly (title\_en, title\_ur, description\_en, description\_ur, category, tags); reject/retry on schema-non-conformant LLM output.
-   **Expected Output:** llm/client.py with a single generate\_listing(image, hint=None) -> ListingSchema function.
-   **Expected Output (contd.):** unit-testable in isolation (mockable provider calls).
-   **Verification:** pytest — primary-success path, primary-failure-fallback-success path, both-fail path (raises a typed error for the API layer to handle), and schema-violation-triggers-retry path all covered.
-   **Next Step:** 3.2.

**3.2 — Expose POST /generate-listing on ai-service**

-   **Objective:** wire the 3.1 client to a FastAPI route, matching TRD §2's architecture diagram (ai-service /generate-listing, internal-only per Feature 0 Task 4's network isolation).
-   **Action:** Add the router in apps/ai-service/app/routers/, accepting an image (base64 or multipart, matching whatever the Core API forwards), calling generate\_listing(), returning the Pydantic-validated JSON.
-   **Expected Output:** working internal endpoint.
-   **Verification:** curl from inside the api container (per Feature 0 Task 4.6's established internal-reachability pattern) succeeds; from the host, unreachable (regression check on Feature 0's isolation guarantee).
-   **Next Step:** 3.3.

**3.3 — Implement product creation (Draft) on api**

-   **Objective:** persist the initial products row before AI generation runs, per App Flow SCR-S02's flow (upload → generate → editable fields belong to an existing Draft row, not a not-yet-created one) — matches REQ-F-Store006 (Draft status hides from storefront until published).
-   **Action:** POST /api/v1/seller/products — creates a minimal products row (status: DRAFT, seller\_id from req.user, stock: 0 default per Schema §4.6) immediately on first image upload, **before** AI generation completes — this gives the frontend a product\_id to attach uploaded images (Task 4) and the AI-generation call (3.4) to target.
-   **Expected Output:** working creation endpoint, returns the new Draft product's product\_id/public\_id.
-   **Verification:** integration test — creates a row with status=DRAFT, correct seller\_id ownership.
-   **Next Step:** 3.4.

**3.4 — Implement POST /seller/products/:id/generate-listing (orchestration)**

-   **Objective:** the Core API's server-side-only call to ai-service — REQ-F-Store004 (progress indicator, fields locked during generation) and REQ-F-Store005 (failure → error + Retry, blank fields for manual entry) both live here.
-   **Action:** In catalog.service.ts: validate the product belongs to the caller (ownership, Task 1.4) and is in DRAFT status → validate ≥1 image already uploaded (Task 4 dependency — if none, reject with a clear error since AI needs an image) → call ai-service's /generate-listing via internal REST (TRD §1) → on success, persist the returned fields to the products row, set ai\_generated: true (Schema §4.6) → on failure/timeout, return a DependencyError(503) (Feature 0 Task 11 hierarchy) **without** touching the row (fields stay blank/whatever the seller had, per REQ-F-Store005 — "leave fields blank for manual entry").
-   **Expected Output:** working orchestration endpoint; failure path leaves the row in a clean, editable state.
-   **Verification:** integration test — success path populates all REQ-AI-Store002 fields; simulated ai-service timeout/failure returns 503 without corrupting the Draft row; retry (re-calling the same endpoint) works cleanly.
-   **Next Step:** 3.5.

**3.5 — Enforce publish-gating and implement POST /:id/publish**

-   **Objective:** satisfy REQ-F-Store003 — publishing requires at least title, one image, and category, regardless of whether fields came from AI or manual entry.
-   **Action:** POST /seller/products/:id/publish — validates title\_en (or title\_ur) present, ≥1 product\_images row exists (Task 4 dependency), category\_id set; on pass, transitions status: DRAFT → LIVE; on fail, BusinessRuleError(422) listing exactly which requirement is missing.
-   **Expected Output:** working publish endpoint with precise validation feedback.
-   **Verification:** integration test — each of the three required fields individually missing correctly blocks publish with a specific message; all three present succeeds.
-   **Next Step:** 3.6.

**3.6 — Implement public product detail retrieval**

-   **Objective:** satisfy App Flow's "→ Product Detail on publish" navigation and SCR-B03's read requirement, using public\_id (Schema §4.6) — never the internal sequential product\_id — for the public-facing URL, consistent with the platform's established pattern (Schema §2: "public-facing references... expose a UUID/opaque public token to avoid enumerable sequential IDs," already applied to orders in Feature-adjacent work).
-   **Action:** GET /api/v1/products/:publicId on the public router — returns full product detail (bilingual fields, price, stock, condition, images ordered by position, category) **only if status = LIVE** for anonymous/buyer callers; the owning Seller (if authenticated and matching seller\_id) may also fetch their own DRAFT products through this same route for preview purposes.
-   **Expected Output:** working public detail endpoint with the owner-preview exception.
-   **Verification:** integration test — Guest fetching a DRAFT product's public\_id → 404 (not 403, to avoid leaking existence per standard practice — **Recommended Enhancement (Optional)**, since the docs don't specify 404-vs-403 here); owning Seller fetching their own DRAFT product → 200.
-   **Next Step:** 3.7.

**3.7 — Build the SCR-S02 frontend screen**

-   **Objective:** implement the full upload → AI-progress → editable-fields → publish/draft UI exactly as App Flow specifies.
-   **Action:** Build features/seller/AddProduct at /seller/products/new (Feature 0 Task 10 route): drag-and-drop upload zone (wired to Task 3.3's creation call on first file, then Task 4's image upload) → auto-trigger 3.4's generation call, showing Feature 0's progress/skeleton pattern with **all fields locked during generation** (REQ-F-Store004) → on success, fields populate and unlock; on failure, Feature 0's error+Retry pattern (REQ-F-Store005) → Publish button calls 3.5, Save Draft persists current field state without the publish-gate validation.
-   **Expected Output:** functional end-to-end Add Product screen.
-   **Verification:** manual E2E — photo upload → AI listing appears within the 30s soft target (REQ-NF-Perf002) → edit a field → Publish → redirected to Product Detail (3.6), confirming the full flow App Flow describes.
-   **Next Step:** proceed to Task 4.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Product row created only *after* AI generation succeeds, with no way to attach images beforehand | Breaks the App Flow order (images upload first, generation needs an image); 3.3's create-as-Draft-first sequencing exists specifically to avoid this chicken-and-egg problem |
| --- | --- |
| AI generation failure clears already-entered manual fields | REQ-F-Store005 requires fields to remain as-is/blank for manual entry — never destructive on failure; verify the 3.4 failure path touches nothing |
| --- | --- |
| Public detail endpoint exposes Draft products to anonymous users | Confirm the status=LIVE-or-owner check (3.6) is enforced server-side, not just hidden in the UI |
| --- | --- |

*End of Response 1 — Feature Overview, Documentation Gaps, Product Management Flow, and Tasks 1–3 complete. Awaiting confirmation before continuing with Tasks 4–6 (Image Management, Inventory Management, Product Editing).*

## **Task 4 — Image Management**

### **Purpose**

-   Implement multi-image upload/reorder/remove for product\_images (Schema §4.7), reusing the ImageUploader component generalized in Feature 3 Task 4.1 rather than building a fourth upload variant.
-   Enforce "first = primary" (App Flow SCR-S02) via the position field and the Task 1.2 unique constraint, with reordering support since sellers may want to change which image is primary after upload.
-   Compress client-side before upload and validate server-side via magic bytes, per REQ-F-Store007 and Sec-012 — identical pattern to every prior upload feature.

### **Dependencies**

-   Task 3 complete (a Draft product row must exist to attach images to — Task 3.3's create-first sequencing)
-   Feature 3 Task 4.1 (ImageUploader generalized component) — extended, not rebuilt

### **Expected Deliverables**

-   \[ \] POST /api/v1/seller/products/:id/images — upload (multi-file capable)
-   \[ \] DELETE /api/v1/seller/products/:id/images/:imageId — remove
-   \[ \] PATCH /api/v1/seller/products/:id/images/reorder — reposition (sets new position values, primary included)
-   \[ \] ImageUploader extended with a multiple + sortable mode for product use
-   \[ \] Client-side compression to <200KB before upload (REQ-F-Store007)

### **Implementation Checklist**

**4.1 — Extend ImageUploader for multi-image, sortable use**

-   **Objective:** avoid a fifth bespoke upload component; add the two capabilities (multiple, sortable) product images need that avatar/logo/banner didn't.
-   **Action:** Extend apps/web/src/components/ImageUploader/ (Feature 3 Task 4.1's shared base) with a multiple: boolean prop (accepts N files) and a sortable: boolean prop (drag-to-reorder, using a lightweight sort library or AntD's built-in list drag support). Single-image consumers (avatar/logo/banner) are unaffected — both new props default to false.
-   **Expected Output:** one component now serving four use cases (avatar, logo, banner, product images).
-   **Verification:** Feature 2/3's existing ImageUploader tests still pass unmodified; new product-mode tests added separately.
-   **Next Step:** 4.2.

**4.2 — Implement image upload (backend)**

-   **Objective:** persist uploaded images with correct position assignment, honoring the "first = primary" rule and REQ-F-Store007's compression requirement.
-   **Action:** In catalog.service.ts, add uploadProductImages(productId, sellerId, files\[\]): ownership check (Task 1.4) → magic-byte + size validation per file (Sec-012, ≤10MB pre-compression per REQ-F-Store001) → object-storage upload() per file using the Task-0-Gaps key convention products/{product\_id}/{position}-{uuid}.ext → position assigned as MAX(existing position) + 1 (or 0 if none exist yet, making it automatically primary) → insert product\_images rows. **Client-side compression to <200KB happens before the request reaches this endpoint** (REQ-F-Store007 explicitly states compression is client-side, pre-upload — the server does not re-compress, only validates).
-   **Expected Output:** working multi-file upload endpoint, correct auto-incrementing position.
-   **Verification:** integration test — first upload gets position=0; subsequent uploads increment; the Task 1.2 unique constraint prevents any duplicate-position insert path from succeeding even under a service-layer bug.
-   **Next Step:** 4.3.

**4.3 — Implement image removal with position re-sequencing**

-   **Objective:** removing an image (especially the primary one) must not leave a gap that breaks "first = primary" or violates the unique constraint on the next insert.
-   **Action:** DELETE /:id/images/:imageId — ownership + existence check → delete the product\_images row → object-storage delete (fire-and-forget, per Feature 2/3's established pattern) → **re-sequence remaining images' position values to be contiguous from 0** (a single transaction: reorder query, not N individual updates where avoidable). If the removed image was position=0 (primary), the next image (now re-sequenced to position=0) automatically becomes primary — no separate "reassign primary" step needed.
-   **Expected Output:** working removal, always leaves a contiguous, valid position sequence.
-   **Verification:** integration test — remove the primary image from a 3-image product → remaining 2 images end up at positions 0,1, contiguous, and the previously-second image is now primary.
-   **Next Step:** 4.4.

**4.4 — Implement explicit reorder (drag-to-reorder)**

-   **Objective:** let a seller change primary/order without deleting and re-uploading, per SCR-S02's "thumbnail previews" (implying reorderable, not just add/remove-only).
-   **Action:** PATCH /:id/images/reorder — accepts an ordered array of imageIds; validates the array is a complete permutation of the product's existing image IDs (no missing/extra/duplicate) → updates position for each in one transaction.
-   **Expected Output:** working reorder endpoint.
-   **Verification:** integration test — reordering \[imgC, imgA, imgB\] results in imgC.position=0 (new primary), imgA.position=1, imgB.position=2; malformed/partial arrays rejected with 422.
-   **Next Step:** 4.5.

**4.5 — Wire the SCR-S02 image section**

-   **Objective:** complete the visible upload zone from Task 3.7 with real multi-image, drag-to-reorder behavior.
-   **Action:** In features/seller/AddProduct (and, by shared-component reuse, ProductEdit in Task 6), mount ImageUploader with multiple={true} sortable={true}, wired to 4.2/4.3/4.4's endpoints via TanStack Query mutations, invalidating the product-detail query cache on any change.
-   **Expected Output:** functional multi-image management in the Add/Edit Product screens.
-   **Verification:** manual test — upload 3 images, confirm first is visually marked primary, drag to reorder, confirm persistence after refresh, remove the primary, confirm the next image takes over.
-   **Next Step:** proceed to Task 5.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Image removal leaves a position gap (e.g., 0, 2 after removing 1) | Confirm 4.3's re-sequencing transaction actually runs — a gap silently breaks the Task 1.2 unique constraint on the *next* insert if the naive MAX+1 logic is used without re-sequencing first |
| --- | --- |
| Client re-compresses already-compressed images repeatedly on edit (re-upload of an existing image) | Only run compression on genuinely new files selected by the user, not on already-persisted images being redisplayed in the uploader |
| --- | --- |

## **Task 5 — Inventory Management**

### **Purpose**

-   Implement the stock field lifecycle (Schema §4.6) with atomic decrement/restore per **REQ-F-Inv-001/002/004**, and the **system-derived** LIVE ↔ OUT\_OF\_STOCK transition established as an Assumption in the Feature Overview.
-   Provide the seller-facing stock-editing surface (Add/Edit Product forms) and the storefront-facing out-of-stock display/hiding behavior (REQ-F-Inv-003) from the same underlying field.
-   Establish the atomic decrement mechanism now, even though the actual **caller** (checkout) belongs to a different feature — this task owns the products.stock mutation logic itself, per Schema §9's ownership boundaries.

### **Dependencies**

-   Task 3 complete (products exist with a stock field to manage)

### **Expected Deliverables**

-   \[ \] stock field editable via product create/update (Task 3/6) with CHECK ≥ 0 (Schema §4.6) enforced client- and server-side
-   \[ \] decrementStock(productId, quantity) — atomic, oversell-safe service method (consumed by the future Checkout feature, defined here since it operates on products)
-   \[ \] restoreStock(productId, quantity) — for cancellation/rejected-payment flows (REQ-F-Inv-004), same ownership rationale
-   \[ \] Automatic status: LIVE ↔ OUT\_OF\_STOCK transition on every stock mutation crossing the zero boundary
-   \[ \] Out-of-stock display state on Product Detail (SCR-B03) and hidden-by-default on Search/Browse (Task 7 dependency, flagged forward)

### **Implementation Checklist**

**5.1 — Implement atomic stock decrement**

-   **Objective:** satisfy REQ-F-Inv-002 (block oversell) using a single atomic DB operation, not a read-then-write race-prone pattern — this is the exact same race-safety discipline Feature 3 Task 2.1 applied to store creation.
-   **Action:** In catalog.service.ts, add decrementStock(productId, quantity): a single Prisma updateMany (or raw conditional UPDATE ... WHERE product\_id = ? AND stock >= ?) that only succeeds if sufficient stock exists; check the affected-row count — 0 rows affected means insufficient stock, throw ConflictError(409) (matches TRD §9's 409 = "oversell" example exactly). **This method is defined here but has no caller yet** — Checkout (a separate feature) will call it at order confirmation; documented as a cross-feature contract.
-   **Expected Output:** race-safe decrement method, unit-tested in isolation (no real caller yet).
-   **Verification:** concurrency test — two simulated concurrent decrementStock calls against a product with stock=1, both requesting quantity=1 → exactly one succeeds, the other gets 409.
-   **Next Step:** 5.2.

**5.2 — Implement stock restore**

-   **Objective:** satisfy REQ-F-Inv-004 — symmetric to decrement, for cancellation/rejected-payment paths (also cross-feature callers, defined here for the same ownership reason).
-   **Action:** Add restoreStock(productId, quantity) — atomic increment, no lower-bound concern (increments are always safe), but should re-trigger the OUT\_OF\_STOCK→LIVE transition check (5.3) if stock moves from 0 to positive.
-   **Expected Output:** working restore method.
-   **Verification:** unit test — restoring stock on a currently-OUT\_OF\_STOCK product flips it back to LIVE automatically.
-   **Next Step:** 5.3.

**5.3 — Implement the system-derived status transition**

-   **Objective:** close the Documentation Gaps Assumption — every stock mutation (decrement, restore, or a direct seller edit via Task 6) automatically keeps status in sync with stock, so no manual toggle can drift from reality.
-   **Action:** Create a single shared internal function syncStockDerivedStatus(productId) (or inline logic within the same transaction as any stock mutation) — after any stock change: if stock === 0 and status === LIVE → set status = OUT\_OF\_STOCK; if stock > 0 and status === OUT\_OF\_STOCK → set status = LIVE. **Does not touch DRAFT or REMOVED** — those remain explicit seller/system actions, unaffected by stock changes (a Draft product with 0 stock stays Draft).
-   **Expected Output:** one shared transition function, called from 5.1, 5.2, and Task 6's stock-edit path — never duplicated logic.
-   **Verification:** integration test matrix: LIVE + stock→0 ⇒ OUT\_OF\_STOCK; OUT\_OF\_STOCK + stock→positive ⇒ LIVE; DRAFT + stock→0 ⇒ stays DRAFT (no incorrect transition).
-   **Next Step:** 5.4.

**5.4 — Enforce CHECK ≥ 0 at every write path**

-   **Objective:** confirm Schema §4.6's stock INTEGER NN, D 0, CHECK ≥ 0 is honored by every entry point that can touch stock — creation (Task 3), direct seller edit (Task 6), decrement (5.1), restore (5.2).
-   **Action:** Add Zod validation (.int().min(0)) on any direct seller-facing stock-edit input (Task 6); confirm the DB CHECK constraint itself is present (it should already exist from the Phase-4 migration — this is a verification step, not a new migration) as the final backstop even if application validation is somehow bypassed.
-   **Expected Output:** confirmed defense-in-depth (Zod + DB constraint).
-   **Verification:** attempt a raw negative-stock update bypassing the service layer (direct Prisma call in a test) → DB rejects it, proving the constraint is truly active, not just assumed.
-   **Next Step:** proceed to Task 6.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| decrementStock implemented as findUnique → check in app code → update (two round-trips) | Race-condition-prone under concurrent checkout attempts — must be one atomic conditional UPDATE, mirroring Feature 3 Task 2.1's DB-constraint-first philosophy applied to a different constraint type |
| --- | --- |
| Status transition logic duplicated separately in decrement, restore, and edit code paths | Extract to the single syncStockDerivedStatus function (5.3) — three copies drift the moment one is bug-fixed and the others aren't |
| --- | --- |
| A seller manually sets status: OUT\_OF\_STOCK on a product with stock > 0 via the edit form | Per the Task 0 Assumption, OUT\_OF\_STOCK must not appear as a seller-selectable option in the Task 6 edit form's status control — it is a read-only, system-computed display value |
| --- | --- |

## **Task 6 — Product Editing**

### **Purpose**

-   Implement PATCH/edit for existing products (App Flow **SCR-S04**), reusing Task 3's field set and validation rather than defining a parallel schema — App Flow itself states SCR-S04 "mirrors" SCR-S02.
-   Implement Delete (soft-delete, per Schema §8) with the "block hard delete if active orders exist" rule from App Flow **SCR-S03**'s documented edge case.
-   Build the Products list screen (**SCR-S03**) as the entry point to both Edit and Delete, since neither makes sense without a list to launch from.

### **Dependencies**

-   Task 3 (Product Creation — field set/validation reused), Task 4 (Image Management — re-run on edit), Task 5 (Inventory — stock edit path plugs into 5.3/5.4 here)

### **Expected Deliverables**

-   \[ \] GET /api/v1/seller/products — seller's own product list (paginated, filterable by status)
-   \[ \] PATCH /api/v1/seller/products/:id — edit (reuses Task 3's DTO)
-   \[ \] POST /api/v1/seller/products/:id/unpublish — LIVE → DRAFT (explicit seller action, distinct from the system-derived OUT\_OF\_STOCK transition)
-   \[ \] DELETE /api/v1/seller/products/:id — soft-delete, with active-order guard
-   \[ \] SCR-S03 (Products list) and SCR-S04 (Edit) frontend screens

### **Implementation Checklist**

**6.1 — Implement GET /seller/products (list)**

-   **Objective:** power SCR-S03's table/grid — seller's own products only, with status filter and search, using cursor/limit pagination per TRD §9.
-   **Action:** In catalog.service.ts, add listSellerProducts(sellerId, filters) — WHERE seller\_id = req.user.user\_id (ownership baked into the query, not a post-fetch filter), optional status filter, paginated (limit/cursor per TRD §9, default 20).
-   **Expected Output:** working paginated list endpoint.
-   **Verification:** integration test — Seller A's call never returns Seller B's products, even without an explicit seller\_id query param (ownership is implicit from the auth token, not client-supplied).
-   **Next Step:** 6.2.

**6.2 — Implement PATCH /seller/products/:id (edit)**

-   **Objective:** reuse Task 3's field-level Zod schema for editable fields (title, description, category, price, condition, tags) plus Task 5's stock-edit path (5.4's validation), as one combined PATCH — not a re-derived schema.
-   **Action:** Extend catalog.dto.ts's update schema to reference/extend the same field validators Task 3.3–3.5 already defined (import, don't duplicate) + Task 5.4's stock validator. Service method: ownership check (Task 1.4) → apply partial update → if stock was included in the payload, run 5.3's syncStockDerivedStatus in the same transaction. **status itself is never a directly-PATCH-able field** — LIVE/DRAFT/OUT\_OF\_STOCK/REMOVED transitions only occur via 3.5 (publish), 6.3 (unpublish), 5.3 (stock-derived), or 6.4 (delete) — never a raw status write, closing the same class of gap Feature 3 Task 6.2 closed for store status.
-   **Expected Output:** working edit endpoint; status field explicitly rejected/stripped if present in a raw PATCH body.
-   **Verification:** integration test — editing title/price/stock succeeds; attempting PATCH { status: "LIVE" } directly is a no-op (field ignored, per Zod's unknown/disallowed-field stripping, TRD §9) — confirmed via an explicit adversarial test, mirroring Feature 3 Task 6.2's pattern.
-   **Next Step:** 6.3.

**6.3 — Implement explicit unpublish**

-   **Objective:** give the seller a deliberate LIVE → DRAFT action (App Flow SCR-S03: "row actions Edit/Unpublish/Delete") distinct from the automatic stock-driven OUT\_OF\_STOCK state — a seller might want to pull a listing entirely regardless of stock level.
-   **Action:** POST /:id/unpublish — ownership check → status: LIVE → DRAFT (only valid from LIVE; reject if already DRAFT/REMOVED with a clear message). Re-publishing later goes back through Task 3.5's publish endpoint (same gate re-validated — title/image/category still required, in case they were removed while in Draft).
-   **Expected Output:** working unpublish endpoint.
-   **Verification:** integration test — LIVE → DRAFT succeeds; unpublishing an already-Draft product returns a clear 422, not a silent no-op.
-   **Next Step:** 6.4.

**6.4 — Implement soft-delete with active-order guard**

-   **Objective:** satisfy Schema §8 (products are soft-deletable) and App Flow SCR-S03's explicit edge case — "deleting a product with active orders → block hard delete, soft-delete + hide from storefront, keep order history intact" (which also matches Schema §5's order\_items → products **RESTRICT** on delete — hard delete would violate that FK regardless, so soft-delete is the only viable mechanism here, not merely a UX choice).
-   **Action:** DELETE /:id — ownership check → set deleted\_at = now() (soft delete, Feature 0/Schema §8's global pattern — no new deletion mechanism invented) → product automatically excluded from all reads via the Prisma soft-delete middleware (Schema §8) → **no active-order check is actually needed as a pre-condition**, since soft-delete never touches order\_items' RESTRICT-protected FK at all; this endpoint is safe to call unconditionally. Confirm existing order\_items.title\_snapshot/unit\_price (Schema §4.11) already preserve history independent of the live products row, satisfying "keep order history intact" without extra logic here.
-   **Expected Output:** working soft-delete endpoint.
-   **Verification:** integration test — delete a product with an existing order\_items reference → succeeds (soft-delete only) → confirm the historical order still displays correct snapshot data (title/price at purchase time) despite the product being soft-deleted → confirm the product no longer appears in GET /seller/products (Task 6.1) or public search (Task 7).
-   **Next Step:** 6.5.

**6.5 — Build SCR-S03 (Products list) and SCR-S04 (Edit) screens**

-   **Objective:** complete the seller-facing management surface — list, edit, unpublish, delete, all in one screen pair.
-   **Action:** Build features/seller/Products at /seller/products (table/grid, status filter, search — Task 6.1) with row actions (Edit → /seller/products/:id/edit, Publish/Unpublish → 3.5/6.3, Delete → 6.4 with a confirm dialog per App Flow's "confirm dialog" note). Build features/seller/ProductEdit at /seller/products/:id/edit, reusing Task 3.7's AddProduct form components (same field set, same ImageUploader instance from Task 4, pre-populated) — **can re-run AI on a new image**, per App Flow SCR-S04, by calling Task 3.4's generation endpoint again against the existing product ID.
-   **Expected Output:** functional Products list + Edit screens, sharing the Add Product form's building blocks rather than duplicating them.
-   **Verification:** manual E2E — edit a live product's price, confirm storefront reflects the change immediately (cache-bust, TRD §19); delete a product with an order history, confirm the order still shows correct historical data; empty-state ("No products yet — add your first with the AI Store Builder") confirmed for a seller with zero products.
-   **Next Step:** proceed to Task 7.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| PATCH schema built independently of Task 3's create schema, drifting over time (e.g., a field validated differently on create vs. edit) | Import/extend Task 3's Zod schemas (.partial() for edit), never redefine field rules a second time |
| --- | --- |
| A raw status field silently accepted through the edit PATCH, allowing a seller to self-set OUT\_OF\_STOCK or bypass the publish-gate by writing LIVE directly | Confirmed as an explicit adversarial test in 6.2 — this is the product-domain equivalent of Feature 3 Task 6.2's status-mutation lockdown and must receive the same rigor |
| --- | --- |
| Editing a live product doesn't bust the product cache (TRD §19, 5-min TTL) | Explicitly invalidate the Redis cache key for the product on every successful edit — a 5-minute stale window on price/stock changes is a real business-correctness issue (buyer could see stale price at checkout) |
| --- | --- |

*End of Response 2 — Tasks 4–6 complete. Awaiting confirmation before continuing with Tasks 7–8 (Product Search, Product Validation & Testing), followed by the final Table of Contents update, cross-reference verification, and consistency check against Features 0–3.*

## **Task 7 — Product Search**

### **Purpose**

-   Implement full-text bilingual search over the search\_vector generated column (Schema §7), satisfying **REQ-F-Browse-001/002/003** — no separate search engine, per **D1**.
-   Implement filters (category, price range, condition) and sort (relevance/price/newest/rating — rating scaffolded-but-disabled per the Feature Overview's Documentation Gap), and the storefront-facing out-of-stock hiding rule from Task 5.
-   Build **SCR-B02** (Search Results/Browse), consuming Task 2's CategorySelect for the filter panel and completing the public read side of this feature.

### **Dependencies**

-   Task 2 complete (CategorySelect, reused in the filter panel)
-   Task 5 complete (OUT\_OF\_STOCK/status logic — search must respect both status=LIVE visibility and the "hide out-of-stock by default" rule)
-   Task 6 complete (soft-deleted/unpublished products must not appear in results — confirms the exclusion path already works)

### **Expected Deliverables**

-   \[ \] GET /api/v1/products/search — tsvector full-text query, public
-   \[ \] Filters: category, price range, condition (seller-rating filter scaffolded, disabled per Gaps)
-   \[ \] Sort: relevance (default), price, newest; rating sort scaffolded, disabled
-   \[ \] GET /api/v1/products/autocomplete — suggestions after N=2 chars (Assumption)
-   \[ \] SCR-B02 frontend screen: result grid, filter panel, infinite scroll

### **Implementation Checklist**

**7.1 — Implement the full-text search query**

-   **Objective:** query the pre-built search\_vector (Schema §7's setweight/to\_tsvector('simple', ...) generated column) — no new indexing logic invented, this task only **queries** what the Database phase already built.
-   **Action:** In catalog.repository.ts, build a raw/Prisma-$queryRaw query against search\_vector @@ plainto\_tsquery('simple', unaccent(:query)) (Schema §7's noted unaccent query-time normalization), ranked via ts\_rank, filtered to status = 'LIVE' AND deleted\_at IS NULL (using the existing partial idx\_products\_live index, Schema §4.6) — matching REQ-NF-Perf003's <1s target at ≤100k listings.
-   **Expected Output:** working ranked full-text query function.
-   **Verification:** integration test — a query in Urdu script matches Urdu title\_ur/description\_ur content; an English query matches English fields; irrelevant terms return empty, not an error.
-   **Next Step:** 7.2.

**7.2 — Implement filters and sort**

-   **Objective:** satisfy REQ-F-Browse-003's exact filter/sort list, using existing indexed columns (idx\_products\_category, idx\_products\_price) — no new indexes invented.
-   **Action:** Extend the search query builder with optional WHERE clauses: category\_id (exact match), price BETWEEN min AND max (validate min ≤ max, Zod, mirroring App Flow SCR-B02's stated validation), condition (enum match). Sort: relevance (default, ts\_rank DESC), price (asc/desc), newest (created\_at DESC). **rating sort/filter accepted in the DTO but is a documented no-op** (per the Feature Overview Gap) — if selected, falls back to relevance silently rather than erroring, with a code comment explaining why.
-   **Expected Output:** composable filter/sort query.
-   **Verification:** integration test per filter dimension individually, plus one combined-filter test (category + price range + condition together).
-   **Next Step:** 7.3.

**7.3 — Enforce out-of-stock hiding (REQ-F-Inv-003)**

-   **Objective:** confirm search results respect Task 5's stock-derived status — OUT\_OF\_STOCK products are hidden from **default** results but still reachable via direct product-detail link (Task 3.6 already handles direct access; this is search-listing-specific).
-   **Action:** Default search query excludes status = 'OUT\_OF\_STOCK' (only status = 'LIVE' shows by default, per REQ-F-Inv-003's "hide from default storefront results when stock = 0" — **Assumption:** "default" implies no explicit toggle exists in the source docs to *show* out-of-stock items in search; none is built, since none is specified).
-   **Expected Output:** confirmed exclusion.
-   **Verification:** integration test — a product with stock=0 (and thus status=OUT\_OF\_STOCK per Task 5.3) does not appear in search results, but its direct detail page (Task 3.6) still loads with an out-of-stock indicator.
-   **Next Step:** 7.4.

**7.4 — Implement autocomplete**

-   **Objective:** satisfy REQ-F-Browse-002 using the Assumption's N=2 trigger length, cached for speed (TRD §19's "search autocomplete: short TTL" cache entry).
-   **Action:** GET /products/autocomplete?q= — lightweight tsvector prefix query (or a simpler ILIKE-with-index approach if tsquery prefix matching proves awkward for partial-word autocomplete — **Engineering Decision**, since Schema §7 doesn't prescribe an autocomplete-specific query shape, only the full-search shape), returns top N title matches, cached briefly per TRD §19.
-   **Expected Output:** working autocomplete endpoint.
-   **Verification:** frontend only fires the request once the query reaches the N=2 constant (defined once, per Feature 0 Task 6's no-magic-values rule — a named constant, not a hardcoded 2 in the component).
-   **Next Step:** 7.5.

**7.5 — Build the SCR-B02 frontend screen**

-   **Objective:** implement the result grid, filter panel, sort selector, and infinite scroll exactly as App Flow specifies, reusing CategorySelect (Task 2.3) and Feature 0's shared components (ProductCard, Skeleton, EmptyState).
-   **Action:** Build features/buyer/SearchResults at /search and /category/:slug (Feature 0 Task 10 routes): search bar with autocomplete (7.4) → filter panel (category via CategorySelect, price range, condition; **rating filter rendered visually disabled/"coming soon"** per the Gaps entry, not hidden entirely, so the documented REQ-F-Browse-003 requirement is visibly acknowledged as pending) → sort selector → ProductCard grid with infinite scroll (cursor-based, matching TRD §9's pagination convention) → empty state ("No products match your search. Try fewer filters." per App Flow, with a reset CTA).
-   **Expected Output:** functional search/browse screen.
-   **Verification:** manual E2E — Urdu query returns Urdu-titled products; combined filters narrow results correctly; result count matches App Flow's "<1s" target under a reasonable local dataset; empty/loading/error states all present per App Flow §0.
-   **Next Step:** proceed to Task 8.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Search query omits the status = 'LIVE' / deleted\_at IS NULL filter, leaking Draft/Removed/soft-deleted products into public results | Confirm 7.1's base WHERE clause is applied before any filter/sort composition, not appended optionally |
| --- | --- |
| Rating sort/filter silently errors (500) instead of gracefully no-op-ing to relevance | Explicitly handle the "not yet implemented" case in the DTO/service — an R1.1 feature stub must degrade gracefully, not crash, per REQ-NF-Safety-003/004's graceful-degradation principle |
| --- | --- |
| tsvector query performance untested until production, missing the <1s target silently | Confirm EXPLAIN ANALYZE is run against the idx\_products\_search GIN index (Schema §7) during this task, not deferred entirely to Phase 12 (Optimization) — a basic sanity check belongs here even though full optimization is a later phase |
| --- | --- |

## **Task 8 — Product Validation & Testing**

### **Purpose**

-   Independently re-verify Tasks 1–7 against their own deliverables, mirroring the closing pattern of every prior feature (0/2/3).
-   Specifically test the three integrity-critical guarantees this feature makes: seller-ownership isolation, atomic stock/oversell safety, and the status state-machine's correctness (publish-gate, system-derived transitions, blocked direct writes).
-   Produce the sign-off artifact enabling the next dependent feature (Cart & Checkout, which calls decrementStock/restoreStock as a cross-feature contract from Task 5) to begin safely.

### **Dependencies**

-   Tasks 1–7 complete

### **Expected Deliverables**

-   \[ \] Full integration test suite for all catalog module routes (public + seller-scoped)
-   \[ \] Cross-seller ownership adversarial test set
-   \[ \] Stock/oversell concurrency adversarial test (extends Task 5.1's isolated test into the full suite)
-   \[ \] Status state-machine adversarial test set (publish-gate, direct-write rejection, system-derived transitions)
-   \[ \] FEATURE\_4\_CHECKLIST.md — consolidated sign-off, evidenced per task
-   \[ \] Coverage confirmed ≥80% for the catalog module (REQ-NF-Quality-003)

### **Implementation Checklist**

**8.1 — Run the full catalog integration suite**

-   **Objective:** confirm every endpoint from Tasks 1–7 behaves correctly, public and seller-scoped, individually and in combination.
-   **Action:** Execute/write Supertest suites: categories (Task 2), create/generate-listing/publish/detail (Task 3), image upload/remove/reorder (Task 4), decrement/restore/status-sync (Task 5), list/edit/unpublish/delete (Task 6), search/filter/sort/autocomplete (Task 7).
-   **Expected Output:** green suite, one describe-block per task.
-   **Verification:** pnpm --filter api test -- catalog — all pass; coverage report confirms the catalog module ≥80% (REQ-NF-Quality-003).
-   **Next Step:** 8.2.

**8.2 — Cross-seller ownership adversarial test**

-   **Objective:** prove Task 1.4's ownership guard chain holds across every seller-scoped write route, not just the ones spot-checked during development.
-   **Action:** Test matrix: Seller A creates a product; Seller B's token attempts PATCH, DELETE, image upload/remove/reorder, unpublish, and generate-listing against Seller A's product\_id → every single one rejected 403, none silently succeed or return 404 (which would incorrectly suggest the product doesn't exist rather than that access is denied — **Assumption:** unlike Task 3.6's deliberate 404-for-anonymous-Draft-access, cross-seller write attempts should return 403 since the requester is authenticated and the ownership boundary, not existence, is what's being enforced — consistent with TRD §8's stated 403 semantics for "not owner").
-   **Expected Output:** confirmed isolation across all seller-write routes.
-   **Verification:** all sub-cases pass as explicitly named test cases (not a single generic "ownership works" assertion).
-   **Next Step:** 8.3.

**8.3 — Stock/oversell concurrency adversarial test (full-suite integration)**

-   **Objective:** fold Task 5.1's isolated concurrency test into the permanent regression suite, and extend it to the restore path.
-   **Action:** Add as permanent named tests: N-concurrent-decrementStock-calls-exceeding-available-stock (only the exact affordable count succeed, rest 409); restoreStock correctly flips OUT\_OF\_STOCK → LIVE under a concurrent decrement racing a restore (order-independent correctness — final state matches final stock value, regardless of operation interleaving).
-   **Expected Output:** these run on every future CI execution.
-   **Verification:** confirmed present in the committed test file.
-   **Next Step:** 8.4.

**8.4 — Status state-machine adversarial test set**

-   **Objective:** consolidate every status-integrity guarantee from Tasks 3, 5, and 6 into one explicit, permanent test group — this is the product-domain equivalent of Feature 3 Task 7.4's status-boundary regression suite.
-   **Action:** Add as permanent named tests: publish blocked when title/image/category individually missing (Task 3.5, three sub-cases); direct PATCH { status: ... } is a no-op regardless of target value (Task 6.2); stock reaching 0 auto-transitions LIVE → OUT\_OF\_STOCK and reverse (Task 5.3); a DRAFT product's stock reaching 0 does **not** incorrectly transition to OUT\_OF\_STOCK (Task 5.3's exclusion case); unpublishing an already-DRAFT product is rejected, not a silent no-op (Task 6.3).
-   **Expected Output:** comprehensive, named, permanent state-machine test coverage.
-   **Verification:** confirmed present and green.
-   **Next Step:** 8.5.

**8.5 — Cross-check against App Flow UI states and Features 0–3 boundaries**

-   **Objective:** confirm SCR-S02/S03/S04/B02 all honor App Flow's documented loading/empty/error states, and that no functionality from Features 0–3 (shared components, guards, upload pattern) was duplicated rather than reused.
-   **Action:** Manually walk all four screens against App Flow's per-screen spec (progress locks during AI generation, Retry-on-failure, confirm-dialog on delete, empty states with correct copy per screen). Separately, grep the codebase: confirm no second ImageUploader-equivalent exists, no second ownership-middleware implementation exists, no duplicate ownership/ hasStore check was written from scratch instead of reusing Feature 3's.
-   **Expected Output:** pass/fail note per screen; a short "reuse audit" confirming zero duplicated infrastructure.
-   **Verification:** any regression or duplication found is fixed/consolidated here, not deferred.
-   **Next Step:** 8.6.

**8.6 — Consolidate FEATURE\_4\_CHECKLIST.md**

-   **Objective:** produce the sign-off artifact, mirroring the exact pattern used by Features 0, 2, and 3.
-   **Action:** Create FEATURE\_4\_CHECKLIST.md — one section per Task (1–8), each Expected Deliverable checked off with evidence; include the Documentation Gaps & Assumptions table with final status per row (position-UQ enforcement, max-images-no-cap, OUT\_OF\_STOCK derivation, autocomplete N=2, rating-filter-stub, storage key convention — each needs explicit confirmed/open status); explicitly note the **cross-feature contract** decrementStock/restoreStock expose for the future Cart & Checkout feature to consume.
-   **Expected Output:** committed, fully checked-off checklist.
-   **Verification:** both developers sign off; any unresolved assumption flagged as an open item for the next feature.
-   **Next Step:** Feature 4 complete.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Coverage measured at whole-repo level (same recurring pitfall from Features 2/3) | Scope coverage explicitly to the catalog module before sign-off |
| --- | --- |
| decrementStock/restoreStock treated as "internal, no test needed since no caller exists yet" | These are a documented cross-feature contract (8.6) — they must be fully tested now, since Checkout will consume them as a black box later without re-verifying their internals |
| --- | --- |

## **Final Consistency Pass**

### **1\. Table of Contents (updated, final)**

1.  [Feature Overview](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#feature-overview) 0.1. [Documentation Gaps & Assumptions](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#documentation-gaps--assumptions) 0.2. [Product Management Flow](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#product-management-flow)
2.  [Task 1 — Product Foundation](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-1--product-foundation)
3.  [Task 2 — Category Integration](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-2--category-integration)
4.  [Task 3 — Product Creation](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-3--product-creation)
5.  [Task 4 — Image Management](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-4--image-management)
6.  [Task 5 — Inventory Management](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-5--inventory-management)
7.  [Task 6 — Product Editing](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-6--product-editing)
8.  [Task 7 — Product Search](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-7--product-search)
9.  [Task 8 — Product Validation & Testing](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-8--product-validation--testing)

### **2\. Cross-Reference Verification**

| **Check** | **Result** |
| --- | --- |
| Organized by implementation dependency, not the feature-brief's list order | ✅ Foundation → Category → Creation → Images → Inventory → Editing → Search → Validation; each task's "Dependencies" names exact prior task(s) |
| --- | --- |
| Categories reused, never redesigned | ✅ Task 2 is strictly read-only; explicit negative test (2.1) confirms no create/edit route exists |
| --- | --- |
| Products scoped to owning seller only, enforced at the query and guard layer | ✅ Task 1.4's guard chain (reusing Feature 3's hasStore/status checks) + Task 6.1's implicit-ownership query + Task 8.2's adversarial cross-seller suite |
| --- | --- |
| Schema Doc §4.5–4.7 followed exactly; one clarified-not-invented constraint (product\_images position UQ) | ✅ Task 1.2 turns Schema §4.7's "consideration" into an enforced constraint — flagged, not silently assumed |
| --- | --- |
| D1 (single Postgres, no separate search engine) honored | ✅ Task 7 queries the existing search\_vector/GIN index (Schema §7) exclusively — no new search infrastructure introduced |
| --- | --- |
| D3 (GPT-4V → GPT-3.5 fallback, confidence/schema-conformant output) honored | ✅ Task 3.1 implements the fallback chain exactly per REQ-AI-Store001/002, inside the Feature-0-reserved ai-service seam |
| --- | --- |
| No duplicate infrastructure vs. Features 0/2/3 | ✅ ImageUploader extended (Task 4.1), not rebuilt; ownership/ hasStore/status guards reused (Task 1.4) from Feature 3, not reimplemented; envelope/error/pagination conventions reused from Feature 0 throughout |
| --- | --- |
| Stock mutation methods correctly scoped as a cross-feature contract, not orphaned "dead code" | ✅ Task 5.1/5.2 explicitly documented as callable-by-Checkout-later; Task 8.6 flags this in the sign-off checklist |
| --- | --- |
| Status field never directly writable by the seller through any route | ✅ Task 6.2's explicit rejection test + Task 8.4's permanent regression coverage — same rigor pattern as Feature 3 Task 6.2 |
| --- | --- |
| Recommended-but-unsourced practices correctly labeled, distinct from Assumptions | ✅ Task 3.6's 404-vs-403-for-anonymous-Draft-access and Task 7.4's autocomplete query-shape choice are the only two **Engineering Decisions**/**Recommended Enhancement** items outside the formal Gaps table — both clearly labeled inline, not presented as binding requirements |
| --- | --- |

### **3\. Remaining Assumptions & Unresolved Documentation Gaps (carried into FEATURE\_4\_CHECKLIST.md for sign-off)**

| **#** | **Item** | **Status** | **Needs** |
| --- | --- | --- | --- |
| 1 | product\_images (product\_id, position) treated as a hard UQ constraint, not merely a "consideration" | Implemented | Schema-owner confirmation it matches intent |
| --- | --- | --- | --- |
| 2 | No max-images-per-product cap enforced | Implemented (uncapped) | Product/UX sign-off if a cap is later desired (Recommended Enhancement, not built) |
| --- | --- | --- | --- |
| 3 | OUT\_OF\_STOCK is system-derived from stock, never seller-settable | Implemented | Schema-owner/PRD-owner confirmation — no TRD state machine names this transition explicitly, this is the playbook's own reading of REQ-F-Inv-003 |
| --- | --- | --- | --- |
| 4 | Autocomplete trigger length N = 2 | Implemented as a named constant | PRD explicitly leaves N unresolved — needs a real product decision |
| --- | --- | --- | --- |
| 5 | Seller-rating search filter/sort scaffolded but non-functional (Reviews is R1.1) | Implemented as disabled/no-op | Must be revisited when the Reviews feature (F16) ships — tracked as a forward dependency, not closed here |
| --- | --- | --- | --- |
| 6 | Product image storage key convention (products/{id}/{position}-{uuid}.ext) | Implemented | No conflicting convention exists elsewhere — low risk, but not literally specified in TRD §28 |
| --- | --- | --- | --- |
| 7 | Anonymous access to a Draft product's public\_id returns 404 (not 403) | Implemented | Not specified in source docs — a defensible security-through-non-disclosure default, flagged as a Recommended Enhancement / Engineering Decision, not a documented requirement |
| --- | --- | --- | --- |
| 8 | Autocomplete query mechanism (prefix tsquery vs. ILIKE) left as an implementation-level choice | Implemented | Schema §7 only specifies the full-search shape; autocomplete's exact query form is unspecified |
| --- | --- | --- | --- |

**Feature 4.md — Product Management Engineering Execution Playbook is complete.** All 8 tasks follow the required dependency sequence, reuse Features 0–3's infrastructure (guards, uploader, envelope, error handling, routing, categories-as-reference-data) without duplication, and every deviation from literal document text is transparently logged as an Assumption or Engineering Decision pending sign-off in FEATURE\_4\_CHECKLIST.md. The decrementStock/restoreStock cross-feature contract is explicitly documented for the upcoming Cart & Checkout feature to consume. Ready for the team to execute following Features 0–3.