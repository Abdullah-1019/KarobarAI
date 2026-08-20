# E5 Report — AI Features

**Date:** 2026-08-19
**Status:** ✅ Complete (with two named scope corrections — see §1)

---

## 1. E5 Overview

E5's brief named four AI surfaces to redesign: AI Store Builder, AI Product Listing, ReturnsAI, and Smart Logistics. Before touching any code, all four were inspected against the actual codebase (routes, components, API contracts, backend service logic), per the brief's own "inspect before modifying" instruction and its explicit "do not invent AI capabilities that do not exist" rule. That inspection surfaced two corrections to the brief's own premise:

- **AI Store Builder and AI Product Listing are the same screens.** There is no separate "build your whole store with AI" flow — Feature 13's own spec (`docs/modules/13_ AI Store Builder.md`) confirms the "AI Store Builder" name refers specifically to the photo → bilingual listing flow inside Add/Edit Product. `StoreSetupWizard.tsx` (the actual store-creation form) was checked and confirmed to contain zero AI content. So §1 and §2 of the brief describe one pair of screens, not two.
- **ReturnsAI does not exist yet, anywhere in the stack.** Confirmed via `docs/KarobarAI-03-AppFlow.md` and `docs/KarobarAI-04-UIUX.md`, both of which explicitly tag every ReturnsAI element `[R1.1]` (post-MVP, not yet built), and via the actual backend code: `returns.service.ts` has a comment stating *"MVP never enters UNDER_AI_REVIEW"* — every return goes straight to manual review. `apps/ai-service/app/routers/` has no returns endpoint at all. Per the brief's own explicit instruction ("Do not fabricate AI explanations or confidence values if the backend does not provide them" / "do not invent AI capabilities that do not exist"), this phase did **not** add a fake AI-analysis UI to Returns. Instead it applied real, honest improvements to the existing manual-review screens (missing order/customer/product context, page-header consistency) — see §3.
- **Smart Logistics exists, but is a deterministic weighted-scoring formula, not an LLM.** `tracking.service.ts`'s courier score is `cost/ETA/reliability/coverage` weights read from `platform_config`, not an AI Service call. The redesign treats it as a real, useful recommendation surface (per the brief's own component-reuse instruction) without rebranding it "AI-powered," since it isn't — see §3.

Everything else in the brief (elevation/motion rules, field-level provenance markers, tier-not-decimal presentation, honest processing states, bilingual/RTL handling, component reuse) applied as written to the two AI surfaces that are actually implemented.

---

## 2. Screens Covered

| Screen ID | Screen Name | Route | File | AI Feature |
|---|---|---|---|---|
| SCR-S02 | AI Store Builder / Add Product (flagship) | `/seller/products/new` | `features/catalog/AddProductPage.tsx` | Real — photo → Gemini-generated bilingual listing |
| SCR-S03/S04 | Product Edit — AI regeneration | `/seller/products/:productId/edit` | `features/catalog/EditProductPage.tsx` | Real — re-run AI on an existing product |
| SCR-S06 | Order Detail — Smart Logistics | `/seller/orders/:id` (component within `SellerOrderDetailPage`) | `features/tracking/CourierRecommendationCard.tsx` | Real, but rule-based, not LLM |
| SCR-S07 | Seller Returns list | `/seller/returns` | `features/returns/SellerReturnsPage.tsx` | None yet (R1.1) — visual consistency pass only |
| SCR-S07 detail | Seller Return detail | `/seller/returns/:id` | `features/returns/SellerReturnDetailPage.tsx` | None yet (R1.1) — real order/customer context added, no AI fabricated |

Not touched: `StoreSetupWizard.tsx` (confirmed no AI content, out of scope), `ReturnWizardPage.tsx`/`ReturnStatusPage.tsx` (buyer-facing, no AI content, brief frames ReturnsAI as seller-facing decision support).

---

## 3. Changes Made

### AI Store Builder / AI Product Listing (`AddProductPage.tsx`, `EditProductPage.tsx`)

The existing implementation (Phase D2) was already close to spec — `AIStatus`/`AIRevealPanel`/`AIHint`/`BilingualField` all existed and were already brand-correct per the UIUX doc. E5 applied the brief's "Enhanced Visual Execution" layer on top:

- **Elevation**: the generated-fields block is now wrapped in a new `AIResultCard` (existing `shadow-lg` token + a 2px marigold `border-inline-start`) — the one visibly-elevated "this is the result" card per screen, distinct from the plain `Card` used for Pricing & Inventory below it.
- **Processing state redesigned**: `AIStatus` no longer spins a `Loader2` icon. It now shows a slow marigold pulse dot + a thin indeterminate bar filling in brand green — "communicates active work" without a spinner, built entirely from existing tokens (no new colors). Verified live against a real Gemini call (see §9).
- **Shape-matched skeleton**: `AddProductPage`'s `AIStatus` now takes a `shape="listing"` prop that renders a title-bar + paragraph + tag-pill skeleton beneath the honest progress copy, so the "meaningful outcome" framing holds even before content arrives. `EditProductPage` deliberately omits this — only title/description regenerate there, not category/tags, so showing tag-pill skeletons would misrepresent what's about to change.
- **Regeneration gets its own motion**: `AIRevealPanel` now takes a `fast` prop. `EditProductPage` (always a regeneration) passes it — the reveal plays at `--dur-fast` (150ms) with a 30ms stagger instead of `--dur-slow` (320ms) / 60ms stagger. `AddProductPage`'s first-time reveal is unchanged.
- **Per-field "still as AI wrote it" marker**: new `AIFieldBadge` — a small marigold dot (not another "AI" text label; the brief explicitly warns against decorating every field with the word) next to a field's label, shown while `aiGenerated && !dirtyFields.<field>` is true. It disappears the instant the seller edits that specific field (verified live — see §9), giving a real, per-field "what have I reviewed" signal without a fabricated field-level backend concept.
- **SEO preview** (`AiSeoPreviewDTO`) was left untouched — it exists in the API response but isn't named anywhere in E5's scope list, and adding new UI for it would be scope creep beyond "the smallest safe change necessary."

### Smart Logistics (`CourierRecommendationCard.tsx`)

- **Raw score demoted, tier promoted**: a new `RecommendationTier` component translates the backend's real `score` field into a plain-language tier ("Strong match" / "Good match" / "Worth a closer look" — the brief's own example wording) with a 3-bar indicator, computed from the actual returned number (`≥0.7` / `≥0.4` / below — a presentational threshold choice, not a backend contract). The raw decimal still appears, but now as small secondary text alongside cost/ETA, never the headline.
- **Elevation on the recommendation only**: the top-scored quote is wrapped in `AIResultCard`; the other quotes stay plain rows — "one primary card per screen," not decorated uniformly.
- **Processing state unified**: the "Finding the best courier…" wait (real async BullMQ scoring) now uses the same `AIStatus` component as Store Builder, instead of a generic `SkeletonLoader` + caption — same visual language across the app's decision-support surfaces, per the brief's component-reuse instruction.
- **Deliberately not relabeled "AI"**: the card still reads "Recommended courier," not "AI-recommended." Since the scoring is a real deterministic formula with no model behind it, adding an "AI" badge here would overclaim — directly against the brief's own "never overclaims certainty" / honesty rule. This is a content judgment call worth flagging explicitly.
- **Action button/booking wait** (`courier.booking` Alert) was left as a plain `Alert`, not `AIStatus` — booking is a real wait on courier-provider APIs, not an AI computation, so reusing the AI-processing visual there would misattribute the wait.

### Returns (`SellerReturnDetailPage.tsx`, `SellerReturnsPage.tsx`)

No AI content added (none exists to redesign — see §1). Real, non-fabricated improvements only:

- **Order/customer/product context added** to Return Detail — previously the screen showed only the return reason and evidence photos, nothing about who bought what. It now fetches the real order (`getOrder(ret.orderId)`, the exact same call `SellerOrderDetailPage` already makes — no new backend endpoint) and shows recipient name and line items, plus a link to the full order.
- **Clearer structure**: "What happened" (reason + photos) and "What you can do" (approve/reject/escalate) are now explicit section labels, satisfying the brief's own framing goal without fabricating an "AI thinks" section that has no real content behind it.
- **`PageHeader` swap** on both screens, for visual consistency with every other seller screen (E4 already established this pattern for Products/Orders/Analytics; Returns had been missed).
- **`scroll={{x: true}}`** added to the Returns table, matching the same horizontal-overflow fix E4 applied to `TopProductsTable`.

---

## 4. AI Components Created / Updated

**Created** (`apps/frontend/src/components/`):
- `AIResultCard.tsx` — elevation wrapper (shadow-lg + marigold inline-start border). Used in `AddProductPage`, `EditProductPage`, `CourierRecommendationCard`.
- `AIFieldBadge.tsx` — quiet per-field marigold-dot marker, disappears on edit. Used in `AddProductPage`, `EditProductPage`.
- `RecommendationTier.tsx` — plain-language tier + bar, generic (not courier-specific). Used in `CourierRecommendationCard`; available for a future real ReturnsAI implementation.

**Updated**:
- `AIStatus.tsx` — spinner replaced with pulse-dot + green progress fill; new optional `shape="listing"` skeleton.
- `AIRevealPanel.tsx` — new `fast` prop for regeneration's quicker replay.
- `BilingualField.tsx` — `enLabel`/`urLabel` widened from `string` to `ReactNode` so a label can carry an `AIFieldBadge` alongside its text (the only structural change made to an existing component's contract).

**Reused as-is, confirmed already correct**: `AIHint.tsx`, `PageHeader.tsx`, `SkeletonLoader.tsx`, `StatusTag.tsx`, `PriceDisplay.tsx`, `Modal.tsx`.

---

## 5. AI Interaction / Motion

- **Before generation**: dashed dropzone with instructions (unchanged, already correct).
- **Processing**: marigold pulse dot (1.6s ease-in-out loop) + indeterminate green bar (1.3s loop) inside the existing marigold-soft panel; `AddProductPage` additionally shows a shape-matched skeleton.
- **First-time reveal**: fields fade+rise in, 60ms stagger, `--dur-slow` (320ms), inside the new elevated `AIResultCard`.
- **Regeneration reveal**: same fade+rise shape, 30ms stagger, `--dur-fast` (150ms) — a quick refresh, not a replay.
- **Field-edited**: `AIFieldBadge` disappears instantly (React re-render on `dirtyFields` change, no exit animation needed — it's a state removal, not a flourish).
- **Failure**: unchanged existing `Alert` + Retry pattern (`AddProductPage`) / re-click-to-retry (`EditProductPage`) — both already matched the brief.
- **Reduced motion**: no new per-component media queries were needed — the app's existing centralized rule (`global.css`, `@media (prefers-reduced-motion: reduce)`, targets `*`) caps every animation (including the new pulse/progress-fill ones) to a single near-instant frame automatically, same mechanism the pre-existing `AIRevealPanel`/skeleton animations already relied on. Content still renders; only the motion is stripped.

---

## 6. Responsive Improvements

- `AIResultCard`/`AIFieldBadge`/`RecommendationTier` use only spacing/radius/font tokens — no fixed widths — so they inherit the app's existing responsive behavior with no new breakpoints.
- Verified at 1280px and 390px (see §9): bilingual fields correctly stack on mobile (pre-existing `<576px` rule), the elevated card doesn't overflow, and the courier recommendation's radio row stays legible at phone width.
- `SellerReturnsPage`'s table now contains its horizontal scroll instead of risking page overflow (matches E4's precedent for `TopProductsTable`).

---

## 7. RTL / Urdu Improvements

- All new components use logical properties (`borderInlineStart`, `marginInlineStart`) exclusively — zero RTL-specific code needed, same architecture as every prior phase.
- Verified live in Urdu with real generated bilingual content (see §9): the marigold accent correctly flips to the trailing edge, the sidebar mirrors, `AIFieldBadge` dots and `AIHint` text stay correctly positioned relative to their labels.
- New locale keys (`aiWizard.fieldUneditedHint`, `sellerDetail.orderInfoTitle`/`customerLabel`/`itemsLabel`/`viewOrder`/`whatHappenedLabel`/`whatYouCanDoLabel`, `courier.tierStrong`/`tierGood`/`tierConsider`) were added to both `locales/en` and `locales/ur`, matching the existing convention of keeping "AI" as a Latin-script loanword in Urdu copy rather than transliterating it.

---

## 8. Accessibility Improvements

- `AIStatus`'s panel keeps `role="status"` (unchanged); the new pulse dot and progress bar are `aria-hidden` (decorative reinforcement of the text message, not new information).
- `AIFieldBadge` uses `role="img"` + `aria-label` (not a bare colored dot with no accessible name) so a screen reader announces "AI-generated — not yet reviewed" rather than nothing.
- `BilingualField`'s label prop change (`string` → `ReactNode`) preserves the existing `<label>` association — the badge is a sibling node inside the same label, not a separate unlabeled element.
- Color is never the only signal: every new marigold treatment (border, dot, tier bar) is paired with existing text (a heading, a badge label, a tier label) — never color alone.
- Verified no new console errors introduced by any of the changes (only a pre-existing, unrelated AntD `message` static-function deprecation warning was observed, present before this phase).

---

## 9. Functional Verification

Verified against a **live backend with real interaction** — MinIO, the Core API, and (newly, this session) the **AI Service itself** were all running, so this is the first phase able to exercise the *real* Gemini-backed generation end-to-end rather than only the failure path (E1–E4 all documented MinIO/AI Service being unavailable as an environment limitation).

- **Registered a real Seller, completed Store Setup**, uploaded a real image to **Add Product**, and got a real Gemini-generated bilingual listing back — verified the processing state (pulse + progress bar + skeleton), the elevated reveal card, all six field badges present-then-disappearing correctly as individual fields were edited (confirmed: editing Title (English) cleared only that field's badge, the other three stayed marked).
- **Regenerated an existing product's listing** from Edit Product — confirmed the faster reveal motion and that only title/description carry field badges there (category/tags aren't part of that endpoint's response).
- **Seeded a full real order** (separate Buyer account → cart → address → `POST /checkout` with COD, which confirms payment immediately) to reach a live `PAYMENT_CONFIRMED` order, then verified the **real, backend-scored** Smart Logistics recommendation card — tier labels, elevation on the top pick only, demoted raw score — all rendering from genuine `tracking.service.ts` output, not mocked data.
- Verified all of the above in **dark mode** (via a real `prefers-color-scheme: dark` browser context, so AntD's actual `darkAlgorithm` engaged — not just the CSS custom properties) and in **Urdu/RTL**, and the Add Product flow additionally at a **390px mobile viewport**.
- Verified `SellerReturnDetailPage`'s error path (non-existent return ID) renders cleanly with no crash and no unnecessary network call — the new `getOrder` query is correctly gated on `enabled: !!ret`.
- Type-check (`tsc --noEmit`): clean, zero errors, across every file touched.

**A real testing-methodology bug (mine) was caught and corrected during verification**: an initial dark-mode check manually set the `data-theme` DOM attribute via script rather than using the browser's real `prefers-color-scheme`. Since this app's theme (`AppProviders.tsx`) reads `prefers-color-scheme` once at mount into React state and drives AntD's `ConfigProvider` algorithm from that — no manual toggle exists yet — the DOM-attribute hack changed the CSS custom properties (page background, sidebar) but never switched AntD's own dark algorithm, leaving `Card`/`Input` backgrounds white against a dark page and making the new marigold-bordered result card look broken (dark-on-white, low contrast). Re-tested with a real `colorScheme: 'dark'` browser context and confirmed everything renders correctly — this was an artifact of the test harness, not a product bug.

---

## 10. Visual QA

Screenshotted and reviewed at every combination above (light/dark × desktop/mobile × EN/UR × first-generate/regenerate/processing/error). No neon, no glow, no gradient, no robot iconography, no per-field "AI" text spam anywhere — confirmed against the brief's own "AI Design Language" negative list. The one marigold-structural element per screen (the elevated result card's border) is visually distinct from, and doesn't compete with, `AIHint`'s once-per-screen badge or the quieter per-field dot marker — three tiers of AI-provenance signal, not one undifferentiated color wash.

---

## 11. Remaining Issues

- **ReturnsAI itself remains unbuilt** (backend and AI Service both) — this was the single biggest scope finding of the phase (§1). Nothing in this pass fabricates it; the Returns screens only got the honest context/consistency improvements described in §3.
- **Full Seller Return Detail *populated* state** (a real return with photos, in `MANUAL_REVIEW`, showing the new order/customer card) was not live-screenshotted this session — reaching it requires an order to progress all the way to `DELIVERED` (courier booking + delivery) before a return can be filed, which was judged too deep a seed chain for this pass's remaining budget. The error/empty states and the code path were verified instead; the change itself (an added `useQuery` reusing an existing, already-proven endpoint) is low-risk.
- **Smart Logistics' booking-wait state** (`courier.booking` Alert) and the override confirmation modal were reviewed in code but not re-exercised live this session (unchanged by E5, already correct).
- Pre-existing, unrelated: the `[antd: message] Static function can not consume context...` console warning (present before this phase, not introduced by it).

---

## 12. Recommendations for Next Phase

- When Feature 14 (AI Returns) is actually built on the backend, `RecommendationTier` and `AIStatus` (with a new `shape="return"` skeleton, following the same pattern as `shape="listing"`) are ready to drop into `SellerReturnDetailPage` without inventing new visual language — this phase deliberately built them generically for that reason.
- The AI Store Builder's `AiSeoPreviewDTO` (`metaTitle`/`metaDescription`) is generated by the backend but still has no UI anywhere — worth a small follow-up if product wants it surfaced, since the data already exists and nothing needs to change server-side.
- `products.ai_generated` is persisted but still not visually surfaced on `SellerProductsPage`'s list or the public product detail page — flagged by the AI Store Builder research this phase but left untouched since neither screen is in E5's named scope.
- If Smart Logistics ever gains a real explanation field from the backend (not just cost/ETA/score), `RecommendationTier`'s card already has a natural slot for a "why" line between the tier and the raw-detail row.
