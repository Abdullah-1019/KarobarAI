---
version: 1
slug: "src-components-auth-authlayout-tsx"
primary_target: "src/components/auth/AuthLayout.tsx"
related_targets: ["src/components/auth/auth.css"]
---

# Surface brief — Auth chrome (Login, Register, OTP, Forgot, Reset)

Scope: the shared AuthLayout around every public auth screen. Mode: Operate (the visitor completes sign-in/sign-up), with a Persuade brand panel beside it on desktop. Plan of record: docs/frontend/DESIGN-CONSULT.md §8 Step 3 (AuthLayout) and Day 2 Batch 3 (auth polish). Replacement world: the Haveli espresso panel is anti-reference.

Audience: buyers and first-time sellers, often Urdu-first, on budget phones. Job: get in quickly and trust the product. Content: real product art (placeholder illustration), the bilingual AI-listing promise, COD/returns stay out of auth. Constraints: no invented stats; 44px targets; full RTL.

Unresolved: role cards / method tabs / checkbox selected states still persimmon (Batch 3).

## Direction contract

THESIS: Signing in feels like stepping into the same light studio as the storefront: a warm peach band with one real AI-written listing beside a calm form. Refuses the dark split-screen auth template and the boxed card-in-card.

OWN-WORLD: Warm-white page; a 36px peach wash band with slow peach and lilac blobs and a 5% ink block-print gathered on the card side; ink copy; a white 24px listing card (ink "Written by AI" chip with the AI-accent star, kurta art on its peach tint, English + Nastaliq titles, stone tags, Outfit price, live dot) tilted -2°; the form directly on the page with stone fields, ink focus edge and a 52px persimmon pill.

STORY: The visitor sees what KarobarAI does (one photo → a bilingual listing), trusts it, and signs in with one persimmon action.

FIRST VIEWPORT: Desktop: panel left (mirrors right in Urdu) at ~52% width, Outfit 52px headline "Real goods from real sellers.", the tilted card under it, caption carousel at the foot; form column 440px centred in the other half with the EN/اردو toggle top-end, 40px Outfit title, fields, one persimmon "Log in". Phone and tablet (<1024px): a slim 136px peach band (28px radius, static lilac blob, 5% block-print) carrying the logo and the toggle, then the form.

FORM: Pinned in the user's own words on 2026-10-17: "docs/frontend/DESIGN-CONSULT.md ← approved \"Studio Light\" direction + migration plan" and "Home (match the sample design https://claude.ai/artifact/NZ8BCheo5VxgqS3DgvS8WX)". A pinned direction beats the roll, so concept-seed was deliberately not run. seed: none (user-pinned direction, no roll)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
