# Feature 5 — Buyer Marketplace: Sign-off Checklist

Backend scope only (`apps/backend`) — frontend screens (SCR-B01/B02/B03) are a separate,
not-yet-started deliverable; see the "Frontend (not built here)" section at the bottom. Full
narrative contract: `docs/handoffs/F5-marketplace-backend.md`. Progress-log entry:
`docs/DoneTillNow.md`.

## Task 1 — Marketplace Foundation

- [x] `marketplace.controller.ts` created inside `modules/catalog/`, imports `catalog.service.ts` — no new service/repository file.
- [x] `GET /api/v1/marketplace/home` registered on the existing public router (`publicCatalogRouter`), not a new router.
- [x] Zero new Prisma models, zero new migrations — confirmed.
- [x] `optionalAuthenticate` (built in Feature 4) confirmed reusable for this feature's needs — **not attached to `/marketplace/home` itself**, since Task 2's own Assumption states homepage content doesn't differ by auth state; the header login-state distinction is a frontend-only concern reading its own stored token, not something this endpoint needs to branch on.

## Task 2 — Homepage

- [x] `GET /api/v1/marketplace/home` implemented — returns `{ featured, newArrivals, categories }`.
- [x] Featured/new-arrivals correctly exclude `DRAFT`/`OUT_OF_STOCK`/`REMOVED`/soft-deleted (tested explicitly).
- [x] Categories field is the same cached tree `GET /categories` returns — no second cache/query (tested explicitly, byte-for-byte equality).
- [ ] **Frontend not built**: SCR-B01 screen, search-bar shell, category grid render, cart-icon stub.

## Task 3 — Category Integration

- [x] `GET /api/v1/categories/:slug` implemented — resolves slug → `{id, slug, nameEn, nameUr}`, `404 CATEGORY_NOT_FOUND` for an unknown slug.
- [x] Explicit negative check: no POST/PATCH/DELETE route exists on `/categories/:slug` (tested).
- [ ] **Frontend not built**: category grid, `/category/:slug` route resolution + handoff to the listing UI.

## Task 4 — Marketplace Search

- [x] Confirmed zero new backend search endpoints/query logic — `GET /products/search`/`autocomplete` reused as-is.
- [ ] **Frontend not built**: homepage autocomplete wiring, `/search?q=` screen.

## Task 5 — Product Listing

- [x] Verified (not assumed) that `GET /products/search?categoryId=X` with no `q` already works correctly — no backend change was needed.
- [ ] **Frontend not built**: `/category/:slug` results rendering, category-context header, infinite scroll wiring.

## Task 6 — Product Details & Filters

- [x] Confirmed `GET /products/:publicId` (Feature 4) needs no changes for this feature.
- [ ] **Frontend not built**: ProductDetail screen, image carousel, out-of-stock display, Add to Cart/Buy Now stubs, filter panel, sort selector.

## Task 7 — Validation & Testing

- [x] Integration test suite for `marketplace.controller.ts`'s new endpoints — 19 tests, `tests/catalog/marketplace.test.ts`.
- [x] Guest-access adversarial sweep — every touched endpoint (new + reused) confirmed `200` with zero auth header.
- [x] Full reuse audit (Task 7.4) — grepped for duplicate product/category queries (none found beyond `catalog.service.ts`), confirmed no `modules/marketplace/` folder exists.
- [x] This checklist file.
- [x] Coverage: `marketplace.controller.ts` 100% statements/functions/lines (one defensive `?? ''` fallback branch on `req.params.slug` untested — structurally unreachable via Express routing, not a real gap).
- [ ] **Frontend not built**: cross-check against App Flow's loading/empty/error states (Task 7.5) — meaningless until the frontend screens exist.

## Documentation Gaps — final status

| # | Item | Status |
|---|---|---|
| 1 | No real "featured" merchandising field/rule | Proxied via recency (Assumption #1) — unresolved, Future product decision |
| 2 | Wishlist (F17) | Confirmed excluded — not built, not stubbed |
| 3 | Seller-rating filter/sort | Unchanged disabled stub from Feature 4 — blocked on future Reviews feature |

## Test results

241/241 backend tests passing, 25/25 suites, confirmed non-flaky across 2 consecutive full-suite
runs (19 of those tests belong to this feature).

## Sign-off

Backend scope: **complete**. Frontend scope (SCR-B01/B02/B03): **not started** — a distinct,
separate piece of work for whoever picks up this feature's UI.
