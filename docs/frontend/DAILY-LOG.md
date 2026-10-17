# KarobarAI Frontend Redesign: Daily Log

The day-by-day record of the 4-day frontend redesign. Each day lists what was planned, what was done, how it was checked, and what is still open.

- The master plan is [REDESIGN-PLAN-HAVELI.md](REDESIGN-PLAN-HAVELI.md).
- The detailed per-step table (file names, every fix) is in the "Progress log" section of [WORKLOG.md](WORKLOG.md).
- The design system as shipped is in [apps/frontend/DESIGN.md](../../apps/frontend/DESIGN.md).

**Standing rules**
- Frontend only. The backend, including `apps/backend/prisma/seed.ts`, belongs to Abdullah.
- Claude never makes git commits. Rafia commits.
- No invented ratings, reviews, seller stories, prices, counts or courier brands.
- Claude writes code only when Rafia asks for it.

---

## Status at a glance

| Day | Date | Batches | Status |
|---|---|---|---|
| Day 0 | 2026-10-16 | Planning: critique, palette, batch plan | ✅ Done |
| Day 1 | 2026-10-17 | Batch 0 (foundation) + Batch 1 (discovery) | ✅ Done, not committed yet |
| Day 1 (end) | 2026-10-17 | Palette rethink → **Studio Light** approved (see DESIGN-CONSULT.md) | ✅ Decided |
| Studio Light migration | 2026-10-17 | DESIGN-CONSULT §8: Steps 1–2 (tokens + fonts) → Stop 1 | ✅ Reviewed by Rafia ("generic, dull" → move on, do it well) |
| Studio Light migration | 2026-10-17 | Step 3 (shared components) → Stop 2 | ✅ Reviewed by Rafia ("next start") |
| Studio Light migration | 2026-10-17 | Steps 4–5 (pages + checks) → Stop 3 | 🟡 Done, waiting for Rafia's review |
| Day 2 | — | Batch 2 (purchase flow) + Batch 3 (auth) | ⏭ Next |
| Day 3 | — | Batch 4 (seller workspace + AI Store Builder) | Not started |
| Day 4 | — | Batch 5 (buyer after purchase) + Batch 6 (admin) + QA | Not started |

---

## Day 0: Planning (2026-10-16)

**Done**
- Reviewed where the project stood, without touching code.
- Wrote a full UI/UX critique. The main findings:
  - The pages don't read as one product.
  - It feels dry because nothing on the page is real.
  - The green-and-white scheme felt flat.
- Proposed the "Haveli" palette: parchment and sand backgrounds, copper buttons, brass highlights, espresso ink.
- Explained the difference between the home page, the landing page and the products page.
- Grouped every page into 4 days of batches, and listed the missing pages and components.
- Saved everything in `docs/frontend/REDESIGN-PLAN-HAVELI.md`.
- Created `docs/frontend/WORKLOG.md` with the locked rules, the Day 1 plan and a palette test guide.
- Installed the design plugins (frontend-design, ui-ux-pro-max, impeccable) and wrote `PRODUCT.md` at the repo root.

---

## Day 1: Batch 0 + Batch 1 (2026-10-17)

### Batch 0: Foundation (Stops A, B, C)

**Stop A: palette, fonts, Ant Design bridge**
- New colour token system in `global.css`, in three layers: primitives (`--haveli-*`), then roles, then component tokens.
- Copper was tuned to `#AE5429` and taupe to `#7D6A58` so text passes WCAG AA.
- Fonts are Fraunces (headings) and Inter (UI). Urdu uses Nastaliq for headings and Naskh for UI text.
- New `src/app/palette.ts`. `theme.ts` no longer contains any hex values.
- Ant Design components now follow the palette, with compact density on the Seller and Admin pages.

**Stop B: auth, core components, product card**
- Auth screens re-skinned: brand panel with a block-print pattern, sand fields, copper focus rings.
- New component tokens for buttons, fields and cards.
- Restyled: Button, Badge, StatusTag, EmptyState, skeletons, toasts.
- New ProductCard: cream card with a hover lift, a brass "New" badge and a red "Only X left" badge, which appears only when real stock is 5 or fewer.

**Stop C: profile icon, shells, character**
- Profile avatar menu in every header (`AccountMenu.tsx`). Guests see a "Log in" glyph.
- Espresso announcement bar and footer, with a new "Your account" footer column.
- One logo component everywhere (`BrandLogo.tsx`).
- AI moments use a new compass-star mark (`AiMark.tsx`) instead of sparkles.
- The 8 placeholder product images were redrawn as Haveli illustrations.
- The impeccable design review ran for 2 rounds. The documenter wrote `apps/frontend/DESIGN.md`.

### Batch 1: Discovery (Home, /sell, Search, Category)

**Home (`/`)**
- New section order: Hero → trust strip → categories → Featured → New arrivals → AI banner. HowItWorks and PaymentStrip were removed.
- The hero leads with search: "The bazaar, at your doorstep." It has real category chips, a "Sell on KarobarAI" link, and a tilted row of 3 product cards that settles in on load and fans out on hover.
- Category tiles show the illustration with both names, Urdu in Nastaliq. They are 4 across on desktop and 2 columns on phones.
- Featured sits on a sand shelf. The AI banner shows one listing card with a brass AI tag.

**Seller landing (`/sell`, new page)**
- Live AI listing demo: it reads a photo, types the listing in English and then Urdu, and shows the finished listing. It starts when it scrolls into view; with reduced motion on, it shows the finished state straight away.
- After the demo: 3 steps, real features (COD, courier booking, photo-backed returns, analytics), an FAQ and a closing call to action.
- "Become a Seller" now opens this page.

**Search (`/search`) and Category (`/category/:slug`)**
- Shared `BrowseLayout`:
  - A sticky filter sidebar (category, price, condition).
  - One toolbar row with the result count, removable filter chips and Sort.
  - On phones, filters open in a bottom sheet.
  - A helpful empty state and a "Load more" button.
- The category page has a banner with a breadcrumb, an illustration and both names.

**Checks**
- `tsc` clean. `eslint` has 0 errors (5 old warnings). `vitest` passes 23/23.
- The design detector shows only 2 old advisories, on the small badge counters.
- Screenshots in English and Urdu at desktop (1440) and phone (390) width. They used mock data because the backend was down.
- The impeccable review ran for 2 rounds. Claude fixed the last 3 items and checked them in new screenshots. `DESIGN.md` was updated.

**Open from Day 1**
- Recheck every page against the real API once the backend is running.
- The tilted cards don't mirror their angles in Urdu.
- `global.css` has some Batch 1 rules that override earlier ones, so it needs a tidy-up pass.
- The seller spotlight was skipped because there is no real seller data.
- `apps/frontend/.impeccable/review/*.png` are review screenshots and can be gitignored.
- Nothing is committed yet. Rafia will commit.

### End of Day 1: palette rethink

**Feedback from Rafia:** the dark espresso brown feels like a coffee brand. The orange is fine but needs refining.

**Diagnosis:** the coffee feeling comes from the large dark-brown areas (hero, AI banner, top bar, footer), not from the orange.

**Options prepared** (each shown on a small storefront mock, with contrast checked):
1. **Ajrak: indigo + persimmon** (recommended). Deep indigo `#1F2B4F` replaces the brown. It draws on Sindhi ajrak block print and Multani blue pottery, and blue reads as trust.
2. **Jamun: plum + persimmon.** Deep plum `#3A2036` with blush-ivory backgrounds. Softer and more boutique.
3. **Slate & Clay: graphite + persimmon.** Neutral graphite `#24262B`. The most SaaS-like, with the least local character.

**Refined orange in all three options:** persimmon `#BF4A1F` (hover `#A63E17`). It is cleaner and redder than `#AE5429` and still passes AA, with 4.98:1 for white text.

**What switching involves:**
- A token swap only (`global.css` primitives + `palette.ts`). No layout changes.
- The hero and AI banner become light tinted bands.
- The illustrations' dark strokes move to the new ink colour.

**Reference samples** (`docs/frontend/SampleImages/`, 11 screenshots from Dribbble, Pinterest and DeepSeek) were analysed. They share one recipe:
- A near-white base.
- Near-black ink for text and pill buttons.
- One warm accent, used sparingly.
- Soft peach and lilac washes instead of dark blocks.
- Product photos or cut-outs on light tiles.
- Large rounded corners (16–32px), pill buttons and chips, and a floating pill-shaped nav.
- Big geometric sans headlines with tight letter spacing.
- Few borders and soft shadows.

From this came a 4th option, **Studio Light**:
- Ink `#17171A`.
- Persimmon `#BF4A1F` CTA.
- Peach wash `#F7E6DC` and lilac wash `#E3E6F5`.
- Warm white `#FAF9F7` background.

It is now the recommended option. The samples also suggest swapping the Fraunces serif headings for a geometric sans, because the serif adds to the vintage, café feel.

**Sample home page design** (no code): a full desktop Home in Studio Light, made as a design canvas: https://claude.ai/artifact/NZ8BCheo5VxgqS3DgvS8WX
- Outfit headings, Inter body, Nastaliq Urdu.
- A floating pill-shaped nav.
- A centred hero with a big search box and fanned product cards.
- A trust row and category tiles with both names.
- Featured product cards.
- A light peach "sell with AI" band with a listing card.
- An ink footer.

It has Ink and Accent controls in its Tweaks panel to preview the other palettes.

**Decision (2026-10-17):** ✅ Rafia approved **Studio Light**: ink `#17171A`, persimmon CTA, light washes, Outfit headings. The full design consultation (tokens, shadows, motion, button system, CTA rules, migration plan) is in [DESIGN-CONSULT.md](DESIGN-CONSULT.md).

---

## Studio Light migration (DESIGN-CONSULT.md §8)

### Stop 1: Steps 1–2, tokens and fonts (2026-10-17)

**Before starting**
- The `taste` skill (`.claude/skills/taste/SKILL.md`) was rewritten for Studio Light. Green/marigold and Haveli are now listed as anti-references.
- `PRODUCT.md`: the "Binding visual direction" line now points at Studio Light instead of Haveli.
- The foundation surface brief (`.impeccable/surfaces/src-app-global-css.md`) was rewritten with the Studio Light direction contract.
- Baseline design detector: 0 findings.

**Step 1: tokens**
- `global.css` primitives renamed from `--haveli-*` to `--studio-*`, with the DESIGN-CONSULT §2 values. Semantic names (`--brand-primary`, `--bg-canvas`, …) are unchanged, so every screen switched at once.
- New roles: `--wash-peach`, `--wash-lilac` (plus their blob tones), `--ai-accent`, `--bg-page`, `--brand-primary-press`, `--field-border-focus`.
- New shadow scale: neutral ink, two layers each, `xs` to `xl`, plus `--shadow-cta` and `--shadow-cta-hover` for the persimmon button only.
- New motion tokens: `--dur-instant` (90ms), `--dur-enter` (520ms), `--ease-spring`.
- Category tints are the six Studio tints, with ink icons.
- `palette.ts` and `theme.ts`: AntD is on Studio Light, with radius 14 and control height 44 (Seller/Admin keep their compact 40px on tablet and desktop).
  - Selected and current states are ink, not persimmon, so there is one persimmon per view: checkbox, radio, switch, slider, tabs, segmented, menu, steps, date picker, pagination, stars and progress.
  - The notification badge is red.
- Two contrast tunes against §2:
  - Caption grey is `#636368` instead of `#6B6B70`. The original was 4.7:1 on stone and **4.4:1 on the peach wash**. The new value is ≥ 5.3:1 on page, white and stone, and ≥ 4.8:1 on the washes.
  - Success green is `#3F6A2C` instead of `#4F7A3A`, going from 4.2:1 to 5.3:1 on its tint.
- Fields stay **stone-filled at rest** instead of white. A white field on a white card only has a 1.5:1 edge. On focus a field turns white with an ink border and a persimmon ring.
- Old espresso, brass and parchment values were removed from every rule that renders on a light ground. The old brass alias now maps to ink on light grounds, and AI tags on ink use `--ai-accent`. The "New" badge is an ink pill.
- The provisional dark values ("ink night") were recoloured, and three dark contrast gaps were fixed.

**Step 2: fonts**
- `index.html` loads Outfit (400–700) and Inter. Fraunces is gone.
- Headings use Outfit 600 with tight tracking tokens (`--fw-display`, `--tracking-*`). The Urdu stacks lead with Outfit and Inter, and Urdu headings have a line-height of 2.

**Also fixed**
- The favicon/PWA icon and the PWA manifest colours were still the **original green and marigold**. The icon is now an ink tile with the bag-and-spark logo mark, and the logo spark uses the AI accent.

**Checks**
- `tsc` clean. `eslint` has 0 errors (the same 5 old warnings). `vitest` passes 23/23.
- Design detector, source: 0 findings.
- Design detector, live pages: no contrast findings. The items left are listed under Open.
- Screenshots in EN and UR at 1440 and 390 (mock data, because the backend is down).
- Impeccable finish review: round 1 = fix (6 items); round 2 = 4 resolved, 1 partial (`.kaTitle` tracking, fixed by Claude afterwards), 0 regressions, 1 open (the seed line, see Open). Review budget of 2 rounds used.

**Open after Stop 1**
- Interim look until Steps 3–4: the hero, AI banner, /sell bands and auth panel are **ink blocks**, and turn into light washes in Step 4. The illustrations still have the block-print tile background (Step 3). Buttons still have 12px corners and no glow (Step 3).
- The live detector also flags these for Step 3: the icon tile above "Welcome back" on login, nested cards on login and /sell, and EmptyState using an h4 right after an h2.
- "Inter is overused": kept on purpose, because DESIGN-CONSULT pins Inter for body text. The typing caret in the /sell AI demo is the page's signature moment (§7).
- The app follows the system dark-mode setting on first load. If Windows is set to dark, you'll see the provisional "ink night" theme, not Studio Light.
- **Open from the review (your call):** the surface brief records `seed: none (user-pinned direction, no roll)`. The reviewer's rules want either a rolled seed or an exemption it recognises. Studio Light is your pinned direction, and rolling a seed could pull against it, so Claude left it as a disclosed pin.
- `docs/frontend/SampleImages/` shows renamed screenshots in git status. That rename isn't from this session, so it's left for Rafia.

---

### Rafia's feedback on Stop 1

Rafia said the screenshots matched neither her reference images nor the sample design: "generic, boring and dull". The reason: Stop 1 only swapped colours and fonts on the old layout. Rafia chose to keep the staged plan ("if it gets fixed later, move on") and asked for genuinely good work. From here on, each stop is compared side by side with the sample design before it is shown.

### Stop 2: Step 3, shared components (2026-10-17)

**What changed**
- **Buttons** (`Button.tsx` + CSS):
  - All buttons are pills now. The persimmon primary/CTA has its own glow, and a new ink `secondary` button was added.
  - Other variants: outline (its hairline turns ink on hover), ghost (underline on hover), a round 44px `icon` button (with an ink version) and a `danger` button.
  - Sizes: 36 / 44 / 52px. The small size keeps a 44px tap area.
  - Motion: pressing shrinks the button to 97% in 90ms, and it springs back on release.
  - Loading fades the label and shows a centred spinner without changing the width.
  - New `arrow` option: the arrow nudges toward the reading direction on hover and mirrors in Urdu.
  - The small underline under section titles is gone. "All categories →" is now an outline pill.
- **Product card** (`ProductCard.tsx`), built to match the sample:
  - A borderless white card with 24px corners and the product art on its category's tint.
  - An ink "New" pill or a red "Only X left" pill.
  - A heart button. It saves on this device only, because Wishlist (F17) has no backend yet, and the toast says so.
  - The category, the title, and the title in the other language under it (Urdu in Nastaliq).
  - The price in Outfit.
  - The persimmon "+" turns into a ✓ only after the item is really in the cart (`useAddToCart` now reports success). It turns back after 1.5s, and the cart icon in the header bumps while its count pops.
  - "Out of stock" moved to the top badge slot, and prices line up across a row.
- **Illustrations:** the 8 product SVGs are now transparent cut-outs, the same art as the sample (the old Haveli tan was recoloured).
  - The thumbnail no longer shows its "no image" icon behind a loaded picture.
  - Prices use Outfit everywhere.
- **Floating pill nav** (`StorefrontHeader.tsx`):
  - The ink announcement strip scrolls away, and a translucent white pill stays at the top.
  - The pill holds Shop / Categories (a new dropdown of the real categories with their tints) / Sell on KarobarAI, a stone search pill, the sliding EN/اردو toggle (`LanguageToggle` restyled), a round cart button with an ink count badge, and an ink "Log in" pill.
  - After 24px of scrolling it becomes more solid and its shadow deepens.
- **Footer:**
  - The brass line is gone, and the spacing is roomier.
  - The WhatsApp button is ink, because green is reserved for success.
- **Small pieces:**
  - The EmptyState has a peach disc with a lilac echo, and its title is an h3 (it was an h4 straight after an h2).
  - Toasts are white pills that open below the header.
  - Skeletons are stone, and status tags got a minimum height.
- **AuthLayout:**
  - The outer card is gone, so the page no longer has a card inside a card.
  - The panel is a peach wash band with drifting blobs, a 5% ink block-print, and a tilted "Written by AI" listing card using the real kurta art.
  - The form sits straight on the page, and the button is a 52px persimmon pill.
  - On phones there is a slim peach band with the logo and the toggle.
  - The icon tile above the title was removed.
- **Bug fixed:** on Urdu phones, Home was 484px wide (it slid sideways). Cause: the one-line Urdu/English title under each card widened the grid columns. Fix: `minmax(0, 1fr)` columns and `min-width: 0` on the card.
- **Dark mode** (provisional): fixed the nav pill, the danger button, the auth blobs, the CTA glow and the ink pills.

**Checks**
- `tsc` clean. `eslint` has 0 errors. `vitest` passes 23/23.
- Design detector, source: 0 findings.
- Interaction probe, in light and dark:
  - "+" becomes ✓ at 120ms, and the cart badge shows "1" and pops.
  - The heart saves to localStorage.
  - The button is back to "+" at 1.9s.
  - The Categories menu opens with 8 categories.
- No sideways scroll on Home or Search, in EN and UR, at 390 and 1440.
- Screenshots: /dev/ui, Home, Search, Login and Register in EN and UR at 1440 and 390.
- ui-ux-pro-max checks: touch targets, hover vs tap, pressed states, loading.
- Impeccable finish review: round 1 = fix (7 items: a duplicate search button at ≥1100px, a missing "Categories" link, the seed line, DESIGN.md, toast position, the phone auth band, the out-of-stock card); round 2 = 5 resolved, 2 partial (DESIGN.md's retired note had to go inside the front matter; the toast still touched the nav pill), 0 regressions. Claude fixed both afterwards and checked them: the toast now rests 20px below the pill, and DESIGN.md carries `status: retired` plus a retired description. The reviewer also noted the Categories swatches were too faint, so they now show the category's cut-out art. Review budget of 2 rounds used.

**Open after Stop 2**
- **Still looks old, changes in Step 4:**
  - The Home hero, the AI banner and the /sell bands are still ink blocks with the old two-column layout.
  - The grey "Featured" shelf.
  - The trust strip.
  - The category tile layout.
  - The Search/Category filter sidebar, which also skips from h1 to h3.
- **Auth polish (Batch 3):** the role cards, method tabs and checkbox still use persimmon for the selected state.
- **Heart:** saves on this device only. A "Saved" list page, or the Wishlist API, is needed before saving can be found again later.
- **Seller city:** the sample showed it on cards, but the product data has no seller or city field, so cards show the category only.
- **DESIGN.md:** now carries a "retired" banner. The documenter rewrites it at the end of the migration.

---

### Stop 3: Steps 4–5, pages and checks (2026-10-17)

**Home (`/`), rebuilt to match the sample design**
- **Hero:**
  - A centred Outfit headline with the Urdu (Nastaliq) line under it, and a short promise.
  - A large white search box with a persimmon "Search" button and 4 real category chips.
  - Behind it, two slowly drifting peach and lilac blobs.
- **Card fan:** five cards built from **real home-feed products**. The centre card shows the real title and price and opens the product.
  - Two tags float on it: "Listed by AI in Urdu & English" and "Pay on delivery".
  - On load the fan settles into place, and it opens a little on hover. The angles now mirror in Urdu, which closes a Day 1 open item.
  - Before the data loads, the fan shows the category illustrations without prices.
- **Trust row:** four light cards, each with its icon on a different wash.
  - "Verified sellers" became "Urdu or English", because there is no seller verification data.
  - "Eligible Returns" became "Photo-backed returns".
- **Categories:** white tiles with tinted art windows and both names.
- **Featured:** plain product cards, with white "previous" and ink "next" arrows beside the heading. The grey shelf is gone.
- **New arrivals:** no longer repeats the Featured products.
- **Sell band:** the dark AI banner became a light peach band titled "One photo. A full listing in Urdu and English.". It holds an AI listing card with English and Urdu titles, tags, a dashed price slot for the seller, and Publish.
- **What was left out of the sample:** the eyebrow pills (banned by the design rules) and the priced placeholder card (invented price).

**/sell**
- **Hero:** light hero over the same blobs. "Log in to your store" is an ink button.
- **AI demo card:**
  - It is white with a large soft shadow.
  - Typing focus, the cursor and the "AI field" dots are now ink.
  - The scan line now animates `transform` instead of `top`.
- **Steps:** each step now shows a small piece of the real flow (the photo, the AI's two titles, a "New order · Cash on Delivery" card) instead of an icon disc.
- **FAQ:** two columns.
- **Closing band:** peach, with the faint block-print.

**Search and Category**
- **Filter card:** a white card with 24px corners.
- **Chips and sort:** applied-filter chips are stone with a × that turns on hover, "Clear all" and the filter count are ink, and Sort is a pill.
- **Headings:** filter group titles are h2 now (they jumped from h1 to h3).
- **Category banner:** a band in the category's own colour, with large cut-out art standing on it and the Urdu name in Nastaliq.

**Auth**
- The selected role card, the method tabs and the checkbox are ink.
- Focus rings are the standard persimmon ring.
- "Forgot password?" is an ink link.
- Urdu fixes: the phone number in the placeholder no longer reverses, and "+92" reads correctly.

**Seller/Admin shell** (checked from code only, because there is no session without the backend)
- The sidebar active link is an ink pill.
- The mobile bottom tab shows a stone pill behind an ink icon.
- Badges are ink.

**Checks (Step 5)**
- `tsc` clean. `eslint` has 0 errors. `vitest` passes 23/23.
- Design detector, source: 0 findings.
- No sideways scroll at 360, 390 and 1440 in EN and UR.
- Contrast spot-check: every new pair passes AA. The lowest is 4.81:1, caption grey on lilac.
- All screenshots ran with reduced motion on: the fan shows its final position and the AI demo shows its finished state.
- 22 screenshots: Home, /sell, Search, Category and Login in EN/UR at 1440 and 390, plus Register.
- Impeccable finish review: round 1 = fix (8 items); round 2 = 4 resolved, 3 partial, 1 small regression. Claude then fixed and checked the rest:
  - The /sell demo photo now matches the fields' height.
  - The category art moved toward the title.
  - The AI tag stays on screen at 360px.
- The documenter is rewriting `DESIGN.md` and `design.json` for Studio Light.

**Open after Stop 3**
- **Seed line (Rafia's call):** the design reviewer wants a generated "seed" recorded for the design direction, or Rafia's confirmation that the direction is pinned and no seed is needed. Claude has written "pinned by Rafia, no roll" and quoted Rafia's approval in every brief.
- **"+" on product cards:** it stays persimmon on every card, because DESIGN-CONSULT §6 and the sample both ask for it. It is recorded in the briefs as the one sanctioned exception to "one persimmon per view".
- **Placeholder art:** the product pictures are still illustrations, not real photos (decision D2).
- **Later days:**
  - Seller AI components (`AIResultCard`, `AIStatus`) still have coloured side stripes (Day 3).
  - The phone field uses a 🇵🇰 emoji as its flag (Batch 3).
  - The seller/admin screens get their full redesign on Day 3 and Day 4.

---

## Day 2: Batch 2 (purchase) + Batch 3 (auth) (planned)

**First:** apply the palette Rafia picks. It is a token swap and should take about an hour, including screenshots.

**Batch 2: Purchase flow**
- Product detail (`/product/:id`): gallery, both titles, price, stock urgency, quantity, Add to cart / Buy now, sticky mobile bar, store card, COD and returns reassurance, "More from this store".
- Cart (`/cart`): items grouped by seller, order summary, checkout button, empty state.
- Checkout (`/checkout`): step indicator, address cards, payment method cards, one "Place order" button.
- Order confirmation (`/checkout/confirmation`): celebration, "Shukriya!", order numbers, "Track order" / "Keep shopping".

**Batch 3: Auth polish**
- Login, Register, OTP, Forgot password, Reset password. Mostly a re-skin, because the structure is already good.

---

## Day 3: Batch 4 (seller workspace) (planned)

- Seller layout, store setup wizard, seller home.
- **AI Store Builder** (`/seller/products/new`), the FYP headline.
- Edit product, orders and order detail (courier booking), tracking, analytics, returns, profile and settings.

---

## Day 4: Batch 5 + Batch 6 + QA (planned)

- **Buyer after purchase:**
  - My orders, order detail, tracking, public tracking.
  - Returns and the return wizard.
  - Notifications, profile.
- **Admin:**
  - Re-skin only, at compact density.
  - Dashboard, users, moderation, reports, returns, config.
- **QA:**
  - Phones at 375px.
  - Urdu/RTL.
  - Empty, loading and error states.
  - Focus states and 44px touch targets.

---

## How to resume in a new session

Paste this at the start of a new Claude Code session:

> Continue the KarobarAI frontend redesign. Read `docs/frontend/DAILY-LOG.md`, `docs/frontend/WORKLOG.md` and `apps/frontend/DESIGN.md` first. Don't make git commits. Also read `docs/frontend/DESIGN-CONSULT.md`. Move the finished pages to Studio Light by following its section 8, then start Day 2 (Batch 2 + Batch 3) with the design plugins.

To start the dev server: run `npx vite --port 5173` from `apps/frontend`. The backend needs Docker, which is Abdullah's setup.
