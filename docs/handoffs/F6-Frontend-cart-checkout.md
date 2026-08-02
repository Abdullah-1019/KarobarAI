# Handoff — F6 Cart & Checkout (Frontend)

**Status:** Complete — 2026-08-02. Built against `F6-cart-checkout-backend.md` (already real,
280/280 backend tests). `tsc --noEmit` and `vite build` both clean. Live buyer-journey testing
surfaced three pre-existing environment/data issues, not caused by this feature's own code — see
**Bugs found (not scoped to F6)** below; all are now fixed.

## Screens built

| Route | Screen |
|---|---|
| `/cart` | Cart (SCR-B04) — public. Items grouped by seller (preview of order splitting), qty stepper, remove, per-seller subtotal + min-order-value warning, inline "only N left" for stock conflicts |
| `/checkout` | Checkout (SCR-B05) — Buyer-only. Address picker (+ "add new" inline modal), payment method (JazzCash / Easypaisa / COD), per-seller order summary (no commission — backend already omits it from every buyer-facing response) |
| `/checkout/confirmation` | Order Confirmation (SCR-B06) — Buyer-only. Shows every order created by the one checkout call (a multi-seller cart splits into N orders); redirects home if visited without the confirmation state (no by-id refetch exists for a *set* of orders) |

`/cart` deliberately stays outside the Buyer-only route group — a guest can build and view a cart;
only `/checkout` onward requires an account.

## Key files

- `features/cart/cartApi.ts` — cart CRUD, address CRUD, `checkout()` (attaches the required
  `Idempotency-Key` header)
- `CartPage.tsx` — branches on auth state: signed-in Buyer reads the persisted cart (React Query),
  guest reads `guestCartStore` directly
- `AddressForm.tsx`, `AddressPicker.tsx` — same react-hook-form + zod pattern as `StoreSetupWizard.tsx`
- `CheckoutPage.tsx`, `CheckoutConfirmationPage.tsx`
- `guestCartStore.ts` — zustand + `persist` (localStorage) — the *only* piece of cart state not in
  React Query, since there's no backend guest-cart endpoint. Snapshots title/price/image per item
  so the guest cart renders with zero extra product fetches.
- `useCartCount.ts` — derived hook backing the header's cart badge (sums the persisted cart for a
  Buyer, the guest store otherwise) — not a second source of truth.
- `useGuestCartMerge.ts` — fires once when `authStore.user` becomes a Buyer (login, OTP-verified
  registration, or session restore); replays the guest cart via repeated `POST /cart/items`
  (`Promise.allSettled` so one out-of-stock guest item doesn't block merging the rest), then clears
  the guest store. Mounted from `StorefrontLayout`.

## Small edit to an existing Feature 1 file

`features/auth/LoginPage.tsx` now reads an optional `redirect` from `useLocation().state`. A
guest's "Buy Now" (`ProductDetailPage`) or "Checkout" (`CartPage`) sends them to `/login` with
`state: { redirect: '/checkout' }`; login now honors it instead of always routing to
`roleHomePath()`. No redirect-back mechanism existed before this feature needed one.

## Bugs found (not scoped to F6, found while live-testing this feature)

1. **Migration drift.** This dev database had only 3 of the 6 committed Prisma migrations applied
   — missing `add_seller_profile_banner_url`, `enable_unaccent_extension`, and (the one that broke
   checkout) `add_address_recipient_name`. Every `GET/POST /addresses` call 500'd at the DB layer,
   which is what made "Place order" look permanently disabled — the address list was silently
   empty, not a UI bug. Fixed with `prisma migrate deploy` (all three migrations verified additive/
   safe — the `addresses` table had zero rows — before applying).
2. **Stale generated Prisma Client.** After the migration, the already-running backend still threw
   `Unknown argument recipientName` — `migrate deploy` applies SQL but doesn't regenerate the
   client. Fixed with `prisma generate` + a backend restart (the old client's native query engine
   DLL was locked by the running process, so the restart had to happen first).

## Known environment gap (not a code bug)

Object storage (MinIO) has to actually be running for product images to resolve — see
`F5`/`F4`'s handoffs for the same note. In this dev sandbox it isn't wired to auto-start; a
Windows-service installer script was prepared but needs a one-time admin-elevated run.

## Not built (deferred, different feature)

Order history/detail after checkout (`/orders`) is Feature 7.
