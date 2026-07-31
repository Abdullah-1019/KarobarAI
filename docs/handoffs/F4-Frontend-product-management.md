# Handoff — F4 Product Management (Frontend)

**Status:** Complete — 2026-07-31. Built against `F4-catalog-backend.md` (already real, 225/225
backend tests). Seller-facing screens only — buyer-facing browse/search is Feature 5 (Buyer
Marketplace), not built here.

## Screens built

| Route | Screen |
|---|---|
| `/seller` | Seller's product list — status filter, cursor pagination ("Load more"), links to edit |
| `/seller/products/new` | Add product — minimal create (title, price, category) → creates a Draft, redirects to edit |
| `/seller/products/:productId/edit` | Full edit — bilingual title/description, price, stock, condition, category, tags, image upload/reorder/delete, "Generate with AI" (mock endpoint), publish/unpublish, delete |

`:productId` in every URL is the product's `publicId` (UUID) — same value as `ProductDetailDTO.id`,
never the internal sequential id.

## Key files

- `features/catalog/catalogApi.ts` — full API layer (categories, seller product CRUD, images, AI generate)
- `features/catalog/SellerProductsPage.tsx`, `AddProductPage.tsx`, `EditProductPage.tsx`
- `features/catalog/ProductImageManager.tsx` — multi-upload + move-left/right reorder + delete (no drag-and-drop lib in the project, so reorder is arrow-button based, not drag handles)
- `features/catalog/ProductStatusTag.tsx` — `ProductStatus` → color/label

## Replaced

`SellerPlaceholder.tsx` no longer covers `/seller` (that's the real product list now) — it only
catches genuinely unbuilt `/seller/*` paths (orders, analytics, etc.). Copy updated since it
previously still said "Store-Setup Wizard lands in Feature 3," which was stale even before today.

## Known environment gap (not a code bug)

Image upload (`POST /seller/products/:id/images`) 500s with `getaddrinfo ENOTFOUND minio` in this
dev sandbox (no MinIO/Docker running) — identical, pre-existing limitation to F3's logo/banner
upload. Frontend handles the failure gracefully (inline error, no crash); confirmed the request
itself is correctly formed via curl. Will work wherever MinIO/S3 is actually reachable.

## Not built (deferred, different feature)

Buyer-facing homepage, search results, category browse, product detail (buyer view) — Feature 5.
The public `GET /products/search`, `/products/:publicId`, `/products/autocomplete` endpoints exist
and are ready to build against when that feature starts.
