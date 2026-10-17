---
version: 1
slug: "src-features-marketplace-sellpage-tsx"
primary_target: "src/features/marketplace/SellPage.tsx"
related_targets: ["src/features/marketplace/AiListingDemo.tsx"]
---

# Surface brief — /sell seller landing

Scope: public route, Persuade mode, Studio Light. Audience: Pakistani micro-sellers with no e-commerce experience, often Urdu-first, on budget phones. Job: believe that one photo becomes a bilingual listing, and start (register as seller). Proof on hand: the shipped AI Store Builder flow, COD, courier booking, photo-backed returns, analytics. Constraints: no testimonials, seller counts, prices, commission figures or courier brand names (adapters are mock).

## Direction contract

THESIS: Show the mechanism, don't describe it — the AI listing writes itself on the page — refusing the SaaS default of a feature-card grid under a headline.

OWN-WORLD: Light hero over the Home washes (peach/lilac blobs); a white 28px working-UI card on --shadow-xl (peach scan over the photo, ink focus while typing, ink "untouched AI field" dots when done, stone tags, a dashed price slot); white step markers on a soft shadow with ink number badges joined by a neutral dashed thread; a lilac statement panel with white EN/UR pairs beside a ruled feature list on peach icon tiles; a ruled FAQ with ink arrows; a 36px peach closing band with the faint ink block-print.

STORY: Seller reads the promise → watches photo → English → Urdu → tags → "ready for you to check" → sees the 3-step sequence → what's handled after publishing → answers to five real questions → one more "Start selling".

FIRST VIEWPORT: Left: Outfit headline ("One photo. A complete listing in Urdu and English."), subline, persimmon "Start selling" + ink "Log in to your store". Right: the live AI demo card.

FORM: Pinned in the user's own words on 2026-10-17: "docs/frontend/DESIGN-CONSULT.md ← approved \"Studio Light\" direction + migration plan" (§8: "/sell: Light hero with blobs, demo card in white with --shadow-xl. Steps with ink number discs, a persimmon 'Start selling', an ink secondary button. FAQ and a closing band in peach with the faint texture."). seed: none (user-pinned direction, no roll)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
