# KarobarAI Frontend Redesign: Work Log

**Owner:** Rafia (frontend), with Claude
**Master plan:** [REDESIGN-PLAN-HAVELI.md](REDESIGN-PLAN-HAVELI.md) has the critique, palette rationale, all pages and the 4-day batches.
**This file:** the **locked execution plan** plus a running log of what was done, decided and verified. Update it at every checkpoint.

---

## Working rules (locked)
1. **No code without an explicit go from Rafia.** Claude plans and describes; code only starts on "start X.Y".
2. **One step at a time.** Claude finishes a step and stops. Rafia reviews in the browser and approves, then the step is committed.
3. **One commit per step**, so any step can be undone on its own.
4. **Frontend only.** Backend files (e.g. `apps/backend/prisma/seed.ts`) belong to Abdullah. Flag them; don't edit them.
5. **Keep existing CSS variable names** (`--brand-primary`, `--bg-canvas`, …) and change only their values, so all ~40 screens switch at once without touching each one.
6. **Light mode is the polished default.** Dark mode polish is deferred beyond the 4 days.

---

## Day 1 (locked): Batch 0 Foundation + Batch 1 Discovery

### Batch 0: Foundation
| Step | Work | Files | Expected result |
|---|---|---|---|
| **0.1 Palette** | Change the existing colour variables to Haveli values. Add espresso, copper, brass, sindoor, moss and indigo tokens. Replace the 8 rainbow category tints with one warm tonal family. | `src/app/global.css` | The whole app switches from green/cream to espresso/parchment/copper |
| **0.2 Fonts** | Serif display headings (Fraunces or Instrument Serif) + Inter body. Remove Plus Jakarta and IBM Plex. Noto Naskh Arabic for Urdu UI, Nastaliq for Urdu headings only. Fix Urdu `line-height: 2`. | `index.html`, `global.css` | Editorial headings; Urdu forms and tables no longer stretched |
| **0.3 AntD bridge** | One palette source shared by `theme.ts` (no hard-coded hex). Compact density (40px) for seller/admin, 48px for buyer. | `src/app/theme.ts` + small palette file | AntD tables, forms, modals, tabs and sliders match Haveli |
| **0.4 Auth styles** | Point `auth.css` at global tokens instead of its private green/cream/font. | `src/components/auth/auth.css` | Auth screens on Haveli (full polish on Day 2) |
| **0.5 Core pieces** | Button (copper primary, espresso outline, ghost, danger), inputs (sand fill, copper focus ring), cards (cream, linen border, warm shadow), Badge/StatusTag (tonal + icon), Skeleton (warm shimmer), EmptyState, Toast | `src/components/*` | Consistent, premium building blocks |
| **0.6 Product card** | Hover image zoom, espresso price, no per-card COD pill, brass "New", sindoor "Only X left", quick-add | `features/marketplace/ProductCard.tsx` + CSS | Boutique-feel product grids |
| **0.7 Shells** | **Buyer:** espresso announcement bar, cream header with search and account menu, espresso footer with link columns. **Seller/admin:** sidebar and header re-skinned. | `StorefrontHeader`, `StorefrontFooter`, `AnnouncementBar`, `AppShell`, `Sidebar` | One brand frame around every page |
| **0.8 Character** | Block-print brass pattern (~6% opacity), paper grain, KarobarAI AI mark replacing ✨. Remove blanket fade-up `Reveal`; keep motion for add-to-cart, AI moments and celebrations. | `global.css`, new AI mark component, `Reveal` usage | Less gimmick, more character |

**✅ Checkpoint 0:** review `/dev/ui` plus 2–3 existing screens. Tune colours before building pages.

### Batch 1: Discovery
| Step | Page | Route | Level | Key content |
|---|---|---|---|---|
| **1.1** | Home (rebuild) | `/` | ★ | Espresso announcement bar, header + category nav, espresso hero (serif headline, real photo, one copper CTA), one slim promise bar (COD · 14-day returns · verified sellers), tonal category tiles, Featured, Seller spotlight, New arrivals, "Sell with AI" band, espresso footer. **Removed:** separate Trust / How-it-works / Payment strips. |
| **1.2** | Seller landing (new) | `/sell` | ★ | Hero + phone mockup, animated "photo → AI listing" demo, 3 steps, benefits grid, seller story, FAQ accordion, final CTA. "Sell" link in header and footer. |
| **1.3** | All products / Search | `/search` | ◆ | Heading + count, removable filter chips, sort, sticky filter sidebar (desktop) / bottom sheet (mobile), skeletons, illustrated no-results state |
| **1.4** | Category | `/category/:slug` | ◆ | Tonal banner (name, duotone illustration, count), breadcrumb, then the same grid and filters as Search |

Home layout reference (desktop):
```
┌──────────────────────────────────────────────────────────────┐
│ ESPRESSO BAR  Cash on Delivery · Easy returns · اردو / EN    │
├──────────────────────────────────────────────────────────────┤
│ KarobarAI   [ Search products, stores…      🔍 ]  Sell  👤 🛒 │
│ Fashion · Mobiles · Home · Beauty · Grocery · …   (cat nav)  │
├──────────────────────────────────────────────────────────────┤
│ ┌── ESPRESSO HERO (block-print pattern, brass hairline) ───┐ │
│ │  Serif headline                     ┌─────────────────┐  │ │
│ │  short subline                      │   REAL PHOTO    │  │ │
│ │  [ Shop now ]  (copper)             └─────────────────┘  │ │
│ └──────────────────────────────────────────────────────────┘ │
│  ✓ COD everywhere   ✓ 14-day returns   ✓ Verified sellers    │
├──────────────────────────────────────────────────────────────┤
│ Shop by category  (tonal tiles)                          →   │
├──────────────────────────────────────────────────────────────┤
│ Featured  ┌────┐┌────┐┌────┐┌────┐                           │
├──────────────────────────────────────────────────────────────┤
│ SELLER SPOTLIGHT (sand band)                                 │
├──────────────────────────────────────────────────────────────┤
│ New arrivals  4 × 2 grid                                     │
├──────────────────────────────────────────────────────────────┤
│ "SELL WITH AI" band → /sell                                  │
├──────────────────────────────────────────────────────────────┤
│ ESPRESSO FOOTER                                              │
└──────────────────────────────────────────────────────────────┘
```
On mobile, the hero stacks with the photo first, categories become a swipe row, and the grid has 2 columns.

**✅ Checkpoint 1:** review Home, /sell, Search and Category on desktop, at 375px mobile, and in Urdu.

### Pending decisions before Day 1 starts
| # | Decision | Options | Status |
|---|---|---|---|
| D1 | Heading font | **Fraunces** (warm, characterful; recommended) / Instrument Serif (sleek, fashion) | ✅ Fraunces (2026-10-17) |
| D2 | Real product photos | Unsplash/Pexels free licence, or Rafia's own | ⏳ |
| D3 | Demo image file type | Seed points to `.svg`; `.jpg` needs a one-line `seed.ts` change (Abdullah) or a workaround | ✅ Kept `.svg`: placeholders redrawn as Haveli illustrations at the same paths (Stop C); real photos still open |
| D4 | Reference samples | Rafia to share sample images | ⏳ |
| D5 | Palette sign-off | Test the palette (see below) and approve or tweak | 🟡 Implemented at Stop A; awaiting Rafia's review |

---

## The Haveli palette

### Light theme
| Role | Name | Hex | Use |
|---|---|---|---|
| Background (60%) | Parchment | `#FAF6EF` | Page background |
| Surface | Cream | `#FFFDF9` | Cards, forms |
| Sunken | Sand | `#F1E8DA` | Inputs, inset areas, table stripes |
| Border | Linen | `#E7DCCB` | Hairlines |
| Strong border | Clay | `#D4C4AB` | Dividers |
| **Ink (30%)** | Espresso | `#2B1D14` | Headings, body, dark bands |
| Brand secondary | Walnut | `#5A3A22` | Nav active, footer, hero gradient end |
| Secondary text | Umber | `#6B5A4B` | Secondary text (≈6:1) |
| Tertiary text | Taupe | `#8A7764` | Captions and icons only (≈4:1) |
| **CTA (10%)** | Copper | `#B4572A` | Primary buttons (white text ≈4.9:1) |
| CTA hover / pressed | Burnt copper | `#9A4722` / `#7E3A1C` | |
| CTA tint | Peach clay | `#F6E3D6` | Selected chips, soft CTA backgrounds |
| **Urgency** | Sindoor | `#C8402E` | Low stock, deal timers, sale stickers |
| **Accent** | Brass | `#C9963F` | AI, ratings, verified, celebration (dark text only) |
| Accent tint | Haldi cream | `#F6E7C4` | AI result backgrounds |
| Success | Moss | `#4F7A3A` | Success only |
| Info | Indigo ink | `#3A4D7A` | Info, long-text links |
| Error | Kiln red | `#B3261E` | Errors |

### Rules
1. **Copper = "do this".** One copper button per screen. Never decorative.
2. **Brass = jewellery.** Less than about 3% of the screen.
3. **Dark bands in espresso, never in copper.** A big copper area looks like Daraz.
4. **One tonal family for categories.** No rainbow.
5. **Indigo is the only cool colour.** It keeps the palette from turning sepia.

### Dark theme (deferred)
| Role | Hex |
|---|---|
| Background | `#17110C` |
| Surface | `#211912` |
| Sunken | `#120D09` |
| Border | `#3A2C20` |
| Text primary / secondary | `#F3EADF` / `#C2B2A0` |
| Copper | `#E07A45` |
| Brass | `#E2B865` |
| Sindoor | `#E8604C` |

---

## How to test the palette (no code changes)

### Test 1: Realtime Colors (5 minutes, quickest gut check)
1. Open **https://www.realtimecolors.com/?colors=2b1d14-faf6ef-b4572a-f1e8da-c9963f&fonts=Fraunces-Inter**
   If the link doesn't fill in the colours, enter them by hand:
   - Text `#2B1D14`
   - Background `#FAF6EF`
   - Primary `#B4572A`
   - Secondary `#F1E8DA`
   - Accent `#C9963F`
2. It shows a full sample website in these colours. Scroll through it.
3. Use the dice and lock icons to try variations. If you find a colour you like better, note its hex here.

**What to judge:** does it feel premium and warm, or muddy? Does the copper button pop without shouting?

### Test 2: Contrast check (2 minutes, so the text stays readable)
Open **https://webaim.org/resources/contrastchecker/** and check these pairs. Each needs **AA ≥ 4.5:1** for normal text.

| Foreground | Background | Expected |
|---|---|---|
| `#FFFFFF` | `#B4572A` (copper button) | ≈4.9 ✓ |
| `#2B1D14` | `#FAF6EF` (body text) | very high ✓ |
| `#6B5A4B` | `#FAF6EF` (secondary text) | ≈6 ✓ |
| `#8A7764` | `#FAF6EF` (tertiary) | ≈4, so **large text/icons only** |
| `#2B1D14` | `#C9963F` (text on brass) | ✓ |
| `#FFFFFF` | `#C8402E` (urgency pill) | check |

If you tweak any colour in Test 1, re-check its pair here.

### Test 3: Live inside our own app (10 minutes, the real test)
This only changes colours in your browser tab. **No files change**, and a page refresh resets everything.

1. Start the app: `pnpm dev:frontend` from the repo root, then open the local URL it prints (usually `http://localhost:5173`).
2. Open the home page, then press **F12** to open DevTools and go to the **Console** tab.
3. Paste this and press Enter:

```js
Object.entries({
  '--bg-canvas': '#FAF6EF', '--bg-surface': '#FFFDF9', '--bg-sunken': '#F1E8DA',
  '--border': '#E7DCCB', '--border-strong': '#D4C4AB',
  '--text-primary': '#2B1D14', '--text-secondary': '#6B5A4B', '--text-tertiary': '#8A7764',
  '--brand-primary': '#B4572A', '--brand-primary-hover': '#9A4722',
  '--brand-primary-active': '#7E3A1C', '--brand-primary-soft': '#F6E3D6',
  '--brand-ring': 'rgba(180,87,42,0.25)',
  '--accent-marigold': '#C9963F', '--accent-marigold-soft': '#F6E7C4',
  '--accent-marigold-strong': '#A87A2C',
  '--accent-2': '#C8402E', '--accent-2-soft': '#F6DEDA',
  '--success': '#4F7A3A', '--success-soft': '#E6EFDD',
  '--warning': '#A8741A', '--warning-soft': '#F6E7C4',
  '--error': '#B3261E', '--error-soft': '#F6DEDA',
  '--info': '#3A4D7A', '--info-soft': '#E2E7F1',
  '--announce-bg': '#2B1D14', '--hero-from': '#2B1D14', '--hero-to': '#5A3A22',
  '--header-blur-bg': 'rgba(250,246,239,0.85)',
}).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
```

4. Browse the home page, a product page and the cart. Press F5 to go back to the old green.

**Known limits of this test (expected, not bugs):**
- **AntD components** (most of the cart, orders, seller and admin screens) **stay green**, because AntD reads colours from `theme.ts`, not from CSS variables. Step 0.3 fixes that, so judge the storefront home for now.
- **The auth screens stay green** too, since they have their own colours until step 0.4.
- **Roles are approximate.** In this test the hero CTA renders in brass (it uses the marigold variable). In the real build it will be copper, with espresso as the brand ink. Fonts don't change either.

### Palette verdict
| Date | Test | Notes / tweaks | Approved? |
|---|---|---|---|
| 2026-10-17 | Stop A, in-app (headless Chrome, 1440 + 390, EN + UR) | Two contrast tunes: copper `#B4572A` → `#AE5429` (link text was 4.48:1 on parchment, now ≈4.76:1; white-on-copper ≈5.1:1); taupe `#8A7764` → `#7D6A58` (≈4.0:1 → ≈4.7:1, because `--text-tertiary` carries real captions). Warning text uses a darker turmeric `#8A5A12` (≈4.9:1 on haldi). | ⏳ Rafia |

---

## Progress log
Newest first. One entry per step or checkpoint: what changed, how it was verified, and any follow-ups.

| Date | Step | What was done | Verified how | Commit | Follow-ups |
|---|---|---|---|---|---|
| 2026-10-17 | **Studio Light Stop 3** (DESIGN-CONSULT §8 Steps 4–5: pages + checks) | **Home** to the sample: `Hero.tsx` centred Outfit display + Nastaliq twin, white 28px search panel (`SearchBar variant="hero"`, persimmon Search pill, 4 real chips), five-card fan from real feed products (centre = real title/price/link; illustrations before data), ink AI sticker + COD tag, drifting peach/lilac blobs, settle-on-load + hover-open fan with RTL-mirrored angles; `html, body { overflow-x: clip }` so washes spill without sideways scroll; `TrustStrip` four light cards on wash tiles (Verified → Urdu or English; Eligible Returns → Photo-backed returns); category tiles white 22px with tinted art; Featured = plain cards with prev/next arrows in the heading (`FeaturedProducts` title prop; sand shelf retired); New arrivals de-duplicated against Featured; `AiBanner` → peach 36px sell band with a white AI listing card. **/sell**: light hero over blobs, ink secondary, white demo on `--shadow-xl`, ink focus/caret/dots, transform-only scan, step fragments (photo / AI titles / order card) instead of icon discs, two-column FAQ, peach closing band. **Browse**: white 24px filter card, stone applied chips (× rotates), ink count/Clear all, pill Sort, filter titles h2, category band in its own tint with large grounded art + Nastaliq name. **Auth**: ink selected role card/tabs/checkbox, 3px persimmon focus ring, ink Forgot-password link, Urdu bidi fixes (LRI/PDI phone sample, `dir=ltr` +92). **Shell**: sidebar pill links, ink active pill, mobile tab stone pill + ink icon, ink badges (10px min). Old Haveli CSS blocks removed (hero, stall, trust, cat tiles, AI banner, sand shelf, `.ai-card`). Briefs written/updated: Home, /sell, Browse, foundation (+ sanctioned persimmon "+" exception). | `tsc` ✅ · `eslint` 0 errors (5 pre-existing warnings) · `vitest` 23/23 ✅ · detector source clean · overflow probe 360/390/1440 EN/UR · contrast spot-check (min 4.81:1) · reduced-motion captures · 22 screenshots · impeccable finish review: r1 fix (8) → r2 4 resolved / 3 partial / 1 regression → Claude fixed + verified the rest (demo photo height, category art position, AI sticker at 360px); budget used · documenter rewriting DESIGN.md + design.json | — (Rafia commits) | Seed line waiver (Rafia's call). Persimmon "+" per card kept as sanctioned exception. Placeholder illustrations (D2). Seller/Admin only from source. Day 3: AIResultCard/AIStatus side stripes. Batch 3: 🇵🇰 emoji flag in PhoneField. |
| 2026-10-17 | **Studio Light Stop 2** (DESIGN-CONSULT §8 Step 3: shared components) | Rafia's Stop 1 feedback: "generic, boring and dull" vs her references and the sample; keep the plan, work to the sample. **Button** system (pills; persimmon primary/cta + `--shadow-cta`; new ink `secondary`; outline, ghost, round `icon` (+ `ink`), `danger`; sm 36 (44 tap halo) / md 44 / lg 52; press scale(.97) 90ms + spring release; loading = label fade + centred spinner; `arrow` nudge, RTL-mirrored). Section-title underline removed; section action = outline pill. **ProductCard** to the sample: borderless 24px, category tint (`tintFor`), ink New / red low-stock / white out-of-stock pills, heart saving on-device (`savedStore.ts`, toast says so), category caption, title + other-language twin (Nastaliq), Outfit price (`PriceDisplay` now Outfit 600, `--price-fs`), persimmon + → ✓ only after a real add (`useAddToCart` returns `Promise<boolean>`), cart bag bump + badge pop. **Illustrations**: 8 transparent cut-outs from the approved sample (Haveli tan recoloured), provenance comments; `ProductThumbnail` hides its placeholder icon once loaded. **Floating pill nav**: ink strip scrolls away (sticky, negative top), translucent pill, Shop / **Categories** (new `CategoriesMenu.tsx`, real categories + tint swatches) / Sell links, stone search pill ≥1100px (round button below), `LanguageToggle` restyled (stone track, white thumb, 44px), round cart with ink badge, ink Log in pill; scrolled state at 24px. **Footer** roomier, brass hairline gone; WhatsApp FAB ink. **EmptyState** peach medallion + lilac echo, `headingLevel` (h3 default); toasts white pills below the header (`message.config top 104`); skeleton/status tweaks. **AuthLayout**: no outer card; 36px peach band, drifting blobs, 5% ink block-print, tilted Written-by-AI card with real kurta art; form on the page; 52px persimmon pill; phone peach band; icon tile removed. **Bug**: RTL phone Home 484px wide (nowrap twin widened `1fr` tracks) → `minmax(0,1fr)` + card `min-width:0`. Dark (provisional) token gaps closed. Surface brief added for AuthLayout; DESIGN.md marked retired. | `tsc` ✅ · `eslint` 0 errors (5 pre-existing warnings) · `vitest` 23/23 ✅ · detector source `[]`; live: only Step 4 items left · interaction probes (light + dark) · overflow probe (no horizontal scroll, EN/UR, 390/1440) · screenshots /dev/ui, Home, Search, Login, Register EN/UR 1440/390 · ui-ux-pro-max checks · taste · impeccable finish review: round 1 = fix (7: duplicate search button, Categories link, seed wording, DESIGN.md, toast offset, phone auth band, out-of-stock card); round 2 = 5 resolved, 2 partial (DESIGN.md front matter, toast touching pill), 0 regressions → both fixed by Claude and verified (toast 20px under the pill; `status: retired` in front matter); menu swatches → category art; budget of 2 rounds used | — (Rafia commits) | Step 4: Home hero/AI banner//sell bands still interim ink; Featured shelf; trust strip; category tiles; browse sidebar + h1→h3. Batch 3: auth role cards/method tabs/checkbox persimmon. Heart needs a Saved page or the Wishlist API. Seller city not in the DTO. DESIGN.md rewrite at the end. |
| 2026-10-17 | **Studio Light Stop 1** (DESIGN-CONSULT §8 Steps 1–2: tokens + fonts) | **Pre-work:** `taste` skill rewritten for Studio Light (green/marigold and Haveli = anti-references); PRODUCT.md binding visual direction → Studio Light; foundation surface brief rewritten. **Step 1:** `global.css` primitives `--haveli-*` → `--studio-*` (§2 values; semantic names unchanged); new roles `--wash-peach/-lilac(-blob)`, `--ai-accent`, `--bg-page`, `--brand-primary-press`, `--field-border-focus`, `--radius-input` (14px), `--tracking-*`, `--fw-display`, `--fs-display` (reserved for the Step 4 hero); neutral two-layer ink shadow scale `xs`–`xl` + `--shadow-cta(-hover)`; motion tokens `--dur-instant/-enter`, `--ease-spring`; six Studio category tints with ink icons; ink announcement/footer; hero/AI-banner/auth panel are interim ink until Step 4. `palette.ts` (`studio`, `studioNight`) + `theme.ts`: radius 14, control height 44, outline default buttons, ink selected/current states everywhere (checkbox, radio, switch, slider, tabs, segmented, menu, steps, date picker, pagination, rate, progress), red badge, two-layer popover shadow. Contrast tunes: caption `#636368` (was `#6B6B70`: 4.4:1 on peach), success `#3F6A2C` (was 4.2:1 on its tint); fields stone at rest. Leftover espresso/brass/parchment/cream rgba removed (hero search ring, sell step thread, AI scan, skeleton sweep, auth mock shadow, success alert border); `--accent-marigold` alias → ink (light-ground consumers), `--ai-accent` named on ink grounds; NEW badge = ink pill; logo spark = AI accent. Dark (provisional) recoloured to ink night + 3 contrast gaps fixed. auth.css inherits global field tokens, ink focus edge. **Step 2:** Outfit 400–700 + Inter (Fraunces dropped); display rules on `--fw-display` 600 + tracking tokens; Urdu stacks lead with Outfit/Inter; Urdu h1–h3 line-height 2. PWA icon + manifest moved off the original green/marigold. | `tsc` ✅ · `eslint` 0 errors (5 pre-existing warnings) · `vitest` 23/23 ✅ · detector: source `[]`, live (/, /login, /sell, /dev/ui) no contrast findings · screenshots (mock API, headless Chrome): home EN 1440 / UR 390, /sell EN 1440, search EN 390 / UR 1440, category UR 1440, login EN 1440 / UR 390, register EN 1440, /dev/ui · ui-ux-pro-max checks (motion tokens, easing, font loading, focus) · taste critique · impeccable finish review: round 1 = fix (6 items: leftover brass/parchment, accent alias, AntD states, display tokens, field radius, seed line); round 2 = 4 resolved, 1 partial (`.kaTitle` tracking, fixed by Claude afterwards), 0 regressions, seed line open; budget of 2 rounds used | — (Rafia commits) | Interim ink blocks (hero, AI banner, /sell bands, auth panel) → Step 4 washes. Illustrations' block-print tiles, button shape + CTA glow, ProductCard border, section-title underline → Step 3. Live detector items for Step 3: login icon tile above h1, nested cards (login, /sell), EmptyState h4 after h2. App follows OS dark mode on first load (provisional theme). FORM seed recorded as `none` (user-pinned direction). `docs/frontend/SampleImages/` renames in git status are not from this session. |
| 2026-10-17 | **Batch 1** (Home · /sell · Search · Category) | **Home** reordered: Hero → TrustStrip → Categories → Featured → New arrivals → AI banner (HowItWorks + PaymentStrip deleted). Search-led hero: "The bazaar, at your doorstep." with a big search bar, real category chips (first 5 from the API), a "Sell on KarobarAI" link and a tilted "stall" of 3 product cards (brass AI tag, COD tag) that settles in on load and fans out on hover. The header search hides while the hero owns it. Trust strip becomes a swipe rail on phones. Categories are compact art tiles with the Urdu name in Nastaliq (`categoryVisuals.ts`), 4 across on desktop and 2 columns on phones. Featured sits on a sand shelf (`Section tone="sand"`), with the track bleeding to the shelf edge. The AI banner is one tilted listing card with a brass chip, and its secondary link goes to /sell. **New `/sell` seller landing** (`SellPage.tsx`, route added): hero with a live **AI listing demo** (`AiListingDemo.tsx`: reads the photo, types EN then UR, then shows the finished listing; starts when 50% visible; reduced motion shows the final state; Replay button), 3 numbered steps on a brass thread, a feature panel with EN/UR tag pairs plus 4 real features (COD, courier, photo-backed returns, analytics), a 5-question FAQ and a closing CTA. "Become a Seller" now goes to /sell. No invented numbers, testimonials or prices. **Search + Category** share the new `BrowseLayout.tsx`: sticky filter sidebar (category, price min/max, condition chips), one toolbar row (count at start via `browseSlots.ts`, removable active-filter chips, sort at end), mobile Filters bottom sheet with Clear all / Show results, an empty state with Clear all, and an outline Load more. The search bar keeps `?q` in sync. Category page gets a banner with breadcrumb, art, both names and a blurb. New EN/UR strings: `hero.*`, `browse.*`, `sell.*`. | `tsc` ✅ · `eslint` 0 errors (5 pre-existing warnings) · `vitest` 23/23 ✅ · detector: only the 2 pre-existing 9px/11px counter-badge advisories · screenshots with mocked API data (headless Chrome, scratchpad only): home, /sell, search, category in EN/UR at 1440 + 390. Impeccable finish review: round 1 = fix (8 items); round 2 = 7 resolved, 1 partial, 2 regressions. Claude fixed the last 3 (count + sort on one row, Featured track bleeding to the shelf edge, 2-column mobile categories) and verified them from recaptures (review budget of 2 rounds used). DESIGN.md updated by the documenter. | — (Rafia commits) | Backend was down, so the pages were checked against mock data only and need a recheck against the real API. Seller spotlight skipped (no real seller data to show). `.impeccable/review/*.png` are review captures and can be gitignored. Documenter notes: the stall-card tilt angles do not mirror in Urdu (positions do); later Batch 1 rules in `global.css` override earlier ones (mobile category rail, stacked art tile, a duplicate sand-shelf rule), so the file needs a cleanup pass. Fixed after documenting: the hero "Sell on KarobarAI" link is parchment with a brass underline (brass text broke the Jewellery rule), and the Urdu AI-card title uses `text-align: start`. |
| 2026-10-17 | **Stop C** (profile icon · 0.7 shells · 0.8 character · finish review · DESIGN.md) | Profile icon: new `features/profile/AccountMenu.tsx`. A round avatar in every header (storefront, Seller, Admin) showing the real profile photo or a Seller's store logo, otherwise a person glyph; opens the role menu. Guests get the same glyph + "Log in" (label hidden on mobile). It's now visible on phones too. New `common:nav.account` EN/UR string. 0.7: espresso announcement bar with brass hairline; copper cart badge; seller/admin sidebar active = espresso pill with brass icon (side-tab removed); bottom-tab active espresso/copper; espresso footer with brass hairline, brass column heads and a new "Your account" column (Orders, Returns, Profile — real routes; new `footer.accountTitle` EN/UR); one brand lockup everywhere (`components/BrandLogo.tsx`; StorefrontLogo is now an alias; auth panel + Seller/Admin headers use it, with an Admin role pill). 0.8: `--pattern-blockprint` token + `.blockprint-layer` (hero, auth panel, AI banner; masked so copy sits on calm espresso); `--hairline-brass`; `components/AiMark.tsx` (compass star) replaces Sparkles on every AI moment (AIHint, auth chip, hero float, AI banner) and Sparkles is gone from the beauty category (Flower2); ✨ removed from `hero.aiFloat`; blanket `<Reveal>` removed from Home (component + tests kept); AI banner gradient cleaned to espresso→walnut; 8 placeholder product SVGs redrawn as hand-authored Haveli illustrations (same filenames, no "Demo photo" text, provenance comment in each); verified badge gets a brass seal; out-of-stock = parchment wash + desaturated photo; `.section--white` sits on parchment (no slab, no nested cards); Fraunces 800 → 700 (only ≤700 is loaded). Impeccable finish review: round 1 = fix (8 items), round 2 = 5 resolved + 2 partial + 2 regressions; the last 3 corrections were verified by Claude from recaptures (review budget of 2 rounds used). `/impeccable document` → `apps/frontend/DESIGN.md` + `.impeccable/design.json`. | `tsc` ✅ · `eslint` 0 errors (5 pre-existing warnings) · `vitest` 23/23 ✅ · detector clean (`[]`) · screenshots: home EN desktop/mobile, home UR desktop/mobile, /dev/ui, login EN/UR, auth EN mobile | — (Rafia commits) | Seller/Admin shells only checked from source (no session while the backend is down). Batch 1 carry-over flagged by the reviewer: eyebrow pills ("Built for Pakistani businesses", "For sellers"), numbered same-size how-it-works cards, cramped mobile trust strip, icon-tile hero collage, no authored motion moment. Documenter notes: WhatsApp button is moss (moss = success only); a few hard-coded white/rgba values on hero/banner and off-grid sizes in auth.css; stale "emerald/saffron" comments. Fraunces SOFT/WONK axes not used yet. |
| 2026-10-17 | **Stop B** (0.4 auth · 0.5 core components · 0.6 product card) | 0.4: `auth.css` now only aliases global tokens. Espresso→walnut brand panel with a brass block-print tile, sand fields, copper focus rings, Haveli alerts / strength meter / checkbox (≥3:1 boundary), parchment text on espresso, radii from the global scale; no brand hex left. 0.5: component-token layer (`--btn-*`, `--field-*`, `--card-*`, `--focus-ring`). Buttons: espresso-outline secondary that warms to copper, visible focus ring, pressed state, disabled = sand/dust, loading keeps copper. Badges: verified = brass ink, low stock = sindoor, COD = quiet sand. StatusTag → `.status-tag` classes (tonal + icon + hairline), colour map moved to `statusVariants.ts`. EmptyState → sand medallion + Fraunces title + copper action. Warm cream skeleton sweep; cream toasts; AntD fields sand + clay hairline; AntD cards linen + xs shadow (radius 16). 0.6: ProductCard is a cream card (inset photo, hover lift + slow zoom, card-level focus ring), espresso price, per-card COD pill removed, brass NEW + sindoor "Only X left" (real `stock` ≤ 5; new `product.onlyLeft` EN/UR string), quick-add = espresso slip, titles in Inter. Urdu font stacks now lead with Fraunces/Inter so Latin in mixed strings stays on-brand. `/dev/ui` gained labelled sample product cards + status tags. | `tsc` ✅ · `eslint` 0 errors (5 pre-existing warnings) · `vitest` 23/23 ✅ · screenshots: /dev/ui EN desktop + UR desktop/mobile, login EN/UR, register EN mobile, forgot-password, home UR · detector: only the pre-existing sidebar side-tab (fixed in 0.7) | — (Rafia commits) | Placeholder product SVGs are still pastel with "Demo photo" text (redrawn in 0.8). |
| 2026-10-17 | **Stop A** (0.1 palette · 0.2 fonts · 0.3 AntD bridge) | 0.1: `global.css` token block rebuilt as primitives (`--haveli-*`) → existing semantic names; new roles `--brand-ink(-2)`, `--urgency(-soft)`, `--accent-ink`, `--text-on-brand/-on-dark`, `--scrim`, `--chart-grid`; espresso-tinted shadows; tonal category family; Haveli-night dark values; selection/caret/accent-color themed; `.btn--cta` → copper; logo "AI" gradient text → solid copper; stray colours fixed in StoreChatWidget + SellerAssistantPage (were falling back to AntD blue), ReturnSimilarityScale, LanguageToggle. 0.2: Fraunces + Inter (variable, one request); Naskh for Urdu UI, Nastaliq for Urdu h1–h3; global Urdu `line-height: 2` → 1.75; IBM Plex + Plus Jakarta removed (incl. auth.css, LanguageToggle). 0.3: new `src/app/palette.ts`; `theme.ts` has no hex; Button / Segmented / Slider / Tabs / Table / Tag / Input / Select / DatePicker / Card / Modal / Drawer on Haveli; `AppShell density="compact"` (40px, ≥768px only) on Seller + Admin. | `tsc` ✅ · `eslint` 0 errors (5 pre-existing warnings) · `vitest` 23/23 ✅ · screenshots: home EN/UR desktop, home EN mobile, login, register UR mobile, search UR, /dev/ui, cart · detector: 1 pre-existing finding (sidebar side-tab) | — (Rafia commits) | Backend was down, so data sections showed error states; /seller and /admin need a session to check. |
| 2026-10-16 | Planning | Critique, Haveli palette, 4-day batch plan, Day 1 plan locked | Reviewed with Rafia | — | Decisions D1–D5 pending |
