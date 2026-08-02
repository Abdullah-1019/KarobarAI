# Handoff — F7 Order Management (Frontend)

**Status:** Complete — 2026-08-02. Built against `F7-orders-backend.md` (already real, extends
Feature 6's `order/` module). `tsc --noEmit` and `vite build` both clean.

## Screens built

| Route | Screen |
|---|---|
| `/orders` | My Orders (SCR-B07) — Buyer-only. Status-tab filter (`ORDER_STATUS_TABS`), cursor pagination |
| `/orders/:id` | Buyer's order detail — shipping info, items, payment summary (no commission — backend only ever sends that to the order's own Seller), status timeline, invoice |
| `/seller/orders` | Seller Order Management (SCR-S05) — same tab/list pattern as the buyer list; rows flag an alert badge when `status === 'PENDING_MANUAL_LOGISTICS'` |
| `/seller/orders/:id` | Seller's order detail (SCR-S06, **minus the courier-booking portion** — Feature 8, not built) — commission visible, Cancel action while pre-shipment |

## Key files

- `features/orders/ordersApi.ts` — buyer/seller list + detail + `cancelOrder` + `viewInvoice`
- `OrderListPage.tsx` / `OrderDetailPage.tsx` — **one generic component each**, taking a
  `scope: 'buyer' | 'seller'` prop, rather than two parallel implementations. Buyer/seller DTOs are
  identical modulo `commission` (which the backend already strips for buyers), and both list
  endpoints share the same `ORDER_STATUS_TABS` contract — splitting the UI would only have
  duplicated the tab/table/timeline code.
- `BuyerOrdersPage.tsx`, `SellerOrdersPage.tsx`, `BuyerOrderDetailPage.tsx`,
  `SellerOrderDetailPage.tsx` — thin route wrappers around the two generic pages above
- `OrderStatusTag.tsx` — mirrors `features/catalog/ProductStatusTag.tsx`'s color-map pattern

## Invoice gotcha

`GET /orders/:id/invoice` returns `text/html` and needs auth, but this app's auth is a **Bearer
token held in memory** (`api/client.ts`), not a cookie — a plain `window.open(url)` sends no
`Authorization` header and 401s. `viewInvoice()` fetches it as a blob through the shared
`apiClient` first, then opens the blob URL in a new tab. The browser's native "Print to PDF"
covers the download-as-PDF case, matching the backend's own explicit choice not to add a PDF
library for one document.

## Small addition to an existing Feature 1 file

`features/auth/authApi.ts` gained a `logout()` call (`POST /auth/logout`) — no frontend caller
existed for it before, because there was no header/nav shell to put a logout action in until
Feature 5's `StorefrontHeader` needed one for its profile dropdown menu.

## Explicitly out of scope (Feature 8, not built)

Courier booking/selection UI (SCR-S06's recommended-courier card, override dropdown), live
tracking screens (SCR-B08's map/timeline, SCR-B09's public token page), WebSocket push updates.
Order Detail renders whatever `timeline` events already exist and a static "Not yet booked"
`courierStatus` label — both are exactly what the backend sends; there's no polling or booking
action anywhere in this feature.

## Not built

Buyer-initiated cancel/return — per the backend handoff's own Assumption, cancel is Seller-only in
this feature; a Buyer-facing cancel/return-request flow would be new scope.
