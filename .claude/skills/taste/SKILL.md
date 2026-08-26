---
name: taste
description: Give a direct, opinionated design/aesthetic critique of a screen, mockup, or artifact against KarobarAI's own visual identity — not generic design advice. Use when the user asks for a taste check, a design critique, "does this look right?", or wants feedback before approving a mockup/screen.
---

# Taste — KarobarAI design critique

Judge visual work the way a sharp in-house design lead would: fast, specific, and grounded in this app's own system — never generic "best practices" that could apply to any product.

## Before critiquing

Ground every judgment in the real system, not memory or vibes:
- `docs/KarobarAI-04-UIUX.md` — the source-of-truth spec (tokens, philosophy, component specs).
- `apps/frontend/src/app/global.css` and `theme.ts` — the actual resolved tokens (colors, radii, spacing, shadows, fonts).
- The nearest already-shipped screen doing something similar — consistency with real precedent beats an abstract rule.

If the work under review doesn't cite what it matched, check it yourself before commenting.

## What to check, in order

1. **On-brand, not generic.** Karobar green (`#1A6B49`) + marigold (`#F4A024`), warm paper canvas — not default SaaS blue/grey. Marigold is spent sparingly (AI moments, celebration), never decoratively everywhere. Flag anything that reads as "default Ant Design" or "default Tailwind" rather than KarobarAI.
2. **Token discipline.** Colors, radii (8/12/16/pill), spacing (`--sp-*` scale), shadows — pulled from real tokens, not arbitrary pixel values or invented hexes.
3. **Hierarchy.** One clear primary action per screen. Headline > body > caption is visually obvious at a glance, not just in the markup order.
4. **Density and restraint.** No filler content, no decorative elements earning their place through novelty alone. Cut before adding.
5. **Accessibility floor.** 44px touch targets, visible focus states, never color-alone status, real label/input association.
6. **Responsiveness.** Actually check mobile, not just assume desktop scales down — cramped touch targets, orphaned text, and broken stacking are the usual failures.
7. **Bilingual/RTL where relevant.** EN⇄UR duality is this brand's signature, not an afterthought bolted on later — logical CSS properties, not hardcoded left/right.

## How to deliver the critique

- Lead with the single biggest problem, not a checklist of minor nits. If nothing is wrong, say so plainly instead of manufacturing feedback.
- Be specific: name the element, the token that should replace an arbitrary value, the exact spacing/contrast issue — not "improve visual hierarchy."
- Distinguish **must-fix** (breaks the system, breaks accessibility, breaks responsiveness) from **worth considering** (a real but optional polish call) — don't flatten both into one urgency.
- Skip praise-padding. A short "this works, ship it" is a valid and complete critique when true.
