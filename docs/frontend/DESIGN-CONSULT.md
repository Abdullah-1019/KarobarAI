# KarobarAI Design Consultation: "Studio Light"

The design direction Rafia approved on 2026-10-17, and the plan for moving the finished pages (Batch 0 + Batch 1) onto it. It covers colour, type, shape, shadows, motion, buttons and the CTA colour. Read this before writing any frontend code from Day 2 onwards.

- Visual reference (sample Home page, no code): https://claude.ai/artifact/NZ8BCheo5VxgqS3DgvS8WX. Its Tweaks panel previews other ink/accent colours.
- Palette comparison: https://claude.ai/artifact/NqhFYCbk2o7hN2TcfQydAb
- Source references: `docs/frontend/SampleImages/` (11 screenshots).
- Day-by-day record: [DAILY-LOG.md](DAILY-LOG.md). Shipped design system: `apps/frontend/DESIGN.md` (gets rewritten after the switch).

---

## 1. Decision

| | Before (Haveli) | After (Studio Light) |
|---|---|---|
| Feel | Warm, vintage, "coffee brand" | Light, airy, premium, modern |
| Base | Parchment `#FAF6EF` | Warm white `#FAF9F7` |
| Dark colour | Espresso `#2B1D14`, used on big blocks | Ink `#17171A`, used for text, pills and footer only |
| Main action | Copper `#AE5429` | Persimmon `#BF4A1F` |
| Highlight | Brass `#C9963F` | Soft peach and lilac washes |
| Headings | Fraunces (serif) | Outfit (geometric sans) |
| Hero / AI banner | Dark espresso blocks | Light tinted bands |

**Why:** Rafia's references all share one recipe: a near-white base, near-black ink, one warm accent used sparingly, soft washes instead of dark blocks, big rounded corners, pill controls, and a geometric sans for headlines. The serif and the large brown areas were what made Haveli read as a café.

**What keeps it Pakistani** (and not a generic Dribbble shot):
- Urdu set in Nastaliq next to English everywhere, as a signature.
- Real local products and cities.
- Cash on Delivery and photo-backed returns up front.
- A very faint block-print texture in two places only: the auth panel and the /sell closing band.

---

## 2. Colour tokens

Only the values change. The names stay, so components keep working.

| Role (existing token) | New value | Use |
|---|---|---|
| `--bg-page` | `#FAF9F7` warm white | Page background |
| `--bg-surface` | `#FFFFFF` | Cards, nav, inputs |
| `--bg-sunken` | `#F2F1EE` stone | Search fields, chips, tiles |
| `--brand-ink` | `#17171A` | Headings, body text, black pills, footer, announcement bar |
| `--text-secondary` | `#5A5A60` | Body copy on light backgrounds (7:1) |
| `--text-tertiary` | `#6B6B70` | Captions (5.0:1, the floor) |
| `--border` | `#ECEAE6` | Card and nav hairlines |
| `--border-strong` | `#DCDAD5` | Outline buttons, dividers |
| `--brand-primary` | `#BF4A1F` persimmon | **Main CTA only** (see §6) |
| `--brand-primary-hover` | `#A63E17` | CTA hover |
| `--brand-primary-press` | `#8F3412` | CTA pressed |
| `--brand-primary-soft` | `#FBE9DE` | CTA tint backgrounds, icon discs |
| `--wash-peach` (new) | `#F7E6DC` (blob `#F7D9C6`) | Hero blob, sell band, category tints |
| `--wash-lilac` (new) | `#E3E6F5` (blob `#E1E5F6`) | Second hero blob, info tints |
| `--ai-accent` (new; replaces brass) | `#F2A27E` | The AI star mark on ink chips |
| `--urgency` | `#B3261E` on `#FBE3DE` | "Only 3 left", errors |
| `--success` | stays green | Success only, never decoration |

**Category tile tints:** peach `#FBEDE4`, sand `#F6F0E6`, lilac `#ECEEF8`, sky `#E9F0F7`, rose `#F8E9EC`, stone `#F3F1EA`.

**Contrast, all checked:**
- Ink on white: 17:1.
- White on persimmon: 4.98:1.
- Persimmon text on white: 4.74:1.
- Caption grey: 5.0:1.

**Retired:** espresso blocks, brass hairlines and the brass "verified" seal (it becomes an ink seal), and parchment.

**Dark mode** stays deferred. It would be ink-night surfaces with the same persimmon.

---

## 3. Type

| Role | Font | Settings |
|---|---|---|
| Display / headings | **Outfit** 600 | Tight tracking (`-0.03em` to `-0.035em`), line-height 1.02–1.1 |
| UI and body | Inter 400 / 500 / 600 | 16px base, line-height 1.55 |
| Urdu headings | Noto Nastaliq Urdu | line-height 2, 24px clear space above |
| Urdu UI | Noto Naskh Arabic | line-height 1.75 |
| Prices | Outfit 600 | Tabular numbers |

**Type scale:**

| Element | Size |
|---|---|
| Hero h1 | `clamp(44px, 6.4vw, 84px)` |
| Section h2 | 40px |
| Card title | 16px / 600 |
| Caption | 12.5–14px |

The Urdu font stacks keep leading with the Latin face, now Outfit / Inter, so Latin text inside Urdu strings stays on-brand.

---

## 4. Shape

| Element | Radius |
|---|---|
| Buttons, chips, toggles, nav bar | Pill (999px) |
| Inputs | 14–16px |
| Search box (hero) | 28px |
| Product cards | 24px outer, 18px image area |
| Category tiles | 22px |
| Trust cards | 20px |
| Big bands (sell band, banners) | 36px |

Cards have **no border**. Lift comes from soft shadow (§5). The only exceptions are flat info cards, which keep a 1px `--border` hairline.

---

## 5. Shadows

The new scale is neutral ink, not brown. Each shadow has two layers: a tight contact shadow plus a soft ambient one, so cards look like they rest on the page.

```
--shadow-ink: 23 23 26;
--shadow-xs:  0 1px 2px rgb(var(--shadow-ink) / .05), 0 1px 3px rgb(var(--shadow-ink) / .04);
--shadow-sm:  0 2px 6px rgb(var(--shadow-ink) / .05), 0 6px 16px rgb(var(--shadow-ink) / .04);
--shadow-md:  0 4px 10px rgb(var(--shadow-ink) / .05), 0 10px 30px rgb(var(--shadow-ink) / .06);
--shadow-lg:  0 8px 18px rgb(var(--shadow-ink) / .06), 0 22px 44px rgb(var(--shadow-ink) / .10);
--shadow-xl:  0 12px 24px rgb(var(--shadow-ink) / .08), 0 30px 70px rgb(var(--shadow-ink) / .14);
--shadow-cta:       0 10px 22px rgb(191 74 31 / .30);
--shadow-cta-hover: 0 14px 28px rgb(191 74 31 / .38);
```

**Rules:**
- Shadows mark things that **float**: cards, the nav pill, the hero search box, popovers, sheets, and the fanned hero cards. Flat page sections never get a shadow.
- **Resting → hover:** cards go `sm` → `lg`; the nav goes `sm`, then `md` after scrolling.
- The **coloured CTA glow** (`--shadow-cta`) belongs to the persimmon button only. Nothing else gets a coloured shadow.
- Dark ink surfaces (footer, ink pills) get no shadow, or a plain `md` for floating ink chips.

---

## 6. CTA colour and button system

**Rule:** one persimmon button per view. It's the action that earns money or moves the user forward, such as Search, Add to cart, Buy now, Place order, Start selling or Publish. Everything else is ink or outline.

| Variant | Look | Used for |
|---|---|---|
| **Primary (CTA)** | Persimmon fill, white text, `--shadow-cta` | The single main action |
| **Secondary** | Ink `#17171A` fill, white text | Log in, "How selling works", Publish (inside a form that already has a CTA) |
| **Outline** | White fill, 1px `#DCDAD5` border, ink text. The border turns ink on hover. | "All categories", Cancel, filters |
| **Ghost / text** | Ink text, underline appears on hover | Tertiary links |
| **Icon (round)** | 44px circle. White with a hairline, or ink. | Cart, save, carousel arrows, photo search |
| **Add (+)** | 44px persimmon circle | Quick add on product cards |
| **Destructive** | `#B3261E` fill | Delete, reject (seller and admin screens) |

**States for every variant:**

| State | Primary | Secondary (ink) | Outline |
|---|---|---|---|
| Rest | `#BF4A1F` + `--shadow-cta` | `#17171A` | Border `#DCDAD5` |
| Hover (fine pointer) | `#A63E17`, lift −1px, `--shadow-cta-hover` | `#2A2A30`, lift −1px, `--shadow-sm` | Border ink, bg `#FAF9F7` |
| Pressed | `#8F3412`, `scale(.97)`, shadow shrinks to `xs` | `scale(.97)` | `scale(.97)` |
| Focus-visible | 3px ring `rgb(191 74 31 / .35)`, offset 2px (all variants) | same | same |
| Loading | Label fades to 0, spinner centred, width locked so nothing jumps | same | same |
| Disabled | Stone `#F2F1EE` bg, `#9A9AA0` text, no shadow, no motion | same | same |

**Sizes:**

| Size | Height | Use |
|---|---|---|
| `sm` | 36px | Inside dense tables only; the tap area is padded to 44px |
| `md` | 44px | Default |
| `lg` | 52px | Hero and banner CTAs |

All pill buttons use horizontal padding of 20–26px.

---

## 7. Motion system

### Tokens

Extends the existing `--dur-*` and `--ease*` tokens.

```
--dur-instant: 90ms;    /* press */
--dur-fast:   150ms;    /* hover, colour */
--dur-base:   220ms;    /* small moves, toggles */
--dur-slow:   320ms;    /* panels, sheets */
--dur-enter:  520ms;    /* page-load entrances */
--ease:        cubic-bezier(0.2, 0.7, 0.2, 1);    /* existing: UI */
--ease-soft:   cubic-bezier(0.22, 1, 0.36, 1);    /* existing: entrances, lifts */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* new: pops (add, save, badge) */
```

### Principles
1. **Motion explains something.** It shows that a thing reacted, appeared, moved or got saved. No decoration-only loops, except the slow hero blobs.
2. **The first frame is complete.** Entrances start from a visible state and animate transform only. Nothing waits at `opacity: 0` for JavaScript.
3. **One signature moment per page.** Others stay quiet:
   - Home: the hero card fan.
   - /sell: the AI typing demo.
   - Product page: the gallery.
   - Order confirmation: the celebration.
4. **No blanket scroll reveals.** The finish reviewer rejected those earlier as generic. Only the signature moment animates in.
5. **Exits are faster than entrances.** Popovers open in 220ms and close in 150ms.
6. **Only `transform` and `opacity` animate.** Never width, height or top, for smoothness on low-end Android phones.
7. **`prefers-reduced-motion`:** every animation becomes instant, and the end state shows immediately. The global rule already exists; new keyframes join it.

### Micro-interactions (the catalogue)

| Element | Interaction |
|---|---|
| **CTA button** | Hover lift + darker colour + bigger glow (150ms). Press `scale(.97)` (90ms). Release springs back with `--ease-spring`. |
| **Button with arrow** ("All categories →") | Arrow slides 3px on hover in the reading direction. In Urdu (RTL) it mirrors. |
| **Add to cart (+)** | Press, then the "+" rotates 90° into a ✓ with a pop (scale 1 → 1.15 → 1, 320ms, spring). It turns back to "+" after 1.5s. The cart icon in the nav bumps and the badge number pops. |
| **Save (heart)** | Pops and fills persimmon (spring, 320ms). Unsave fades back. |
| **Product card** | Lift −4px, shadow `sm` → `lg`, image scales to 1.04 over 600ms. Card-level focus ring for the keyboard. |
| **Category tile** | Lift −3px, art scales to 1.06. |
| **Nav pill** | After 24px of scroll it becomes more opaque and gets `--shadow-md` (220ms). The header search appears once the hero search scrolls out of view (already built). |
| **Language toggle** | The white "thumb" slides between EN and اردو (220ms). |
| **Chips / filters** | Selecting fills ink with a 150ms colour change. A removable chip's × rotates on hover. |
| **Inputs** | Focus: the border turns ink and a soft 3px persimmon ring fades in. |
| **Hero blobs** | Peach and lilac blobs drift slowly (about 20s alternate, 20–30px). Static with reduced motion. |
| **Hero card fan** | On load the cards settle from a tighter fan into place (520ms, staggered 40ms). On hover the fan opens slightly. Already built; restyled. |
| **AI demo (/sell)** | Typing sequence as built. The "Written by AI" chip gets a single shine sweep when it finishes. |
| **Skeletons** | Existing shimmer, recoloured to stone. |
| **Toasts** | Slide up 8px + fade (220ms). Leave in 150ms. |
| **Bottom sheet (filters)** | Slides up with `--ease-soft` (320ms). The scrim fades. |

---

## 8. How the finished pages move to Studio Light

The order is foundation first, so every page inherits the change.

### Step 1: Tokens (about 1 hour)
- `global.css` primitives: replace the `--haveli-*` values with the Studio Light values in §2. Add `--wash-peach`, `--wash-lilac` and `--ai-accent`. Add the new shadow and motion tokens (§5, §7).
- `palette.ts` / `theme.ts`: Ant Design follows automatically. Set its radius to 14 and its control height to 44.
- Rename the primitives (`--haveli-*` → `--studio-*`). Leave the semantic names alone.

### Step 2: Fonts (about 15 minutes)
- `index.html`: load Outfit (400–700) and keep Inter. Drop Fraunces.
- Point `--font-display` at Outfit, and update the Urdu stacks.

### Step 3: Shared components (about 2 hours)

| Component | Change |
|---|---|
| `Button.tsx` + CSS | The new variants and states (§6) and press/hover motion. Add an `iconEnd` arrow slot that nudges on hover. |
| `ProductCard.tsx` | Borderless 24px card, tinted image area, ink "New" pill, red low-stock pill, heart button, Urdu title, Outfit price, the animated "+" add button. |
| `Badge`, `StatusTag` | Ink / peach / red tones. The verified seal becomes ink. |
| `StorefrontHeader` | Floating pill nav (§7 scroll state) with an ink "Log in" pill and round icon buttons. |
| Announcement bar, `StorefrontFooter` | Ink. The footer drops its brass hairline. |
| `AccountMenu`, `LanguageToggle` | Pill styling and the sliding thumb. |
| `EmptyState`, skeletons, toasts | Stone and peach tones. |
| `AiMark` | The star stays; its colour becomes `--ai-accent` on ink chips. |
| `AuthLayout` | The brand panel goes from espresso to a peach/lilac wash with ink text and a faint block-print texture. |
| Product illustrations (8 SVGs) | Remove the block-print background and recolour to ink/persimmon. They become transparent cut-outs on tinted tiles, the same treatment as the sample design. |

### Step 4: Pages already built (about 2–3 hours)

| Page | Change |
|---|---|
| **Home** | Hero recomposed to match the sample: centred headline, Urdu line, big search box with chips, fanned cards with two floating tags, drifting blobs. Light trust row. Category tiles with tints. Featured as plain product cards (the sand shelf is retired). The AI banner becomes the light peach "One photo. A full listing in Urdu and English." band with the listing card. |
| **/sell** | Light hero with blobs, demo card in white with `--shadow-xl`. Steps with ink number discs, a persimmon "Start selling", an ink secondary button. FAQ and a closing band in peach with the faint texture. |
| **Search / Category** | White filter sidebar card (24px radius). Ink selected chips, pill Sort. Category banner in a peach wash with the cut-out art. |
| **Auth** (Login, Register, OTP, Forgot, Reset) | The new `AuthLayout`, pill fields and buttons. |
| **Seller / Admin shells** | Ink active pill in the sidebar, white surfaces, compact density kept. These pages get their full redesign on Days 3 and 4. |

### Step 5: Check (about 45 minutes)
- `tsc`, `eslint`, `vitest`, and the impeccable detector.
- Screenshots in EN and UR at 1440 and 390 for Home, /sell, Search, Category and Login.
- A reduced-motion pass and a contrast spot-check.
- One impeccable finish-review round. The documenter then rewrites `DESIGN.md`.
- Log the work in `DAILY-LOG.md` and `WORKLOG.md`. No commits; Rafia commits.

**Total: about one working session.** After that, Day 2 (purchase flow + auth) is built directly in Studio Light.

---

## 9. Don'ts
- Don't put persimmon on more than one button per view. Don't use it for decoration, icons or text colour, except the logo "AI" and links.
- Don't bring back dark brown, brass, or large dark blocks above the footer.
- Don't use a serif for headings.
- Don't put grey captions below 5:1 contrast. Many buyers use budget phones in sunlight.
- Don't add scroll-triggered fade-ins on every section, or bouncy motion on anything except the small pop moments.
- Don't animate layout properties. Every animation needs a reduced-motion fallback.
- Don't make touch targets smaller than 44px, even when the drawn button is smaller.
- Don't invent ratings, review counts, seller numbers or delivery promises.

---

## 10. Open notes
- **The Facebook video Rafia shared** (https://www.facebook.com/share/v/1BrWS9uJ6a/) couldn't be viewed: Facebook requires a login and the tools can't watch video. If there's a specific effect from it you want, describe it or share a screenshot, and it gets added to §7.
- **The project's `taste` skill** (`.claude/skills/taste/SKILL.md`) still describes the old green/marigold brand. It should be updated to Studio Light so later design reviews judge against the right colours.
