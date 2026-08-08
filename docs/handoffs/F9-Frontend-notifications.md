# Handoff — F9 Notifications (Frontend)

**Status:** Complete — 2026-08-08. Built against the already-signed-off `notification/` backend
module (`docs/DoneTillNow.md`'s Feature 9 entry — 443/443 backend tests). `tsc --noEmit` and
`vite build` both clean.

## Screens built

| Route | Screen |
|---|---|
| Bell icon in the header | Unread-count badge, click navigates to `/notifications`. Mounted in both `StorefrontHeader` (Buyer) and the new `SellerLayout` (Seller) |
| `/notifications` | Notification Center — cursor-paginated list, any authenticated role (Buyer/Seller/Admin), unread items bold, click marks read + navigates to the related order |

## Key files

- `features/notifications/notificationsApi.ts` — `listNotifications`/`getUnreadCount`/`markAsRead`, one stable `notificationsQueryKey` for the whole paginated set (cursor is a `useInfiniteQuery` `pageParam`, not part of the key — same convention as `features/orders/ordersApi.ts`)
- `useUnreadCount.ts` — derived hook mirroring `features/cart/useCartCount.ts`'s shape; **polls** every 30s rather than pushing live — no Socket.IO channel exists for notifications, only Feature 8's `/tracking` namespace does
- `NotificationBell.tsx` — plain 🔔 glyph, not an icon package. `@ant-design/icons` isn't installed anywhere in this app (`components/QuantityStepper.tsx`'s own precedent: "no icon package... uses plain text glyphs"), so this follows the same convention rather than adding a new dependency for one button
- `NotificationCenterPage.tsx` — `antd List` + "Load more" (same pattern as `OrderListPage.tsx`'s table+load-more, just a different antd component since this is a simple message feed, not tabular data). `message` on every item arrives already rendered server-side in the recipient's own language (`notification.service.ts`'s `renderForRecipient`) — zero client-side templating
- `notificationsErrors.ts` — same `formatXError(t, err)` convention as every other feature (`ordersErrors.ts`, `authErrors.ts`, ...)

## A real, pre-existing gap found and fixed as part of this pass (not a Feature 9 bug — a Feature 3/7 gap)

**Every `/seller/*` page rendered with zero persistent header or nav before this feature.**
`StorefrontLayout`/`StorefrontHeader` (Feature 5/7) only ever wrapped Buyer/public routes; no
`SellerLayout` existed anywhere, confirmed by reading `router.tsx` and every seller page file. A
bell icon would have been invisible on every page a Seller actually works in (Products, Orders) —
exactly where courier-failure/manual-logistics alerts matter most. Confirmed with the user before
building rather than silently expanding scope; built `features/seller/SellerLayout.tsx` (title,
Dashboard/Orders nav, language switch, the bell, profile+logout dropdown — mirrors
`StorefrontHeader.tsx`'s existing Seller menu-items branch) and re-nested the whole `/seller/*`
route branch under it in `router.tsx`. `RequireStore`'s own redirect behavior is unchanged — this
is a wrapping restructure, not new gating logic.

## Modified existing files

- `features/marketplace/StorefrontHeader.tsx` — added `<NotificationBell />` next to the existing profile dropdown, only when `user` is present
- `app/router.tsx` — `/seller/*` branch re-nested under the new `SellerLayout`; new top-level `/notifications` route (`ProtectedRoute allowedRoles={['BUYER','SELLER','ADMIN']}`, not nested under either layout — same bare-page convention as `features/tracking`'s detail-style pages)
- `locales/en|ur/index.ts` — new `notifications` export (its own namespace this time, not folded into an existing one — unlike Feature 8's `orders` reuse, this has its own screen and no natural parent namespace)
- `app/i18n.ts` — registered the new `notifications` namespace/resources

## Known limitations / not built

- **Most `ORDER_*` notification types can't be produced on a real order right now** — per the bug
  flagged in `docs/handoffs/F8-Frontend-courier-tracking.md`, `confirmPayment()` (and everything
  downstream of it, including `ORDER_PAYMENT_CONFIRMED`'s enqueue) is never called in production.
  `COURIER_MANUAL_LOGISTICS` and `TRACKING_POLL_FAILURE` (Feature 8's poll job) are the two event
  types with a genuinely working producer today — the realistic manual-test path until that
  backend gap is closed.
- **No live push for the badge or list** — polls on a 30s interval. Wiring notifications into
  Feature 8's existing `/tracking` Socket.IO namespace would be a scope mismatch (that namespace is
  explicitly per-order-room, not a general per-user channel); a real fix would mean a new,
  general-purpose namespace on the backend, out of this frontend-only pass.
- **Admin click-through not built** — a notification with an `orderId` only navigates for
  Buyer/Seller. Admin's own order-detail screens don't exist yet (Feature 12 frontend is still a
  placeholder), so there's nowhere sensible to send an Admin click yet.
- **No inline dropdown preview** — clicking the bell navigates to the full `/notifications` page
  rather than showing a small preview list in a popover. Simpler, and consistent with how every
  other icon action in this app (cart, profile) either navigates or opens a full menu, never an
  inline content preview.
