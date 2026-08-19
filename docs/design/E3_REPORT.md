# E3 Report — Cart + Checkout + Orders

**Date:** 2026-08-18
**Status:** ✅ Complete

---

## 1. E3 Overview

E3 covers the Buyer's Cart → Checkout → Order Confirmation → Orders → Order Details experience — the purchase-commitment path that follows Marketplace (E2, already complete) and precedes Tracking/Returns/Notifications (E6, not yet started).

The objective was to make this path feel like one coherent, trustworthy ecommerce flow using the existing KarobarAI design system, without rebuilding working functionality. The single biggest finding driving this batch: **the existing Checkout page never showed the buyer a grand total before they placed an order** — only per-seller subtotals — a real trust/transparency gap the brief's "what will I pay" requirement pointed straight at. Two more concrete bugs were also found and fixed during implementation and verification (see §3, §9): a dark-mode contrast bug affecting `StatusTag` chips app-wide, and a mobile layout bug that squeezed cart item titles to zero width.

---

## 2. Screens Covered

| Screen ID | Screen Name | Route | File |
|---|---|---|---|
| SCR-B04 | Cart | `/cart` | `features/cart/CartPage.tsx` |
| SCR-B05 | Checkout (Delivery + Payment + Order Review, one page) | `/checkout` | `features/cart/CheckoutPage.tsx` |
| SCR-B06 | Order Confirmation | `/checkout/confirmation` | `features/cart/CheckoutConfirmationPage.tsx` |
| SCR-B07 | Orders / Order History | `/orders` | `features/orders/BuyerOrdersPage.tsx` → shared `OrderListPage.tsx` (`scope="buyer"`) |
| SCR-B07 (detail) | Order Details | `/orders/:id` | `features/orders/BuyerOrderDetailPage.tsx` → shared `OrderDetailPage.tsx` (`scope="buyer"`) |
| — | Order Status / Tracking entry point | within Order Details → `/orders/:id/track` | Same `OrderDetailPage.tsx` — "Track shipment" button; the tracking screen itself is E6 scope |

**Architecture note, reported per your instruction to use existing structure rather than invent screens:** "Delivery Information," "Order Review," and "Payment" are not three separate screens in this codebase — `CheckoutPage.tsx` is one single-page checkout. Rather than build a new multi-step wizard (a functional rewrite, not a UI refinement), these map onto three clearly Card-separated sections on the same existing page/route. `OrderListPage.tsx` and `OrderDetailPage.tsx` are each **shared with the Seller role** (`/seller/orders`, `/seller/orders/:id`) via a `scope` prop — changes to them were kept to generic, role-neutral improvements (see §5) rather than Buyer-specific redesigns, to avoid overstepping into Seller's screens (E4 scope).

---

## 3. Changes Made

**Cart (`CartPage.tsx`)**
- Wrapped the grand-total + Checkout CTA in its own elevated, sticky `Card` — previously a bare flex row with no visual boundary from the cart contents above it, failing the brief's explicit "strong visual separation" requirement.
- Fixed a real mobile bug: item rows (thumbnail + title + price + quantity stepper + remove button) squeezed the product title to zero visible width on a ~375px phone, because the quantity stepper alone is ~140px wide. Restructured with a `flex-wrap` pattern so quantity/remove controls drop to their own line below the product info on narrow screens — an intentional two-line mobile layout, not the desktop row simply shrunk.

**Checkout (`CheckoutPage.tsx`)** — rebuilt with three Card-separated sections:
- **Delivery address**: `AddressPicker`'s radio options now render as selectable cards (highlighted border + tint when chosen) instead of plain radio rows.
- **Payment method**: same selectable-card treatment, each method gets an icon (banknote for COD, phone for JazzCash/Easypaisa), plus a small trust-indicator line ("Your payment details are never shared with the seller.") per the brief's "secure/trust indicators" ask.
- **Order summary**: now shows actual line items (thumbnail, title, quantity, price) per seller group — previously only a per-seller subtotal was shown, with no visibility into *what* was being bought at the final review step. Added the real grand subtotal and total (computed from already-fetched cart data, no new API calls) — **previously no total was shown anywhere on this page**. Added an "Edit cart" link back to `/cart`.
- A shipping-fee line was deliberately **not** added here: no frontend API call exists to estimate it before checkout (checked `cartApi.ts`), and fabricating a number would violate "don't use hardcoded data instead of existing data sources." The existing "Shipping fee is calculated per seller" note is shown instead, and the real fee appears immediately after on the confirmation screen once it's known.

**Order Confirmation (`CheckoutConfirmationPage.tsx`)**
- Replaced the AntD default checkmark styling with a single brand-green `CheckCircle2` icon — calm, not celebratory, per the brief.
- Added a "delivering to" address recap (passed through `navigate()`'s state from `CheckoutPage`, since `CreatedOrderDTO` itself carries no shipping fields — no new API call).
- Added the full item list and subtotal/shipping-fee/total breakdown per order — the data (`CreatedOrderDTO.items`, `.subtotal`, `.shippingFee`) already existed and was fetched, just never rendered; only the total was shown before.
- Added a "what happens next" reassurance line.

**Orders / Order History (`OrderListPage.tsx`)**
- Added a mobile card-list view alongside the existing desktop `Table` (CSS-toggled by breakpoint, no JS viewport state, matching the app's established pattern) — the same data renders as scannable cards (order ID, status, date, store, item count, total, a "View order" button) instead of a cramped table on a narrow phone.

**Order Details (`OrderDetailPage.tsx`)**
- Reordered sections to match the brief's recommended hierarchy: status header → order-summary glance line (placed date, item count) → Items → Payment (now includes payment method and payment status, previously not shown at all despite the data existing on `OrderDetailDTO`) → Shipping/delivery → Status history → Actions.
- Payment status renders as a `StatusTag` (e.g. "Pending" for COD, amber; "Confirmed" for online payment, green) instead of being absent.

---

## 4. Components Created / Updated

**Created:**
- `features/cart/SelectableOptionCard.tsx` — the "selectable option card" shell used by both the address list and the payment-method list (same visual pattern, one implementation instead of two).

**Updated:**
- `components/ProductThumbnail`, `PriceDisplay`, `StatusTag`, `QuantityStepper`, `EmptyState` — reused as-is, no changes needed (confirms E1/E2 picked durable abstractions).
- `AddressPicker.tsx` — now composes `SelectableOptionCard`.
- Global CSS (`app/global.css`) — three new rule blocks: `.karobarai-cart-item*` (mobile item-row stacking), `.karobarai-orders-table`/`.karobarai-orders-cards` (responsive list toggle), and dark-mode soft-tint token overrides (see §9).

No new components were created merely for the sake of it — `PriceDisplay`, `ProductThumbnail`, `StatusTag`, and `EmptyState` already covered everything else the brief's example list named.

---

## 5. Responsive Improvements

- Cart item rows: quantity/remove controls move to their own line below product info under 480px (see §3).
- Cart summary: sticky `Card` that respects the existing mobile bottom-tab-bar clearance (`.karobarai-content-area`'s reserved padding), verified not to overlap the tab bar.
- Orders list: `Table` (desktop) ⇄ card list (mobile, <768px) via the app's existing pure-CSS breakpoint pattern — no JS viewport detection, nothing to fall out of sync with the real viewport.
- Checkout: all three sections stack cleanly in the existing single-column mobile layout; verified no horizontal overflow at 375px.
- Touch targets: `SelectableOptionCard` options, quantity stepper buttons, and all CTAs remain ≥44px via the existing `controlHeight: 44` theme token — unchanged, not newly introduced.

---

## 6. Accessibility Improvements

- `AddressForm.tsx`: every field now has a real `id`/`htmlFor` pair and `aria-invalid`/`aria-describedby` wired to its error text — previously plain `<label>` tags with no programmatic association (same gap pattern closed in E1's auth/profile forms).
- Payment-status and order-status are always communicated via `StatusTag` (icon + label + color), never color alone.
- `SelectableOptionCard` wraps AntD's own `<Radio>` rather than reimplementing radio semantics — full keyboard navigation and screen-reader behavior is inherited, not rebuilt.
- Fixed a real contrast bug (see §9) that would otherwise have made selected-option text and every `StatusTag` chip's text nearly illegible in dark mode.

---

## 7. Functional Verification

Verified against a **live backend with real interaction**, not just code review: registered a real Buyer account, added two products (from the same seller, in this environment's seed data) to the cart, added a real delivery address through `AddressForm`, selected Cash on Delivery, and placed a real order. Confirmed:
- Cart quantity update and item removal mutations still call the same `cartApi` functions, unchanged.
- Checkout still uses the same idempotency-key contract, the same `checkout()` call, the same COD-vs-online-payment confirmation logic.
- The placed order correctly appears in `/orders` and its detail page shows the real persisted data (status, payment method/status, items, shipping address, timeline).
- No routing, authentication, API contracts, or business logic were changed — every edit is presentational/structural (JSX layout, new CSS classes, one new component) or additive (rendering already-fetched data that wasn't shown before).

**Type-check:** clean, both mid-implementation and after all fixes.
**Production build:** clean (`vite build`, 3m27s — same pre-existing >500kB chunk-size warning as every prior phase, unrelated to this batch).
**Lint:** no lint configuration exists for this app (unchanged from prior phases).

---

## 8. Visual QA

Rendered via Playwright against the live dev server and the real backend (not mocked), across the full purchase flow, in: light/desktop, dark/desktop, light/mobile, dark/mobile, and a full Urdu/RTL pass (desktop). Two real problems were caught by this process, not assumed away:

1. **Dark-mode contrast bug** — the first dark-mode screenshot of Checkout showed the selected address/payment card's text as nearly invisible (light dark-mode text on an unintentionally near-white background). Root-caused to `--brand-primary-soft` and the other `-soft` tint tokens never having a dark-mode override anywhere in `global.css` — a gap that also affected every `StatusTag` chip app-wide (order status, payment status, product-card out-of-stock chip, etc.), not just this batch's new component. Fixed at the token level and **re-verified with a second full screenshot pass** — confirmed legible on Checkout's selected cards and on Order Detail's "Pending"/"Payment confirmed" chips.
2. **Mobile cart item-title squeeze** — caught in the first mobile screenshot, fixed, re-verified (see §3).

RTL verification confirmed: full header/section mirroring, payment-method icons correctly positioned, Nastaliq rendering on page-level headings ("Checkout," "Order placed!"), numerals staying LTR within RTL text (standard convention, unchanged), zero new RTL-specific code required anywhere in this batch — everything relies on the same logical-property/token architecture proven since Phase C.

---

## 9. Remaining Issues

- **No shipping-fee estimate before checkout.** Genuinely not available client-side (no API call exists to fetch it pre-order) — the real fee only becomes known once the order is placed, and is shown immediately on the confirmation screen. Flagged rather than fabricated.
- **Only one seller was present in this environment's test cart** (both test products belonged to the same seller), so the "divider between multiple seller groups" code path in `CheckoutPage`'s order-summary section was verified by code review, not visually — the render logic reuses the same `eligibleGroups.map()` structure already proven correct for Cart's multi-group rendering (unchanged since D1/E2), so this is low-risk, but flagging that it wasn't visually exercised.
- **The dark-mode soft-tint fix is a global token change**, not scoped to E3 screens only — it will also visibly change `StatusTag` chip backgrounds in dark mode on every other screen in the app (Marketplace, Profile, Seller, Admin, etc.). This is a correctness fix (those chips were already broken in dark mode, just not yet caught), not a new design decision, but flagging the blast radius for visibility.

---

## 10. Recommendations for Next Phase

- **E4 (Seller)** will render through the same `OrderListPage`/`OrderDetailPage` components this batch touched (`scope="seller"`) — worth a quick visual pass early in E4 to confirm the responsive card-list and reordered detail sections read correctly for Seller's slightly different data (commission, courier booking, cancel action), even though the underlying components weren't given Seller-specific changes here.
- **E6 (Tracking)**: `OrderDetailPage`'s "Track shipment" entry point was preserved as-is; when E6 starts, it should assume this button/link is the one and only entry point into tracking from Orders, not build a second one.
- Consider, in a future batch (not urgent), doing the same dark-mode `-soft` token audit for any other token pairs that might have the same "light-only" gap — this batch fixed the ones it found, but wasn't an exhaustive sweep of the entire token file.
