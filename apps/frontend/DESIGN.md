---
# RETIRED (2026-10-17): the Haveli tokens below are anti-reference. Studio Light replaced them; the
# source of truth is docs/frontend/DESIGN-CONSULT.md + src/app/global.css until this file is rewritten.
name: KarobarAI
status: retired
description: "RETIRED Haveli design system, kept for history only. Do not build from these tokens; use docs/frontend/DESIGN-CONSULT.md (Studio Light) and src/app/global.css."
colors:
  parchment: "#faf6ef"
  cream: "#fffdf9"
  sand: "#f1e8da"
  linen: "#e7dccb"
  clay: "#d4c4ab"
  espresso: "#2b1d14"
  walnut: "#5a3a22"
  umber: "#6b5a4b"
  taupe: "#7d6a58"
  dust: "#a6977f"
  copper: "#ae5429"
  copper-deep: "#9a4722"
  copper-deeper: "#7e3a1c"
  peach-clay: "#f6e3d6"
  sindoor: "#c8402e"
  sindoor-soft: "#f7ddd6"
  brass: "#c9963f"
  brass-deep: "#a87a2c"
  brass-ink: "#7a5512"
  haldi: "#f6e7c4"
  moss: "#4f7a3a"
  moss-soft: "#e6eedb"
  indigo: "#3a4d7a"
  indigo-soft: "#e3e7ef"
  kiln: "#b3261e"
  kiln-soft: "#f6deda"
  turmeric-ink: "#8a5a12"
typography:
  display:
    fontFamily: "Fraunces, 'Noto Naskh Arabic', Georgia, 'Times New Roman', serif"
    fontSize: "clamp(34px, 5vw + 1rem, 56px)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Fraunces, 'Noto Naskh Arabic', Georgia, 'Times New Roman', serif"
    fontSize: "clamp(24px, 1.6vw + 1rem, 32px)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Fraunces, 'Noto Naskh Arabic', Georgia, 'Times New Roman', serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, 'Noto Naskh Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  body-ui-title:
    fontFamily: "Inter, 'Noto Naskh Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0"
  label:
    fontFamily: "Inter, 'Noto Naskh Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
  label-sm:
    fontFamily: "Inter, 'Noto Naskh Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
  urdu-display:
    fontFamily: "Fraunces, 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif"
    lineHeight: 1.95
    letterSpacing: "0"
  urdu-ui:
    fontFamily: "Inter, 'Noto Naskh Arabic', 'Noto Nastaliq Urdu', 'Segoe UI', sans-serif"
    lineHeight: 1.75
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  card: "20px"
  xl: "24px"
  pill: "999px"
spacing:
  sp-1: "4px"
  sp-2: "8px"
  sp-3: "12px"
  sp-4: "16px"
  sp-5: "20px"
  sp-6: "24px"
  sp-8: "32px"
  sp-10: "40px"
  sp-12: "48px"
  sp-16: "64px"
  sp-24: "96px"
components:
  button-primary:
    backgroundColor: "{colors.copper}"
    textColor: "#ffffff"
    typography: "{typography.body-ui-title}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.copper-deep}"
  button-primary-active:
    backgroundColor: "{colors.copper-deeper}"
  button-primary-disabled:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.dust}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.espresso}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "48px"
  button-outline-hover:
    backgroundColor: "{colors.peach-clay}"
    textColor: "{colors.copper-deeper}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.copper}"
    rounded: "{rounded.md}"
    height: "48px"
  button-ghost-hover:
    backgroundColor: "{colors.peach-clay}"
    textColor: "{colors.copper-deeper}"
  button-sm:
    typography: "{typography.label}"
    padding: "0 16px"
    height: "40px"
  button-lg:
    padding: "0 32px"
    height: "56px"
  field:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "48px"
  field-focus:
    backgroundColor: "{colors.cream}"
  card-product:
    backgroundColor: "{colors.cream}"
    rounded: "{rounded.lg}"
    padding: "8px 8px 16px"
  card-tile:
    backgroundColor: "{colors.cream}"
    rounded: "{rounded.card}"
    padding: "16px"
  quick-add-slip:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.parchment}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "40px"
  badge-new:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.espresso}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "24px"
  badge-sale:
    backgroundColor: "{colors.sindoor}"
    textColor: "#ffffff"
    typography: "{typography.label-sm}"
    rounded: "{rounded.pill}"
    height: "24px"
  badge-low-stock:
    backgroundColor: "{colors.sindoor-soft}"
    textColor: "{colors.sindoor}"
    rounded: "{rounded.pill}"
    height: "24px"
  badge-cod:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.walnut}"
    rounded: "{rounded.pill}"
    height: "24px"
  status-tag-success:
    backgroundColor: "{colors.moss-soft}"
    textColor: "{colors.moss}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.pill}"
    padding: "2px 12px 2px 8px"
  status-tag-info:
    backgroundColor: "{colors.indigo-soft}"
    textColor: "{colors.indigo}"
    rounded: "{rounded.pill}"
  status-tag-warning:
    backgroundColor: "{colors.haldi}"
    textColor: "{colors.turmeric-ink}"
    rounded: "{rounded.pill}"
  status-tag-error:
    backgroundColor: "{colors.kiln-soft}"
    textColor: "{colors.kiln}"
    rounded: "{rounded.pill}"
  sidebar-link:
    textColor: "{colors.umber}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "44px"
  sidebar-link-active:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.parchment}"
  announce-band:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.parchment}"
    height: "36px"
  search-hero:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.pill}"
    padding: "0 8px 0 24px"
    height: "62px"
  hero-chip:
    backgroundColor: "rgba(250, 246, 239, 0.07)"
    textColor: "{colors.parchment}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  stall-card:
    backgroundColor: "{colors.cream}"
    rounded: "{rounded.card}"
    padding: "10px 10px 14px"
    width: "210px"
  stall-tag-ai:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  stall-tag-cod:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.walnut}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  cat-tile-art:
    backgroundColor: "{colors.cream}"
    rounded: "{rounded.lg}"
    padding: "8px 16px 8px 8px"
  section-sand:
    backgroundColor: "{colors.sand}"
    rounded: "{rounded.xl}"
  ai-demo:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.xl}"
    padding: "16px"
  ai-demo-field:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
    height: "52px"
  ai-demo-field-writing:
    backgroundColor: "{colors.cream}"
  active-filter-chip:
    backgroundColor: "{colors.peach-clay}"
    textColor: "{colors.copper-deeper}"
    rounded: "{rounded.pill}"
    padding: "0 8px 0 12px"
    height: "36px"
  filter-chip:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "36px"
  filter-chip-selected:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.parchment}"
  filters-button:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  browse-sidebar:
    backgroundColor: "{colors.cream}"
    rounded: "{rounded.lg}"
    padding: "20px"
    width: "264px"
  cat-banner:
    textColor: "{colors.espresso}"
    rounded: "{rounded.xl}"
  sell-step-marker:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.copper}"
    rounded: "{rounded.pill}"
    size: "64px"
---

> **RETIRED — do not build from this file.** On 2026-10-17 Rafia replaced the "Haveli" world described
> below with **Studio Light** (warm white, ink, one persimmon CTA, peach/lilac washes, Outfit + Inter).
> Until this file is rewritten from the shipped build at the end of the migration, the source of truth
> is `docs/frontend/DESIGN-CONSULT.md` plus the live tokens in `src/app/global.css`. Everything below
> (espresso, brass, parchment, copper, Fraunces) is anti-reference.


# Design System: KarobarAI

## Overview

**Creative North Star: "The Haveli at Golden Hour"**

A Lahore haveli in late light: sandstone grounds, espresso woodwork, copper hardware, brass inlay. The system exists so a small, unknown seller looks established and trustworthy. The page is mostly warm parchment and cream; espresso carries the ink and every dark band; a single copper fill tells the visitor what to do next; brass appears only as small pieces of jewellery. The recurring material is an ajrak/ralli eight-point block-print tile, drawn in brass and laid faintly over espresso bands.

Two densities share one world. Buyer surfaces (storefront, cart, checkout) are calm and touch-first, with 48px controls and generous section rhythm. Seller and admin workspaces are quieter and denser (40px controls on tablet and desktop), and the brand lives in precise details: the espresso active pill in the sidebar, sand table headers, copper focus halos. Everything is bilingual: English in Fraunces and Inter, Urdu in Naskh for running UI and Nastaliq for display, with layouts written in logical properties so they mirror under RTL without separate code.

The world deliberately refuses the category default: green-on-white marketplace chrome and flash-sale orange. Light mode is the finished world. A dark "Haveli at night" value set exists but is unpolished; treat it as provisional.

**Key Characteristics:**
- Parchment, cream and sand grounds with linen hairlines; espresso ink; copper as the only action colour.
- Espresso bands (announcement, hero, AI banner, footer, auth panel) edged with a brass hairline and, on the larger ones, the block-print tile.
- Fraunces display over Inter UI; Urdu stacks lead with the Latin face so mixed strings keep their brand letterforms.
- Warm, espresso-tinted shadows; soft lift on hover; restrained, purposeful motion that respects reduced motion.
- Bilingual RTL by construction (logical properties, mirrored arrows and masks).
- Storefront entry is search-led: the search field sits where a CTA would, beside a hand-placed "stall" of tilted illustrated cards.
- Bilingual identity is shown, not tucked away: category and sample-listing names carry their Urdu in Nastaliq at display size next to the English.

## Colors

A warm sandstone-and-wood palette with one decisive copper, one jewellery metal, and a single cool note.

### Primary
- **Haveli Copper** (copper): the single "do this" colour. Primary and CTA buttons, links, focus outline and ring, checked controls, slider tracks, the active tab ink bar, cart badge. Tuned from the brief's #B4572A to clear AA 4.5:1 as link text on parchment and for white-on-copper.
- **Deep Copper / Deeper Copper** (copper-deep, copper-deeper): hover and pressed states of copper; deeper copper is also the text colour of hovered outline/ghost buttons.
- **Peach Clay** (peach-clay): copper's soft fill. Hover wash for outline and ghost buttons, selected rows and options, trust-strip and step icon tiles, text selection.

### Secondary
- **Espresso** (espresso): brand ink. All headings and primary text, every dark band, the sidebar active pill, the product-card quick-add slip, tooltips, the selected segment of segmented controls.
- **Walnut** (walnut): espresso's second tone. The far stop of the espresso→walnut band gradient, table header text, COD badge text.

### Tertiary
- **Brass** (brass): jewellery. The AI mark, the "New" badge, the verified seal (brass-deep), the 48×4 section-title underline, footer column labels, the block-print tile stroke, the sidebar active icon. Always with dark text when it is a fill.
- **Brass Ink / Haldi** (brass-ink, haldi): brass-family text and its soft ground (AI chips, warning tags).
- **Sindoor** (sindoor, sindoor-soft): urgency. Discount and low-stock badges only.
- **Indigo** (indigo, indigo-soft): the palette's one cool note. Info status, the books and mobile category tints, the fourth chart series.
- **Moss** (moss, moss-soft): success status.
- **Kiln** (kiln, kiln-soft) and **Turmeric Ink** (turmeric-ink): error and warning text, with kiln-soft and haldi as their tag grounds.

### Neutral
- **Parchment** (parchment): the canvas of every page; also text on espresso bands.
- **Cream** (cream): raised surfaces: cards, header, modals, drawers, toasts, the auth form half.
- **Sand** (sand): sunken surfaces: form fields at rest, table headers, skeleton base, disabled buttons, COD and out-of-stock badges.
- **Linen** (linen): default hairline borders and dividers. **Clay** (clay): stronger borders, hovered card edge, AntD default-button outline.
- **Umber** (umber): secondary text. **Taupe** (taupe): tertiary text and captions, darkened from the brief's #8A7764 to clear AA on parchment. **Dust** (dust): disabled text only.

### Named Rules
**The One Copper Rule.** Copper fill marks the one primary action per screen. Secondary actions are espresso outlines that only warm to copper on hover; repeated per-item actions (quick add on a card grid) are espresso slips, never copper.

**The Jewellery Rule.** Brass stays under about 3% of any screen and is never a CTA. It marks AI, verification, newness and section headings; nothing else.

**The Single-Meaning Rule.** Sindoor means urgency, moss means success, indigo means info. None of them is a decorative accent or an action colour.

**The Selected-Is-Espresso Rule.** A chosen option (filter chip, segmented control) fills espresso with parchment text. An applied filter shown back to the visitor as a removable chip is peach-clay with deeper-copper text and a trailing close icon. Copper fill stays reserved for the action; the only copper pill in browse is the small filter-count badge.

**The Roles-Not-Primitives Rule.** Components consume semantic roles (`--brand-primary`, `--bg-sunken`, `--text-tertiary`) or component tokens (`--btn-*`, `--field-*`, `--card-*`), never `--haveli-*` primitives or hex. JS consumers read the mirrored `palette.ts`; change a colour in both places.

## Typography

**Display Font:** Fraunces (optical size 9–144, weight 500–700), with Georgia fallback
**Body Font:** Inter (weight 400–700), with system-ui fallback
**Urdu Fonts:** Noto Nastaliq Urdu (display) and Noto Naskh Arabic (UI), loaded lazily

**Character:** Fraunces brings a crafted, slightly old-world warmth to headings, with optical sizing switched on; Inter keeps every working surface plain and legible. In Urdu, Nastaliq carries the calligraphic display voice and Naskh carries the compact, readable UI.

### Hierarchy
- **Display** (700, clamp(34px, 5vw + 1rem, 56px), 1.1, -0.02em): the single page `<h1>` in the hero, on espresso.
- **Headline** (700, clamp(24px, 1.6vw + 1rem, 32px), 1.2): section titles and the AI banner title; section titles carry the brass underline mark.
- **Title** (600, 20px, 1.3): empty-state titles, payment strip, drawer and sheet titles (Fraunces).
- **Body** (400, 16px, 1.5): running text in Inter. Hero and banner subcopy step up to 18px / 1.6 and cap at 46ch; empty-state descriptions cap at 42ch.
- **UI Title** (Inter 600, 16px, 1.4): product-card titles, category tile names, trust labels. Product titles are Inter, not Fraunces: the serif reads bookish in a dense grid.
- **Label** (Inter 600, 14px) and **Small Label** (Inter 600, 12px): buttons (16px at default size, 14px small, 18px large), badges, status tags, sidebar links, role pills.
- **Display, landing variant:** the /sell hero title uses the display size set tighter (line-height 1.04, -0.025em, capped at 15ch, balanced). Section and closing-band titles on /sell and the browse head use the headline size at 1.15 with balanced wrapping (22ch on /sell sections, 20ch in the closing band, 18ch for the AI banner title).
- **Category banner title** (Fraunces 700, 36px, 1.1, -0.02em): the h1 on a category page; the other-language name follows at 18px in secondary text.
- **Step title** (Fraunces 600, 24px, 1.25): numbered seller steps. Feature-list titles are Inter 600 18px; filter-group titles are Inter 600 14px, not Fraunces.
- **Small UI copy in Batch 1 chrome** (Inter 14px): hero chips (500), stall captions and tags (600), result count and sort label (umber), active chips (600). Stall captions and tags step to 12px under 480px.

### Named Rules
**The Latin-First Urdu Rule.** Urdu stacks lead with the Latin brand face (Fraunces or Inter, which have no Arabic glyphs), so product names, "KarobarAI" and prices keep brand letterforms while Urdu script falls through to Nastaliq or Naskh.

**The Naskh-for-Work Rule.** In Urdu, running UI text, h4–h6, product titles and form chrome use Naskh at a 1.75 line height. Nastaliq is reserved for h1–h3, the hero and section titles, with a 1.7–1.95 line box so its descending tails never clip. Never set tables or forms in Nastaliq.

**The Shown-Not-Tucked Urdu Rule.** Where a surface presents bilingual identity (category tile names, the sample listing in the AI demo and the AI banner card, the EN/UR feature pairs on /sell), the Urdu is set in the Nastaliq display stack at 18px with a 1.9 line box in walnut or primary ink, not as a grey Naskh sub-label. On phones the tile names step down to 16px Urdu / 14px English. This is for showcase labels only; product grids, forms and tables keep the Naskh-for-Work Rule.

**The Clear-Air Rule.** Urdu page titles (category banner, browse head) are Nastaliq with a line-height of 2 and an extra 24px above, so ascenders clear the breadcrumb and toolbar. /sell display titles in Urdu run at 1.85 with letter-spacing 0.

**The Display Is a Face, Not a Weight Rule.** Headings get their character from Fraunces itself; the loaded range tops out at 700, so do not specify heavier weights.

## Layout

A centred column with a 1280px maximum (`--container-max`), shared by the header, every section and the app content area so all edges align. Page padding is 24px (16px under 768px). Spacing follows a 4px base scale (sp-1 through sp-24); sections breathe with `clamp(56px, 8vw, 96px)` vertical padding on buyer surfaces.

Breakpoints: mobile under 768px, tablet 768–991px, desktop 992px and up (with 480px and 1200px refinements for grids). Product grids run 4 / 3 / 2 columns (switching at 1200px and 768px); category tiles 4 / 3 / 2, stacking vertically under 480px. The featured rail is a native scroll-snap row with 240px items (200px on mobile) and arrows only for fine pointers.

Navigation by role: buyers get a sticky storefront header (80px row, compressing to 64px with a parchment blur once scrolled) beneath an espresso announcement band; seller and admin get a 240px cream sidebar that collapses to 72px icons on tablet. Every role switches to a fixed 56px bottom tab bar on mobile, and the content area pads its bottom to clear it.

Density: buyer controls are 48px. Seller and admin wrap their shell in a compact density (40px controls, 15px base) on screens 768px and wider only; phones keep 48px so touch targets never fall below 44px.

Home order (buyer storefront): search-led hero, trust strip (straddling the hero's lower edge), categories, Featured on a sand shelf, New arrivals, AI banner. Grounds alternate between the product bands: the sand shelf is a 24px-radius sunken panel with `clamp(20px, 3vw, 40px)` inline padding, and the featured rail bleeds through that padding to the shelf's edge (negative inline margin with matching padding and scroll-padding) so the peeking card runs under the rounded corner; the shelf clips with `overflow: hidden` and its rail arrows sit at the inline edges.

Hero: two columns at 1.08fr / 0.92fr with a 560px minimum height; copy caps at 600px and the search at 560px. At 991px and below it becomes one column (`minmax(0, 1fr)` so the chip row can never widen it) and the stall sits under the copy at 360px tall, max 520px wide and centred; under 480px the stall is 300px tall, the search 56px, and the try-chips become a single swipeable row with the scrollbar hidden. The trust strip is one four-up row on desktop and a swipeable scroll-snap row (items `min(260px, 74%)`) at 991px and below. The header search fades out (opacity and visibility, 220ms) on Home until the hero search has scrolled away.

Categories: 4 columns, 3 on tablet, and on phones (767px and below) a two-column grid of compact tiles so every category is visible without sideways scrolling.

Browse (search and category results): a 264px filter sidebar beside the results with a 32px gap, sticky at 116px from the top. Results run 3 columns at 1200px and up, 2 at 992-1199px, 3 again at 768-991px (the sidebar is gone there), and 2 under 768px. The results column opens on one toolbar row: result count at the inline start, active-filter chips between, sort at the inline end (`margin-inline-start: auto`, select at least 190px). At 991px and below the sidebar is replaced by a Filters pill that opens a bottom sheet (Clear all ghost and "Show results" primary, split evenly), and the count drops to its own full-width line under the controls; under 768px the chip row also wraps to a full line, the sort label becomes visually hidden and the select narrows to 168px.

Seller landing (/sell): the hero runs 0.92fr copy / 1.08fr demo at a 600px minimum height, single column at 991px and below. Sections breathe with `clamp(64px, 9vw, 112px)` top padding; the FAQ narrows to 820px. Steps are three columns joined horizontally, becoming a vertical list (64px marker column, thread running down through the markers) at 991px and below. Features pair one large statement panel with a ruled list (1.05fr / 1fr), stacking at 991px. Under 480px the hero CTAs go full width and the demo stacks its photo (max 180px) above the fields.

Direction: all layout uses logical properties (`inset-inline-*`, `margin-inline`, `border-inline-*`), so grids, sidebars, badges and pattern masks mirror under `dir="rtl"`. Directional icons (arrows, breadcrumb chevrons, rail arrows) flip with `scaleX(-1)`.

## Elevation & Depth

A hybrid of tonal layering and soft, warm shadow. Surfaces step parchment (canvas) → cream (raised) → sand (sunken), separated by linen hairlines. Shadows are always tinted from espresso, never neutral grey, and stay low at rest. Depth increases in response to state: cards and tiles lift on hover, the header gains a shadow once scrolled, and overlays (modals, toasts, the trust strip that straddles the hero) sit on the largest shadow.

### Shadow Vocabulary
- **Rest** (`box-shadow: 0 1px 3px rgba(43, 29, 20, 0.07)`): cards at rest, the selected auth method tab.
- **Lift** (`box-shadow: 0 2px 8px rgba(43, 29, 20, 0.07)`): button hover, scrolled header.
- **Raised** (`box-shadow: 0 6px 18px rgba(43, 29, 20, 0.09)`): hovered product cards, the quick-add slip, rail arrows.
- **Overlay** (`box-shadow: 0 14px 36px rgba(43, 29, 20, 0.14)`): modals, toasts, the trust strip, hovered category tiles, sticky action bar.
- **Focus halo** (`box-shadow: 0 0 0 3px rgba(174, 84, 41, 0.28)`): paired with a 2px copper outline at 2px offset on keyboard focus.
- **Brass hairline** (`box-shadow: inset 0 0 0 1px rgba(201, 150, 63, 0.5)`): the edge of every espresso band (full ring on the hero, single edge on the announcement, AI banner and footer).

- **On-espresso depth** (`--shadow-ink: 8 4 2`, used as `rgb(var(--shadow-ink) / alpha)`): a near-black espresso reserved for objects resting on espresso bands. Stall cards and the AI banner card use `inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 26px 54px rgb(ink / 0.46), 0 3px 8px rgb(ink / 0.24)`; the AI demo card goes deeper (`0 34px 70px` at 0.5); the hero search `0 18px 44px` at 0.42 plus a brass inset hairline at 0.35; floating tags `0 14px 30px` at 0.38.
- **Pinned art** (`box-shadow: 0 18px 36px rgba(43, 29, 20, 0.16), 0 2px 6px rgba(43, 29, 20, 0.08)`): the tilted illustration card on the light category banner.
- **Inset hairline panels** (`box-shadow: inset 0 0 0 1px` linen): category banner, AI demo fields, browse sidebar (with the rest shadow), empty results, the /sell feature panel. The edge is drawn as an inset shadow so radius and tint stay clean.

### Named Rules
**The Deeper-Ink-on-Dark Rule.** On an espresso band an espresso-tinted shadow disappears, so cards, tags and the hero search resting on it cast `--shadow-ink` (near-black espresso) at 0.24-0.5 alpha with a white inner top highlight. This ink is never used on light grounds.

**The Warm Shadow Rule.** Every shadow and scrim is mixed from espresso (rgba(43, 29, 20, …)). A grey or black shadow on a light surface is out of world.

**The Earned Lift Rule.** Surfaces are low at rest; lift and the bigger shadow arrive with hover, scroll or overlay state.

## Shapes

Softly rounded, never sharp and never blobby. Controls and fields use 12px; product cards 16px with a 12px inset photo; marketing tiles (category tiles, how-it-works steps, hero and AI-banner collage cards) 20px; the hero and AI banner themselves 28px (card radius + 8px); mobile sheets and the auth container 24px top/outer corners. Badges, status tags, search, icon buttons, avatars and chips are full pills or circles.

Borders are 1px linen hairlines; outline buttons use 1.5px. Category and status are signalled by tinted circular discs and pills, not by coloured borders or side stripes. Decorative collage cards in the hero and auth panel are rotated by 2–4 degrees (mirrored under RTL) to feel hand-placed.

Batch 1 extends the hand-placed language. The hero stall fans three cards at -8, 7 and -1.5 degrees from a pivot near their base (50% 90%), the centre card slightly larger (228px against 210px); positions use logical insets so the fan's layout mirrors under RTL, while the angles themselves do not flip. The AI banner card sits at -3 degrees with its brass tag at +3, pinned past the card's corner; the category banner's art card sits at 4 degrees (-4 under RTL). The /sell hero and closing band reuse the 28px band radius; the AI demo card and sand shelf use 24px; demo fields 12px, the price slot and category chip 8px. Two dashed lines join the vocabulary: a 2px brass dashed thread (rgba(201, 150, 63, 0.55)) linking the numbered seller steps, and a 1.5px clay dashed outline marking the price slot the seller still has to fill. Compact category tiles are 16px with a 12px-radius 4:5 art window.

The block-print tile is the signature geometry: a 72px eight-point star (two overlapping squares, a centre circle, and connecting stubs) stroked in brass, laid at about 0.10–0.13 opacity over espresso and masked so it gathers on the artwork side and fades away behind the copy.

## Components

### Buttons
Tactile and decisive: copper for the one action, espresso for everything else.
- **Shape:** gently rounded (12px); 48px tall at default, 40px small, 56px large; 600 weight Inter.
- **Primary / CTA:** copper fill with white text, 24px inline padding. CTA is the same copper at marketing size; it is never brass.
- **Hover / Focus:** lifts 1px with the lift shadow and deepens to copper-deep; presses back with `scale(0.98)` and copper-deeper. Keyboard focus shows a 2px copper outline at 2px offset plus the copper halo. Transitions run 150ms on a soft ease-out (`cubic-bezier(0.22, 1, 0.36, 1)`).
- **Outline (secondary):** transparent with an espresso 1.5px border and espresso text; on hover it warms to a peach-clay fill, copper border and deeper-copper text.
- **Ghost:** copper text on transparent, peach-clay wash on hover. **Danger ghost:** kiln text, kiln-soft wash.
- **Outline light:** parchment/white outline for use on espresso bands only.
- **Disabled:** sand fill with dust text, no lift, so it reads "not available" rather than a faded copper. **Loading** keeps its copper with an inline spinner, since busy is not unavailable.
- **AntD buttons** (tables, toolbars) follow the same logic: clay outline, espresso text, copper on hover, no shadows.

### Badges & Status Tags
- **Product badges** (24px pills, 12px/600): New is brass with espresso text; discount is sindoor with white; low stock is sindoor text on sindoor-soft; COD is walnut on sand; out of stock is taupe on sand; Verified is espresso text after a brass-deep seal with no fill.
- **Status tags:** tonal pill (soft ground, strong text, a 16% inset hairline of the text colour) plus an icon plus a label: success moss, warning turmeric on haldi, error kiln, info indigo, neutral umber on sand. Colour is never the only signal.

### Cards / Containers
- **Product card:** cream card, linen hairline, 16px corners, 8px padding around an inset 12px-radius photo. On fine pointers it lifts 3px to the raised shadow with a clay edge while the photo zooms slowly (`scale(1.04)` over 600ms). The title link stretches over the whole card; focus rings the card, not the text. Out of stock lays a parchment veil over a partly desaturated photo so the card stays warm.
- **Quick add:** an espresso slip that slides up from the card's bottom edge on hover or focus (desktop pointers only).
- **Category tile:** cream, 20px, linen hairline, a 56px tinted icon disc from the warm category family; on hover it lifts 6px to the overlay shadow and a copper arrow slides in from the inline-end. Since Batch 1 this is the fallback for categories without an illustration (see Compact Art Tile).
- **Internal padding:** 16–24px on tiles and steps; cards and panels follow the 4px scale.

### Inputs / Fields
- **Style:** sand fill with a translucent espresso hairline (20%), 12px corners, 48px tall (40px in compact density), 14px inline padding.
- **Hover:** hairline darkens to 38% espresso. **Focus:** the fill lifts to cream, the border turns copper, and the 3px copper halo appears.
- **Error:** kiln border with a kiln-tinted halo and kiln helper text. Placeholders and hints on sand use umber, not taupe, to keep a margin over 4.5:1.
- **Search:** a full-pill 48px field with clear, camera and submit icons inline at the trailing edge.

### Navigation
- **Storefront header:** espresso announcement band (36px, parchment text, brass hairline beneath) over a cream nav row with a linen bottom border; compresses and blurs on scroll. Icon buttons are 44px pills that go sand with copper icons on hover. The cart badge is a copper pill that pops (`scale(1.35)`, 500ms) when an item is added.
- **Sidebar (seller/admin):** cream, linen inline-end border; links are umber 14px/500 at 44px, sand on hover; the active link is an espresso pill with parchment text and a brass icon (aria-current carries the same meaning).
- **Bottom tabs (mobile):** cream bar, 56px tabs; active tab is espresso text with a copper icon.
- **Footer:** espresso with a brass top hairline; parchment link text at 78% that brightens with a brass underline on hover; column labels are small uppercase brass.

### Espresso Band (signature)
The hero, AI banner, footer and auth brand panel share one construction: an espresso→walnut gradient, parchment text, a brass hairline edge, and on the hero, banner and auth panel the brass block-print tile masked toward the artwork side (top edge on mobile; mirrored under RTL). Copy always sits on calm espresso. A copper CTA and a light outline button are the only actions on it.

### AI Mark (signature)
An eight-point compass star from the block-print tile, four long points over four short, with sharp tips so it reads as a spark at 12–16px. Brass by default, always paired with a text label, and used everywhere the UI says "AI did this" in place of a generic sparkle icon.

### Search-Led Hero (signature, Batch 1)
On the storefront the search field is the hero's primary action, placed where a CTA button would be.
- **Search:** a 62px cream pill with transparent border, 18px text, a brass inset hairline and the on-espresso depth shadow; the submit is a 46px copper circle with a white icon (deep copper on hover). Focus swaps the hairline for a 4px copper halo at 0.45. 56px with 16px text under 480px.
- **Try chips:** up to five real categories as 36px translucent pills (parchment at 7% fill and 22% border, 14px/500 parchment text) after a muted "Try" label; hover raises the fill to 15% and edges the pill brass.
- **Sell link:** a quiet underlined text link with a store icon, 44px tall, under the chips; selling is the secondary path to /sell.

### Stall Showcase (signature, Batch 1)
Three illustrated products fanned on the hero's art side, decorative (one `role="img"` label; no prices, ratings or sellers). Each stall card is a cream 20px card with 10px padding around a 4:5 illustration (12px radius) and a 14px/600 category caption. Two pill tags float over the fan: a brass AI tag (AI mark plus label, espresso text) at the inline end and a cream COD tag with walnut text and a linen inset hairline at the inline start (moving to the top under 480px). Cards shrink to 170/186px at 991px and to 138/150px with 16px corners under 480px.

### Compact Art Tile (Batch 1)
Category tiles led by their hand-drawn Haveli illustration: a cream 16px tile at the rest shadow, 8px padding (16px at the inline end), a 76px 4:5 art window on the category's tint with the illustration zoomed to 1.12, then the current-language name with the other-language name under it (Urdu in Nastaliq per the Shown-Not-Tucked Rule). The arrow is hidden on art tiles. Hover or focus lifts 4px to the raised shadow with a clay edge and slowly zooms the art to 1.18 (600ms). On phones: 52px art, 8px gaps, two per row. Art and tint come from one shared category mapping, so the Home tile and the category banner read a category the same way; unmatched categories fall back to the icon disc.

### Sand Shelf (Batch 1)
`Section` gains a sand tone: a sunken 24px-radius panel that holds Featured on Home, alternating ground with the parchment bands around it. Rails inside it bleed to the shelf edge (see Layout).

### Chips (Batch 1)
- **Filter chip (choice):** 36px cream pill, clay 1px border, espresso 14px/500 text; hover turns the border copper; pressed (`aria-pressed`) fills espresso with parchment text.
- **Active-filter chip (applied, removable):** 36px peach-clay pill, deeper-copper 14px/600 text, trailing 14px close icon; hover deepens the fill with 18% copper mixed in. The whole chip is the remove button, with an accessible "remove" label. A copper underlined "Clear all" text button follows.
- **Filters button (991px and below):** 44px cream pill with a 1.5px espresso border and a sliders icon, carrying a 20px copper count pill when filters are applied.

### Browse Shell (Batch 1)
- **Filter sidebar:** cream 16px panel with 20px padding, linen inset hairline plus rest shadow; groups separated by 20px rhythm and linen rules; price is a two-field min/max grid with 12px umber labels; category is a select; condition is a filter-chip group. The same panel renders inside the mobile Filters sheet.
- **Toolbar:** count (14px umber), chips and sort, arranged as in Layout. The results grid renders its count into a slot the toolbar reserves; the slot collapses when empty.
- **Load more** is centred 32px under the grid. **Empty results** sit in a cream 24px panel with a linen inset hairline.

### Category Banner (Batch 1)
The category page header: a 24px tonal panel in the category's own tint with a linen inset hairline and `clamp(24px, 3vw, 40px)` padding, holding the breadcrumb, the 36px Fraunces name, the other-language name and a 44ch blurb, with the category illustration framed as a cream card pinned to the board (180px, rotated 4 degrees, pinned-art shadow). The art card shrinks to 104px under 768px. Category pages drop the category filter, since the page already is one.

### Seller Landing (Batch 1)
- **Hero and closing band:** both are espresso bands (135-degree espresso to walnut, full brass hairline ring, 28px). The hero's block-print is masked toward the demo side (mirrored under RTL); the closing band's is masked radially so it frames the centred copy. Their actions are one large copper CTA and one large light outline button.
- **Numbered steps:** a real sequence, so 64px cream circular markers (clay inset ring, soft warm shadow, copper icon) carry a 24px espresso number badge at the inline-end corner, linked by the brass dashed thread.
- **Feature statement:** one sand panel (24px, linen inset) with a 28px brass AI mark, a 24-32px Fraunces title, body at 44ch and a stack of cream EN/UR pairs (12px radius, lift shadow); beside it a ruled list of features, each with a 44px peach-clay icon tile in deeper copper.
- **FAQ:** AntD Collapse re-set as a ruled list: transparent, linen rules, 18px/600 questions, copper expand arrow, answers at 62ch and 1.7 line height.

### AI Listing Demo (signature, Batch 1)
The /sell hero's working-UI card: a cream 24px card with on-espresso depth, labelled "Example listing" in a small sand pill, with a copper Replay text button disabled until the run completes. A 4:5 product illustration sits beside the fields. Phases are exposed as `data-phase` and drive the styling: **reading** sweeps a brass scan band down the photo (1.3s loop); **writingEn / writingUr** lift the active sand field to cream with a 1.5px copper inset and the copper halo while a 2px copper caret blinks (0.9s, stepped); **ready** gives every AI-filled field the brass 8px "untouched AI field" dot and settles the tags (peach-clay pills rising 4px from 35% opacity, staggered 70ms). A haldi category chip and a dashed clay price slot (the seller sets the price) close the card. The status line, led by the brass-deep AI mark, is a polite live region.

### AI Banner Art Card (Batch 1)
The Home AI banner's art is one real mini listing, not an empty frame: a cream 20px card tilted -3 degrees holding a 5:4 illustration, the English title (14px/600) and the Urdu title (Nastaliq, 1.9, umber, `dir="rtl"`), with the brass AI tag pinned past its inline-end corner. The art is hidden under 480px; the banner stacks to one column at 991px.

### Motion
- **Durations:** 150ms (state), 220ms (hover lift, tiles), 320ms (reveals); eases `cubic-bezier(0.2, 0.7, 0.2, 1)` and `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Skeletons:** a slow cream sweep across sand (1.8s), like light moving over sandstone, in shape-matched placeholders.
- **AI reveal:** fields arrive with an 8px rise and fade (320ms first time, 150ms on regeneration); AI "working" is a slow brass pulse plus an indeterminate bar, not a spinner.
- **Reveal on scroll** is opt-in per element, never applied to whole pages.
- **One authored moment per page (Batch 1):** Home's is the stall settling once on load (1100ms soft ease-out from 46px lower, unrotated and at 94% scale, staggered 0 / 110 / 220ms, from an already-visible state so nothing is hidden before it runs); on fine pointers the fan opens on hover (outer cards slide 14px and rotate 3 degrees further, the centre rises 10px, 420ms). /sell's is the AI listing demo: a 1.3s read, then titles typed at 34ms per character with 280ms between languages and 380ms before ready. The demo starts only once the card is half on screen (IntersectionObserver, threshold 0.5), so on phones it does not play out below the fold.
- **Small state motion:** hero chips and filter chips transition fill and border at 150ms; the header search fades at 220ms; art zooms run 600ms.
- **Reduced motion:** a global rule collapses animations and transitions to near-instant; reveals render visible and static. The AI demo skips straight to the finished, ready listing with both titles filled.

## Do's and Don'ts

### Do:
- **Do** give each screen exactly one copper fill; make the other actions espresso outlines, ghosts or espresso slips.
- **Do** consume semantic roles and component tokens (`--brand-primary`, `--bg-sunken`, `--btn-*`, `--field-*`, `--card-*`); keep `palette.ts` and the `--haveli-*` primitives in step.
- **Do** edge every espresso band with the brass hairline (rgba(201, 150, 63, 0.5)) and use the shared block-print layer, masked away from the copy, for patterned bands.
- **Do** tint every shadow and scrim from espresso.
- **Do** set Urdu UI text in Naskh at 1.75 and reserve Nastaliq for h1–h3 and display titles with a 1.7–1.95 line box.
- **Do** write layout in logical properties and flip directional icons under RTL.
- **Do** keep touch targets at 44px or more; compact 40px density applies only to seller/admin at 768px and wider.
- **Do** keep text at or above 4.5:1 on its actual ground (taupe on parchment, umber on sand, brass-ink on haldi).
- **Do** use the AI mark, with a text label, wherever the interface signals AI work.
- **Do** let search be the storefront hero's primary action; keep selling as a secondary path to /sell.
- **Do** cast `--shadow-ink` under objects resting on espresso bands, and espresso-tinted shadows everywhere else.
- **Do** show bilingual identity by setting the Urdu name in Nastaliq at 18px / 1.9 beside the English on showcase labels; give Urdu page titles a 2 line height and 24px of clear air above.
- **Do** start orchestrated motion only when it is on screen, and give reduced motion the finished state rather than a frozen first frame.
- **Do** mark a chosen filter option with an espresso fill and an applied filter with a removable peach-clay chip.

### Don't:
- **Don't** use brass as a CTA or a large fill; it is jewellery under about 3% of the screen.
- **Don't** use sindoor for anything but urgency, or moss for anything but success.
- **Don't** fall back to green-on-white marketplace chrome or flash-sale orange; those are the category defaults this world refuses.
- **Don't** set product-card titles or dense table text in Fraunces or Nastaliq.
- **Don't** use neutral grey or black shadows on light surfaces.
- **Don't** fade disabled buttons as translucent copper; disabled is sand with dust text.
- **Don't** request Fraunces weights above 700; they are not loaded.
- **Don't** treat the dark "Haveli at night" values as finished; they are provisional until polished.
- **Don't** hide categories in a sideways scroller on phones; show them as a two-column grid of compact tiles.
- **Don't** slice a peeking rail card inside a rounded panel's padding; bleed the track to the panel edge.
- **Don't** play a signature animation from a hidden state; settle from an already-visible position.
