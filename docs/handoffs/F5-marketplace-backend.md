# Handoff — F5 Buyer Marketplace (Backend → Frontend)

**Status:** Backend complete — 2026-07-31. This feature is, by its own module doc's explicit
design, almost entirely a **thin composition layer over Feature 4** — not a new domain. Exactly
two things are genuinely new on the backend: `GET /marketplace/home` and
`GET /categories/:slug`. Everything else (search, autocomplete, product detail, filters) is
Feature 4's existing, already-tested endpoints, consumed as-is with zero changes.

Full backend suite green: **241/241 tests, 25/25 suites** (16 new to this feature), confirmed
non-flaky across 2 consecutive full-suite runs.

**Zero new Prisma models, zero new migrations** — confirmed, matching the module doc's own
central claim for this feature.

---

## Reuse audit (Task 7.4 — done, not skipped)

Grepped the codebase before considering this done:
- Every `prisma.product.*` query lives exclusively in `catalog.service.ts` (one other unrelated
  hit: `health.routes.ts`'s `SELECT 1` readiness check).
- Every `prisma.category.*` query lives exclusively in `catalog.service.ts`.
- No `modules/marketplace/` folder exists — the one new file, `marketplace.controller.ts`, lives
  inside `modules/catalog/`, importing `catalog.service.ts` directly (no new repository/service).

## What's new

### `GET /api/v1/marketplace/home` — public
```ts
{
  featured: ProductDetailDTO[],
  newArrivals: ProductDetailDTO[],
  categories: CategoryDTO[],   // identical object to what GET /categories returns — same 5-min cache, not refetched
}
```
**"Featured" and "New Arrivals" are currently the exact same query** (most-recently-published
LIVE products, limit 12) — there's no merchandising/`is_featured` field anywhere in the schema.
They may legitimately return overlapping or identical products right now; that's intentional, not
a bug. Both arrays correctly exclude `DRAFT`/`OUT_OF_STOCK`/`REMOVED`/soft-deleted products —
this reuses Feature 4's exact visibility rule, not a second independently-written filter (if you
ever see a Draft or out-of-stock item on the homepage, that's a real regression, not expected
behavior).

### `GET /api/v1/categories/:slug` — public
Resolves a category slug (the natural key for a `/category/:slug` route) to
`{ id, slug, nameEn, nameUr }`. `404 CATEGORY_NOT_FOUND` for an unknown slug — a clean error, not
a crash. This is the lookup the frontend's `/category/:slug` route needs before calling
`GET /products/search?categoryId=<resolved id>` with the category grid's category-browse mode.

## Everything else — reused exactly as Feature 4 built it, zero changes

- `GET /categories` — same tree-shaped, 5-min-cached response.
- `GET /products/search` — already accepts a `categoryId`-only call (no `q`) correctly; this is
  what powers the category-browse mode (`/category/:slug`) — same screen/component as text
  search, per the module doc's explicit "Search and Listing are one data-layer mechanism"
  Assumption. No second listing endpoint exists or is needed.
- `GET /products/autocomplete` — same `N=2`-character-minimum endpoint.
- `GET /products/:publicId` — same public detail endpoint, same owner-Draft-preview exception.

**None of these needed any backend change for this feature** — confirmed by direct test (Task
5.1's explicit ask): a `categoryId`-only search call already worked correctly before this feature
touched anything.

## Guest access (this feature's primary guarantee)

Every endpoint this feature touches — new and reused — was swept with **zero** `Authorization`
header and confirmed `200`: `/marketplace/home`, `/categories`, `/categories/:slug`,
`/products/search` (bare, with `q`, with `categoryId`), `/products/autocomplete`,
`/products/:publicId` (for a LIVE product). This matches PRD §11's Guest permission matrix
exactly — Guest is explicitly ✅ for browse/search, and nothing in this feature accidentally
requires a token.

## Confirmed exclusions (per your explicit direction, not oversights)

- **Wishlist is not built, not stubbed.** PRD §12.11/§15/App Flow all scope it as Future (F17) —
  no schema, no endpoint, no UI affordance anywhere. If a future Wishlist feature starts, it's a
  clean-slate build.
- **Add to Cart / Buy Now** are frontend-only inert stubs (per the module doc) — no backend
  endpoint exists for cart mutations in this feature; that's the Cart & Checkout feature.
- **Seller-rating filter/sort** remains the same disabled stub Feature 4 already established —
  unchanged, not revisited here (blocked on the future Reviews feature).

## Known limitations / assumptions

- Homepage content is identical for Guest and authenticated Buyer — no personalization logic
  exists in MVP scope (no "recently viewed," no recommendations).
- "Featured" has no real merchandising rule behind it yet — flagged as a Future product decision,
  not something this feature invents a field for.
