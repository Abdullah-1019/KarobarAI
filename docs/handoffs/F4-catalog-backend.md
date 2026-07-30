# Handoff — F4 Product Management (Backend → Frontend)

**Status:** Backend complete — 2026-07-30. Scoped to `apps/backend`'s catalog module +
`apps/ai-service`'s mock `/generate-listing` endpoint only — every frontend screen this module
doc lists (AddProduct/ProductEdit/Products-list/SearchResults, the ImageUploader multi/sortable
extension) is out of scope here, same split as Features 1–3. Full backend suite green: **225/225
tests, 24/24 suites** (108 of those are this feature's own), confirmed non-flaky across 2
consecutive clean full-suite runs. Catalog module coverage: 96.0% statements / 96.8% lines.

**Explicit scope decision confirmed with the user before building:** Task 3's AI Store Builder
depends on a real GPT-4 Vision → GPT-3.5 fallback chain, which needs actual OpenAI API keys and is
a different kind of work than anything built so far. Per the user's explicit choice, **this pass
implements a mock stub**: `apps/ai-service`'s `/generate-listing` always returns a fixed,
schema-conformant response rather than calling a real LLM. The real integration is a separate,
later task — the orchestration contract on the backend side (validate → call → persist-on-success,
never touch the row on failure) is exactly what that later implementation will run under
unchanged, so no rework is expected when it lands.

---

## The one thing to internalize before building any UI here

Two columns on `products` are **NOT NULL with no database default**: `titleEn` and `price`. The
module doc's App Flow framing ("upload a photo first, everything else follows") doesn't hold
literally — a Draft row cannot be created with zero fields. **Assumption:** the seller provides a
minimal working title + price upfront in the very first `POST /seller/products` call; AI
generation (`generate-listing`) then overwrites `titleEn`/`titleUr`/`descriptionEn`/
`descriptionUr`/`tags`/`category` on success — never `price`, since AI was never asked to
generate a price (REQ-AI-Store002's schema doesn't include one).

## Base path & envelope

Same standard envelope as every other module. Two route groups:
- **`/api/v1/categories`, `/api/v1/products/*`** — fully public, no `Authorization` header
  required (Guest/Buyer/Seller/Admin can all browse LIVE products, PRD §11).
- **`/api/v1/seller/products/*`** — Seller-only, tighter than Feature 2/3's shared routes.
  Requires: valid token → `SELLER` role → **completed store onboarding** (Feature 3's `hasStore`)
  → **`ACTIVE` account status**. All three checks happen once, at the router level, before any
  handler runs.

## Endpoints

### `GET /categories` — public
Returns the full category set as a nested tree (`children: []` on every node). Currently flat (no
parent categories seeded yet) but the shape is tree-ready regardless. Cached in Redis, 5-min TTL —
categories change rarely.

### `POST /seller/products` — create Draft
Body: `{ titleEn: string, price: number, categoryId?: string }`. Returns a `ProductDetailDTO` with
`status: "DRAFT"`, `stock: 0`. This is the row the wizard's first image-upload attaches to.

### `POST /seller/products/:productId/generate-listing`
Body: `{ hint?: string }` (optional context string, e.g. a category hint). **Mock stub** —
always succeeds with a fixed listing unless ai-service itself is unreachable. Requires the product
to be `DRAFT` and to already have ≥1 image uploaded.
- `400 PRODUCT_IMAGE_REQUIRED` — no image yet.
- `422 PRODUCT_NOT_DRAFT` — product isn't in Draft status.
- `503 AI_GENERATION_FAILED` — ai-service unreachable/errored; **the product row is left
  completely untouched** on failure (REQ-F-Store005) — safe to retry by calling this again.
- On success: `titleEn`/`titleUr`/`descriptionEn`/`descriptionUr`/`tags` are overwritten, and
  `categoryId` is set **only if** the AI's returned category slug matches a real seeded category
  — otherwise the product's existing category (if any) is left alone, never cleared to null.

### `POST /seller/products/:productId/publish`
No body. Requires title (always true given the NOT NULL constraint, checked anyway) + ≥1 image +
category, all three. `422 PUBLISH_REQUIREMENTS_NOT_MET` with `error.details.missing` — an array
naming exactly which of `title`/`image`/`category` is missing, so the UI can point at the right
field(s) rather than a generic "can't publish" message.

### `POST /seller/products/:productId/unpublish`
LIVE → DRAFT only. `422 ALREADY_UNPUBLISHED` if the product wasn't Live.

### `PATCH /seller/products/:productId`
Editable: `titleEn`, `titleUr`, `descriptionEn`, `descriptionUr`, `price`, `stock`, `condition`,
`categoryId` (nullable), `tags`. **`status` is never a field here** — sending it is rejected
outright (`400`, unknown field) by the schema's `.strict()`, not silently ignored. Editing `stock`
directly (not through checkout's future decrement) still runs the same auto status-sync as
below — dropping stock to 0 on a Live product auto-flips it to `OUT_OF_STOCK` in the same request.

### `DELETE /seller/products/:productId`
Soft-delete — sets both `deletedAt` and `status: REMOVED` together. No active-order precondition
needed: `order_items → products` is a hard DB `RESTRICT`, so a real delete would be physically
blocked by the FK regardless; soft-delete never touches that relationship at all, and historical
orders already carry their own price/title snapshot independent of the live product row.

### `GET /seller/products` — the seller's own list
Query: `status?`, `cursor?`, `limit?` (default 20, max 100). Cursor-paginated, `nextCursor: null`
when exhausted. Ownership is implicit from the auth token — there is no `sellerId` query param;
you cannot ask for anyone else's products through this endpoint.

### `POST /seller/products/:productId/images` — multipart, field name `images` (up to 10 files)
First upload gets `position: 0` (primary); later uploads increment. Same validation as every
prior upload feature — magic-byte checked (JPEG/PNG/WEBP), 10MB ceiling per file,
`400 PRODUCT_IMAGE_TOO_LARGE` / `400 PRODUCT_IMAGE_INVALID_FILE`.

### `DELETE /seller/products/:productId/images/:imageId`
Removing any image (including the primary) automatically re-sequences the rest to stay contiguous
from 0 — the next image is promoted to primary with no separate step. `404
PRODUCT_IMAGE_NOT_FOUND` if the image doesn't belong to that product.

### `PATCH /seller/products/:productId/images/reorder`
Body: `{ imageIds: string[] }` — **must be a complete permutation** of the product's existing
image IDs (same length, no duplicates, nothing foreign). `400 REORDER_INVALID` otherwise. The
first ID in the array becomes the new primary.

### `GET /products/:publicId` — public detail, with an owner-preview exception
`404` (not 403) for a Draft product viewed by anyone other than its owning Seller — this avoids
confirming a Draft product's existence to someone probing URLs. **`OUT_OF_STOCK` products remain
fully visible here** even to anonymous callers — only `DRAFT` (and soft-deleted `REMOVED`) are
gated. This matters: don't build a "product unavailable" page keyed off a 404 for out-of-stock
items — that response only ever means "doesn't exist or isn't yours to see."

### `GET /products/search` — public
Query: `q?`, `categoryId?`, `minPrice?`, `maxPrice?`, `condition?`,
`sort?` (`relevance|price_asc|price_desc|newest|rating`), `cursor?`, `limit?`. Full bilingual
(EN/UR) tsvector search, diacritic-insensitive. **`sort=rating` is accepted but silently falls
back to relevance** — Reviews/ratings don't exist in this MVP (a separate future feature); render
a rating sort option as visually present but understand it won't actually reorder anything yet.
Results always exclude `DRAFT`/`OUT_OF_STOCK`/`REMOVED`/soft-deleted products by default.

### `GET /products/autocomplete?q=` — public
Requires `q` to be **at least 2 characters** (`400` otherwise) — don't fire this request on every
keystroke below that length. Returns `{ id, title }[]`, title-substring matched (not the full
tsvector engine), LIVE products only.

## `ProductDetailDTO` shape

```ts
{
  id,               // publicId (UUID) — never the internal sequential product_id
  titleEn, titleUr, descriptionEn, descriptionUr,
  price,            // string (Decimal serialized as string — avoid float precision loss)
  stock, condition, status, aiGenerated,
  category: { id, slug, nameEn, nameUr } | null,
  images: [{ id, url, position }],   // always ordered by position ascending
  createdAt,
}
```

## Cross-feature contract for Cart & Checkout (Task 5)

`decrementStock(productId, quantity)` and `restoreStock(productId, quantity)` are implemented and
fully tested (including concurrency: N concurrent decrements against limited stock, order-
independent correctness when a decrement races a restore) but **have no HTTP route and no caller
yet** — they're exported from `catalog.service.ts` for the future Cart & Checkout feature to call
directly at order confirmation / cancellation. Both are atomic (single conditional `UPDATE`, not
read-then-write) and both re-run the same `LIVE ↔ OUT_OF_STOCK` status sync a direct seller stock
edit does. `decrementStock` throws `ConflictError` (`409 INSUFFICIENT_STOCK`) if stock is
insufficient — the exact 409-for-oversell contract TRD §9 documents.

## Real bugs found and fixed while building this (not pre-existing — introduced and caught in the
same session, before you ever saw the code)

- **`GET /products/:publicId` initially hid `OUT_OF_STOCK` products from everyone but the owner**
  — wrong; REQ-F-Inv-003's "hidden from default results" only ever meant *search/listing* pages,
  not the direct detail page. Fixed to only gate `DRAFT`/`REMOVED`.
- **Soft-delete never actually set `status: REMOVED`**, leaving that enum value permanently dead
  and making the fix above's `DRAFT`/`REMOVED` distinction meaningless in practice. Fixed to set
  `deletedAt` and `status: REMOVED` together.
- **My own test bug** (not a service bug): the image-removal test's mock delete assertion failed
  because the test used an arbitrary `mock://...` URL that doesn't match the real
  `extractStorageKey()` prefix — same gotcha Features 2/3's tests had already learned from,
  missed here initially and fixed the same way.

## Real documentation gaps found and closed

- **Schema §7 specifies `unaccent` for query-time diacritic-insensitive search, but the Database
  feature's original migration never actually created the Postgres extension.** Closed with a
  small additive migration (`CREATE EXTENSION IF NOT EXISTS unaccent;`) — this session's, not a
  pre-existing one that was silently broken before.
- **`product_images (product_id, position)` was already a real DB unique constraint** from the
  Database feature (Task 1.2 in the module doc asked to add it, but it was already there) — no
  migration needed for that specific item.
- **`resetDb()`'s test helper would have started failing the moment any test created a product**:
  `products.seller_id → seller_profiles` is `onDelete: Restrict`, not `Cascade`, so the existing
  teardown order (delete `sellerProfile` before any `product` cleanup) would throw a foreign-key
  violation. Fixed by deleting `product` rows before `sellerProfile` rows in the shared test
  helper.

## Known limitations / assumptions

- No `catalog.repository.ts` layer was introduced, despite the module doc naming one as an
  expected file. Every other module in this codebase (`auth`, `profile`) keeps all logic in
  `*.service.ts` directly — introducing a new architectural layer just for this one module would
  be inconsistent with the established convention, so `catalog.service.ts` also owns the raw
  tsvector search queries.
- Autocomplete uses a substring/`ILIKE`-equivalent match (Prisma's `contains` + `insensitive`
  mode), not a tsquery-prefix query — an explicit Engineering Decision the module doc itself
  permits either way.
- No max-images-per-product cap is enforced (uncapped) — the docs don't specify one.
- The AI-guessed category is matched against real categories by exact slug — there's no fuzzy/
  partial matching. Once the real LLM integration lands, verify its prompt is instructed to return
  one of the platform's actual category slugs, not a freeform guess.
