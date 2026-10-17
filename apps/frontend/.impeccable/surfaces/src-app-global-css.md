---
version: 1
slug: "src-app-global-css"
primary_target: "src/app/global.css"
related_targets: ["src/app/theme.ts","src/app/palette.ts","index.html"]
---

# Surface brief — Studio Light design-system foundation

Scope: app-wide visual foundation (tokens, type, AntD bridge, shared components, shells). Modes: Persuade on the storefront home and /sell; Operate on cart/checkout/orders/seller/admin. Plan of record: docs/frontend/DESIGN-CONSULT.md §8 (Steps 1–5). Replacement world: the Haveli espresso/parchment/copper/brass world (and the older green/marigold one) is evidence and anti-reference only. Visual reference: the sample Home design at https://claude.ai/artifact/NZ8BCheo5VxgqS3DgvS8WX.

Unresolved: real product photography (illustrations are placeholders); dark mode stays deferred (ink-night values are provisional). Deliberate deviations from DESIGN-CONSULT §2, both for contrast: caption grey #636368 (not #6b6b70) and success green #3f6a2c (not #4f7a3a). Fields are stone-filled at rest rather than white, so a field reads without relying on a faint edge.

## Direction contract

THESIS: A light, airy studio storefront where a small unknown Pakistani seller looks premium and trustworthy: near-white ground, near-black ink, one warm persimmon action. Refuses the category default (green-on-white marketplace chrome, Daraz flash-sale orange) and the retired Haveli café look (big espresso blocks, brass, serif).

OWN-WORLD: Warm white #FAF9F7 page, white floating cards with no border and a two-layer neutral ink shadow, stone #F2F1EE fields/chips/tiles. Ink #17171A for text, black pill buttons, announcement bar, footer only. One persimmon #BF4A1F CTA per view with its own glow. Sanctioned exception: the 44px persimmon "+" quick-add disc on every product card (DESIGN-CONSULT §6 lists it as its own button variant, and the approved sample comp uses it); it is the only persimmon repeated in a view. Peach #F7E6DC and lilac #E3E6F5 washes replace dark bands. Pills for buttons, chips, nav; 24px cards, 22px tiles, 36px bands. Outfit 600 with tight tracking over Inter; Urdu Nastaliq display and Naskh UI beside the English.

STORY: Buyer sees a calm, modern bazaar that is unmistakably local (Urdu, real products, COD and photo-backed returns up front), trusts the seller, and acts on the one persimmon button. Seller/admin see a quiet, precise, dense workspace.

FIRST VIEWPORT: Each storefront first viewport reads warm white with a floating pill nav, an ink announcement bar, Outfit headlines, and exactly one persimmon action. Home: a centred headline + Urdu line, big white search pill with chips, fanned product cards over drifting peach/lilac blobs (Step 4).

FORM: Pinned in the user's own words on 2026-10-17: "docs/frontend/DESIGN-CONSULT.md ← approved \"Studio Light\" direction + migration plan" and "Home (match the sample design https://claude.ai/artifact/NZ8BCheo5VxgqS3DgvS8WX)". A pinned direction beats the roll, so concept-seed was deliberately not run. seed: none (user-pinned direction, no roll)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
