---
version: 1
slug: "src-features-marketplace-homepage-tsx"
primary_target: "src/features/marketplace/HomePage.tsx"
related_targets: ["src/features/marketplace/Hero.tsx","src/features/marketplace/AiBanner.tsx","src/features/marketplace/TrustStrip.tsx"]
---

# Surface brief — Home (/) storefront

Scope: buyer Home, Persuade mode, Studio Light (DESIGN-CONSULT.md; foundation brief src/app/global.css). Audience: Pakistani buyers, many first-time online shoppers, mostly on budget phones. Job: find something and trust a small seller enough to order. Proof on hand: real categories and products from the home feed; platform facts (COD, courier tracking, photo-backed returns within the policy window, Urdu or English). Constraints: no invented ratings, sellers, cities, prices or stats; the header search defers to the hero on Home.

Unresolved: real product photography (illustrations are placeholders); seller city on cards needs a backend field.

## Direction contract

THESIS: A calm, light bazaar front step that is search-led and shows real goods immediately — refusing the promo carousel, the dark hero block and the "Shop now" over a stock banner.

OWN-WORLD: Warm white page with slow peach and lilac blobs; a centred Outfit headline with its Nastaliq twin; a white 28px search panel floating on a soft shadow with a persimmon "Search" pill and stone category chips; five real product cards fanned like cards on a counter (white 22–24px, art on category tints) with an ink AI tag and a white COD tag; four light trust cards each with a different wash tile; white category tiles with tinted art windows and both names; plain product cards; a 36px peach sell band with a white AI listing card; ink footer.

STORY: Visitor sees what this is (Pakistani sellers, both languages, pay in cash) → searches or taps a category → browses featured and new arrivals → sellers find the one invitation to sell with AI.

FIRST VIEWPORT: Floating pill nav; centred headline at clamp(44–84px), Urdu twin under it, one-line promise, the 760px search panel (the page's only persimmon action), then the top of the card fan. Fan settles on load (520ms, 40ms stagger) and opens slightly on hover; RTL mirrors the angles.

FORM: Pinned in the user's own words on 2026-10-17: "docs/frontend/DESIGN-CONSULT.md ← approved \"Studio Light\" direction + migration plan" and "Home (match the sample design https://claude.ai/artifact/NZ8BCheo5VxgqS3DgvS8WX)". The sample is the comp; deviations: real feed products instead of a priced placeholder card, no eyebrow pills, "Urdu or English" instead of an unverifiable "Verified sellers". seed: none (user-pinned direction, no roll; waiver confirmed by Rafia on 2026-10-17: "THEK HAI")

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
