---
version: 1
slug: "src-features-marketplace-storepage-tsx"
primary_target: "src/features/marketplace/StorePage.tsx"
related_targets: ["src/features/marketplace/StoreChatWidget.tsx","src/features/marketplace/StoreMonogram.tsx","src/features/marketplace/storeApi.ts"]
---

# Surface brief — Store page (/store/:storeSlug)

Scope: the public storefront of one seller, Persuade mode (a small unknown store earns a browse and an order), Studio Light (DESIGN.md; foundation brief src/app/global.css). Audience: buyers arriving from a product page or a shared link (often WhatsApp). Job: understand whose shop this is, see everything it sells, ask it a question. Proof on hand: /stores/:slug returns name, description, logoUrl, bannerUrl and the live products (titles EN/UR, price, stock, one image, category). Constraints: no ratings, follower or order counts, city, "member since" or verified badge (none exist); the product count is the real length of the live list.

Unresolved: most stores have no logo or banner (the initial and the shop window cover it); store policies are null in the API.

## Direction contract

THESIS: A seller's own counter inside the bazaar — a peach wash band with the store's name set large and its real goods standing in a small hand-placed window — refusing the marketplace "shop header" of cover photo, star rating and follower count.

OWN-WORLD: A 36px peach band (28px on phones) with a white corner glow; breadcrumb; the store's logo or its Outfit initial on a white disc; the store name in Outfit display-band; the description at 52ch; two translucent white fact pills (live product count, Cash on Delivery); an ink "Ask the store" pill; on the far side three of the store's own products as tilted white cards on their category tints (mirrored in RTL; hidden on phones; the uploaded banner replaces them when one exists). Below: "All products" with a pill sort (store order / price), filter chips for only the categories this store stocks with their counts (ink when selected), and the plain product-card grid (4 / 3 / 2).

STORY: Whose store is this → what does it sell → narrow by category or price → open a product or ask the store.

FIRST VIEWPORT: The band fills the top with name, facts and the ink chat pill on the inline-start, the shop window on the inline-end; the shelf heading and chips start just below the fold at 1440×900.

MOTION: none authored beyond the shared card hover and the chat launcher's entrance; once the band scrolls away a white "Ask the store" pill appears above the WhatsApp button (never on top of it). The page's moment is the shop window, which is still.

FORM: Pinned in the user's own words on 2026-10-17 (Day 2 brief): "Store page: store header band (wash), name + description, the store's products grid, chatbot." The approved sample (https://claude.ai/artifact/NZ8BCheo5VxgqS3DgvS8WX: peach sell band, fanned cards, plain product cards) is the comp. seed: none (user-pinned direction, no roll; waiver confirmed by Rafia on 2026-10-17: "THEK HAI")

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
