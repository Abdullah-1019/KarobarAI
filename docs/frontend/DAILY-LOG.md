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
| Day 1 (end) | 2026-10-17 | Palette rethink → **Studio Light** approved (see DESIGN-CONSULT.md) | ✅ Decided, not coded yet |
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
