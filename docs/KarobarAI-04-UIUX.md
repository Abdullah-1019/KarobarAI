# KarobarAI — UI/UX Design Brief

**Document 4 of 6 — Software Blueprint Series**
**Project:** KarobarAI — Generative-AI E-Commerce Platform for Micro-Sellers in Pakistan
**Version:** 1.0 (Design Brief)
**Design philosophy (from brief):** Hybrid Minimalism + Agentic + Conversational
**Depends on:** Documents 1–3 — decisions D1–D5 binding; component library = **Ant Design 5** (TRD §4)
**Status:** Draft for approval

---

## 0. Design Thesis (the one idea everything serves)

KarobarAI's user is a first-time, non-technical seller — Ayesha from the PRD — photographing a product on a cheap Android phone over a weak connection. A cold, sterile "SaaS blue / grey-white" interface reads as *institutional* and *intimidating* to that user. So the **one aesthetic risk** taken here, and justified: a **warm, paper-toned, market-warm identity** built on **karobar green + marigold**, not generic SaaS blue. It is grounded in the subject's real world — the warmth of a Pakistani bazaar, the marigold garlands of celebration, the cream of an Urdu manuscript — and it makes the product feel *human and trustworthy* to someone selling online for the first time.

The **signature** is the product's own magic: **the bilingual generation reveal** — a single photo becoming a live Urdu/English listing, the two scripts appearing together. The recurring **EN ⇄ اردو duality** is the brand's visual fingerprint.

Everything else stays quiet and disciplined (the "minimalism" the brief asks for), so the magic moment and the bilingual identity are what users remember.

---

## 1. Brand Personality

| Trait | What it means in the UI |
|-------|-------------------------|
| **Empowering** | The interface does the hard work (writing, courier choice); the seller feels capable, not tested |
| **Warm & human** | Paper tones, rounded forms, plain bilingual language — never clinical |
| **Trustworthy** | Calm green, clear money/status, honest loading and error states — critical for handling livelihoods |
| **Effortless** | One photo, one tap to book a courier; defaults that just work |
| **Local & proud** | Urdu-first, PKR, Pakistani couriers and wallets treated as primary, not afterthoughts |
| **Quietly intelligent** | AI is present but unobtrusive — a helpful assistant, never a gimmick |

**Voice:** plain, active, sentence case, bilingual. "Publish" → toast "Published." Errors direct, never apologetic: *"This photo is over 10 MB. Try a smaller one."* / *"یہ تصویر 10 MB سے بڑی ہے۔ چھوٹی تصویر آزمائیں۔"*

---

## 2. Design Principles

1. **Subtract until it's obvious.** Every screen has one primary action; secondary actions recede. Minimalism = precision in spacing and type, not emptiness.
2. **Bilingual by construction.** Layouts work identically in LTR (English) and RTL (Urdu); nothing is positioned in a way that breaks when mirrored.
3. **AI assists, never blocks.** AI fills fields the user can always edit; AI failure degrades to manual entry, never a dead end.
4. **Honest states.** Loading shows real progress; empty states invite action; errors explain and offer a fix.
5. **Performance is a design value.** On a 3G phone, a fast, light screen is better UX than a beautiful heavy one. Compress, lazy-load, skeleton.
6. **Touch-first.** Designed for thumbs on a 320px screen first, then scaled up.
7. **Accessible by default.** WCAG 2.1 AA is a floor, not a feature (PRD §13.4).

---

## 3. UX Goals

- New seller: register → first published product in **< 10 min** (REQ-NF-Quality-008).
- Any primary screen interactive in **< 3s on 3G** (REQ-NF-Perf001).
- Buyer can go product → tracked order with confidence and zero confusion about cost (clear shipping line).
- Every AI action has a visible, honest progress state and a recovery path.
- Zero "where is my order?" anxiety — proactive notifications + live tracking.

---

## 4. Visual Hierarchy

Order of emphasis on any screen: **(1) primary action / key data → (2) supporting content → (3) metadata/controls → (4) chrome.** Achieved through, in priority order: size, weight, color (green for primary/action, marigold for celebratory highlights only), then position. Money and order status always sit high in the hierarchy. One — and only one — primary (green, filled) button per view; everything else is secondary or tertiary.

---

## 5. Color Palette

Grounded in: Pakistan/growth/trust (green), bazaar celebration (marigold), Urdu-manuscript warmth (paper neutrals). All foreground/background pairs below meet **WCAG AA (≥4.5:1 text, ≥3:1 UI/large)**.

### 5.1 Light mode (default)
| Token | Hex | Use |
|-------|-----|-----|
| `--brand-primary` | `#1A6B49` | Primary actions, links, active nav (white text ≈ 5.6:1) |
| `--brand-primary-hover` | `#15583C` | Hover |
| `--brand-primary-active` | `#0F4630` | Pressed |
| `--brand-primary-soft` | `#E7F2EC` | Selected/tint backgrounds |
| `--accent-marigold` | `#F4A024` | Celebration, "Live!" badges, highlights (with dark text only) |
| `--accent-marigold-soft` | `#FCEFD6` | Accent tint |
| `--bg-canvas` | `#FBF8F3` | App background (warm paper) |
| `--bg-surface` | `#FFFFFF` | Cards, sheets, inputs |
| `--bg-sunken` | `#F3EEE5` | Wells, table headers |
| `--border` | `#E7E0D5` | Hairlines, dividers, input borders |
| `--text-primary` | `#211D17` | Body/headings (warm near-black ≈ 14:1) |
| `--text-secondary` | `#6B6358` | Captions, metadata (≈ 5.2:1) |
| `--text-disabled` | `#A89E90` | Disabled |

### 5.2 Semantic
| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--success` | `#1A6B49` | `#3FA877` | Confirmed, paid, delivered |
| `--warning` | `#C77A12` | `#E0A33A` | Pending, manual review, retries |
| `--error` | `#B23A2A` | `#E0634F` | Failures, rejections (warm brick, not pure red) |
| `--info` | `#2C6A93` | `#4E97C4` | Neutral notices, tracking info |

### 5.3 Dark mode
| Token | Hex |
|-------|-----|
| `--bg-canvas` | `#15130F` (warm near-black) |
| `--bg-surface` | `#1F1C17` |
| `--bg-sunken` | `#100E0B` |
| `--border` | `#34302A` |
| `--text-primary` | `#F2EEE6` |
| `--text-secondary` | `#ADA597` |
| `--brand-primary` | `#3FA877` (lightened for contrast on dark) |
| `--accent-marigold` | `#F4A024` (retained; ≥3:1 on dark) |

**Status color chips** (order/return states) use semantic tokens with soft backgrounds + readable text, never color alone (pair with an icon/label for accessibility — §23).

---

## 6. Typography

The **signature system**, grounded in the bilingual subject:

| Role | English | Urdu | Notes |
|------|---------|------|-------|
| **Display / brand / Urdu headings** | IBM Plex Sans (Medium/SemiBold) | **Noto Nastaliq Urdu** | Nastaliq is the *cultural soul* — reserved for headings, brand, and celebratory moments; needs generous line-height |
| **UI / body (both scripts)** | **IBM Plex Sans** | **IBM Plex Sans Arabic** | One superfamily across scripts → genuine bilingual harmony + strong small-size legibility on cheap screens |
| **Data / numerals** | IBM Plex Sans (tabular figures) | — | PKR amounts, counts, tables |

**Why this pairing (not a default):** IBM Plex Sans has a true Arabic sibling (Plex Sans Arabic), so Urdu and English UI share one visual voice — rare and deliberate. Nastaliq carries identity where it can breathe (headings), while Naskh-style Plex Arabic carries the dense working UI where Nastaliq would hurt legibility and performance. This is a legibility-and-identity decision specific to a bilingual Pakistani product, not a generic webfont grab.

### 6.1 Type scale (1.25 modular; rem @ 16px base)
| Token | px | Use |
|-------|----|-----|
| `--fs-xs` | 12 | captions, helper |
| `--fs-sm` | 14 | secondary UI, table cells |
| `--fs-base` | 16 | body, inputs (≥16 prevents iOS zoom) |
| `--fs-lg` | 18 | emphasised body, card titles |
| `--fs-xl` | 20 | section headings |
| `--fs-2xl` | 24 | page titles |
| `--fs-3xl` | 30 | dashboard hero numbers |
| `--fs-4xl` | 36 | brand/marketing display |

**Line-height:** Latin body 1.5; **Nastaliq Urdu 1.9–2.0** (mandatory — Nastaliq clips at tight leading). **Weights:** 400 body, 500 UI emphasis, 600 headings (avoid 700+ for Nastaliq). **Performance:** subset fonts to needed glyph ranges; `font-display: swap`; preload the two primary faces; lazy-load Nastaliq (heading-only).

---

## 7. Iconography

- **Set:** **Lucide** (consistent 2px stroke, friendly geometry) as the primary icon system — distinctive and warmer than default icon packs; Ant Design's bundled icons used only where a component requires them.
- **Style:** line icons, 24px default / 20px dense / 16px inline; `currentColor` so they theme + dark-mode automatically.
- **RTL:** directional icons (arrows, chevrons, send) mirror in RTL; non-directional (camera, bell, star) do not.
- **Always paired with a text label** for primary nav and actions (no icon-only ambiguity for first-time users), except universally understood controls (close, search).

---

## 8. Grid System

- **Columns:** 12 (desktop) / 8 (tablet) / 4 (mobile).
- **Max content width:** 1200px, centered; full-bleed allowed for hero/dashboard headers.
- **Gutters:** 24 (desktop), 16 (tablet/mobile).
- **Margins:** 24 (desktop), 16 (mobile, min 16 to keep thumb-safe edges).
- Built on AntD's 24-unit `Row/Col` grid, mapped to the above.

---

## 9. Spacing System

4px base unit. **Tokens:** `--sp-1`=4, `--sp-2`=8, `--sp-3`=12, `--sp-4`=16, `--sp-5`=20, `--sp-6`=24, `--sp-8`=32, `--sp-10`=40, `--sp-12`=48, `--sp-16`=64. Component internal padding defaults: inputs/buttons 12×16; cards 20; sections 32–48. **Consistency rule:** spacing only ever uses scale tokens — no arbitrary pixel values.

---

## 10. Layout Rules

- **Mobile (primary):** single column, sticky bottom tab bar (seller) / sticky bottom checkout bar (buyer), top app bar with language switch + bell.
- **Seller portal (desktop/tablet):** left sidebar nav + main content; sidebar collapses to icons on tablet, to bottom tabs on mobile.
- **Buyer storefront:** top nav + search; content grid; sticky cart on desktop.
- **Admin:** dense left-nav + data-table-first layouts.
- **RTL:** the entire layout mirrors — sidebar moves to the right, content flows right-to-left, progress/timelines reverse direction. Use logical CSS properties (`margin-inline-start`, `padding-inline-end`) throughout so mirroring is automatic.
- **Touch targets:** ≥44×44px (WCAG 2.5.5 / mobile ergonomics).

---

## 11. Design Tokens (implementation-ready)

Exposed as CSS custom properties **and** mapped to AntD `ConfigProvider` theme tokens.

```css
:root {
  /* color → see §5 */
  --radius-sm: 8px;  --radius-md: 12px;  --radius-lg: 16px;  --radius-pill: 999px;
  --shadow-sm: 0 1px 2px rgba(33,29,23,.06), 0 1px 3px rgba(33,29,23,.08);
  --shadow-md: 0 4px 12px rgba(33,29,23,.10);
  --shadow-lg: 0 12px 32px rgba(33,29,23,.14);
  --dur-fast: 150ms; --dur-base: 220ms; --dur-slow: 320ms;
  --ease: cubic-bezier(.2,.7,.2,1);
  --z-toast: 1000; --z-modal: 900; --z-sticky: 100;
}
```

```ts
// AntD theme (ConfigProvider) — light
const theme = {
  token: {
    colorPrimary: '#1A6B49',
    colorInfo: '#2C6A93', colorSuccess: '#1A6B49',
    colorWarning: '#C77A12', colorError: '#B23A2A',
    colorBgLayout: '#FBF8F3', colorBgContainer: '#FFFFFF',
    colorBorder: '#E7E0D5', colorText: '#211D17', colorTextSecondary: '#6B6358',
    borderRadius: 8, borderRadiusLG: 12,
    fontFamily: '"IBM Plex Sans","IBM Plex Sans Arabic",system-ui,sans-serif',
    fontSize: 16, controlHeight: 44,
  },
  // direction: 'rtl' applied dynamically on Urdu
};
```

---

## 12. Button Styles

| Variant | Style | Use |
|---------|-------|-----|
| **Primary** | Filled green `--brand-primary`, white text, radius 8, height 44 | The one main action per view (Publish, Place Order, Confirm & Book) |
| **Secondary** | Outline (green border, green text, transparent bg) | Alternate actions (Save as Draft, Cancel) |
| **Tertiary / text** | Text only, green | Low-emphasis (Skip, Edit) |
| **Destructive** | Outline `--error` → filled error on confirm | Delete, Ban (always behind a confirm dialog) |
| **Accent** | Marigold filled, dark text | *Celebratory only* (rare) — e.g. "Go Live", never for routine actions |
| **Disabled** | `--text-disabled` on `--bg-sunken`, no shadow | Blocked state (e.g. publish before required fields) |

States: hover (darken), active (darken+inset), focus (2px focus ring, §23), loading (spinner replaces label, button width locked). Full-width primary buttons on mobile.

---

## 13. Card Styles

- Surface `--bg-surface`, radius 12, `--shadow-sm`, 20px padding, 1px `--border` in flat/dense contexts.
- **Variants:** metric card (big tabular number + label + delta chip), product card (image 1:1, title EN/UR, price, status chip), order card (status chip + courier inline box), **AI recommendation card [R1.1]** (marigold-soft left border, lightbulb icon, plain-language text, dismiss).
- Hover (desktop): lift to `--shadow-md`, 150ms. No hover effects on touch.

---

## 14. Form Design

- **Single-column**, labels above fields (RTL-safe), 16px input text (no iOS zoom), 44px height, radius 8.
- **Inline validation** on blur; error text below field in `--error` with an icon; never rely on color alone.
- **Helper text** under inputs for guidance ("We'll send a 6-digit code").
- **Bilingual fields** (Store Builder) show EN and UR in a paired layout, each independently editable, each labelled by script.
- **Required** marked with a clear label, not just an asterisk.
- **Disabled submit** until valid (e.g. Returns "Next" until 3 photos; Publish until title+image+category).
- **Smart defaults** everywhere (recommended courier preselected, default address preselected).

---

## 15. Navigation Design

- **Seller:** left sidebar (Dashboard, Products, Orders, Returns, Analytics, Wallet, Settings) with labelled icons; collapses to bottom tab bar on mobile (5 max: Home, Products, Orders, Returns, More).
- **Buyer:** top bar (logo, search, language, cart, account); bottom tabs on mobile (Home, Search, Cart, Orders, Account).
- **Admin:** dense left nav grouped (Overview / Users / Payments / Disputes / Moderation / Config / Audit).
- **Active state:** green text + soft tint + inline-start accent bar (mirrors in RTL).
- **Language switch** always reachable in the top bar; switching is instant (no reload), persists to profile.

---

## 16. Dashboard Design

- **Seller dashboard:** top row of metric cards (Sales, Orders, Returns) with delta chips; 7-day trend chart; recent orders list; prominent "Add Product" primary button. Empty state for new sellers (§19).
- **Admin dashboard:** KPI tiles (GMV, active users, adapter uptime) + alert feed (manual-logistics, stuck payments, disputes, fraud flags) as the first thing seen.
- Numbers use tabular figures; trends use the chart system (§18); everything readable at a glance, scannable top-left → down (mirrored in RTL).

---

## 17. Tables

- Zebra-free; hairline `--border` row separators; sunken header (`--bg-sunken`), 14px, medium weight.
- Sticky header on scroll; horizontal scroll on mobile with a frozen first column for wide tables (orders, settlements).
- Row actions in a trailing (RTL: leading) overflow menu; primary row action inline.
- Sortable columns show direction; status cells use chips (icon + label + semantic color).
- Empty: in-table empty state with a CTA. Loading: skeleton rows (§20).

---

## 18. Charts

- **Library:** Recharts (or AntD Charts) themed to tokens.
- **Palette:** primary green for the main series, marigold for a secondary/highlight series, neutral grey for comparison/baseline; never more than 4 series; categorical colors drawn from a tokenised, colorblind-safe set.
- **Defaults:** soft gridlines, no chart-junk, direct value labels where space allows, tooltips with PKR formatting and the buyer's locale.
- **Types:** line (sales trend), bar (revenue by category), donut sparingly. RTL: axes and order reverse.
- **Empty/loading:** chart-shaped skeleton; "no data yet" message with context.

---

## 19. Empty States

Treated as **invitations to act**, never dead ends (per design-writing guidance):
| Screen | Message + CTA |
|--------|---------------|
| New seller dashboard | "Your dashboard fills in once you publish a product. **Add your first product →**" |
| Products | "No products yet — create one in seconds with the AI Store Builder. **Add product →**" |
| Orders (per tab) | "No orders in this stage yet." |
| Analytics (new) | "Your analytics will appear here once your first order is placed." (SRS §4.5) |
| Cart | "Your cart is empty. **Browse products →**" |
| Search (no results) | "No products match your search. Try fewer filters. **Clear filters**" |
| Returns/Disputes (admin) | "No cases awaiting review." |
Each: a calm line illustration (single-color, light), one short line, one CTA. Bilingual.

---

## 20. Skeleton Loaders

- Used for **all data fetches** (cards, lists, tables, charts, product grids).
- Shape-matched to final content (image block + 2 text lines for product cards; rows for tables; bars for charts).
- Subtle shimmer at `--dur-slow`, `prefers-reduced-motion` → static placeholder.
- Distinct from **AI progress** (which shows a real progress bar + "AI is generating your product listing…", fields locked, §22).

---

## 21. Error Pages

- **404 / 410 (e.g. invalid tracking token):** friendly line illustration, "We couldn't find that," primary CTA home, bilingual.
- **500 / dependency down:** "Something went wrong on our side. Please try again." + Retry; never a stack trace (REQ-NF-Safety-003).
- **403:** "You don't have access to this." → role-appropriate home.
- **Offline [R1.1 PWA]:** banner "You're offline — showing your last loaded view."
- **Graceful degradation:** feature-level error cards (e.g. map down → text-only tracking; all couriers down → manual-logistics notice) rather than whole-screen failures (REQ-NF-Safety-004).

---

## 22. AI Chat / Generation Components (the agentic + conversational layer)

The "agentic + conversational" philosophy expresses as **guided, plain-language AI moments**, not a chatbot bolted on:

- **AI Store Builder reveal (signature):** drop zone → progress bar with honest copy ("AI is generating your listing…") → fields **animate in** as a paired EN ⇄ اردو reveal (the brand fingerprint), each editable. Failure → inline error + **Retry**, fields left blank for manual entry (REQ-F-Store005). A small "Generated by AI — edit anything" hint sets expectations.
- **AI Recommendation card [R1.1]:** conversational, plain-language insight in the seller's language ("Your electronics return at 32% — try clearer descriptions"), marigold-soft accent, lightbulb icon, dismissible (suppress 14 days).
- **ReturnsAI status [R1.1]:** a calm "Reviewing your return…" state (≤60s), then a plain-language decision with the *reason* in human terms; low-confidence/failed → "A team member is reviewing this" (manual-review framing, D3) — never expose model internals or scores to end users.
- **Tone:** the AI speaks like a helpful colleague, in sentence case, bilingual; it never overclaims certainty.
- **Future [F28]:** a true tool-using assistant (draft listings, suggest pricing, answer seller questions) would extend these patterns into a conversational surface.

---

## 23. Accessibility (WCAG 2.1 AA)

- **Contrast:** ≥4.5:1 text, ≥3:1 large/UI (all §5 tokens comply).
- **Never color alone:** status = color **+** icon **+** label.
- **Keyboard:** every interactive element reachable and operable; logical focus order; visible **2px focus ring** (`--brand-primary` with offset) on all focusable elements.
- **Touch targets** ≥44×44px.
- **Semantics:** proper landmarks, headings order, `aria-live` for toasts and AI status, descriptive `alt` on all images (REQ-NF-Quality-007).
- **RTL & language:** `dir` and `lang` set correctly per script; mirrored layout via logical properties; screen-reader language switches with content.
- **Forms:** labels programmatically associated; errors announced; not reliant on placeholder-as-label.
- **Motion:** honor `prefers-reduced-motion` (disable shimmer, parallax, the reveal animation's flourish — keep the functional state).
- **Inputs ≥16px** to prevent mobile zoom traps.

---

## 24. Dark Mode & Light Mode

- **Light is default** (warm paper); **dark** uses warm near-blacks (§5.3), not pure black — consistent with the human, paper-rooted identity.
- Toggle in Settings + respects `prefers-color-scheme` on first load; persists to profile.
- All tokens have light/dark values; **no hard-coded colors** in components — only tokens — so both modes and RTL come "for free."
- Green and marigold are tuned per mode for contrast (§5).
- Charts, chips, skeletons, and shadows all have dark variants (shadows softer/darker on dark surfaces).

---

## 25. Animation Guidelines

- **Purposeful, brief, calm.** Durations: 150ms (micro), 220ms (standard), 320ms (entrances). Easing `cubic-bezier(.2,.7,.2,1)`.
- **The one orchestrated moment** is the AI generation reveal (§22) — the signature; everything else is restrained.
- **Avoid** gratuitous parallax/auto-playing motion (reads as AI-generated and harms 3G performance and accessibility).
- **Reduced motion:** all non-essential animation removed; functional transitions become instant.
- **Performance:** animate only `transform`/`opacity`; never layout-thrashing properties.

---

## 26. Micro-interactions

- Button press: subtle scale/darken (transform only).
- Add to cart: cart icon count bumps + brief marigold pulse.
- Toggle/checkbox: smooth state slide.
- Field validation: gentle shake on hard error (reduced-motion: none), inline check on valid.
- Publish success: brief marigold confetti burst on the seller's *first* publish only (celebratory, then retired).
- Pull-to-refresh on mobile lists.
- Copy tracking link: icon → check confirmation.

---

## 27. Toast Notifications

- Position: top-center (mobile), top-trailing (desktop; flips in RTL).
- Types: success (green), error (brick), warning (amber), info (blue) — each with icon + concise message; **action-consistent copy** (Publish → "Published").
- Duration: 3–4s; errors persist until dismissed or offer a Retry action.
- `aria-live="polite"` (assertive for errors); stack max 3, collapse overflow.
- Never use a toast for critical irreversible confirmations — those use dialogs (§29).

---

## 28. Modals

- Centered (desktop) / bottom sheet (mobile); `--bg-surface`, radius 16, `--shadow-lg`, scrim `rgba(33,29,23,.5)`.
- Focus-trapped; `Esc` and scrim-click close (except blocking flows); restore focus on close.
- One primary action; title states the task in active voice.
- Used for: address add/edit, courier override confirm, AI report detail [R1.1], filters on mobile.
- Keep modals shallow — no modal-in-modal.

---

## 29. Confirmation Dialogs

- Reserved for **destructive or irreversible** actions: delete product, ban user, manual payment release, admin override, cancel order.
- Pattern: clear title naming the consequence ("Delete this product?"), a one-line explanation of effect, **destructive button labelled with the verb** ("Delete") + Cancel.
- Mandatory-reason actions (overrides, suspensions) include a required reason field inline (audited, REQ-F-Admin-003).
- Default focus on the *safe* action (Cancel) for destructive dialogs.

---

## 30. Mobile / Tablet / Desktop Design

| Breakpoint | Range | Layout |
|------------|-------|--------|
| **Mobile (primary)** | 320–575 | Single column; bottom tab bar; sticky action bar (checkout/publish); full-width primary buttons; filters in a bottom sheet |
| **Small** | 576–767 | Single/二-column product grid; sidebar still bottom tabs |
| **Tablet** | 768–991 | 2-pane (collapsed icon sidebar + content); 2–3 col product grid |
| **Desktop** | 992–1199 | Full sidebar + content; 3–4 col grids; sticky cart/summary |
| **Wide** | 1200–1920 | Max 1200 content width centered; dashboards may use full width |

**Designed mobile-first**, enhanced upward — the 320px Android phone on 3G is the canonical target (SRS §3.1). Range 320–1920 fully supported (SRS §3.1).

---

## 31. Responsive Rules

- Use **logical CSS properties** so LTR/RTL both work from one stylesheet.
- Fluid type via `clamp()` between scale steps; spacing from tokens only.
- Images: responsive `srcset`, lazy-loaded, AVIF/WebP, compressed <200 KB (REQ-F-Store007); 1:1 product thumbs.
- Tables → horizontal scroll with frozen first column on mobile; or stack to cards where clearer.
- Nav collapses sidebar → bottom tabs at <768.
- Modals → bottom sheets on mobile.
- No fixed pixel widths on containers; max-width + percentage/grid.

---

## 32. Design Inspirations

Referenced for *principles*, not imitation:
- **Stripe / Linear** — disciplined minimalism, honest states, type clarity (the "quiet around the signature").
- **Gumroad** — warmth and approachability for solo sellers (anti-institutional).
- **Daraz / local marketplaces** — what Pakistani buyers/sellers already recognise (familiarity), improved on.
- **Urdu manuscript & bazaar craft** — paper warmth, marigold celebration, Nastaliq character (the subject's own world — the true source of the identity).
- **WhatsApp** — the conversational, low-friction register our non-technical users already trust.

---

## 33. UI Component Library Recommendation

**Ant Design 5** (confirmed in TRD §4), themed entirely through the §11 tokens via `ConfigProvider`.

| Reason | Detail |
|--------|--------|
| **First-class RTL** | `ConfigProvider direction="rtl"` mirrors the whole tree — essential for Urdu (SRS §2.5, §3.1.4) |
| **Token theming** | Our entire palette/type/radius system maps to AntD tokens → light/dark/RTL "for free," no hard-coded colors |
| **Dense data components** | Tables, descriptions, forms, steppers ideal for seller/admin dashboards |
| **Accessibility baseline** | Keyboard + ARIA support to build AA on top of |
| **Velocity** | Lets a small FYP team ship a consistent UI fast (REQ-NF-Quality, timeline) |

**Companions:** Lucide (icons, §7), Recharts/AntD Charts (§18), react-i18next (bilingual), `browser-image-compression` (upload perf). **Custom layer:** a thin in-house component set (MetricCard, ProductCard, OrderCard, AIRevealPanel, StatusChip, EmptyState, BilingualField) built on AntD primitives + the tokens, so the brand identity (the green/marigold/paper warmth and the EN⇄اردو signature) lives above the library default and the app never "reads as templated AntD."

---

*End of Document 4 (UI/UX Design Brief). On approval, the next document is the **Backend Schema Document** — the full PostgreSQL physical schema (D1): tables, columns, types, keys, relationships, cascade rules, indexes, soft-deletes/audit, session/refresh-token model, naming standards, and the migration strategy.*
