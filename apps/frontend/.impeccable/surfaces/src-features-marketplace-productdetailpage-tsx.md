---
version: 1
slug: "src-features-marketplace-productdetailpage-tsx"
primary_target: "src/features/marketplace/ProductDetailPage.tsx"
related_targets: ["src/features/marketplace/ProductGallery.tsx","src/features/marketplace/StoreChatWidget.tsx","src/features/marketplace/StoreMonogram.tsx","src/components/QuantityStepper.tsx"]
---

# Surface brief — Product detail (/product/:id)

Scope: buyer product page (SCR-B03), Operate-leaning Persuade mode (the visitor decides and adds to cart), Studio Light (DESIGN.md; foundation brief src/app/global.css). Audience: Pakistani buyers on budget phones, many first-time online shoppers. Job: judge the item, trust a small unknown store enough to order, add to cart or buy now. Proof on hand: the real product DTO (titles EN/UR, descriptions EN/UR, price, stock, condition, aiGenerated flag, category, images) and the store's name/slug from /stores/by-product; platform facts (COD, photo-backed returns reported within 24 hours of delivery, shareable courier tracking). Constraints: no ratings, reviews, seller city, verified flag, sale price or delivery promise (none exist in the data); "Only X left" only from real stock ≤ 5.

Unresolved: real product photography (seed images are category illustrations); seller city/verified on the store card needs backend fields (BACKEND-NOTES §3).

## Direction contract

THESIS: A calm studio counter for one product — the item standing on its own category tint, the buy decision in one column beside it — refusing the marketplace PDP of star rows, seller badges and stacked promo banners.

OWN-WORLD: Warm white page; a 28px stage in the category tint with a white corner glow and a soft ground shadow under the cut-out; an ink "Listing written by AI" tag hand-tilted -2° (mirrored in RTL) when the listing is AI-written; a white heart disc; Inter page title with its Nastaliq twin; Outfit 38px price with a stone condition pill; green "In stock" dot or red "Only X left" pill; a stone pill quantity stepper with round white buttons; persimmon "Add to cart" beside ink "Buy now"; a flat hairline reassurance panel (COD, photo-backed returns, courier tracking) with each icon on its own wash; a white store card with the store's initial on a peach disc and an outline "Ask the store"; "More from {store}" as plain product cards.

STORY: See the product → read price, stock and condition → choose quantity → add to cart (or buy now) → reassured by COD/returns/tracking → can ask the store or visit it → more from the same store.

FIRST VIEWPORT: Breadcrumb (Home › Category › Title); stage at 6:5 on the inline-start ~56%; sticky buy column at the inline-end with title, twin, price, stock, quantity and both buttons above the fold at 1440×900. Phones: stage (1:1) first, then the buy column; a floating pill bar (price + Buy now + Add to cart) slides up above the tab bar only after the in-page buttons scroll away, so one persimmon is on screen at a time.

SIGNATURE MOTION: the gallery. On arrival the product grows onto the counter from its own base (scale .94 → 1 around its ground line, 640ms ease-soft, from a visible frame, transform/opacity only; the ground is drawn in the asset, so nothing slides under it); on a mouse the stage is a 1.8× loupe following the pointer; several photos ride a native scroll-snap track with ink-ringed thumbnails and a "n / N" counter. Reduced motion: no settle, no loupe, instant jumps.

FORM: Pinned in the user's own words on 2026-10-17 (Day 2 brief): "image gallery (the page's one signature motion), EN title + Nastaliq Urdu title, Outfit price, real-stock "Only X left", quantity, persimmon "Add to cart" + ink "Buy now", sticky mobile action bar, store card (store name only, no invented seller data), COD + returns reassurance, "More from this store", the existing chatbot widget restyled." The approved sample (https://claude.ai/artifact/NZ8BCheo5VxgqS3DgvS8WX) and docs/frontend/SampleImages/ProductView.png are the comp: product on a soft tile, thumbnails, pill price, white rounded cards. seed: none (user-pinned direction, no roll; waiver confirmed by Rafia on 2026-10-17: "THEK HAI")

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
