---
version: 1
slug: "src-features-marketplace-browselayout-tsx"
primary_target: "src/features/marketplace/BrowseLayout.tsx"
related_targets: ["src/features/marketplace/SearchPage.tsx","src/features/marketplace/CategoryPage.tsx","src/features/marketplace/FilterPanel.tsx"]
---

# Surface brief — Browse (Search /search and Category /category/:slug)

Scope: shared BrowseLayout for search results and category pages. Mode: Operate (scan, filter, pick), Studio Light. Audience: buyers on phones and desktops. Job: narrow to something worth opening. Proof: real products, real categories, real filters (category, price, condition), sort. Constraints: no invented ratings/sellers; filters only for fields the API supports.

## Direction contract

THESIS: A quiet, fast results page where the products carry the colour and the chrome stays ink and white (the per-card persimmon "+" is the foundation's sanctioned exception) — refusing marketplace clutter (banners, sponsored rows, rating filters with no data).

OWN-WORLD: Warm-white page; a white 24px filter card on a soft shadow (stone fields, ink-filled selected chips, h2 group titles); one toolbar row (count, removable stone chips whose × turns on hover, pill Sort); the Studio Light product cards in a 3/2/3/2 grid; the category page opens on a 36px band in the category's own tint with the cut-out art standing on it and both names (Nastaliq for Urdu).

STORY: Visitor lands with a query or a category → sees how many results → narrows with filters or chips → opens a product.

FIRST VIEWPORT: Desktop: title (or category band), then filter card at the inline start beside the results grid. Phone: title, Filters pill (count badge in ink) + Sort, chips, two-column grid; filters open in a bottom sheet.

FORM: Pinned in the user's own words on 2026-10-17: "docs/frontend/DESIGN-CONSULT.md ← approved \"Studio Light\" direction + migration plan" (§8: "Search / Category: White filter sidebar card (24px radius). Ink selected chips, pill Sort. Category banner in a peach wash with the cut-out art."). seed: none (user-pinned direction, no roll; waiver confirmed by Rafia on 2026-10-17: "THEK HAI")

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
