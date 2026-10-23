# Day 3 · Phase 4 — handoff for the next session

Paste this to start the new session:

> Read `docs/frontend/DAY3-PHASE4.md` and memory, then start Phase 4a. Lean mode.

---

## 1. Ground rules (from Rafia — follow exactly)

- **Lean mode.** No screenshots, no reviewer/finish agents, no design briefs. Rafia checks every page in her own browser.
- **Quality still matters.** "Quality par compromise na karna": EN/UR + RTL, phone layout, loading/empty/error states, and `tsc` + `eslint` clean every time.
- **Frontend only.** Backend belongs to Abdullah. If something needs a backend change, write it in `docs/frontend/BACKEND-NOTES.md` (section 3 table) and carry on. Ask before touching backend or infra files.
- **Never commit.** Rafia commits herself.
- **Explain first, then build.** For each part: say in Roman Urdu what you will do and how, wait for her OK, then code.
- **Report format.** When a part is done: the URL plus 3–4 short lines in Roman Urdu. Add a 2–3 line entry to `docs/frontend/DAILY-LOG.md` under "Day 3".
- **Design feedback she has given:**
  - Nothing generic or empty. Each page needs one memorable moment and some purposeful motion.
  - The feel should be calm and trustworthy.
  - **Buttons stay at normal size.** Use the AntD default size (40px on desktop via compact density) and no `size="large"` on buttons. No big `min-width` values.
  - Use the project's Studio Light colours only.

## 2. Environment notes

- The app runs from **Docker**: `web` serves http://localhost:5173 and `api` serves :4000. Don't start another Vite on 5173. If you start one for a check, stop it afterwards and say so.
- `ai-service` is back in `infra/docker-compose.yml` and running. If AI features fail after a Docker restart, check `docker ps` for `karobarai-ai-service-1` first.
- Postgres in Docker is on **5433**. A local Postgres and Memurai also run on the laptop; leave them alone.
- **Shell gotcha (Windows Git Bash):** heredocs and `node -e` strings that contain backticks, `${…}` or some quotes get mangled. For multi-line code or CSS, write a file with the Write tool (scratchpad) and append or splice it with a small node script, or use the Edit tool. Locale files use **CRLF**, so normalise line endings when patching.
- Windows file names are case-insensitive. Don't create `orderJourney.ts` next to `OrderJourney.tsx`.

## 3. What is already done (Day 3)

| Phase | Result |
|---|---|
| 1 | Own seller shell in `features/seller/SellerLayout.tsx`: floating glass sidebar with collapse toggle (remembered), grouped nav, store card; centred glass top pill (store status "Live" dot or back link, AI assistant, messages, bell, language, account); phone floating tab bar with a raised AI "+". Seller home (`features/catalog/SellerProductsPage.tsx`). 3-step store setup wizard with live preview. |
| 2 | AI Store Builder (`features/catalog/AddProductPage.tsx`) and Edit product: step tracker, drop zone, two-column workspace, buyer preview, sticky glass action bar. |
| 3 | Orders list, order detail and tracking (`features/orders/*`, `features/tracking/AuthenticatedTrackingPage.tsx`), shared by buyer and seller. Journey tracker component `features/orders/OrderJourney.tsx` (helpers in `journeyStages.ts`). |

**Styling conventions to reuse:**

- `features/seller/seller.css` (classes `sl*`) is loaded by SellerLayout, so it is available on every `/seller` page. Useful pieces:
  - `slFormCard`, `slFormCardHead`, `slPanelTitle`
  - `slField`, `slFieldRow`, `slFieldError`, `slFieldHint`
  - `slActionBar` (sticky glass save bar)
  - `slEmpty`, `slEmptyIcon`, `slEmptyTitle`, `slEmptyBody`
  - `slGhostBtn`, `slPrimaryBtn`, `slTextLink`
  - `slFilters` / `slFilter` (pill filters)
  - `slSteps` (step tracker), `slBuilderHead` (page title row)
- `features/orders/orders.css` (classes `ol*` / `od*` / `tr*`): pill tabs with a sliding ink (`olTabs`), cards (`odCard`, `odCardTitle`), the two-column grid (`odGrid` / `odMain` / `odSide`), `odNext` (the "next step" card), and `odPulse` / `odNextIn` keyframes.
- Patterns:
  - Page title in Outfit (Nastaliq in Urdu).
  - White cards with a 1px border and 22–24px radius on the canvas.
  - Lilac wash for a page's hero band; persimmon only for the one primary action.
  - Logical CSS properties everywhere; `prefers-reduced-motion` respected.
- The top pill's back link covers detail pages, so don't add separate "← Back" headers. The mapping lives in SellerLayout (`/seller/returns/:id` → Returns, `/seller/profile/*` → Profile).

## 4. Phase 4a — Analytics + Returns (do first)

**Analytics** (`/seller/analytics`, `features/analytics/*`)
- Check `AnalyticsDashboardPage`, `RevenueCards`, `SalesTrendChart`, `CategoryBreakdownChart`, `OrderAnalyticsCard`, `CustomerAnalyticsCard`, `TopProductsTable`, `DateRangeFilter`.
- Load the `dataviz` skill **before** touching chart code (colours, marks, tooltips).
- Idea:
  - A lilac header band: the title, the date-range filter as pill tabs (reuse the sliding-ink pattern), and the hero metric.
  - Metric tiles with soft tinted icon tiles.
  - A sales trend area chart in Studio colours that draws in on load.
  - Category breakdown and top products with product thumbnails (`ProductThumbnail`).
  - An empty state that explains when analytics will appear.
- Note: RevenueCards documents that revenue reads "Rs 0" for real sellers until settlement exists. Present that honestly; never invent numbers.

**Returns** (`/seller/returns`, `/seller/returns/:id`, `features/returns/SellerReturnsPage.tsx`, `SellerReturnDetailPage.tsx`, plus `ReturnProgressTimeline`, `ReturnSimilarityScale`, `PrivateEvidenceImage`)
- List: reuse the orders-list look (pill tabs, rows with status, a highlight for returns waiting on the seller).
- Detail:
  - A journey band like the order detail's, built from `ReturnProgressTimeline`.
  - Evidence photos in a gallery.
  - The AI similarity scale as the memorable moment (an animated gauge).
  - A single "next step" card (approve / reject / respond to appeal) using `odNext`.
- Buyer return pages (`BuyerReturnsPage`, `ReturnWizardPage`, `ReturnStatusPage`) are **Day 4**. Don't break them if you change shared components.

## 5. Phase 4b — Messages + Assistant + Profile/Settings

- **Messages** (`/seller/messages`, `features/human-chat/HumanMessagesPage.tsx` + `humanChat.css`, which has tests):
  - Conversation list plus a thread in Studio Light, with soft bubbles.
  - Delivery receipts already exist (recent commit), so keep them.
  - Run `HumanMessagesPage.test.tsx` and `useHumanChatSocket.test.tsx` after the changes.
- **AI Assistant** (`/seller/assistant`, `features/seller/SellerAssistantPage.tsx`, 106 lines; it streams):
  - Chat layout with the AiMark and suggested prompts as pills.
  - Streaming text with a calm typing indicator.
- **Profile / Settings / Change password** (`features/profile/ProfilePage.tsx`, `SettingsPage.tsx`, `ChangePasswordPage.tsx`, `StoreBrandTab.tsx`, `AvatarUpload.tsx`):
  - Profile = store header (banner + logo, like the setup wizard preview) with tabs.
  - Settings = grouped `slFormCard` sections with the sticky `slActionBar` save.
  - Change password reuses the auth `PasswordField` / checklist pattern if practical.
  - These pages are shared with buyer/admin in places, so check the `role` branches.

## 6. Checks before reporting each part

1. `npx tsc --noEmit -p ..` and `npx eslint <changed folders>`, run from `apps/frontend/src`.
2. `npx vitest run` when shared components or tested files changed.
3. EN and UR strings added in **both** `locales/en/index.ts` and `locales/ur/index.ts`.
4. Phone width (≤767px) and RTL thought through; no horizontal scroll.
5. Loading, empty and error states present.
6. DAILY-LOG entry, then report: URL + 3–4 lines in Roman Urdu.

## 7. Open items to remember

- **Backend asks** (already in BACKEND-NOTES): `thumbnailUrl` on order DTOs, so the orders list can show product photos.
- `docker-compose.yml` still has Rafia's uncommitted local changes: port 5433, the api `command`, and the restored `ai-service` block.
- Not verified end-to-end with real data: AI listing publish flow and the order fulfilment flow (pack → courier → deliver). Rafia checks in the browser.
- **Day 4 after this:**
  - Buyer after-purchase pages: orders and tracking already restyled through the shared pages; returns wizard, notifications, profile.
  - Admin re-skin.
  - QA at 375px + Urdu/RTL.
