---
name: KarobarAI
description: "Studio Light: a light, airy studio storefront where a small Pakistani seller looks premium and trustworthy. Warm white, ink, one persimmon action, peach and lilac washes, Outfit over Inter, Urdu in Nastaliq beside the English."
colors:
  warm-white: "#faf9f7"
  white: "#ffffff"
  stone: "#f2f1ee"
  hairline: "#eceae6"
  hairline-strong: "#dcdad5"
  ink: "#17171a"
  ink-2: "#2a2a30"
  graphite: "#5a5a60"
  slate: "#636368"
  mist: "#9a9aa0"
  persimmon: "#bf4a1f"
  persimmon-deep: "#a63e17"
  persimmon-deeper: "#8f3412"
  persimmon-soft: "#fbe9de"
  peach-wash: "#f7e6dc"
  peach-blob: "#f7d9c6"
  lilac-wash: "#e3e6f5"
  lilac-blob: "#e1e5f6"
  ai-accent: "#f2a27e"
  red: "#b3261e"
  red-soft: "#fbe3de"
  green: "#3f6a2c"
  green-soft: "#e6eedb"
  amber-ink: "#8a5a12"
  amber-soft: "#f6e7c4"
  indigo: "#3a4d7a"
  tint-peach: "#fbede4"
  tint-sand: "#f6f0e6"
  tint-lilac: "#eceef8"
  tint-sky: "#e9f0f7"
  tint-rose: "#f8e9ec"
  tint-stone: "#f3f1ea"
typography:
  display:
    fontFamily: "Outfit, 'Noto Naskh Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(44px, 6.4vw, 84px)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  display-band:
    fontFamily: "Outfit, 'Noto Naskh Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(36px, 4.4vw, 56px)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Outfit, 'Noto Naskh Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(28px, 2vw + 1rem, 40px)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Outfit, 'Noto Naskh Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  price:
    fontFamily: "Outfit, 'Noto Naskh Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "20px"
    fontWeight: 600
    fontFeature: "tnum"
  body:
    fontFamily: "Inter, 'Noto Naskh Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  body-lead:
    fontFamily: "Inter, 'Noto Naskh Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.55
  ui-title:
    fontFamily: "Inter, 'Noto Naskh Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
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
  logo:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  urdu-display:
    fontFamily: "Outfit, 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif"
    lineHeight: 2
    letterSpacing: "0"
  urdu-ui:
    fontFamily: "Inter, 'Noto Naskh Arabic', 'Noto Nastaliq Urdu', 'Segoe UI', sans-serif"
    lineHeight: 1.75
rounded:
  sm: "8px"
  md: "12px"
  input: "14px"
  lg: "16px"
  image: "18px"
  trust: "20px"
  tile: "22px"
  xl: "24px"
  panel: "28px"
  band: "36px"
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
    backgroundColor: "{colors.persimmon}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.persimmon-deep}"
  button-primary-active:
    backgroundColor: "{colors.persimmon-deeper}"
  button-secondary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.ink-2}"
  button-outline:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "44px"
  button-outline-hover:
    backgroundColor: "{colors.warm-white}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.red}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    height: "44px"
  button-disabled:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.mist}"
  button-sm:
    padding: "0 16px"
    height: "36px"
  button-lg:
    padding: "0 26px"
    height: "52px"
  button-icon:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "44px"
  add-disc:
    backgroundColor: "{colors.persimmon}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    size: "44px"
  add-disc-added:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.warm-white}"
  field:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "0 14px"
    height: "44px"
  field-focus:
    backgroundColor: "{colors.white}"
  search-pill:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 4px 0 16px"
    height: "44px"
  hero-search-panel:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.panel}"
    padding: "10px"
    width: "760px"
  product-card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.xl}"
    padding: "10px 10px 16px"
  product-card-media:
    rounded: "{rounded.image}"
  category-tile:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.tile}"
    padding: "10px 18px 10px 10px"
  trust-card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.trust}"
    padding: "18px 20px"
  wash-band:
    backgroundColor: "{colors.peach-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.band}"
    padding: "clamp(28px, 5vw, 64px)"
  nav-pill:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "0 8px 0 20px"
    height: "64px"
  announce-bar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.warm-white}"
    height: "36px"
  footer:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.warm-white}"
  chip:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  chip-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.warm-white}"
  filter-chip:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "36px"
  filter-chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.warm-white}"
  active-filter-chip:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 8px 0 12px"
    height: "36px"
  filter-card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.xl}"
    padding: "20px"
    width: "264px"
  language-toggle:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.pill}"
    padding: "4px"
    width: "108px"
    height: "44px"
  language-toggle-thumb:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
  ai-chip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.warm-white}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
  badge-new:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.warm-white}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "24px"
  badge-sale:
    backgroundColor: "{colors.red}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    height: "24px"
  badge-low-stock:
    backgroundColor: "{colors.red-soft}"
    textColor: "{colors.red}"
    rounded: "{rounded.pill}"
    height: "24px"
  badge-cod:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    height: "24px"
  status-tag-success:
    backgroundColor: "{colors.green-soft}"
    textColor: "{colors.green}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.pill}"
    padding: "2px 12px 2px 8px"
  status-tag-warning:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.pill}"
  status-tag-error:
    backgroundColor: "{colors.red-soft}"
    textColor: "{colors.red}"
    rounded: "{rounded.pill}"
  status-tag-info:
    backgroundColor: "{colors.lilac-wash}"
    textColor: "{colors.indigo}"
    rounded: "{rounded.pill}"
  sidebar-link:
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
    height: "44px"
  sidebar-link-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.warm-white}"
  toast:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 20px 10px 16px"
---

# Design System: KarobarAI

## Overview

**Creative North Star: "The Light Studio Counter"**

A bright product studio set up on a Pakistani bazaar counter: warm white ground, real goods laid out on white cards that rest on soft neutral shadow, near-black ink for every word, and a single warm persimmon that tells the visitor what to do next. Colour arrives as washes, not blocks: slow peach and lilac blobs behind the hero, a peach sell band, category tints behind each product's art. What keeps it unmistakably local is shown, not tucked: Urdu set in Nastaliq beside the English on headlines, product cards and category tiles; Cash on Delivery and photo-backed returns up front; a faint ink block-print tile in two places only.

Buyer surfaces are calm and touch-first: 44px pill controls, generous section rhythm, one signature moment per page (the Home card fan, the /sell AI typing demo). Seller and admin workspaces run the same palette at a quieter, denser setting (40px controls on 768px and wider), with the ink active pill in the sidebar. Everything is bilingual and RTL by construction: logical properties throughout, mirrored arrows, fans and blobs.

The world refuses green-on-white marketplace chrome, flash-sale orange, and the retired Haveli café look (large espresso blocks, brass jewellery, serif headings). Light mode is the finished world.

**Provisional, stated honestly (2026-10-17):**
- Dark mode ("ink night", `[data-theme='dark']`) is a values-only pass: unpolished, not reviewed; do not treat its values as design decisions.
- Product art is placeholder illustration (8 category SVG cut-outs), not photography.
- Seller and Admin shells are recoloured (ink active pill, white surfaces, compact density) but not redesigned; that is Day 3.
- Product detail, Cart and Checkout pages are not yet rebuilt in Studio Light; that is Day 2. Their current chrome inherits tokens only.

**Key Characteristics:**
- Warm white page, white floating cards with no border, stone for fields, chips and tiles.
- Ink for text, black pill buttons, selected states, the announcement bar and the footer; no large dark blocks above the footer.
- One persimmon action per view with its own coloured glow; the per-card "+" is the one sanctioned repeat.
- Peach and lilac washes and six category tints instead of dark bands.
- Pills for every control; 24px cards, 22px tiles, 28px panels, 36px bands.
- Outfit 600 with tight tracking over Inter; Urdu in Nastaliq for display and Naskh for UI, Latin-first stacks.
- Two-layer neutral ink shadows that mark only what floats; springy pops only on add, save and badge.

## Colors

A near-white and near-black studio palette with one warm action colour and soft tinted washes.

### Primary
- **Persimmon** (persimmon): the one "do this" colour. Primary and CTA buttons (Search, Start selling, Log in on auth, Add to cart), the product-card "+" disc, links, the focus ring (`--brand-ring`, 35% persimmon), the logo's "AI", a saved heart, caret and native accent colour. White on it and persimmon on white both sit at about 4.98:1.
- **Persimmon Deep / Deeper** (persimmon-deep, persimmon-deeper): hover and pressed states of the CTA; deeper is also `--accent-ink`, text on a soft wash.
- **Persimmon Soft** (persimmon-soft): text selection, selected table rows and select options, `.section--mint` grounds.

### Secondary
- **Ink** (ink): brand ink. Every heading and body word, secondary (black pill) buttons, the guest "Log in" pill, selected filter chips, the sidebar active pill, the AI chip and AI tag, the "New" badge, cart and filter count pills, the "added" state of the "+" disc, the announcement bar and the footer. In the AntD bridge every selected or current state (tabs, menu, segmented, steps, switch, checkbox, radio, slider, pagination, date picker, rate) is ink.
- **Ink 2** (ink-2): ink hover, COD badge text, the Urdu side of /sell feature pairs.

### Tertiary
- **Peach Wash / Peach Blob** (peach-wash, peach-blob): the Home sell band, the /sell closing band, the auth brand panel, empty-state discs, /sell feature icon tiles, and the hero's drifting peach blob.
- **Lilac Wash / Lilac Blob** (lilac-wash, lilac-blob): the hero's second blob, the /sell statement panel and step 3 art, info tag grounds, the empty-state echo disc.
- **AI Accent** (ai-accent): the AI star on ink chips only (8.7:1 on ink, 1.95:1 on warm white, so never on a light ground) and the peach scan band in the /sell demo.
- **Category Tints** (tint-peach, tint-sand, tint-lilac, tint-sky, tint-rose, tint-stone): the ground behind each category's art in tiles, product-card media, the category banner, trust-card icon tiles and the AI listing photo.
- **Status** (red / red-soft, green / green-soft, amber-ink / amber-soft, indigo): red is urgency and error (sale badge, low stock, destructive fill); green is success only (status tags, live dots); amber-ink is warning; indigo is info and the fourth chart series.

### Neutral
- **Warm White** (warm-white): the canvas of every page; text on ink.
- **White** (white): raised surfaces: cards, nav pill, filter card, modals, drawers, toasts, the language-toggle thumb, focused fields.
- **Stone** (stone): sunken surfaces: fields at rest, search pills, chips, the language-toggle track, disabled buttons, table headers, skeleton base.
- **Hairline / Hairline Strong** (hairline, hairline-strong): nav, trust-card and flat-info hairlines; outline buttons, filter chips, dashed price slots.
- **Graphite** (graphite): secondary text, 6.5:1 on warm white; also field placeholders on auth.
- **Slate** (slate): captions and tertiary text. Darkened from DESIGN-CONSULT's #6b6b70 so captions hold at least 5:1 on warm white and about 4.8:1 even on the washes.
- **Mist** (mist): disabled text only.

### Named Rules
**The One Persimmon Rule.** One persimmon button per view: the action that earns money or moves the user forward. Everything else is ink, outline or ghost. The sanctioned exception is the 44px persimmon "+" quick-add disc on every product card (DESIGN-CONSULT §6 lists it as its own variant); it is the only persimmon that repeats in a view. Persimmon is otherwise never decoration, icon colour or text colour, except links and the logo "AI".

**The Selected-Is-Ink Rule.** Chosen, current and active states fill or edge in ink (filter chips, sidebar link, AntD tabs, menu, segmented, steps, switch, checkbox, radio, pagination, auth role cards and method tabs). Persimmon stays reserved for the action.

**The Washes-Not-Blocks Rule.** Colour areas are light washes (peach, lilac, category tints). Ink appears as text, pills, the 36px announcement bar and the footer, never as a large band above the footer.

**The Single-Meaning Rule.** Red means urgency or error, green means success, amber means warning, indigo means info. None of them decorates; the WhatsApp action is an ink pill for this reason.

**The Roles-Not-Primitives Rule.** Components consume semantic roles (`--brand-primary`, `--bg-sunken`, `--text-tertiary`) or component tokens (`--btn-*`, `--field-*`, `--card-*`, `--pill-ink-*`), never `--studio-*` primitives or hex. JS consumers (the AntD theme) read `palette.ts`; change a colour in both places.

## Typography

**Display Font:** Outfit (400–700, drawn at 600), with system-ui fallback
**Body Font:** Inter (400–700), with system-ui fallback
**Urdu Fonts:** Noto Nastaliq Urdu (display) and Noto Naskh Arabic (UI)

**Character:** Outfit is a geometric sans that tightens as it grows, giving headlines a confident, modern studio voice; Inter keeps every working surface plain and legible. In Urdu, Nastaliq carries the calligraphic display voice and Naskh carries compact, readable UI.

### Hierarchy
- **Display** (Outfit 600, clamp(44px, 6.4vw, 84px), 1.02, -0.035em): the Home hero h1, capped at 13ch and balanced. Its other-language twin follows at 24px (19px on phones) in graphite.
- **Display Band** (Outfit 600, clamp(36px, 4.4vw, 56px), 1.04, -0.035em): the sell band title (14ch); the category banner title uses clamp(36px, 3.6vw, 52px) at 1.05; the /sell hero title uses clamp(36px, 4.6vw + 1rem, 60px) at 1.04, 15ch.
- **Headline** (Outfit 600, clamp(28px, 2vw + 1rem, 40px), 1.1, -0.03em): section titles, browse head, /sell section and closing titles (1.15, balanced). Section heads carry no underline mark; the headline stands alone.
- **Title** (Outfit 600, 24px, 1.25, -0.015em): /sell step titles; the empty-state title is 22px; the /sell statement title is clamp(24px, 1.4vw + 1rem, 32px).
- **Body** (Inter 400, 16px, 1.5): running text. Leads (hero, sell band, /sell hero) step up to 17–18px at 1.55–1.65 and cap at 46–52ch; empty states cap at 42ch, FAQ answers at 62ch.
- **UI Title** (Inter 600, 16px, 1.35): product-card titles (two-line clamp), category tile names, trust labels. Product titles stay in Inter, never Outfit.
- **Price** (Outfit 600, tabular figures): 20px on product cards, 17px on fan cards, resized per context through `--price-fs`.
- **Label** (Inter 600, 14–15px): buttons (15px default, 14px small, 16px large), chips, sidebar links (500). **Small label** (Inter 600, 12px): badges, status tags, AI chips. Captions are 12.5–14px in slate.
- **Logo** (Outfit 700, 22px, -0.02em; 20px on phones) with a persimmon "AI".

### Named Rules
**The Latin-First Urdu Rule.** Urdu stacks lead with the Latin brand face (Outfit for display, Inter for UI, neither of which has Arabic glyphs), so product names, "KarobarAI" and prices keep brand letterforms while Urdu script falls through to Nastaliq or Naskh.

**The Naskh-for-Work Rule.** In Urdu, body text, h4–h6, product titles, category names and form chrome use Naskh at a 1.75 line height (1.6–1.7 for titles). Nastaliq is reserved for h1–h3, hero, section, band and banner titles, with a 1.7–2 line box so its tails never clip. Never set tables or forms in Nastaliq.

**The Shown-Not-Tucked Rule.** Where a surface presents bilingual identity (hero twin line, product-card twin, category tile and banner names, the AI listing card, /sell feature pairs, the auth listing card), the Urdu is set in Nastaliq at display weight beside the English, not as a grey Naskh sub-label. Under an Urdu title the English twin is Inter or Outfit.

**The Clear-Air Rule.** Urdu page titles (category banner, browse head) take a line height of 2 and 24px of clear space above so ascenders clear the breadcrumb and toolbar. Urdu headings always reset letter-spacing to 0.

**The Tight-As-It-Grows Rule.** Outfit tracking tightens with size: -0.015em for titles, -0.03em for h1/h2 and section heads, -0.035em for display. No serif headings, ever.

## Layout

A centred column with a 1280px maximum (`--container-max`), shared by the header, every section, the browse shell and the app content area so all edges align. Page padding is 24px (16px under 768px). Spacing follows a 4px base scale (sp-1 through sp-24); Home sections breathe at `clamp(36px, 4.5vw, 64px)`, /sell sections at `clamp(64px, 9vw, 112px)`.

Breakpoints: mobile under 768px, tablet 768–991px, desktop 992px and up, with refinements at 420/480px, 1100px (header search field appears) and 1200px (grid columns). Product grids run 4 / 3 / 2 columns; browse results 3 / 2 / 3 / 2 (≥1200 / 992–1199 / 768–991 / <768); category tiles 4 / 3 / 2; trust cards 4 / 2. The featured rail is a scroll-snap row (four across, minimum 240px items; 200px on phones) with 44px arrows beside the heading on fine pointers only, the next arrow in ink.

Navigation: buyers get a sticky header whose 36px ink announcement strip scrolls away while a 64px floating pill nav (60px on phones) stays, 12px below it, with no full-width bar behind. On Home the header search fades in only after the hero search scrolls away. Seller and admin get a 240px white sidebar (72px icons on tablet). Every role gets a fixed 56px bottom tab bar on phones and the content area pads to clear it.

Home order: centred hero (headline, twin line, sub, 760px search panel, card fan over drifting blobs), trust row, category tiles, featured rail, new arrivals, the peach sell band with the AI listing card, ink footer. /sell: 0.92fr copy / 1.08fr demo hero (one column at 991px), three illustrated steps, statement panel beside a ruled feature list, FAQ with a sticky title column, peach closing band. Browse: a 264px filter card (sticky at 116px) beside results with a 32px gap; one toolbar row (count, removable chips, sort at the inline end); below 992px the sidebar becomes a Filters pill opening a bottom sheet. Auth: a 36px-radius peach panel at about 52% beside a 440px form column; under 1024px a slim 136px peach band carries the logo and toggle above the form.

Density: buyer controls are 44px. Seller and admin wrap their shell in compact density (40px controls, 15px base) on 768px and wider only, so touch targets never drop below 44px on phones. Drawn controls under 44px (36px chips, small buttons, the 28px announcement close) carry an invisible tap halo to 44px.

Direction: all layout uses logical properties; arrows, breadcrumb chevrons, rail arrows, the card fan, empty-state echo disc and blobs mirror under `dir="rtl"`.

## Elevation & Depth

A hybrid: tonal layering (warm white → white → stone) plus two-layer neutral ink shadows. Every shadow pairs a tight contact layer with a soft ambient one so objects rest on the page. Shadows mark only what floats: cards, the nav pill, the hero search panel, the card fan, popovers, sheets, toasts. Flat page sections and washes never cast one. Depth rises with state: cards go `sm` to `lg` on hover; the nav pill goes `sm` to `md` once scrolled.

### Shadow Vocabulary
- **xs** (`0 1px 2px rgb(23 23 26 / .05), 0 1px 3px rgb(23 23 26 / .04)`): heart disc, language-toggle thumb, out-of-stock badge, small inset chips.
- **sm** (`0 2px 6px rgb(23 23 26 / .05), 0 6px 16px rgb(23 23 26 / .04)`): product cards and category tiles at rest, nav pill, filter card, icon-button and ink-pill hover.
- **md** (`0 4px 10px rgb(23 23 26 / .05), 0 10px 30px rgb(23 23 26 / .06)`): scrolled nav pill, /sell step art.
- **lg** (`0 8px 18px rgb(23 23 26 / .06), 0 22px 44px rgb(23 23 26 / .1)`): hovered cards and tiles, fan cards, dropdowns and popovers (also the AntD `boxShadowSecondary`), modals, toasts, sticky action bar, WhatsApp pill.
- **xl** (`0 12px 24px rgb(23 23 26 / .08), 0 30px 70px rgb(23 23 26 / .14)`): the centre fan card, the AI listing card, the /sell demo card, the auth form container.
- **CTA glow** (`0 10px 22px rgb(191 74 31 / .3)`, hover `0 14px 28px … / .38`, small `0 6px 14px … / .28` for the "+" disc): persimmon buttons only.
- **Focus ring** (`0 0 0 3px rgb(191 74 31 / .35)`, buttons and cards add a 2px canvas gap first): every interactive element; the global fallback is a 2px persimmon outline at 2px offset.

### Named Rules
**The Float-Only Rule.** A shadow means the thing floats. Sections, bands and washes are flat; flat info cards keep a 1px hairline instead.

**The One Coloured Glow Rule.** The persimmon glow belongs to the persimmon button and the "+" disc. Every other shadow is neutral ink (`--shadow-ink: 23 23 26`). In ink night the CTA glow becomes a plain dark lift.

**The Earned Lift Rule.** Surfaces sit low at rest; the bigger shadow arrives with hover, scroll or overlay state.

## Shapes

Big, soft and pill-led. Every button, chip, toggle, badge, status tag, search field and the nav bar is a full pill; icon buttons, the heart and the "+" are circles. Fields are 14px (`--radius-input`, AntD `borderRadius` 14). Product cards are 24px with an 18px media window; category tiles 22px with a 16px art window (18px tile / 12px window on phones); trust cards 20px with 14px icon tiles; the hero search panel, AI listing card, /sell demo card and statement panel 28px; washes and big bands (sell band, closing band, category banner, auth panel) 36px, stepping to 28px on phones. Modals are 24px; mobile sheets round their top corners at 24px.

Cards have no border; lift comes from shadow. Hairlines appear on the nav pill, trust cards, icon buttons and flat info panels; outline buttons and filter chips use a 1px hairline-strong edge that turns ink on hover. A 1.5px dashed hairline-strong outline marks the price slot a seller still has to fill.

Hand-placed tilt is part of the language: the Home fan cards rotate by their own pose from a 50% 90% pivot (mirrored in RTL), the AI tag on the fan sits at 3°, the /sell step photo at -4°, the auth listing card at -2°. The block-print tile (a 72px eight-point star, two squares, a circle and stubs, stroked in ink) appears at about 5% opacity in two places only: the auth panel and the /sell closing band.

## Components

### Buttons
Pills with a tactile press: the persimmon CTA for the one action, ink for everything else.
- **Shape:** full pill; 44px default, 36px small (with a 44px tap halo), 52px large; Inter 600 15px; 24px inline padding (16px small, 26px large).
- **Primary / CTA:** persimmon fill, white text, CTA glow. Hover deepens to persimmon-deep with the bigger glow; press goes persimmon-deeper at `scale(.97)` in 90ms with the shadow dropping to xs; release springs back (`--ease-spring`, 320ms).
- **Hover / Focus:** a 1px lift on fine pointers only. Focus shows a 2px canvas gap and the 3px persimmon ring on every variant.
- **Secondary:** ink pill with warm-white text, ink-2 and the sm shadow on hover. Used for Log in, "How selling works", Publish inside a form that already has a CTA.
- **Outline:** white pill, hairline-strong edge, ink text; hover turns the edge ink over a warm-white fill. **Ghost:** ink text, underline (1.5px, 4px offset) on hover. **Icon:** 44px white circle with a hairline (or ink). **Destructive:** red fill; danger-ghost is red text with a red-soft hover.
- **Arrow slot:** a trailing arrow nudges 3px toward the reading direction on hover and mirrors in Urdu.
- **Disabled:** stone fill, mist text, no shadow, no motion. **Loading** keeps its variant colour, fades the label to 0 and centres a spinner without changing width.
- **AntD buttons** (dense tables, toolbars) are flat: white with a hairline-strong edge turning ink on hover; AntD primary keeps persimmon without the glow.

### Chips
- **Hero try chips:** 36px stone pills, 13.5px/500 ink text; hover fills ink with warm-white text. One swipeable row on phones with a faded trailing edge.
- **Filter chip (choice):** 36px white pill, hairline-strong edge, 14px/500; hover edges ink; pressed (`aria-pressed`) fills ink with warm-white text.
- **Active-filter chip (applied, removable):** 36px stone pill, 14px/600 ink text, trailing close icon that rotates 90° on hover; the whole chip removes. An underlined ink "Clear all" follows.

### Cards / Containers
- **Product card:** borderless white 24px card, 10px padding around an 18px media window on the category tint, sm shadow. Category caption (12.5px slate), two-line Inter title, the other-language twin on one line (Nastaliq for Urdu), Outfit price, and the persimmon "+" disc in the foot. A 40px white heart sits top inline-end. Hover lifts 4px to lg while the art scales to 1.04 over 600ms. The title link stretches over the card; keyboard focus rings the whole card. Out of stock lays a warm-white veil over a desaturated image.
- **Category tile:** white 22px tile on sm, an 80×92px art window on the category tint, current-language name (Inter 600) over the other-language name (Nastaliq for Urdu). Hover lifts 3px to lg and scales the art to 1.06.
- **Trust card:** white 20px card with a hairline, 44px icon on its own tint tile (14px), 16px/600 label over a 14px slate sub. Flat, no shadow.
- **Internal padding:** follows the 4px scale; panels 16–28px, bands clamp(28px, 5vw, 64px).

### Inputs / Fields
- **Style:** stone fill at rest with a hairline-strong edge (AntD) or 16% ink edge (`--field-border`), 14px corners, 44px tall in AntD (40px compact), 48px on auth forms, 14px inline padding.
- **Hover:** the edge darkens (mist in AntD, 34% ink on auth). **Focus:** the fill lifts to white, the edge turns ink, and the 3px persimmon ring appears.
- **Error:** red edge with red helper text. Placeholders and hints use graphite, not slate, to keep margin over 4.5:1 on stone.
- **Search pill:** 44px stone pill (header), clear, camera and submit inline at the trailing edge; focus turns white with an ink edge.
- **Deviation from DESIGN-CONSULT:** the consult listed inputs as white (`--bg-surface`); the build fills them stone at rest so a field reads on white cards and the warm-white page without relying on a faint edge.

### Navigation
- **Pill nav:** a 64px white pill at 86% opacity with a 14px backdrop blur, hairline edge and sm shadow, floating 12px under the ink announcement strip; after scrolling it goes 96% opaque with md. Links are 14.5px/500 graphite, stone on hover, ink 600 when current. A Categories menu opens a white 20px dropdown on lg with tinted art swatches per row. The guest gets an ink "Log in" pill; 44px round icon buttons hold search (below 1100px) and cart, whose ink count badge pops when an item is added.
- **Announcement strip:** 36px ink, 13px/500 warm-white text, dismissible per session.
- **Sidebar (seller/admin):** white with a hairline; links are 14px/500 graphite pills, stone on hover; active is the ink pill with warm-white text.
- **Bottom tabs (phones):** white bar, 56px tabs; active is ink text over a stone pill behind the icon. No persimmon in the chrome.
- **Footer:** ink, warm-white 78% links that brighten and underline on hover, Inter 600 column titles.

### Language Toggle
A 108×44px stone pill track with a white thumb on xs that slides between "EN" (13px Inter uppercase) and "اردو" (15px Nastaliq) in 220ms on `--ease-soft`; the selected label goes ink 600. The same control serves the header and auth.

### Hero Search Panel (signature)
A white 28px panel (max 760px) with a hairline and a soft deep shadow, holding a 64px search row (leading magnifier, 17px field, a 44px round photo button, and the persimmon "Search", the page's only persimmon action) above the stone category chips. Focus fills the row warm white with an ink inset edge and the persimmon ring.

### Card Fan (signature)
Five real feed products fanned like cards on a counter (three on phones): white 22px cards (the centre 24px, larger, on xl) with art on its category tint, title and price. An ink AI tag at 3° and a white COD tag are pinned to the centre card. On load the fan settles from a tighter, lower pose (520ms, 40ms stagger, transform only, from a visible first frame); on fine pointers it opens 30% wider and the centre rises 8px.

### AI Listing Card and Demo (signature)
What the AI Store Builder hands a seller to check: a white 28px card on xl with an ink "Written by AI" chip carrying the AI-accent star, the photo on its tint, field rows on warm white with a hairline, the Urdu title in Nastaliq, stone tags, a dashed price slot and an ink Publish. On /sell it runs live: a peach scan sweeps the photo (1.3s), the active field lifts to white with a 1.5px ink inset and the persimmon ring while an ink caret blinks, then each AI-filled field gets the ink "untouched AI field" dot and the tags settle (70ms stagger). It starts only when half on screen; reduced motion shows the finished listing.

### Badges & Status Tags
- **Product badges** (24px pills, 12px/600): New is ink; sale is red with white; low stock is red on red-soft; COD is ink-2 on stone; out of stock is ink on white with xs; Verified is ink text after an ink seal.
- **Status tags:** tonal pill (soft ground, strong text, 16% inset hairline of the text colour) plus icon plus label: success green, warning amber, error red, info indigo on lilac, neutral graphite on stone. Colour is never the only signal.

### Empty State and Toast
- **Empty state:** an 88px peach disc with a lilac echo disc offset behind it (mirrored in RTL), a 22px Outfit title (Nastaliq in Urdu), a 42ch graphite description and one action.
- **Toast:** a white pill with a hairline on lg, 500 weight, opened below the sticky header; the status icon carries the colour, the text says what happened.

### Motion
- **Durations:** 90ms press, 150ms hover and colour, 220ms toggles and small moves, 320ms panels, sheets and pops, 520ms page-load entrances. Exits run faster than entrances.
- **Eases:** `--ease` cubic-bezier(0.2, 0.7, 0.2, 1) for UI; `--ease-soft` cubic-bezier(0.22, 1, 0.36, 1) for entrances and lifts; `--ease-spring` cubic-bezier(0.34, 1.56, 0.64, 1) for pops only (add, save, badge, button release).
- **The pop:** scale 1 → 1.15 → 1 in 320ms on the spring; the "+" turns 90° into a ✓ and back after 1.5s while the cart bumps.
- **Decorative loop:** only the hero and auth blobs drift (20–24s alternate, about 28px).
- **One signature moment per page:** Home's card fan, /sell's AI demo. No blanket scroll reveals.
- **Only transform and opacity animate.** Reduced motion collapses every animation and transition to near-instant and shows the end state.

## Do's and Don'ts

### Do:
- **Do** give each view exactly one persimmon button; the per-card "+" disc is the only sanctioned repeat.
- **Do** mark selected, current and active states in ink, in custom components and through the AntD bridge.
- **Do** consume semantic roles and component tokens; keep `palette.ts` and the `--studio-*` primitives in step.
- **Do** use peach and lilac washes and the category tints for colour areas; keep ink to text, pills, the announcement strip and the footer.
- **Do** cast only the two-layer neutral ink shadows, and only on things that float.
- **Do** keep captions in slate (#636368) so they hold at least 5:1 on warm white; use graphite on stone and washes.
- **Do** fill fields stone at rest and turn them white with an ink edge and the persimmon ring on focus.
- **Do** set Urdu UI in Naskh at 1.75 and reserve Nastaliq for display titles and shown-not-tucked twins with a 1.7–2 line box.
- **Do** write layout in logical properties and mirror directional icons, fans and offsets under RTL.
- **Do** keep touch targets at 44px, using an invisible halo when the drawn control is smaller.
- **Do** start signature motion from an already-visible frame and only when it is on screen.

### Don't:
- **Don't** put persimmon on a second button, an icon, a selected state or decoration.
- **Don't** bring back large dark blocks above the footer, espresso, brass, parchment or serif headings.
- **Don't** put a coloured shadow on anything but the persimmon button and "+" disc.
- **Don't** put a border on cards; lift them with shadow (flat info cards keep a hairline).
- **Don't** use the AI accent on light grounds; it is for the AI star on ink only.
- **Don't** use red for anything but urgency and error, or green for anything but success.
- **Don't** set product titles, tables or forms in Outfit or Nastaliq.
- **Don't** add scroll fade-ins to every section or bouncy motion outside the pop moments; never animate layout properties.
- **Don't** treat ink-night (dark mode) values, the placeholder product illustrations, or the current Seller/Admin, Product, Cart and Checkout screens as finished Studio Light references.
- **Don't** invent ratings, review counts, seller numbers or delivery promises.
