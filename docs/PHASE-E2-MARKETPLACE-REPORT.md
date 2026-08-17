# Phase E2 — Marketplace / Buyer Experience Visual Refinement

**Status:** ✅ Complete (2026-08-16)
**Primary specification:** [`docs/KarobarAI-04-UIUX.md`](./KarobarAI-04-UIUX.md)
**Overall tracker:** [`docs/FRONTEND-UI-UX.md`](./FRONTEND-UI-UX.md) — this file holds the detailed E2 record; the tracker only carries a high-level status line/reference per the brief for this batch.

---

## 1. E2 Scope

The Buyer Marketplace experience only: Storefront Home, Search, Category browse, Product Detail, and Cart (explicitly included in this batch's brief, distinct from Checkout/Orders which remain E3). No Seller, Admin, Returns, or Analytics screens were touched.

---

## 2. Exact screen → route → file mapping

Reported before any file was modified, per the batch's own instructions.

| Screen | Route(s) | File(s) |
|---|---|---|
| Storefront Home | `/` | `features/marketplace/HomePage.tsx` (+ `CategoryGrid.tsx`, `ProductGrid.tsx`) |
| Search | `/search?q=` | `features/marketplace/SearchPage.tsx` (+ `FilterPanel.tsx`, `SearchResultsGrid.tsx`) |
| Category browse | `/category/:slug` | `features/marketplace/CategoryPage.tsx` (same `FilterPanel`/`SearchResultsGrid`) |
| Product Detail | `/product/:id` | `features/marketplace/ProductDetailPage.tsx` |
| Cart | `/cart` | `features/cart/CartPage.tsx` |
| Shell / header / search bar | wraps every route above | `features/marketplace/StorefrontLayout.tsx`, `SearchBar.tsx` |

No separate "listing" screen exists beyond Search/Category — both share one `SearchResultsGrid` component (categoryId-only for Category, full filter set for Search). There is no dedicated "featured products" or "new arrivals" browse route — both are Home-only sections with no deeper destination, which is why the new `SectionHeader` component doesn't render a "View all" action anywhere in this batch (there's nowhere real for it to go). Checkout/Checkout Confirmation/Orders were identified but deliberately left untouched — they belong to E3 per the phase overview, and the E2 brief itself only asked for Cart's own screen, not the pages downstream of its Checkout CTA.

---

## 3. Initial visual audit

Performed against the actual rendered app — a real backend was reachable in this environment with genuine seeded data (8 categories, 12 featured products, 12 new-arrival products), so the audit reflects real content, not empty/mocked states. One real environment constraint: the object-storage service (MinIO, port 9000) that serves product images was not running, so every product photo failed to load throughout the audit and the rebuild — this is called out explicitly in §19 below and did not block the work, since it happens to be an unusually good stress test of the "no image" / "image failed" states.

Evaluated against every dimension the brief listed (hierarchy, spacing rhythm, card composition, typography, image treatment, price prominence, buttons, search, category discovery, section hierarchy, borders/shadows, density, whitespace, empty/loading states, hover states, mobile, dark mode, RTL, accessibility, brand distinctiveness).

---

## 4. Problems identified

1. **A real bug**: `HomePage` rendered its own Login/Register button pair directly under the header, duplicating the identical pair `AppHeader`'s `guestActions` slot already renders — two stacked, identical CTA rows for a guest visitor.
2. **The single strongest "generic/unstyled" tell**: `ProductCard` and `CategoryGrid` wrapped their content in `<Link>` with no style reset. Browsers propagate an anchor's default `color`/`text-decoration` through descendant inline content unless the anchor itself resets it — since neither `<Link>` set `color`/`textDecoration`, every product and category title rendered as a literal underlined blue-ish hyperlink instead of a designed title.
3. `ProductCard` itself was a bare small AntD `Card` — flat, no meaningful hierarchy beyond thumbnail→title→price, no hover/image interaction, nothing distinctly KarobarAI.
4. `CategoryGrid` tiles were plain bordered text boxes — no icon, no visual identity, reading as a bulleted link list rather than a discovery surface.
5. Section headings (`Typography.Title` only, no consistent rhythm) gave Home's three sections ("Browse categories"/"Featured"/"New arrivals") no visual grouping beyond a plain heading.
6. Grid loading states (`HomePage`, `SearchResultsGrid`) fell back to the generic `SkeletonLoader` — a handful of flat AntD paragraph bars with no resemblance to the eventual product grid, violating the UIUX doc's own §20 ("shape-matched to final content").
7. On `ProductDetailPage`, a failed image load rendered as a **total blank void** — the raw `<img>` had no background/fallback box at all, so any image hiccup (guaranteed in this environment, plausible in production on a slow connection) looked like a broken page, not a designed empty state.
8. `ProductThumbnail`'s original placeholder logic only showed a fallback icon *after* `onError` fired — with 20+ thumbnails queued behind the browser's per-host connection limit, many images hadn't even attempted (let alone failed) by the time the page settled, leaving a blank box with only the (near-black, in dark mode) sunken background visible. Found during dark-mode screenshot verification, not the initial code read — see §12.
9. `ProductGrid`'s `minmax(180px, 1fr)` never allowed more than one column at a 320–375px mobile width, producing an extremely long single-column scroll (the Home page's full-page screenshot was ~10,800px tall on mobile) for what should read as a dense browsing grid.
10. `ProductDetailPage` had no seller/store information anywhere on the page. Checked `ProductDetailDTO` in `packages/shared/src/types/catalog.ts` — it genuinely does not carry `sellerId`/`storeName` (unlike `CartItemDTO`/`SellerCartGroupDTO`, which do). Surfacing it would need a backend DTO/query change, out of scope for a frontend visual-refinement batch — flagged as a decision in §20, not silently skipped or faked.
11. `CartPage`'s item rows (within a seller-group `Card`) had no visual separation between consecutive items — just padding, no divider, so multiple items in one card visually ran together.
12. `ProductDetailPage`'s condition indicator was a bare, unstyled AntD `<Tag>` — the one place on this screen still bypassing the app's own `StatusTag` chip convention.

---

## 5. Visual changes made

- Removed `HomePage`'s duplicate guest CTA block (problem #1).
- Rebuilt `ProductCard`: `<Link>` now resets `color`/`textDecoration` (problem #2), title given real weight/size hierarchy (`--fs-sm`, weight 500) distinct from price, subtle image-zoom-on-hover paired with the existing card shadow lift (UIUX §26 micro-interaction), out-of-stock chip kept, no new badges/decoration added.
- Rebuilt `CategoryGrid`: same anchor-style fix, added a category icon (Lucide, keyword-heuristic mapped — see §6) so tiles read as a discovery surface instead of a link list, icon tints to brand green on hover/focus.
- New `SectionHeader` shared component for Home's three sections, giving them one consistent rhythm.
- New `ProductGridSkeleton` (grid-shaped, matches `ProductGrid`/`CategoryGrid`'s actual layout) replacing the generic paragraph skeleton in `HomePage` and `SearchResultsGrid`.
- `ProductThumbnail` rebuilt: the fallback icon now renders immediately (underneath the `<img>`), and the real image fades in on top only once it has actually loaded — one code path now correctly handles "no photo," "still loading," and "failed to load" instead of three different (and in dark mode, sometimes broken-looking) visual outcomes. Same pattern applied to `ProductDetailPage`'s new `CarouselSlideImage`.
- `ProductDetailPage`: image column switched from a fixed `height: 360` crop to the same 1:1 aspect ratio `ProductThumbnail` already uses everywhere else (closing the one place in the app not following UIUX §13's "product image 1:1" rule); condition indicator switched from a bare `<Tag>` to `StatusTag variant="neutral"`.
- `ProductGrid`'s `minmax` tightened from 180px to 150px, letting the same auto-fill CSS mechanism settle into 2 columns on a real phone width — no separate mobile breakpoint logic added.
- `CartPage`: added a bottom border between consecutive item rows within a group (both the buyer's per-seller groups and the guest's flat list), so multiple items read as a list rather than running together.

---

## 6. Reusable components created

- **`components/SectionHeader.tsx`** (new, shared) — title + optional subtitle, used for Home's three sections. Deliberately has no "View all" action wired up yet (no E2 section has a real destination for one); the prop surface is there for when one does, rather than linking to nowhere.
- **`features/marketplace/ProductGridSkeleton.tsx`** (new, feature-scoped) — a grid-shaped skeleton with a `product`/`category` variant, mirroring `ProductGrid`'s and `CategoryGrid`'s actual grid templates. Feature-scoped rather than `components/`, same reasoning as `ProductGrid` itself: it's tightly coupled to those two grids' exact layout and would drift the moment either changes.

## 7. Reusable components modified

- **`components/ProductThumbnail.tsx`** — see §5/§12. Used by `ProductCard`, `CartPage` (buyer + guest rows), and (indirectly, as the pattern `CarouselSlideImage` now follows) `ProductDetailPage`.
- **`components/index.ts`** — exports `SectionHeader`.

---

## 8. Files modified

- `apps/frontend/src/features/marketplace/HomePage.tsx`
- `apps/frontend/src/features/marketplace/ProductCard.tsx`
- `apps/frontend/src/features/marketplace/ProductGrid.tsx`
- `apps/frontend/src/features/marketplace/CategoryGrid.tsx`
- `apps/frontend/src/features/marketplace/ProductDetailPage.tsx`
- `apps/frontend/src/features/marketplace/SearchResultsGrid.tsx`
- `apps/frontend/src/features/cart/CartPage.tsx`
- `apps/frontend/src/components/ProductThumbnail.tsx`
- `apps/frontend/src/components/index.ts`
- `apps/frontend/src/app/global.css`

**Files created:**
- `apps/frontend/src/components/SectionHeader.tsx`
- `apps/frontend/src/features/marketplace/ProductGridSkeleton.tsx`

**Not modified in this batch** (read/audited, judged already acceptable): `SearchPage.tsx`, `CategoryPage.tsx`, `FilterPanel.tsx`, `SearchBar.tsx`, `StorefrontLayout.tsx`, `EmptyState.tsx`, `PriceDisplay.tsx`, `StatusTag.tsx`.

---

## 9. Explanation of each important change

**`HomePage`'s duplicate CTA removal** — a straightforward bug, not a style choice: `AppHeader`'s `guestActions` slot (wired in `StorefrontLayout`) already renders the exact same Login/Register pair; `HomePage` had its own copy that nothing else in the app duplicates.

**The anchor-underline fix (`ProductCard`, `CategoryGrid`)** — the actual root cause of the Marketplace's "generic template" read. CSS text-decoration lines drawn by an ancestor `<a>` visually propagate through descendant inline boxes regardless of what those descendants set, unless the anchor itself is given `text-decoration: none`. Neither `<Link>` had a `style` prop at all before this batch, so every product/category name rendered with the browser's default link color and underline. This one fix, on its own, changes more about how "designed" the page reads than any token or spacing change would have.

**`ProductThumbnail`'s icon-first rendering** — found during dark-mode screenshot verification (§12), not the initial code read. The original version rendered the fallback icon only in the `onError` branch, so a thumbnail whose image request hadn't resolved yet (very common on a page with 20+ images queued behind the browser's per-host connection cap) showed nothing but the container's own background color. In light mode that background is a warm cream, so it looked acceptable by accident; in dark mode it's close to true black, so it read as a rendering failure. The fix — render the icon immediately, fade the `<img>` in on top only once `onLoad` fires — removes the failure mode entirely rather than just improving its odds of resolving before the user notices.

**Category icons** — categories are admin-managed data (`packages/shared`'s `CategoryDTO`), not a fixed enum, so a hardcoded slug→icon lookup would silently stop working the moment an admin renamed or added one. `CategoryGrid.tsx`'s `ICON_RULES` is a small ordered list of keyword regexes (`electronic`, `fashion|cloth`, `beauty|personal.?care`, etc.) with a neutral `Tag` icon fallback for anything unmatched — a real design decision, not a shortcut; flagged in §20 for your review since it's a heuristic rather than authoritative data.

**`ProductGrid`'s density tightening (180px → 150px)** — purely a `minmax()` value change, not new breakpoint logic. At a 343px usable mobile width (375px viewport minus the content area's 16px side padding), 180px never fit two columns; 150px reliably does. The grid is exactly as responsive as before, it just settles into more columns sooner.

---

## 10. Color / typography / spacing changes

- **No new colors introduced.** Every new visual element (category icons, `StatusTag` condition chip, skeleton shimmer) uses existing tokens (`--text-secondary`, `--text-disabled`, `--brand-primary`, `--bg-sunken`).
- **No spacing values outside the `--sp-*` scale were added.** `SectionHeader` uses `--sp-4`; the Home page's section gaps use `--sp-10` (was `--sp-8` inline before — bumped one step for a touch more breathing room between major sections, still on-scale).
- **Typography**: `ProductCard`'s title now has an explicit `fontWeight: 500` at `--fs-sm` (previously no weight/size override at all, inheriting AntD `Typography.Text` defaults); `CategoryGrid`'s label matches the same treatment. No new font sizes, no Nastaliq usage introduced (Home's `SectionHeader` renders as `<h4>`, correctly staying in IBM Plex Sans Arabic per the existing global Nastaliq rule which is scoped to `h1`–`h3`).

---

## 11. Animation changes

- **`ProductCard` hover**: a contained `scale(1.05)` on the thumbnail image only (not the whole card), `transform`-only (no layout thrash), using the existing `--dur-base`/`--ease` tokens, paired with the pre-existing card shadow lift.
- **`CategoryGrid` hover/focus**: icon color transitions to `--brand-primary` using `--dur-fast`.
- **`ProductThumbnail`/`CarouselSlideImage` image fade-in**: `opacity` transition on successful load, `--dur-base`/`--ease`.
- **Skeleton pulse** (`ProductGridSkeleton`): a gentle `opacity` pulse (`karobarai-skeleton-pulse`, 1.4s), not AntD's moving-gradient shimmer — same visual language, simpler mechanism for this shape.
- All of the above are covered by the existing app-wide `prefers-reduced-motion` rule (targets `*`, already in `global.css` since Phase B) — no new reduced-motion handling needed.
- No entrance animations, parallax, or gradients were added anywhere.

---

## 12. Light-mode verification

Rendered via Playwright against the live dev server + real backend data. Home, Search, Category, Product Detail, and populated/empty Cart all confirmed clean: no overflow, correct card/section spacing, product/category titles render as designed text (not hyperlinks), price hierarchy correct, `StatusTag` chips render with icon+label+color.

## 13. Dark-mode verification

Same five screens re-rendered with `prefers-color-scheme: dark` emulation. Confirmed warm near-black backgrounds (not pure black, not simply inverted), lightened brand green, readable text hierarchy, correct card borders. **Caught and fixed a real dark-mode-specific bug in the process** (§9/§4 item 8) — the first verification pass showed several product cards as a near-black void with no visible icon; root-caused to `ProductThumbnail`'s icon-only-on-error logic, fixed, and re-verified clean on a second full screenshot pass.

## 14. Responsive verification

Desktop (1280px) and mobile (375px) both rendered for every screen. Mobile confirmed: `ProductGrid`/`CategoryGrid` now show 2 columns instead of 1 (Home page's full-page screenshot height dropped from ~10,800px to ~3,673px for the same 24-product feed), `FilterPanel` stacks above results (single-column layout, per UIUX §30's mobile-primary rule), Product Detail stacks image-then-info cleanly, no horizontal overflow anywhere, touch targets (buttons, quantity stepper, category tiles) all remain ≥44px via the existing `controlHeight: 44` theme token. Tablet width wasn't separately screenshotted — the grid's `auto-fill` behavior scales continuously between the verified mobile/desktop widths, and no tablet-specific code exists to diverge from that.

## 15. Urdu/RTL verification

Home, Search, Category, and Product Detail all re-rendered under Urdu. Confirmed: header/sidebar fully mirror, `CategoryGrid`/`ProductGrid` reading order reverses correctly, `ProductDetailPage`'s image/info columns swap sides, `StatusTag`/`QuantityStepper` mirror correctly, Nastaliq renders on genuine page-level headings (`ProductDetailPage`'s `h3` title) while `SectionHeader`'s `h4` correctly stays in IBM Plex Sans Arabic per the existing scoped rule — zero new RTL-specific code was written anywhere in this batch; every fix relies on the same logical-property/flex-mirroring architecture proven since Phase C.

## 16. Accessibility verification

- `StatusTag` (used for out-of-stock and condition chips) already carries icon + label + color, never color alone.
- New `ImageOff` icon placeholders are `aria-hidden="true"` (decorative; the surrounding product title already labels the card).
- `ProductGridSkeleton` is `aria-hidden="true"` (loading placeholders shouldn't be announced as content).
- Touch targets unchanged from the existing `controlHeight: 44` baseline; category tiles/product cards remain comfortably above 44×44px at every verified width.
- Full screen-reader/keyboard-only testing wasn't performed — no such tooling is available in this environment (same limitation noted in every prior phase).

## 17. Functional behavior preserved

No routing, authentication, API calls, cart mutation logic, product-fetching logic, search/filter logic, or localization architecture changed. Verified via real interaction, not just code review: registered as a guest, added a real product to the cart from `ProductDetailPage`, and confirmed the cart badge count and `CartPage`'s totals updated correctly against the live backend.

## 18. Screenshots / browser testing performed

A backend was reachable in this environment (unlike prior Phase D batches), so this batch was verified against **real seeded data**: 8 categories, 12 featured products, 12 new-arrival products, one product added to a live cart. Playwright drove the actual dev server for every check in §12–§15. `console --errors` was checked on every page load; the only errors present were expected `401`s from the session-bootstrap `/auth/refresh` call on a guest's first visit (documented, benign, unrelated to this batch) and the product-image load failures this batch's own fixes were built to handle gracefully.

## 19. Remaining visual problems

- **Object storage (MinIO) is not running in this environment**, so every product photo in every screenshot is the fallback icon, not a real photo. `ProductCard`'s hover image-zoom and the fade-in-on-load transition are implemented and verified in code/via the CSS rules applied, but could not be *visually* confirmed against a real photograph — only against the placeholder icon (which doesn't visibly "zoom" in a way that reads in a static screenshot). This is an environment limitation, not a code gap; flagged rather than silently claimed as fully verified.
- **`FilterPanel`** was audited and left visually as-is (beyond inheriting the app-wide AntD token theming) — it reads acceptably once the surrounding page no longer looks generic, and the brief's own "avoid unnecessary card nesting" guidance argued against wrapping it in a new `Card` just to give it more visual weight.
- **No seller/store info on `ProductDetailPage`** — see §4 item 10 and §20 below.

## 20. Decisions requiring your approval

| Decision | Context |
|---|---|
| Category icons are a keyword-heuristic mapping (`CategoryGrid.tsx`'s `ICON_RULES`), not authoritative per-category data | Categories are admin-managed, not a fixed enum — there's no `iconKey` field on `CategoryDTO` to read from. The heuristic covers every currently-seeded category correctly, with a neutral fallback for anything unmatched, but a newly-added category with an unexpected name could get a generic icon. A real fix would add an icon field to the category schema (backend change, out of scope here). |
| `ProductDetailPage` has no seller/store name | `ProductDetailDTO` genuinely doesn't carry `sellerId`/`storeName` (confirmed in `packages/shared`). The E2 brief listed "Seller information" as an expected Product Detail element; surfacing it needs a backend DTO/query change. Flagging rather than adding fake data or quietly dropping the requirement. |
| `SectionHeader` has no wired "View all" action | No E2 section (Featured/New arrivals) has a real browsable destination beyond the Home feed itself. The prop is there for a future batch once one exists, rather than linking to nowhere now. |

## 21. Known limitations

- Product images could not be visually verified against real photography anywhere in this environment (see §19).
- No project skill exists yet for launching this app — the same one-off Playwright driver technique used in E1 was reused here (installed to a scratch directory, not the repo; no `package.json`/lockfile changes).
- Tablet width (768–991px) wasn't separately screenshotted, per §14.

## 22. E2 completion status

**Complete.** Type-check, production build, and full light/dark/desktop/mobile/EN/Urdu-RTL browser verification all pass. One real bug (duplicate guest CTA) and one real dark-mode regression (found during this batch's own verification, not pre-existing) were both fixed and re-verified, not just reported.

## 23. Change-log entry (2026-08-16)

Phase E batch E2 (Marketplace / Buyer Experience) completed. Root-caused and fixed the Marketplace's core "generic Ant Design template" problem: `ProductCard`/`CategoryGrid` links had no anchor-style reset, so every product/category title rendered as a raw underlined hyperlink — the single strongest "unstyled" signal on the page. Rebuilt `ProductCard` (image hover-zoom, real title/price typographic hierarchy) and `CategoryGrid` (keyword-mapped category icons). Added `SectionHeader` and a grid-shaped `ProductGridSkeleton` (closing a UIUX §20 gap — loading states previously used a generic paragraph skeleton with no resemblance to the eventual grid). Fixed a genuine bug (`HomePage` duplicating its own guest login/register CTA already provided by the header) and a genuine dark-mode regression found during this batch's own verification (`ProductThumbnail`'s fallback icon only appeared after an image failed, leaving a near-black void for any thumbnail still in flight). Fixed `ProductDetailPage`'s image column, which previously rendered as a total blank void on any load failure. Tightened `ProductGrid`'s density so mobile shows 2 columns instead of 1. Verified against real seeded backend data (8 categories, 24 products) across light/dark, desktop/mobile, and English/Urdu-RTL — the first Marketplace batch verified this way, since prior phases had no reachable backend. 2 new files, 10 modified. Type-check/build verified green both before and after the dark-mode fix.
