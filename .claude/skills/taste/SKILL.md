---
name: taste
description: Give a direct, opinionated design/aesthetic critique of a screen, mockup, or artifact against KarobarAI's own "Studio Light" visual identity — not generic design advice. Use when the user asks for a taste check, a design critique, "does this look right?", or wants feedback before approving a mockup/screen.
---

# Taste — KarobarAI design critique ("Studio Light")

Judge visual work the way a sharp in-house design lead would: fast, specific, and grounded in this app's own system — never generic "best practices" that could apply to any product.

The brand changed on 2026-10-17. The old worlds are **anti-references** now: the original green `#1A6B49` + marigold, and the "Haveli" espresso/parchment/copper/brass world. Anything that still reads as either one is a must-fix.

## Before critiquing

Ground every judgment in the real system, not memory or vibes:
- `docs/frontend/DESIGN-CONSULT.md` — the approved Studio Light direction: tokens (§2), type (§3), shape (§4), shadows (§5), CTA + button system (§6), motion (§7), don'ts (§9).
- `apps/frontend/src/app/global.css`, `palette.ts`, `theme.ts` — the actual resolved tokens (`--studio-*` primitives → semantic roles → component tokens).
- `apps/frontend/DESIGN.md` — the shipped system (rewritten for Studio Light at the end of the migration; if it still says "Haveli", trust DESIGN-CONSULT.md).
- The sample Home design: https://claude.ai/artifact/NZ8BCheo5VxgqS3DgvS8WX
- The nearest already-shipped screen doing something similar — consistency with real precedent beats an abstract rule.

If the work under review doesn't cite what it matched, check it yourself before commenting.

## The world in one paragraph

Warm white `#FAF9F7` base, white cards, stone `#F2F1EE` for fields/chips/tiles. Ink `#17171A` carries text, black pill buttons, the announcement bar and the footer — and nothing else large. One persimmon `#BF4A1F` CTA per view. Soft peach `#F7E6DC` and lilac `#E3E6F5` washes stand in for dark blocks. Outfit 600 headlines with tight tracking, Inter for UI, Urdu in Nastaliq (display) and Naskh (UI) right next to the English. Pills for buttons/chips/nav, big rounded cards (24px) with no border and a soft two-layer ink shadow. Pakistani by content, not costume: Nastaliq Urdu, real local products and cities, COD and photo-backed returns up front, a faint block-print only on the auth panel and the /sell closing band.

## What to check, in order

1. **On-brand, not generic.** Does it read as Studio Light — near-white, ink, one warm accent, washes, pills, geometric sans — and also as *KarobarAI* (Urdu set beside English, local content)? Flag anything that reads as default Ant Design / default Tailwind, a generic Dribbble shot with no Pakistani signal, or a leftover of the old worlds (espresso/brown blocks, brass, parchment, serif headings, green chrome, Daraz orange).
2. **The One Persimmon Rule.** Exactly one persimmon button per view — the action that earns money or moves the user forward (Search, Add to cart, Buy now, Place order, Start selling, Publish). Secondary = ink pill, tertiary = outline (`#DCDAD5` border) or ghost. Persimmon never decorates icons, text or backgrounds (exceptions: the logo "AI", links). Only the persimmon button gets a coloured glow (`--shadow-cta`).
3. **Token discipline.** Colours from roles (`--brand-primary`, `--bg-sunken`, `--text-tertiary`, `--wash-peach`…), never primitives or hex in components. Radii from §4 (pill / 14–16 inputs / 24 cards / 22 tiles / 36 bands). Shadows from the ink scale (`--shadow-xs` … `--shadow-xl`): only floating things get one; flat sections never do. Spacing from `--sp-*`.
4. **Hierarchy.** One clear primary action. Headline > body > caption obvious at a glance. Outfit for headings and prices, Inter for UI — no serif anywhere.
5. **Motion with a reason.** One signature moment per page (Home hero fan, /sell AI demo, product gallery, order celebration); everything else quiet. Only `transform`/`opacity`. First frame complete — nothing waits at opacity 0. No blanket scroll fade-ins. Spring easing only on small pops (add, save, badge). Every animation has a reduced-motion end state.
6. **Density and restraint.** No filler, no eyebrow kickers, no same-size icon-card grids as page structure, no invented ratings/reviews/seller counts/prices/courier brands. Cut before adding.
7. **Accessibility floor.** 44px touch targets (even when the drawn control is smaller), visible focus ring (3px persimmon at .35, offset 2px), never colour-alone status, captions ≥ 5:1 (buyers read on budget phones in sunlight), real label/input association.
8. **Responsiveness.** Actually check 390px, not just assume desktop scales down — cramped targets, orphaned words, broken stacking, horizontal scroll.
9. **Bilingual/RTL.** EN⇄UR is the signature. Logical CSS properties only; arrows and directional motion mirror in Urdu; Nastaliq gets its tall line box and clear air above; Latin inside Urdu strings stays in Outfit/Inter.

## How to deliver the critique

- Lead with the single biggest problem, not a checklist of minor nits. If nothing is wrong, say so plainly instead of manufacturing feedback.
- Be specific: name the element, the token that should replace an arbitrary value, the exact spacing/contrast issue — not "improve visual hierarchy."
- Distinguish **must-fix** (breaks the system, breaks accessibility, breaks responsiveness, leftover old-world styling) from **worth considering** (a real but optional polish call) — don't flatten both into one urgency.
- Skip praise-padding. A short "this works, ship it" is a valid and complete critique when true.
