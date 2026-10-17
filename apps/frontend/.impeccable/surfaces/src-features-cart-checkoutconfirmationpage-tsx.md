---
version: 1
slug: "src-features-cart-checkoutconfirmationpage-tsx"
primary_target: "src/features/cart/CheckoutConfirmationPage.tsx"
related_targets: []
---

# Surface brief — Order confirmation (/checkout/confirmation)

Scope: success screen (SCR-B06), Persuade-leaning (reassure, then send to tracking), Studio Light. Proof on hand: the created orders (store, items, subtotal, shipping fee, total, payment method) and each order's real orderNumber from /orders/:id; the delivery address chosen. Constraints: no delivery-date promise, no invented courier.

## Direction contract

THESIS: A thank-you stamped onto the counter — one celebratory beat, then plain facts about what happens next — refusing confetti rain and generic success pages.

OWN-WORLD: A 36px peach band with a white corner glow; an ink check disc that stamps in (scale 1.35 → .94 → 1 on the spring), a ring ripple and twelve small persimmon/indigo/peach/ink pieces thrown once (transform/opacity, ~900ms, never looping; reduced motion shows the settled check without pieces); "Shukriya!" in Outfit display with شکریہ in Nastaliq (Urdu: شکریہ! with "Thank you"); "Your order is placed" and "Pay Rs. X in cash when it arrives"; persimmon "Track order" (one order → its tracking, several → My orders) beside an outline "Keep shopping". Below: white order cards ("Order #N", store, items, subtotal, shipping fee, total) and two hairline side cards (Delivering to; What happens next as a numbered three-step sequence).

SIGNATURE MOTION: the stamp + burst described above; the page's only authored motion.

seed: none (user-pinned direction, no roll; waiver confirmed by Rafia on 2026-10-17: "THEK HAI")

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
