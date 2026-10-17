---
version: 1
slug: "src-features-cart-cartpage-tsx"
primary_target: "src/features/cart/CartPage.tsx"
related_targets: ["src/components/QuantityStepper.tsx","src/features/cart/guestCartStore.ts"]
---

# Surface brief — Cart (/cart)

Scope: buyer cart (SCR-B04), Operate mode, Studio Light (DESIGN.md; foundation brief src/app/global.css). Audience: buyers about to commit, many paying cash. Job: check items and quantities per store, see what's ready, go to checkout. Proof on hand: CartDTO (seller groups with storeName, items with title/price/qty/image/stockConflict, subtotal, eligibleForCheckout, minOrderValuePkr, grandSubtotal) or the device-only guest cart. Constraints: shipping isn't known until the order is placed, so the summary says "Calculated per store" and the total is "before shipping"; no invented discounts or delivery dates.

## Direction contract

THESIS: A calm counter tally, one white card per store because each store ships its own order — refusing the coupon-box, cross-sell and countdown clutter of marketplace carts.

OWN-WORLD: Outfit page title with an "N items from N stores" line; white 24px store cards (store initial on peach, "Ships as its own order", amber "Not ready" status with the exact reason: amount short of the store minimum, or stock); item rows with the image on stone, linked title, "Rs. X each", the stone pill stepper (36px drawn, 44px tap), Outfit line total, a round trash button that warms to red; a sticky white summary card (items, shipping "Calculated per store", total before shipping, the one persimmon Checkout with arrow, COD line). Phones: a pill bar with the total and Checkout slides up above the tab bar while the summary card's button is off screen. Empty: the peach-disc empty state plus four real "Popular right now" cards from the home feed. Guest: one "Your items" card; Checkout goes to login with the redirect kept.

seed: none (user-pinned direction, no roll; waiver confirmed by Rafia on 2026-10-17: "THEK HAI")

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
