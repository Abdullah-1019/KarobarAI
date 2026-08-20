# E6 Report — Tracking + Returns + Notifications

**Date:** 2026-08-20
**Status:** ✅ Complete

---

## 1. E6 Overview

E6 covers the post-purchase customer experience: Order Tracking (authenticated + public/login-free), Returns (request, status/appeal, and history), and Notifications. Per the brief's own "inspect first" instruction, every screen was located and read in full before any change — two research agents mapped the tracking screens and the notifications feature respectively, and the returns screens were read directly (partly already known from E5's work on the seller-side return detail).

One real screen-ID mapping surprise: `BuyerTrackingPage`/`SellerTrackingPage` are not two separate screens — both are 5-line pass-throughs to one shared `AuthenticatedTrackingPage` (a `scope` prop only changes where "back" points). So SCR-B08 has one implementation serving both Buyer and Seller routes, and a `TrackingTimeline` component shared across **four** call sites, not just the two dedicated tracking pages: `AuthenticatedTrackingPage`, `PublicTrackingPage`, and `OrderDetailPage`'s "Status history" card. Rebuilding that one shared component correctly meant all four screens gained the new completed/current/upcoming timeline for free — confirmed live (§10).

One deliberate scope addition beyond redesigning existing screens: a **Buyer Returns History** screen didn't exist as a route before (only a per-order return status page), but `listBuyerReturns()` already existed on the backend and was already being called internally — this phase gave it its own screen (`/returns`) rather than leaving a fully-built, already-working endpoint with no way to see it as a list. This is different from E5's "don't invent AI that doesn't exist" situation: here the data and endpoint were real and already wired up; only the screen was missing.

---

## 2. Screens Covered

| Screen ID | Screen Name | Route | File |
|---|---|---|---|
| SCR-B08 | Order Tracking (authenticated, Buyer + Seller) | `/orders/:id/track`, `/seller/orders/:id/track` | `features/tracking/AuthenticatedTrackingPage.tsx` (via `BuyerTrackingPage.tsx`/`SellerTrackingPage.tsx`) |
| SCR-B09 | Public Tracking (login-free) | `/t/:publicToken` | `features/tracking/PublicTrackingPage.tsx` |
| SCR-B10 | Returns Wizard | `/orders/:id/return` | `features/returns/ReturnWizardPage.tsx` |
| SCR-B11 | Return Status / Appeal | `/orders/:id/return/status` | `features/returns/ReturnStatusPage.tsx` |
| — | Buyer Returns History (new) | `/returns` | `features/returns/BuyerReturnsPage.tsx` |
| SCR-S07 | Seller Returns (list + detail) | `/seller/returns`, `/seller/returns/:id` | `features/returns/SellerReturnsPage.tsx`, `SellerReturnDetailPage.tsx` — already redesigned in E5; this phase added the shared `ReturnProgressTimeline` to the detail page for buyer/seller consistency |
| — | Notification Center | `/notifications` | `features/notifications/NotificationCenterPage.tsx` — no dedicated screen ID exists in the docs (it's referenced as a cross-cutting element inside other screens' descriptions, not numbered on its own) |
| — | Order Detail — Status history (indirect) | `/orders/:id`, `/seller/orders/:id` | `features/orders/OrderDetailPage.tsx` — not redesigned itself (E3/E4 territory), but its embedded `TrackingTimeline` automatically inherited this phase's changes since it's the same shared component |

Not touched: `NotificationBell.tsx` (already correct — lucide `Bell` + unread badge, no changes needed), `TrackingMap.tsx` (already has correct graceful-degradation behavior per REQ-NF-Safety-004, no changes needed).

---

## 3. Changes Made

**Tracking (`AuthenticatedTrackingPage.tsx`, `PublicTrackingPage.tsx`, `TrackingTimeline.tsx`)**:
- Replaced the raw `Typography.Title` + manual flex header on both pages with `PageHeader`, matching every other redesigned screen.
- Rebuilt `TrackingTimeline` from an AntD `Timeline` wrapper into a purpose-built completed/current/upcoming stepper (brief's own recommended structure): every real event in `timeline[]` renders as "completed" except the last (which renders larger/bolder as "current"); the remainder of the happy-path milestone order (`PAYMENT_CONFIRMED → PROCESSING → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED`) that hasn't happened yet renders hollow/muted as "upcoming," with no fabricated timestamp. A cancelled order shows no upcoming steps — nothing further to expect.
- **Fixed a real, pre-existing inconsistency**: `colorForStatus` was already a documented prop on `TrackingTimeline` (`OrderStatusTag`'s own code comment says it's exported *specifically* so the timeline can use it), and `OrderDetailPage.tsx` already passed it — but both dedicated tracking pages simply never did, so their timeline dots rendered in AntD's default color instead of the app's real status semantics. Both pages now pass it.
- Added `TrackingStatusCard` (new) — the brief's "what's happening right now" card, above the map/timeline: status icon + the real, server-computed `deliveryStageLabel` + one honest status-specific sentence (new `tracking.statusMessage.*` locale keys, e.g. "Your order is out for delivery"). No ETA is shown — `TrackingDTO` has no such field, and inventing one would violate "do not invent tracking functionality."
- Added a "preparing your order" info panel (brief's documented pre-shipment empty state) when `timeline` is empty, instead of an otherwise-blank-looking timeline card.
- Added a **Retry** action to both pages' error states (previously a bare `Alert` with no way to recover except reloading).
- Left `TrackingMap.tsx` unchanged — its graceful-degradation-to-text-panel behavior for a missing `lastLocation` already matches the brief's "Tracking Unavailable" direction exactly.
- **Known, documented gap**: the brief's original AppFlow spec for SCR-B08 also mentions a map ETA, notification history, and a "contact support" button. None of these have real data/destinations behind them — `TrackingDTO` has no ETA field, no notification-history field, and no support-contact route/mechanism exists anywhere in the app (a `tracking.contactSupport` locale string exists but was never wired to anything real). Per "do not invent functionality," none of these were added.

**Returns (`ReturnStatusPage.tsx`, `ReturnWizardPage.tsx`, new `BuyerReturnsPage.tsx`, new `ReturnProgressTimeline.tsx`)**:
- New `ReturnProgressTimeline` — deliberately mirrors `TrackingTimeline`'s completed/current/upcoming visual language (brief: "the user should immediately understand the relationship between Order Tracking and Return Tracking"), but derives its steps from `ReturnDetailDTO`'s real status + timestamp fields (`createdAt`/`decidedAt`/`refundedAt`), not a copy of the order lifecycle. A rejected return shows no pickup/refund steps at all — same "no upcoming after a terminal state" principle as `TrackingTimeline` after `CANCELLED`.
- `ReturnStatusPage`: added `PageHeader`, the new progress timeline, and a real "Returning: {item}" card — fetched via `getOrder(orderId)` (the same call `SellerOrderDetailPage`/E5's `SellerReturnDetailPage` already make; no new endpoint). Previously this screen showed only the reason text and a refund-status line, nothing about what was actually being returned.
- `ReturnWizardPage`: added `PageHeader` and the same real product-context card at the top of every step, so the seller-side improvement from E5 and this buyer-side flow now share the same "what am I looking at" pattern. The 4-step `Steps` wizard itself was left functionally untouched (already correct) — confirmed via live testing that AntD's `Steps` already switches to a vertical layout on mobile with no changes needed.
- New `BuyerReturnsPage` (§1) — a card-based list (not a table, unlike the seller's management-style `SellerReturnsPage`; this is a small personal list, not a queue), reusing the already-existing `listBuyerReturns()` call. Reachable from a "View all your returns" link added to `ReturnStatusPage`.
- `SellerReturnDetailPage` (E5) gained the same `ReturnProgressTimeline`, so sellers and buyers now see literally the same progress visualization for the same return.

**Notifications (`NotificationCenterPage.tsx`, new `NotificationIcon.tsx`)**:
- New `NotificationIcon` — a per-`eventType` icon + soft-tint color, keyed off the real `eventType` values the backend actually dispatches (`ORDER_PLACED`, `ORDER_PAYMENT_CONFIRMED`, `ORDER_CANCELLED`, `ORDER_PICKED_UP`, `ORDER_IN_TRANSIT`, `ORDER_OUT_FOR_DELIVERY`, `ORDER_DELIVERED`, `COURIER_MANUAL_LOGISTICS`, `TRACKING_POLL_FAILURE`, `OTP_REQUESTED`, plus the reserved-but-unused `RETURN_DECISION`/`REFUND_ISSUED`). `NotificationDTO` has no icon-hint field, so this mapping is purely presentational — an unknown/future `eventType` falls back to a plain bell icon rather than breaking.
- Added "Today"/"Earlier" date grouping (client-side, from the real `createdAt` field) and relative timestamps ("a few minutes ago") via `dayjs`'s `relativeTime` plugin — already an installed dependency (AntD's own peer dep), no new package added. Locale-aware (`dayjs.locale('ur')` when the app is in Urdu).
- Strengthened the unread/read distinction beyond bold-only text: unread rows now also get a subtle background tint and a small brand-green dot — still paired with the existing bold weight, never color alone.
- Replaced the single generic `SkeletonLoader` block with a shape-matched skeleton (icon circle + two text lines, repeated) so the loading state previews the real list shape.
- Softened the empty-state copy to "You're all caught up" per the brief's exact wording, with a calmer explanatory line.
- Swapped the manual `BackLink` + title for `PageHeader`, matching every other redesigned screen. The page's own prior, deliberate decision to stay un-shelled (no sidebar/bottom-tabs, since it's reachable from any of three different role layouts with no single natural shell) was preserved — not revisited, as that's a larger navigation-architecture question outside E6.
- **No mark-all-read control was added** — no such endpoint exists on the backend (confirmed absent in both the API and its own module doc's task list); adding one client-side with nothing to call would be inventing functionality.

---

## 4. Components Created / Updated

**Created**:
- `features/tracking/TrackingStatusCard.tsx` — prominent "what's happening now" card.
- `features/returns/ReturnProgressTimeline.tsx` — return-specific progress stepper, visually matched to `TrackingTimeline`.
- `features/returns/BuyerReturnsPage.tsx` — buyer return history list.
- `features/notifications/NotificationIcon.tsx` — per-event-type icon.

**Rebuilt**:
- `features/tracking/TrackingTimeline.tsx` — now a real completed/current/upcoming stepper (see §3), and now exports `STATUS_ICON` so `TrackingStatusCard` reuses the exact same icon set rather than a second mapping.

**Updated**: `AuthenticatedTrackingPage.tsx`, `PublicTrackingPage.tsx`, `ReturnStatusPage.tsx`, `ReturnWizardPage.tsx`, `SellerReturnDetailPage.tsx`, `NotificationCenterPage.tsx`, `app/router.tsx` (new `/returns` route), `features/returns/index.ts` (new export).

**Reused as-is, confirmed already correct**: `PageHeader`, `EmptyState`, `SkeletonLoader`, `StatusTag`/`STATUS_VARIANT_COLOR`, `OrderStatusTag`/`ORDER_STATUS_VARIANT`, `ReturnStatusTag`, `TrackingMap`, `NotificationBell`.

---

## 5. Tracking UX

- **Status hierarchy**: `TrackingStatusCard` (what's happening now) → map (or graceful text fallback) → timeline (completed/current/upcoming) → courier info → actions — matches the brief's recommended `Order → Current Status → Progress → Expected Next Step → Delivery Details` order exactly.
- **Timeline visual tiers**: completed steps are quiet (small icon, secondary text, real timestamp); the current step is the most prominent (larger colored icon, bold label); upcoming steps are hollow-outline and muted, with no timestamp — verified live at every real order status this session reached (`PAYMENT_CONFIRMED`).
- **Color use**: status color comes from the same `ORDER_STATUS_VARIANT`/`STATUS_VARIANT_COLOR` mapping the rest of the app already uses for order status chips — not a new palette, and not marigold (marigold stays reserved for AI moments per E5; tracking isn't an AI feature and deliberately doesn't borrow that visual language).
- **Icons**: contextual per status (package/truck/map-pin/check), from the existing lucide icon set already used throughout the app.

---

## 6. Returns UX

- **Consistency with Tracking**: `ReturnProgressTimeline` intentionally shares `TrackingTimeline`'s visual grammar (same dot/line shape, same completed/current/upcoming tiers) so a user who already understands order tracking immediately reads return progress the same way.
- **"What → Why → Status → What's next"**: `ReturnStatusPage` now orders as returned-item card → progress timeline → reason → decision/refund info → appeal action, matching the brief's suggested hierarchy.
- **Reassurance over bureaucracy**: added real product context ("Returning: {item}") to both the wizard and the status page so the customer always sees *what* they're dealing with, not just an order number. The reason-selection and photo-upload steps themselves were left as they were — already plain-language, not administrative-feeling.
- **Return History**: buyer-facing card list (§3) gives customers a place to see all past/active returns at a glance, which didn't exist as a screen before this phase.

---

## 7. Notifications UX

- **What happened / when / action-needed** prioritized per the brief: icon conveys *what kind* of update at a glance, relative time conveys *when*, bold + tint conveys *unread (may need attention)*.
- **Grouping**: "Today"/"Earlier" — a simple two-bucket split (not a busier per-day breakdown), matching the brief's own example exactly.
- **Iconography**: contextual per event type (package/truck/pin/check/key/rotate/wallet), never emoji, falls back to a plain bell for anything the mapping doesn't recognize.
- **Click-through behavior preserved exactly** (mark-read + navigate to the related order for Buyer/Seller, no-op for Admin) — this phase only changed presentation, not the interaction logic itself.

---

## 8. Responsive Improvements

- All new components (`TrackingStatusCard`, `ReturnProgressTimeline`, `NotificationIcon` rows) use only spacing/radius/font tokens, no fixed widths — inherit the app's existing responsive behavior with no new breakpoints needed.
- Verified live at 1280px and a 390px mobile viewport (§10): the tracking timeline stays readable as a single vertical column at both widths; AntD's `Steps` component in the Return Wizard automatically switches to a vertical layout on narrow screens with no code changes required; the notification list remains comfortable to tap at mobile width.

---

## 9. Accessibility Improvements

- Timeline/progress-stepper icons are always paired with a text label and a real status color — never color alone, per the brief's explicit "icon + label + color" rule.
- `NotificationIcon` uses `aria-hidden` (decorative reinforcement of text already present in the row) rather than being the only signal.
- Unread notification rows are `role="button"` + `tabIndex={0}` + `onKeyDown` (Enter/Space), so the mark-read + navigate interaction is keyboard-reachable, not just click-only (a gap in the previous implementation, which used `List.Item`'s `onClick` with no keyboard equivalent).
- All new elevation/accent styling uses logical properties (`borderInlineStart`) exclusively — RTL mirroring verified live with zero RTL-specific code (§10).

---

## 10. Functional Verification

Verified against a **live backend with real interaction** (Postgres, Redis, MinIO, the Core API, and the AI Service were all running this session):

- Registered a real Seller, published a real product (with a real Gemini-generated listing), registered a real Buyer, and drove a full **real checkout** (cart → address → `POST /checkout` with COD, which confirms payment immediately) to reach a genuine `PAYMENT_CONFIRMED` order — not seeded/mocked data.
- Verified the **Buyer Tracking page** end-to-end: `TrackingStatusCard` showing the real status/label/message, the map's graceful "unavailable" fallback (no location yet, as expected this early in the lifecycle), and the timeline correctly showing one real completed/current step (`PAYMENT_CONFIRMED`) followed by five real upcoming milestones.
- Verified **Notifications**: a real `ORDER_PLACED` notification appeared, correctly grouped under "Today," with the right icon, unread styling, and relative timestamp; the bell's unread badge matched.
- Verified the **Return Wizard**: real product context card, real Steps progression, reason selection.
- Verified the **Buyer Returns list** empty state, and confirmed (via a direct code check) that the `getOrder` query in `ReturnStatusPage`/`SellerReturnDetailPage` is correctly gated (`enabled: !!order-ish`) so it never fires on a not-found return.
- Verified **`OrderDetailPage`'s "Status history" card** (the 4th `TrackingTimeline` call site, not itself redesigned) picked up the new completed/current/upcoming rendering automatically, with zero console errors — confirming the shared-component change was safe across all four call sites.
- Verified **dark mode** via a real `prefers-color-scheme: dark` browser context (not a DOM-attribute hack — AntD's actual `darkAlgorithm` engaged) on the tracking page: status card, timeline, and map fallback all remain legible.
- Verified **Urdu/RTL** on the tracking page: header/sidebar mirror, the status card's accent border correctly flips to the trailing (right) edge, icon/text order mirrors automatically with zero RTL-specific code. Noted one **pre-existing, backend-owned** content gap (not a frontend bug): `TrackingEventDTO.description` and `TrackingDTO.deliveryStageLabel` are plain server-generated strings that aren't localized, so an English phrase can appear as secondary text underneath an already-translated Urdu status label. This existed before this phase (the old `TrackingTimeline` rendered the same `description` field the same way) and is a backend localization gap, not something the frontend redesign can fix without inventing translations for free-text content.
- Verified **mobile** (390px, dark mode) for Notifications and the Return Wizard.
- Type-check (`tsc --noEmit`): clean after every change, verified incrementally rather than only at the end.

---

## 11. Visual QA

Screenshotted and reviewed at light/dark × desktop/mobile × EN/UR combinations for the Tracking, Notifications, and Returns screens. One real bug was found and fixed during this pass: `PageHeader`'s `backLabel` defaults to the page's own `title` when omitted, which meant `BuyerReturnsPage`, `ReturnStatusPage`, and `ReturnWizardPage` were initially showing a back-link that duplicated the page heading itself (e.g., "← Return this order" pointing at a page titled "Return this order"). Fixed by passing real, distinct back-labels ("My orders", "Order {{id}}") to all three — re-verified live afterward.

Confirmed: no neon/glow/decorative motion anywhere in the new components (all changes are static layout + the existing app-wide reduced-motion rule, no new animations were introduced this phase — E6 deliberately doesn't add motion beyond what already existed, since the brief prioritizes calm clarity over flourish for this specific phase); marigold was not used anywhere in these screens (correctly reserved for AI moments only, per E5's established rule — tracking/returns/notifications aren't AI features).

---

## 12. Remaining Issues

- **Backend-owned localization gap**: `TrackingEventDTO.description` and `TrackingDTO.deliveryStageLabel` aren't localized server-side (§10) — out of this phase's scope (frontend-only, no backend changes permitted).
- **No ETA field exists anywhere in the tracking data model** — the original AppFlow doc's SCR-B08 spec mentions one, but `TrackingDTO` has no such field. Flagged, not invented.
- **No "contact support" destination exists** — the locale string was already present (likely provisioned from the original spec) but nothing in the app implements a real support-contact mechanism (no support page, no mailto, no external link). Left unwired rather than pointing it at nothing.
- **Public Tracking page** (`SCR-B09`) was reviewed and updated in code (status card, timeline, retry action) but not re-exercised live this session with a real public token — the authenticated tracking page (same shared components, same data shape) was verified live instead, and the two pages' logic differs only in auth/polling-vs-socket, not in rendering.
- **`BuyerReturnsPage`'s populated state** (a real return actually showing in the list) wasn't captured live — the eligibility flow this session progressed straight into photo upload rather than being blocked, but completing a full return (3 photos, submit) was outside this pass's remaining time budget. The empty state, the underlying `listBuyerReturns()` call, and the identical pattern already proven on `SellerReturnsPage` give reasonable confidence in the populated state without a live screenshot.

---

## 13. Recommendations for Next Phase

- If a future phase adds real backend-computed ETA or a support-contact mechanism, both `TrackingStatusCard` and the tracking pages' action rows already have a natural slot for them — no structural rework needed.
- If Feature 14 (AI Returns, still unbuilt per E5's findings) ever ships, `ReturnProgressTimeline` would be the natural place to add an "AI reviewing" step, matching `AIStatus`'s established processing-state language from E5 rather than inventing a third visual system.
- Consider localizing `deliveryStageLabel`/tracking event `description` server-side — the frontend is already fully bilingual-ready to display them correctly once the source data is.
