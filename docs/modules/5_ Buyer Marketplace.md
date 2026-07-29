# **KarobarAI — Engineering Execution Playbook**

## **Feature 5: Buyer Marketplace**

**Source of truth:** PRD · TRD · App Flow · Backend Schema · Implementation Plan (Docs 1–6). No architecture, schema, API contract, business rule, workflow, or folder structure is invented beyond what these documents specify. Gaps are marked **Assumption**; reuse-vs-extend calls are marked **Engineering Decision**.

**Depends on:** Feature 0 (Foundation), Feature 1 (Authentication), Feature 4 (Product Management — Category read endpoint, Product search/detail endpoints, catalog module, CategorySelect/ProductCard components).

**Scope confirmation:** Wishlist is **dropped from this feature** per explicit direction — PRD §12.11 (REQ-F-Browse-005), §15 (F17), and App Flow SCR-B03 all scope Wishlist as **Future**, not MVP. It is deferred to its own future feature and logged in the Documentation Gaps table below, not built here even as a stub.

## **Table of Contents**

1.  [Feature Overview](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#feature-overview) 0.1. [Pre-Generation Reuse Review](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#pre-generation-reuse-review) 0.2. [Documentation Gaps & Assumptions](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#documentation-gaps--assumptions) 0.3. [Buyer Marketplace Flow](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#buyer-marketplace-flow)
2.  [Task 1 — Marketplace Foundation](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-1--marketplace-foundation)
3.  [Task 2 — Homepage](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-2--homepage)
4.  [Task 3 — Category Integration](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-3--category-integration)
5.  Task 4 — Marketplace Search *(pending)*
6.  Task 5 — Product Listing *(pending)*
7.  Task 6 — Product Details & Filters *(pending)*
8.  Task 7 — Validation & Testing *(pending)*

## **Feature Overview**

**What Feature 5 covers:** the buyer-facing, read-only discovery surface — App Flow **SCR-B01** (Home/Storefront), **SCR-B02** (Search Results/Browse), **SCR-B03** (Product Detail, read-only consumption; Add-to-Cart/Buy-Now buttons are wired to the future Cart & Checkout feature, not built here). This feature is a **frontend-and-thin-orchestration layer** over Feature 4's already-complete backend — it does not introduce a new domain module.

**What it explicitly excludes (per your brief + PRD scope):**

-   Wishlist (Future, F17 — dropped per your direction above).
-   Cart/Add-to-Cart mutation logic (SCR-B04, a separate feature) — SCR-B03's Add to Cart/Buy Now buttons render but dispatch to a not-yet-built Cart feature; this task stubs the click target only.
-   Reviews (reviews, R1.1/F16) — Product Detail's review section is out of scope, matching Feature 4's own established exclusion.
-   Any Product CRUD, image mutation, inventory mutation, or category mutation — these belong exclusively to Feature 4 and are **consumed, never rebuilt**.
-   Seller-side anything — this feature is 100% Guest/Buyer-facing.

**Governing tables (Schema Doc §4):** none new. products (4.6), product\_images (4.7), categories (4.5) — all **read-only** consumption via Feature 4's existing repository methods.

### **Pre-Generation Reuse Review**

Per the instruction to review Features 0–4 before generating tasks and document overlaps as Engineering Decisions:

| **Feature 0–4 Asset** | **Exists At** | **Feature 5 Usage** |
| --- | --- | --- |
| Envelope helper, typed error hierarchy, Zod validation harness | Feature 0 Task 11 | Reused unchanged — any new endpoint in this feature (Homepage aggregation, Task 2) uses the same envelope/error conventions |
| --- | --- | --- |
| Public router pattern (authenticate optional) | Feature 4 Task 1.3 | Reused — this feature's routes mount on the **same public /api/v1/products\* router group**, not a new one |
| --- | --- | --- |
| authenticate middleware, JWT | Feature 1 | Reused only for the **optional-auth** case (a logged-in Buyer sees a personalized homepage section, per SCR-B01's guest-vs-buyer distinction) — no new auth logic |
| --- | --- | --- |
| catalog.repository.ts / catalog.service.ts | Feature 4 Task 1, 3, 7 | **Extended, not duplicated** — Task 5's Product Listing and Task 6's Product Details call Feature 4's existing repository methods directly; no parallel marketplace.repository.ts product-query logic is written |
| --- | --- | --- |
| GET /api/v1/products/search, /autocomplete | Feature 4 Task 7 | Consumed as-is by Task 4 (Marketplace Search) — no new search endpoint |
| --- | --- | --- |
| GET /api/v1/products/:publicId | Feature 4 Task 3.6 | Consumed as-is by Task 6 (Product Details) — no new detail endpoint |
| --- | --- | --- |
| GET /api/v1/categories (tree-shaped, cached) | Feature 4 Task 2.1–2.2 | Consumed as-is by Task 3 (Category Integration) — no new category endpoint |
| --- | --- | --- |
| CategorySelect component | Feature 4 Task 2.3 | Reused directly in the Filters UI (Task 6) — not rebuilt |
| --- | --- | --- |
| ProductCard component | Feature 0 Task 8 | Reused directly in Homepage (Task 2), Product Listing (Task 5) — this is its first real feature consumer since Feature 0 scaffolded it empty |
| --- | --- | --- |
| EmptyState, Skeleton, ToastProvider, ErrorBoundary | Feature 0 Task 8 | Reused for all loading/empty/error states across every screen in this feature |
| --- | --- | --- |
| Object storage adapter / product image URLs | Feature 4 Task 4 | Product images are **read via already-persisted cdn\_url values** returned by Feature 4's detail/search endpoints — this feature never calls upload()/getUrl() directly |
| --- | --- | --- |
| Routing (/, /search, /category/:slug, /product/:id) | Feature 0 Task 10 | Routes already reserved as placeholders — this feature fills them with real screens, no new route registration needed beyond what Task 10 stubbed |
| --- | --- | --- |

**Conclusion of review:** no new backend domain module is required for this feature. All backend work in Tasks 1–7 is either (a) thin composition/aggregation logic sitting on top of Feature 4's existing service methods, or (b) genuinely new only where Feature 4 has no equivalent (Homepage's featured/new-arrivals aggregation — see Task 2). This is documented as the feature's central Engineering Decision below.

**Engineering Decision — No Parallel Marketplace Module:**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Backend module structure | Extend apps/api/src/modules/catalog/ with a marketplace sub-concern (new controller/routes file, e.g. marketplace.controller.ts, but sharing catalog.service.ts/catalog.repository.ts — **not** a new modules/marketplace/ folder with its own repository) | A separate marketplace module querying products independently would duplicate Feature 4's query logic and risk drift (e.g., two places excluding OUT\_OF\_STOCK/DRAFT differently). One repository, multiple thin controllers, is consistent with the reuse-first instruction. |
| --- | --- | --- |

### **Documentation Gaps & Assumptions**

| **Gap** | **What the docs say** | **Assumption taken** |
| --- | --- | --- |
| **Homepage content composition** | App Flow SCR-B01 lists UI elements ("category grid, featured/new products") but no document specifies the exact query/ranking logic for what counts as "featured" — no is\_featured column exists in Schema §4.6. | **Assumption:** "Featured" = most-recently-published LIVE products (a proxy using existing created\_at/status, no new schema field). "New Arrivals" = the same query, explicitly labeled. This reuses Feature 4's existing list-query shape (Task 6.1's pattern) rather than inventing a new ranking field — flagged as a placeholder pending a real merchandising rule. |
| --- | --- | --- |
| **Guest vs. Buyer homepage personalization** | App Flow §0 states language/RTL apply to Guest and Buyer alike; SCR-B01 doesn't describe any content difference between a Guest and a logged-in Buyer's homepage. | **Assumption:** Homepage content is **identical** for Guest and authenticated Buyer in MVP — no personalization logic is built (no "recently viewed," no "recommended for you," none of which are named in any MVP-scoped requirement). Only the header's login-state (Login/Register vs. account menu) differs, which is Feature 1/2's existing concern, not this feature's. |
| --- | --- | --- |
| **Wishlist absence** | PRD §12.11 (REQ-F-Browse-005), §15 (F17), §17.2, App Flow SCR-B03 — all scope Wishlist as **Future**. | **Confirmed exclusion**, per explicit direction. Not built, not stubbed. Product Detail's UI (Task 6) omits any Wishlist affordance entirely (App Flow itself brackets it \[Future\], which this playbook treats as "not present in this build," consistent with how Feature 4 treated the rating-filter stub differently — rating was a *partially-built dependency* of an MVP requirement; Wishlist is a *wholly Future* feature with no MVP requirement referencing it at all, so no stub is warranted). |
| --- | --- | --- |
| **"Product Listing" vs. "Search Results" distinction** | Your brief lists "Product Listing" as its own item (#4); App Flow only names one screen, **SCR-B02**, covering both search-driven and category-driven browsing. | **Assumption:** "Product Listing" (Task 5) and "Marketplace Search" (Task 4) are **two facets of the same SCR-B02 screen and the same underlying endpoint** (GET /products/search, Feature 4 Task 7.1) — a category-only browse (no q param) is just a search call with a category\_id filter and no text query. No second listing endpoint is built. This is stated explicitly here so Task 4/5's split is understood as an implementation-sequencing split, not a data-layer split. |
| --- | --- | --- |

### **Buyer Marketplace Flow**

Marketplace Foundation

(route/controller scaffold on top of Feature 4's catalog module — no new repository)

│

▼

Homepage

(SCR-B01: featured/new-arrivals aggregation, category grid, search entry point)

│

▼

Category Integration

(category grid → /category/:slug, consuming Feature 4's category tree as-is)

│

▼

Marketplace Search

(SCR-B02 text-search path, consuming Feature 4's search endpoint as-is)

│

▼

Product Listing

(SCR-B02 category-browse path — same endpoint, category-filter-only mode)

│

▼

Product Details & Filters

(SCR-B03 consuming Feature 4's detail endpoint; SCR-B02's filter panel)

│

▼

Validation & Testing

(reuse-audit · guest-access adversarial tests · cross-check against Feature 4)

Each stage depends on the one before it: Homepage needs the route/controller seam (Task 1) to attach its aggregation endpoint to; Category Integration's grid needs a place to land clicks (Task 2's homepage); Search and Listing are sequenced after Category Integration since both consume the same category data the grid surfaces; Product Details is last among the data screens because it's the navigation target of every other screen; Validation is only meaningful once the full read-path exists end-to-end.

## **Task 1 — Marketplace Foundation**

### **Purpose**

-   Reserve the exact backend seam this feature needs — one new controller file sitting on Feature 4's existing service/repository — settling the Pre-Generation Reuse Review's Engineering Decision in code before any endpoint is written.
-   Confirm Feature 0's already-stubbed buyer routes (/, /search, /category/:slug, /product/:id) are the correct, unmodified attachment points — no new route registration.
-   Establish the optional-auth pattern (Guest and Buyer both reach the same public endpoints; auth, if present, is read but not required) needed for Task 2's minor Guest/Buyer header distinction.

### **Dependencies**

-   Feature 0 complete (routing stubs, envelope, error handling)
-   Feature 4 complete (catalog.service.ts, catalog.repository.ts, public router group, products/categories endpoints)

### **Expected Deliverables**

-   \[ \] apps/api/src/modules/catalog/marketplace.controller.ts — new file, imports catalog.service.ts (no new service/repository files)
-   \[ \] GET /api/v1/marketplace/home route reserved (implemented in Task 2)
-   \[ \] Confirmed: zero new Prisma models, zero new migrations for this feature
-   \[ \] Optional-auth middleware variant applied only where Task 2 needs it

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 1.1 | Confirm Feature 4's public router (/api/v1/products\*, /api/v1/categories) and its service/repository are reachable from a new controller file without modification | marketplace.controller.ts created, imports CatalogService | File compiles; no changes made to catalog.service.ts/catalog.repository.ts signatures |
| --- | --- | --- | --- |
| 1.2 | Register GET /api/v1/marketplace/home on the **existing public router group** (Feature 4 Task 1.3), not a new router | Route reserved, returns 501 stub via Feature 0's envelope helper | Route resolves; no authenticate middleware blocking Guest access |
| --- | --- | --- | --- |
| 1.3 | Confirm/reuse an "optional-auth" middleware variant — attaches req.user if a valid token is present, does not reject if absent | Middleware reused from Feature 1 if it already supports optional mode, or a one-line wrapper added around Feature 1's existing authenticate (not a new auth implementation) | A request with no token succeeds and req.user is undefined; a request with a valid Buyer token succeeds and req.user is populated |
| --- | --- | --- | --- |
| 1.4 | Verify Feature 0's route stubs at /, /search, /category/:slug, /product/:id still resolve unmodified | No route-table changes needed | ROUTES.md (Feature 0) requires no edits — confirms Task 1 introduced zero new frontend routes |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A new modules/marketplace/ folder with its own repository.ts gets scaffolded | Delete it — the Pre-Generation Reuse Review's Engineering Decision is explicit: one controller file, Feature 4's existing service/repository, no parallel data-access layer |
| --- | --- |
| Optional-auth middleware rebuilt from scratch instead of wrapping Feature 1's existing authenticate | Reuse Feature 1's JWT verification logic; only the "reject on missing/invalid token" behavior should differ, not the token-parsing internals |
| --- | --- |

## **Task 2 — Homepage**

### **Purpose**

-   Implement GET /api/v1/marketplace/home — a **thin aggregation** endpoint composing three calls to Feature 4's existing service methods (featured products, category list, search-bar metadata), per the Task 0 Assumption that no new ranking field exists.
-   Build **SCR-B01** exactly per App Flow: bilingual search bar with autocomplete, category grid, featured/new products, cart icon, login/register.
-   Confirm the Guest/Buyer content-parity Assumption holds — one screen, no personalization branching.

### **Dependencies**

-   Task 1 complete (controller seam, route reservation)

### **Expected Deliverables**

-   \[ \] GET /api/v1/marketplace/home — implemented, returns { featured: Product\[\], newArrivals: Product\[\], categories: CategoryTree }
-   \[ \] SCR-B01 frontend screen at / (Feature 0 Task 10's already-stubbed route)
-   \[ \] Search bar wired to Task 4's autocomplete (forward reference — implemented next task, wired here as a shared header component)
-   \[ \] Cart icon count stub (reads from a not-yet-built Cart feature — rendered as 0/placeholder, not fetched)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 2.1 | Implement getFeaturedProducts() in catalog.service.ts (extend, don't duplicate) — reuses Task 6.1's (Feature 4) list-query shape with status='LIVE', ORDER BY created\_at DESC, LIMIT 12 per the Task 0 Assumption | New service method, thin wrapper over existing query patterns | Returns only LIVE, non-deleted products, correctly excludes DRAFT/OUT\_OF\_STOCK/REMOVED (regression check against Feature 4 Task 5/6's status rules) |
| --- | --- | --- | --- |
| 2.2 | Implement the "New Arrivals" variant — **Assumption confirms this is the same query as 2.1**, so implement as a second call with a distinct LIMIT/offset or simply reuse the identical result set under a second label if the docs don't warrant true differentiation | Documented in code comment: "featured and new-arrivals are currently identical per Task 0 Assumption; differentiate when a merchandising rule exists" | No duplicate query logic — both fields in the response may legitimately return overlapping data for now, and this is intentional, not a bug |
| --- | --- | --- | --- |
| 2.3 | Implement GET /marketplace/home controller — calls 2.1/2.2 + Feature 4's listCategories() (Task 2.1, cached) in parallel (Promise.all), assembles via Feature 0's envelope helper | Working aggregation endpoint | Response shape matches the DTO; category data is the *same* cached tree Feature 4 Task 2.2 already produces — no second cache/query for categories |
| --- | --- | --- | --- |
| 2.4 | Build the SCR-B01 screen: search bar (autocomplete wired in Task 4, header rendered here), category grid (Task 3 dependency, forward-stubbed with the Task 2.3 data), featured/new product sections using the **existing ProductCard** component (Feature 0 Task 8, its first real consumer) | Functional homepage screen | Guest and authenticated-Buyer views render identically except header login-state (per Task 0 Assumption); loading skeleton (Feature 0 Skeleton) during fetch; empty state ("No products yet") if the platform has zero live products |
| --- | --- | --- | --- |
| 2.5 | Add the cart-icon placeholder (static 0 badge, no fetch) | Non-functional stub, visually present per SCR-B01's UI list | Confirmed as a stub in code comments — real cart-count wiring is the Cart & Checkout feature's responsibility, not built here |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Homepage query re-implements the status='LIVE' AND deleted\_at IS NULL filter independently instead of calling Feature 4's existing filtered-query helper | Extract/reuse the exact filter Feature 4 Task 7.1 already applies — two independently-written "what counts as visible" filters is the exact drift risk the Pre-Generation Reuse Review exists to prevent |
| --- | --- |
| Cart icon wired to a real (non-existent) endpoint, causing a 404 on every homepage load | Confirm it's a static placeholder per 2.5 — do not call a Cart API that doesn't exist yet |
| --- | --- |

## **Task 3 — Category Integration**

### **Purpose**

-   Wire the SCR-B01 category grid and the /category/:slug route to Feature 4's existing, already-cached category tree — zero new backend work, per the Pre-Generation Reuse Review.
-   Confirm /category/:slug resolves to the **same** underlying browse mechanism Task 5 (Product Listing) implements, per the Task 0 Assumption that listing and search share one endpoint.
-   Reuse CategorySelect (Feature 4 Task 2.3) for any category-narrowing UI need beyond the homepage grid (e.g., breadcrumb/sub-category nav within a category page), rather than building a second category-picker.

### **Dependencies**

-   Task 2 complete (homepage exists to host the grid)
-   Feature 4 Task 2 complete (GET /categories, tree-shaped, cached, CategorySelect component)

### **Expected Deliverables**

-   \[ \] Category grid on SCR-B01 rendering Feature 4's existing tree data (root-level categories, name\_en/name\_ur)
-   \[ \] /category/:slug route resolves the slug to a category\_id and forwards to the Task 5 listing mechanism (implemented next task; this task wires the routing/resolution only)
-   \[ \] Confirmed: no POST/PATCH/DELETE category route introduced anywhere in this feature (explicit negative check, mirroring the discipline established in Features 3/4)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 3.1 | Render the SCR-B01 category grid from Task 2.3's already-fetched category data (root-level nodes of the tree) — no separate fetch | Grid section on homepage | Grid matches the same cached data source as Feature 4 Task 2.2 — confirmed via network tab (single request, shared with homepage load) |
| --- | --- | --- | --- |
| 3.2 | Implement slug-to-category\_id resolution — categories.slug (Schema §4.5, UQ) is the natural key for the /category/:slug route; add a lightweight lookup in catalog.service.ts (findCategoryBySlug) if Feature 4 didn't already expose one | New (small) service method if missing from Feature 4, otherwise reused as-is | Resolves a valid slug to the correct category\_id; invalid slug returns a clear 404, not a crash |
| --- | --- | --- | --- |
| 3.3 | Confirm /category/:slug frontend route (Feature 0 Task 10 stub) forwards the resolved category\_id into the same listing/search UI Task 5 builds — **this task does not render its own product grid**, it only resolves the category and hands off | Route wiring only | Manually navigating to /category/:slug (once Task 5 exists) shows category-filtered results using the identical component Search Results uses |
| --- | --- | --- | --- |
| 3.4 | Explicit negative check: confirm no category mutation route exists in marketplace.controller.ts | Grep-confirmed absence | Matches Feature 4 Task 2.1's own negative check — this feature inherits, does not relax, that boundary |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A second category-fetch call fired specifically for the category grid, separate from Task 2's homepage aggregation | Wastes a request and risks cache/data mismatch — the grid must consume the same Task 2.3 response, not issue its own GET /categories call |
| --- | --- |
| /category/:slug builds a bespoke category-page layout distinct from /search's results grid | Contradicts the Task 0 Assumption explicitly stated for this feature — both must resolve to the same SCR-B02 screen/component, differing only in which filter (category vs. text query) is pre-applied |
| --- | --- |

*End of Response 1 — Feature Overview, Pre-Generation Reuse Review, Documentation Gaps, Buyer Marketplace Flow, and Tasks 1–3 complete. Awaiting confirmation before continuing with Tasks 4–5 (Marketplace Search, Product Listing).*

## **Task 4 — Marketplace Search**

### **Purpose**

-   Wire SCR-B02's text-search path directly to Feature 4's existing GET /products/search and GET /products/autocomplete endpoints (Task 7.1/7.4) — zero new search logic, per the Pre-Generation Reuse Review.
-   Complete the homepage search bar's autocomplete wiring (forward-referenced in Task 2.4).
-   Confirm result correctness (status/visibility filters, bilingual matching) is inherited automatically from Feature 4, requiring only frontend consumption here.

### **Dependencies**

-   Task 2 complete (homepage search bar exists as a UI shell)
-   Feature 4 Task 7 complete (/products/search, /products/autocomplete, ranking, status='LIVE' filtering, out-of-stock hiding — all already implemented and tested)

### **Expected Deliverables**

-   \[ \] Homepage search bar's autocomplete calls Feature 4's existing GET /products/autocomplete
-   \[ \] /search?q= route (SCR-B02, text-query mode) fully functional, calling GET /products/search
-   \[ \] Zero new backend search endpoints, zero new query logic
-   \[ \] Search result grid uses ProductCard (Feature 0 Task 8), consistent with Homepage's featured-products rendering (Task 2.4)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 4.1 | Wire the homepage search bar (Task 2.4) to GET /products/autocomplete — fires only after the N=2 constant (Feature 4 Task 7.4's Assumption, already defined as a shared constant) | Autocomplete dropdown functional from the homepage | Confirmed reuse: no second N constant redefined in this feature's code |
| --- | --- | --- | --- |
| 4.2 | Build features/buyer/SearchResults at /search?q= — **Assumption/Engineering Decision:** this is the exact screen Feature 4 Task 7.5 already scaffolded (App Flow attributes SCR-B02 to Feature 4's own playbook). Confirm whether Feature 4 Task 7.5 already built this screen; if so, this step is a **no-op / verification only**, not new construction | Either: (a) confirmed pre-existing screen reused as-is, or (b) if Feature 4 stopped short of full UI and only built the endpoint, complete the screen here — documented explicitly either way | If (a): zero new files created for this step. If (b): new screen created, explicitly noted as completing Feature 4's deferred UI scope, not duplicating its endpoint |
| --- | --- | --- | --- |
| 4.3 | Confirm submit-from-homepage navigation: typing a query and pressing Enter/Search on / navigates to /search?q=<value>, preserving the query string | Working navigation | Manual test: homepage search → results page shows matching products, URL reflects the query (shareable/bookmarkable, standard REST-ful behavior) |
| --- | --- | --- | --- |
| 4.4 | Verify bilingual + status-filter correctness is inherited, not re-implemented | No new test needed for correctness — Feature 4 Task 7.1's tests already cover this | A quick smoke test (one Urdu query, one English query) confirms the **existing** backend behavior surfaces correctly through this feature's new UI layer |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A second SearchResults-equivalent screen gets built here, duplicating whatever Feature 4 Task 7.5 already produced | Step 4.2 exists specifically to force this check — verify against the actual Feature 4 codebase state before writing new screen code |
| --- | --- |
| Autocomplete re-implemented with a locally-defined trigger-length constant instead of importing Feature 4's shared one | Import the existing constant from wherever Feature 4 Task 7.4 defined it (e.g., packages/shared) — do not redeclare N=2 locally |
| --- | --- |

## **Task 5 — Product Listing**

### **Purpose**

-   Implement the **category-browse path** of SCR-B02 — same screen, same endpoint as Task 4, invoked with a category\_id filter and no text query, per the Task 0 Assumption that Listing and Search are one data-layer mechanism.
-   Complete the /category/:slug handoff Task 3.3 deferred — rendering results once the slug is resolved.
-   Confirm infinite scroll / pagination (App Flow SCR-B02) works identically whether entered via search or via category grid.

### **Dependencies**

-   Task 3 complete (slug→category\_id resolution)
-   Task 4 complete (the shared SearchResults/listing screen and its result-rendering logic)

### **Expected Deliverables**

-   \[ \] /category/:slug renders the same SearchResults component as /search?q=, pre-filtered by the resolved category\_id, no text query
-   \[ \] Confirmed: GET /products/search (Feature 4) accepts a category\_id-only call (no q param) and returns correctly — verification, not new backend work
-   \[ \] Infinite scroll (cursor-based, TRD §9 pagination convention) functional in category-browse mode
-   \[ \] Category name/breadcrumb header rendered above results (distinguishing "Browsing: Electronics" from a generic search results header)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 5.1 | Verify GET /products/search?category\_id=X (no q) already works correctly against Feature 4's existing query builder (Task 7.2) — this should require **zero backend changes**, since Feature 4's filter composition already supports category-only calls | Confirmation only, no new code expected | Manual curl/Postman test against the existing Feature 4 endpoint with only category\_id set — results correctly scoped, no error on missing q |
| --- | --- | --- | --- |
| 5.2 | Wire /category/:slug (Task 3.3's resolved category\_id) into the shared SearchResults component from Task 4.2, passing category\_id as the initial filter state and q as empty | Category page renders using the identical component tree as text search | No new grid/card/pagination component written — confirmed via code diff that this step touches only route-param-to-props wiring |
| --- | --- | --- | --- |
| 5.3 | Add a category-context header ("Browsing: {category name}" / bilingual per name\_en/name\_ur) above the shared results grid, shown only in category-browse mode (absent when arriving via /search?q=) | Small conditional header addition to the shared component | Category mode shows the header; search mode does not — confirmed via both entry paths |
| --- | --- | --- | --- |
| 5.4 | Confirm infinite scroll (cursor pagination, TRD §9) works in category-browse mode exactly as it does in text-search mode — same underlying mechanism, different initial filter | Verified pagination behavior | Scroll to bottom on a category with >20 results (default limit) → next page loads correctly, no duplicate/missing items |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A separate CategoryListing component gets built alongside SearchResults, duplicating grid/pagination/card logic | This directly contradicts the Task 0 Assumption underlying this feature's entire Search/Listing split — Step 5.2 exists specifically to prevent it; one component, two entry modes |
| --- | --- |
| category\_id-only search silently applies a different default sort than text search (e.g., missing the relevance→newest fallback Feature 4 Task 7.2 defines for empty-query cases) | Verify Feature 4's existing sort-default logic already handles the no-q case correctly (it should, since ts\_rank on an empty query is meaningless) — if a gap is found here, it is a **Feature 4 regression to report**, not something to patch locally in this feature |
| --- | --- |

*End of Response 2 — Tasks 4–5 complete. Awaiting confirmation before continuing with Tasks 6–7 (Product Details & Filters, Validation & Testing), followed by the final Table of Contents update, cross-reference verification, and full consistency review against Features 0–4.*

## **Task 6 — Product Details & Filters**

### **Purpose**

-   Implement **SCR-B03** (Product Detail) by consuming Feature 4's existing GET /products/:publicId (Task 3.6) directly — no new detail endpoint, per the explicit deliverable "Product Details consume the existing Product APIs instead of creating duplicate endpoints."
-   Implement SCR-B02's filter panel (category, price range, condition; rating scaffolded-disabled) by extending the **same** SearchResults component's query params — no new filter/query logic, since Feature 4 Task 7.2 already builds and tests every filter dimension.
-   Stub the Add to Cart / Buy Now buttons as inert click targets pointing at the not-yet-built Cart feature, consistent with this feature's read-only scope.

### **Dependencies**

-   Task 5 complete (SearchResults component, category/search entry points)
-   Feature 4 Task 3.6 complete (public product detail endpoint) and Task 7.2 complete (filter query composition)

### **Expected Deliverables**

-   \[ \] features/buyer/ProductDetail at /product/:id, consuming Feature 4's existing detail endpoint
-   \[ \] Image carousel, bilingual title/description, price, condition, stock/availability, seller rating **display** (rating value itself deferred — see Task 0 Gap on rating; this only *renders* whatever field Feature 4's DTO exposes, none is invented here)
-   \[ \] Filter panel wired into SearchResults (Task 4/5's shared component): category (CategorySelect, Feature 4 Task 2.3), price range, condition; rating filter rendered disabled per Feature 4's own established stub
-   \[ \] Add to Cart / Buy Now rendered as disabled/stub controls, explicitly not wired to any endpoint

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 6.1 | Build ProductDetail screen calling GET /products/:publicId (Feature 4 Task 3.6) — **zero new backend code** | Functional detail screen | Confirmed: no new controller/service method added anywhere in this feature for product detail retrieval |
| --- | --- | --- | --- |
| 6.2 | Render image carousel from the product\_images array already returned by the Feature 4 endpoint (ordered by position, primary first — Feature 4 Task 4's contract) | Swipeable/clickable carousel | First image (position 0) displays first, matching the "first = primary" rule established in Feature 4 |
| --- | --- | --- | --- |
| 6.3 | Render out-of-stock state (status = OUT\_OF\_STOCK, per Feature 4 Task 5.3's system-derived transition) — Buy button disabled, "Out of stock" label shown, per App Flow SCR-B03's edge case | Correct out-of-stock UI | A product with stock=0 (direct-link access, since Task 7.3 of Feature 4 already excludes it from search) shows the correct disabled state |
| --- | --- | --- | --- |
| 6.4 | Stub Add to Cart / Buy Now — rendered, styled, but onClick is a no-op or shows a "Coming soon" toast (Feature 0 ToastProvider), explicitly not calling any Cart endpoint | Non-functional but visible controls | Code comment marks this as the Cart & Checkout feature's future wiring point — no placeholder API call fired |
| --- | --- | --- | --- |
| 6.5 | Extend SearchResults (Task 4/5) with the filter panel: category (CategorySelect reused from Feature 4 Task 2.3), price range (min/max inputs, min ≤ max validation per App Flow SCR-B02), condition (enum select) — each maps directly to an existing Feature 4 GET /products/search query param | Functional filter panel | Combined filters (category + price + condition) narrow results correctly, using Feature 4 Task 7.2's already-tested combined-filter query — no new query composition written here |
| --- | --- | --- | --- |
| 6.6 | Render the rating filter as visually disabled/"coming soon", matching Feature 4 Task 7.5's own established pattern exactly — do not silently omit it (App Flow names it) or newly enable it (Reviews is R1.1) | Disabled control present | Consistent with Feature 4's precedent — no divergent treatment introduced in this feature |
| --- | --- | --- | --- |
| 6.7 | Add sort selector (relevance/price/newest — rating sort disabled, mirrors 6.6) to the shared results component if not already present from Feature 4's own screen work (verification step, same pattern as Task 4.2) | Confirmed present or completed | No duplicate sort-logic written; UI only |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A new GET /marketplace/products/:id endpoint gets created "for the buyer surface" | Explicitly forbidden by your brief's deliverables — Feature 4's GET /products/:publicId is public already and must be called directly |
| --- | --- |
| Filter panel builds its own client-side filtering logic instead of passing params to Feature 4's server-side query | Defeats indexing/performance (Schema §7's GIN index, idx\_products\_price, etc.) and risks inconsistent results vs. direct search — all filtering must be server-side via existing query params |
| --- | --- |
| Add to Cart silently fails a network call to a non-existent endpoint | Confirm Step 6.4's no-op stub is truly a no-op — a 404 on every product page load is a regression, not an acceptable placeholder |
| --- | --- |

## **Task 7 — Validation & Testing**

### **Purpose**

-   Independently re-verify Tasks 1–6 against the central claim of this entire feature: **zero duplicated backend logic**, everything is composition/consumption over Feature 4.
-   Run adversarial tests confirming Guest-level (unauthenticated) access works correctly across every screen, since this is the platform's first fully public-facing feature.
-   Produce the sign-off artifact and the final reuse audit required before the next feature (Cart & Checkout) can safely build on top of this read path.

### **Dependencies**

-   Tasks 1–6 complete

### **Expected Deliverables**

-   \[ \] Integration test suite for marketplace.controller.ts's one new endpoint (/marketplace/home) plus consumption smoke tests against Feature 4's existing, already-tested endpoints
-   \[ \] Guest-access adversarial test set (no token, all screens/endpoints)
-   \[ \] Full **reuse audit** — grep-level confirmation of zero duplicated query/component logic
-   \[ \] FEATURE\_5\_CHECKLIST.md — consolidated sign-off
-   \[ \] Coverage confirmed ≥80% for the new marketplace.controller.ts code specifically (Feature 4's existing code is already covered under its own feature's gate)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 7.1 | Integration-test GET /marketplace/home — the only genuinely new backend endpoint in this feature | Green test suite | Featured/new-arrivals correctly exclude DRAFT/OUT\_OF\_STOCK/REMOVED; categories match Feature 4's cached tree exactly |
| --- | --- | --- | --- |
| 7.2 | Smoke-test (not re-test) Feature 4's consumed endpoints through this feature's new UI paths: search, category browse, product detail, filters | Confirmed correct behavior at the integration seam | These are **not** re-testing Feature 4's internal logic (already covered by Feature 4 Task 8) — only confirming this feature's UI correctly passes params and renders responses |
| --- | --- | --- | --- |
| 7.3 | Guest-access adversarial test: every screen (/, /search, /category/:slug, /product/:id) and every endpoint this feature touches, called with **no auth token** | All succeed (200), none require authentication | Matches PRD §11's permission matrix — Guest is explicitly ✅ for "Browse & search products" and "View public tracking page"-adjacent read actions; confirm no route in this feature accidentally inherited a authenticate-required guard |
| --- | --- | --- | --- |
| 7.4 | Full reuse audit — grep the codebase for: any second product-query implementation, any second category-fetch implementation, any second ProductCard/CategorySelect/results-grid component, any duplicated pagination logic | Zero matches found (or each match explicitly justified and documented if a genuine false-positive) | This is the feature's core success criterion per your brief — the audit result is recorded verbatim in FEATURE\_5\_CHECKLIST.md |
| --- | --- | --- | --- |
| 7.5 | Cross-check against App Flow UI states (SCR-B01/B02/B03's documented loading/empty/error states) | Pass/fail note per screen | Loading skeletons, empty states ("No products yet", "No products match your search"), error+retry all present per Feature 0 Task 8 components, consistent with every prior feature's discipline |
| --- | --- | --- | --- |
| 7.6 | Consolidate FEATURE\_5\_CHECKLIST.md — one section per task, Documentation Gaps table with final status, explicit confirmation that Wishlist was correctly excluded (not stubbed, not built) | Committed sign-off artifact | Both developers review; any open item flagged for the next feature (Cart & Checkout, and eventually the Wishlist future-feature) |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Coverage gate measured against the whole catalog module (inflated by Feature 4's already-covered code), masking whether the new marketplace.controller.ts code itself is tested | Scope coverage specifically to the new file(s) added in this feature |
| --- | --- |
| Reuse audit skipped as "obviously fine" since no explicit duplication was noticed during development | The audit must be a deliberate grep/search pass, not a recollection — this is the exact discipline Task 8.5 established in Feature 4 and must not regress here |
| --- | --- |

## **Final Consistency Pass**

### **1\. Table of Contents (updated, final)**

1.  [Feature Overview](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#feature-overview) 0.1. [Pre-Generation Reuse Review](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#pre-generation-reuse-review) 0.2. [Documentation Gaps & Assumptions](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#documentation-gaps--assumptions) 0.3. [Buyer Marketplace Flow](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#buyer-marketplace-flow)
2.  [Task 1 — Marketplace Foundation](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-1--marketplace-foundation)
3.  [Task 2 — Homepage](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-2--homepage)
4.  [Task 3 — Category Integration](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-3--category-integration)
5.  [Task 4 — Marketplace Search](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-4--marketplace-search)
6.  [Task 5 — Product Listing](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-5--product-listing)
7.  [Task 6 — Product Details & Filters](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-6--product-details--filters)
8.  [Task 7 — Validation & Testing](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-7--validation--testing)

### **2\. Cross-Reference Verification**

| **Check** | **Result** |
| --- | --- |
| Organized by implementation dependency, not the feature-brief's list order | ✅ Foundation → Homepage → Category → Search → Listing → Details/Filters → Validation; every task's Dependencies field names exact prior task(s) |
| --- | --- |
| Zero new Prisma models/migrations | ✅ Confirmed in Task 1.1/1.4 and reconfirmed at Task 7.4's reuse audit — this feature is purely a consumption/composition layer |
| --- | --- |
| No Product CRUD logic recreated | ✅ Every create/update/delete/image/inventory action remains exclusively Feature 4's; this feature only calls GET methods |
| --- | --- |
| Search reuses Feature 4's search/autocomplete endpoints unmodified | ✅ Task 4 — zero new query logic; Task 4.2 explicitly checks for and avoids duplicating Feature 4's own SCR-B02 screen work if already built |
| --- | --- |
| Categories reused, not redesigned | ✅ Task 3 — read-only consumption of Feature 4's cached tree; explicit negative check (3.4) mirrors Feature 4 Task 2.1's own discipline |
| --- | --- |
| Product Details consumes existing endpoint, no duplicate | ✅ Task 6.1 — explicit "zero new backend code" requirement, verified |
| --- | --- |
| Filters extend existing query system, no duplicate logic | ✅ Task 6.5 — all filter params map directly to Feature 4 Task 7.2's already-tested query composition |
| --- | --- |
| Wishlist correctly dropped, not stubbed | ✅ Per your explicit direction — logged in Documentation Gaps as a confirmed exclusion, not built in any form (Task 6's Product Detail screen has no Wishlist affordance at all) |
| --- | --- |
| No seller functionality duplicated | ✅ This feature contains zero seller-role routes, zero seller\_profiles/store-scoped logic — confirmed by scope (Feature Overview's exclusions) |
| --- | --- |
| Shared components reused, not rebuilt | ✅ ProductCard, CategorySelect, Skeleton, EmptyState, ToastProvider all consumed from Features 0/4 with zero new equivalents created |
| --- | --- |
| Guest access works correctly across the entire feature (this feature's primary security-relevant guarantee) | ✅ Task 7.3's dedicated adversarial test set, matching PRD §11's permission matrix exactly |
| --- | --- |

### **3\. Assumptions Made (full list)**

| **#** | **Assumption** | **Task** |
| --- | --- | --- |
| 1 | "Featured" and "New Arrivals" are both proxied by status='LIVE' ORDER BY created\_at DESC — no dedicated merchandising field exists | Task 2.1–2.2 |
| --- | --- | --- |
| 2 | Homepage content is identical for Guest and authenticated Buyer (no personalization logic in MVP) | Feature Overview / Task 2.4 |
| --- | --- | --- |
| 3 | "Product Listing" and "Marketplace Search" are two entry modes of one SCR-B02 screen and one backend endpoint, not two separate data paths | Feature Overview / Tasks 4–5 |
| --- | --- | --- |

### **4\. Engineering Decisions Made (full list)**

| **#** | **Decision** | **Task** |
| --- | --- | --- |
| 1 | No parallel modules/marketplace/ repository — one new controller file extends Feature 4's existing catalog.service.ts/catalog.repository.ts | Pre-Generation Reuse Review |
| --- | --- | --- |
| 2 | Category page and Search Results page share one SearchResults component, differing only in initial filter state (category\_id vs. q) | Task 3.3, Task 5.2 |
| --- | --- | --- |
| 3 | Add to Cart / Buy Now rendered as inert stubs, explicitly not calling any endpoint, deferred entirely to the future Cart & Checkout feature | Task 6.4 |
| --- | --- | --- |

### **5\. Unresolved Documentation Gaps (carried forward, not closed by this feature)**

| **#** | **Gap** | **Status** | **Needs** |
| --- | --- | --- | --- |
| 1 | No real "featured product" merchandising field/rule exists anywhere in Schema Doc | Proxied via recency (Assumption #1) | Product/business decision if true merchandising logic is ever desired — Future scope, not blocking |
| --- | --- | --- | --- |
| 2 | Wishlist (F17) has no schema, no endpoint, no UI anywhere in the platform yet | Confirmed excluded from this feature per your direction | A dedicated future feature, to be scoped against PRD §17.2 when prioritized |
| --- | --- | --- | --- |
| 3 | Seller-rating filter/sort remains a disabled stub (inherited unresolved from Feature 4) | Unchanged, correctly not addressed here | Blocked on the Reviews feature (F16, R1.1) — tracked, not owned by this feature |
| --- | --- | --- | --- |

**Feature 5.md — Buyer Marketplace Engineering Execution Playbook is complete.** All 7 tasks follow the required dependency sequence, reuse 100% of Feature 4's product/category/search infrastructure and Feature 0's shared components with zero duplicated backend logic (confirmed via the Task 7.4 reuse audit), and Wishlist is correctly deferred to its own future feature per your explicit direction rather than built or stubbed. Every Assumption and Engineering Decision is logged above and carried into FEATURE\_5\_CHECKLIST.md for sign-off. Ready for the team to execute following Features 0–4.