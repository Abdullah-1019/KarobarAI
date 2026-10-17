---
version: 1
slug: "src-features-cart-checkoutpage-tsx"
primary_target: "src/features/cart/CheckoutPage.tsx"
related_targets: ["src/features/cart/AddressPicker.tsx","src/features/cart/AddressForm.tsx","src/features/cart/addressFormat.ts"]
---

# Surface brief — Checkout (/checkout)

Scope: buyer checkout (SCR-B05), Operate mode, Studio Light. Job: confirm where it goes and how to pay, then place the order(s). Proof on hand: addresses API, /payments/config (COD on; Stripe/JazzCash/Easypaisa flags), the cart's eligible seller groups. Constraints: keep the Idempotency-Key and Stripe flows exactly as built; unavailable payment methods are shown honestly (dimmed, "Not available yet"), never as working options; no shipping figure before placement.

## Direction contract

THESIS: Three short, folding steps on one page — the buyer always sees what's decided and changes only one thing at a time — refusing the long single form and the separate wizard pages.

OWN-WORLD: Outfit title with a step indicator (ink check when done, ink ring when current, stone when ahead); each step a white 24px panel that folds into a one-line summary with an underlined "Change"; address cards (real radios inside, ink edge + ink check when chosen, peach map-pin tile) plus a dashed "Add new address" card that opens a two-column form; payment cards (COD on peach, card on lilac, wallets dashed and dimmed with a stone "Not available yet" tag); Review lists each store's items on warm white with "Shipping for this store is added when you place the order". "Continue" is ink; the sticky white summary card (items, shipping, deliver to, pay with, total before shipping) holds the one persimmon "Place order", enabled on Review. Returning buyers land on Review with steps 1–2 folded.

seed: none (user-pinned direction, no roll; waiver confirmed by Rafia on 2026-10-17: "THEK HAI")

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
