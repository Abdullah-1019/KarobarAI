# Handoff — F5 Buyer Marketplace (Frontend)

**Status:** Complete — 2026-08-02. Built against `F5-marketplace-backend.md` (already real, 241/241
backend tests). `tsc --noEmit` and `vite build` both clean. Guest-facing; buyer/seller-account
screens for cart/orders are Features 6/7, not built here.

## Screens built

| Route | Screen |
|---|---|
| `/` | Home (SCR-B01) — category grid, Featured/New Arrivals rails, login/register CTAs for guests. Replaces the old `/buyer` redirect + placeholder entirely |
| `/search` | Search results (SCR-B02) — filter panel (category, price range, condition, sort), infinite scroll, driven by `?q=`/filter query params so results are shareable/bookmarkable |
| `/category/:slug` | Category browse — resolves the slug to a category id, then the same result grid as `/search` with `categoryId` set and no `q` (matches the backend's "search and listing are one mechanism" design) |
| `/product/:id` | Product detail (SCR-B03) — image carousel, bilingual title/description, quantity stepper, Add to Cart / Buy Now |

All four routes (plus `/cart` from Feature 6) are wrapped in a new `StorefrontLayout` — see below.

## New app shell

`features/marketplace/StorefrontLayout.tsx` + `StorefrontHeader.tsx` — **nothing like this existed
before**; `AppProviders.tsx` previously rendered `<RouterProvider>` with no header/nav at all.
The header carries the search bar (with autocomplete), a live cart-count badge, the language
switcher, and a login/register or profile/logout menu depending on auth state.

## Key files

- `features/marketplace/marketplaceApi.ts` — `getHomeFeed`, `getCategoryBySlug`, `searchProducts`,
  `autocomplete`. Reuses `getCategories`/`getProduct` from `../catalog/catalogApi` as-is (Feature
  4's endpoints) rather than duplicating them — matches the backend handoff's own framing of F5 as
  "a thin composition layer over Feature 4."
- `HomePage.tsx`, `SearchPage.tsx`, `CategoryPage.tsx`, `ProductDetailPage.tsx`
- `SearchResultsGrid.tsx` — shared cursor-paginated grid used by both Search and Category pages
- `ProductCard.tsx`, `SearchBar.tsx` (debounced, 2-char-minimum autocomplete), `FilterPanel.tsx`,
  `CategoryGrid.tsx`

## New shared component

`components/QuantityStepper.tsx` — promoted to `components/` since Feature 6's Cart page needed
the identical control. No icon package is installed anywhere in this app, so it uses plain `−`/`+`
text glyphs rather than pulling in `@ant-design/icons` for two buttons.

## Routing changes

- `/` used to `<Navigate to="/buyer" />` into a placeholder ("Homepage and browse land in Feature
  5"). It's now the real home directly; `features/buyer/` (the placeholder + its barrel) is deleted.
- `roleHomePath()` (`features/auth/roleHome.ts`) now sends a Buyer to `/` instead of `/buyer` after
  login.
- `/buyer/profile*` (Feature 2) keeps its exact path, just re-nested under `StorefrontLayout` so it
  gets the header too.

## Known/deliberate limitations

- Seller-rating sort option is rendered in `FilterPanel` but disabled with a tooltip — mirrors the
  disabled-stub convention Feature 4 already established for the seller-rating filter (blocked on
  a future Reviews feature), not something invented here.
- No wishlist affordance anywhere — Future/F17 per both the module doc and the backend handoff's
  explicit scope note.
- Homepage content is identical for Guest and Buyer (no personalization) — matches the backend's
  own stated MVP limitation.

## Not built (deferred, different feature)

Cart/Checkout (Add to Cart writes into either the guest cart or the persisted cart depending on
auth state, but the Cart/Checkout screens themselves are Feature 6) and Order Management
(Feature 7).
