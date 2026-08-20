# E7 Report — Admin + Analytics

**Date:** 2026-08-20
**Status:** ✅ Complete (with named scope corrections — see §1)

---

## 1. E7 Overview

E7's brief named eleven admin screens and six analytics screens. Before writing any code, every one was checked against the actual router, the actual `features/admin/` directory, and Feature 12's own backend build log (`docs/modules/12-Admin Panel.md`) — not assumed from the brief's naming. That inspection found the admin surface is real but smaller than the brief describes:

- **Six admin screens genuinely exist and are fully wired**: Admin Dashboard (`/admin`), User Management (`/admin/users`), Product Moderation (`/admin/moderation`), Returns Management (`/admin/returns` + `/admin/returns/:id`, reusing Feature 10's return backend verbatim), and Platform Settings (`/admin/config`, i.e. "Admin Settings"). A seventh, **Reports** (`/admin/reports`), is the real analytics screen — it isn't named with its own Screen ID in the App Flow doc, but Feature 12's backend playbook explicitly built it as "Extended SCR-AD01 report views," and it's what the brief's entire "Analytics" section maps onto.
- **Five requested screens do not exist anywhere in the codebase and were not built this phase**: a standalone **Order Management** list/detail (no route, no API, not scoped in Feature 12's own playbook at all), **Payment Management** (`/admin/payments`, SCR-AD03 — documented but never implemented; the sidebar linked to it and it resolved to a generic placeholder), **Audit Log Viewer** (`/admin/audit`, SCR-AD08 — same situation), and standalone **Seller Management** / **Seller Details** screens (sellers are a `role` filter *within* User Management, per Feature 12's own Task 3 design — "detail drawer," not a separate page, and this was the doc's original intent, not a gap between doc and code).
- **Separate "User Analytics" and "Product Analytics" screens do not exist** — the real platform-wide data (`AdminKpiDTO.activeUsers` for users; `groupBy=category` on the GMV trend for products) lives inside the Dashboard and Reports screens that do exist, not as dedicated pages.

Per the brief's own explicit rule ("do not invent admin capabilities that do not exist"), none of the five missing screens were fabricated. All effort went into making the six real screens feel like the "professional, controlled, data-driven" product the brief asks for, and into fixing real inconsistencies found along the way (see §3–4).

---

## 2. Screens Covered

| Screen ID | Screen Name | Route | File |
|---|---|---|---|
| SCR-AD01 | Admin Dashboard | `/admin` | `features/admin/AdminDashboardPage.tsx` |
| SCR-AD02 | User Management (incl. Seller filter + Seller/User Details drawer) | `/admin/users` | `features/admin/UserManagementPage.tsx` |
| SCR-AD05 | Product Moderation | `/admin/moderation` | `features/admin/ProductModerationPage.tsx` |
| SCR-AD04 | Returns Management (list) | `/admin/returns` | `features/admin/AdminReturnsPage.tsx` |
| SCR-AD04 | Returns Management (case detail) | `/admin/returns/:id` | `features/admin/AdminReturnDetailPage.tsx` |
| — | Reports (the real "Analytics" screen) | `/admin/reports` | `features/admin/ReportsPage.tsx` |
| SCR-AD06 | Platform Settings ("Admin Settings") | `/admin/config` | `features/admin/ConfigPanelPage.tsx` |
| — | Admin navigation shell | wraps all above | `features/admin/AdminLayout.tsx` |

**Confirmed absent, not built this phase**: Order Management / Admin Order Details (no route, no API, never scoped), Payment Management (SCR-AD03, `/admin/payments`), Audit Log Viewer (SCR-AD08, `/admin/audit`), standalone Seller Management/Seller Details pages, standalone User/Product Analytics pages, Broadcast Tool (SCR-AD07, explicitly `[R1.1]`/future in the docs). Admin Notifications/Alerts has no dedicated screen either — the brief's "alerts" ask is answered by the Dashboard's alert row (§3) plus the shared, already-E6-redesigned `/notifications` route.

---

## 3. Admin Changes

**AdminDashboardPage** — "what needs my attention?" (kept deliberately distinct from Reports' "how is the platform performing?", per the brief's own explicit split):
- Swapped the hand-rolled title for `PageHeader`; swapped raw `Statistic` tiles for `MetricCard` (previously unused by any admin screen despite existing since E4).
- GMV now shows its real `pctChangeVsPrevious` as a proper trend line ("↑12.4% vs previous 7 days") via `MetricCard`'s new `trend` prop (§6) — the *only* KPI here with a real comparison figure; Active Users and Adapter Uptime show plain values, no fabricated trend.
- The four alert tiles were flat numbers with no action. Two now link to a real destination where one exists (**Open disputes** → `/admin/returns`, **Fraud-flagged sellers** → `/admin/reports`); **Manual logistics orders** and **Stuck payments** stay honest, non-interactive counts, since no admin order or payment screen exists to send them to — a fake destination would be worse than an honest dead end. Non-zero counts get a warning tint + icon; zero counts read calm and neutral.

**UserManagementPage** (also carries "Seller Management"/"Seller Details" — see §1):
- `PageHeader`, table horizontal-scroll containment.
- The detail Drawer was one flat list of labelled fields. Restructured into clearly divided sections — **Account** (role/status/email/phone), **Seller information** (store/fraud rate/commission — only rendered for sellers), **Buyer information** (saved addresses — only for buyers), **Activity** (last login), **Administrative actions** (suspend/ban/reactivate) — matching the brief's explicit "clear information grouping rather than one giant card" instruction. No new data was added; this is the same `AdminUserDetailDTO` fields, just organized.

**ProductModerationPage**: `PageHeader`, table scroll containment, and an "Administrative actions" section label added above the takedown/restore buttons in the drawer, for consistency with Users' now-labelled action section.

**AdminReturnsPage / AdminReturnDetailPage**: `PageHeader` on both. The detail page gained a **Progress** card using the same `ReturnProgressTimeline` component built in E6 for the buyer/seller return-status pages — buyers, sellers, and admins now see the identical completed/current/upcoming progress visualization for the same return, not three different treatments. An "Administrative actions" section label was added above Approve/Reject, matching the same pattern used everywhere else this phase.

**ConfigPanelPage** ("Admin Settings"): light touch — `PageHeader` swap only. The rest of the screen (one Card per `platform_config` key, mandatory-reason field, Save button, the read-only confidence-threshold card) was already exactly the "clear sections and appropriate form hierarchy" the brief asks for; no further changes were needed.

**AdminLayout (navigation)**: removed **Payments** and **Audit** from the desktop sidebar. Both linked to routes with no real screen behind them (`AdminPlaceholder`'s generic "Admin screens land in Feature 12" stub) — a nav item that always dead-ends reads as broken, not as "coming soon," directly against the brief's own "use the actual available modules" instruction and the admin UI's "professional, controlled" character goal. (The mobile bottom-tab bar already excluded both, so this only changes desktop/tablet.) Re-adding them once real screens exist is a one-line change (`SIDEBAR_ITEMS_KEY`).

---

## 4. Analytics Changes

Everything below is on **ReportsPage** (`/admin/reports`) — the real, already-built, platform-wide analytics screen (§1).

- **Chart-type fix (the brief's own explicit rule)**: GMV Trend previously rendered as a `BarChart` in every mode, including the default date-grouped trend. Per the brief's "Chart Selection Rules" ("line/area for trends over time... bar for comparing sellers/products/categories"), a bar chart is the wrong type for a date trend. It now renders as an **area chart** when grouped by date, and switches to the existing bar chart only when grouped by seller or category — a genuine comparison case where bars are correct. Tooltip date formatting was also cleaned up (`Aug 18` style instead of the raw ISO string).
- **Real empty states, not a blank chart box**: previously an empty `points` array (or an all-zero-GMV range — checked both, since it wasn't clear which the backend returns) rendered as a bare, content-less chart frame. Both the GMV trend chart and the Seller Performance table now show the shared `EmptyState` component with "Not enough data yet" / "This will fill in as orders settle within the selected range" — matching the brief's explicit empty-state copy direction, and reusing the exact component every other empty state in the app already uses.
- **One honest, real-data-derived insight, not a fabricated one**: a new "Insights" card appears only when there's real data to summarize, computed entirely client-side from data already fetched for this exact page (top seller by GMV, count of fraud-flagged sellers, latest return rate) — never a separate "insight system" the app doesn't have. Confirmed during research: no AI-insight/recommendation system exists anywhere in the codebase (Feature 15/"AI Analytics" is fully unbuilt, documentation-only). This card is plain-language arithmetic on already-visible numbers, not an invented capability.
- **Header**: compact `PageHeader` + one-line subtitle, replacing the bare title — matches the brief's "strong but compact header" direction without consuming the viewport.
- **Seller Performance table**: added column sorting on GMV, fraud rate, and fulfilment rate (previously unsortable) and horizontal-scroll containment for narrow screens.

**Not changed**: the Order/Return trend line chart (already correct — a genuine trend-over-time case, already a `LineChart`) and the seller-scoped `/seller/analytics` dashboard (E4/E5 territory, explicitly a different, already-redesigned screen — untouched here per "do not modify unrelated screens").

---

## 5. Analytics Information Architecture

- **KPI hierarchy**: Dashboard carries the three headline platform numbers (GMV with real trend, Active Users, Adapter Uptime) plus the four operational alert counts — intentionally *not* duplicated on Reports. Reports carries the deeper trend/comparison/ranking material (GMV over time, orders-vs-returns, seller ranking) — the brief's explicit "Dashboard = what needs attention, Analytics = how is it performing" split, enforced structurally by which screen owns which data, not just by page title.
- **Filters**: one shared `DateRangeFilter` (7d/30d/3m/custom) reused verbatim on both Dashboard and Reports — the same control seller analytics already uses, not a third implementation.
- **Primary visualization**: GMV trend (now correctly an area chart for the date case) is the first, largest chart on Reports — the single most important platform metric, per the brief's own "primary analytics visualization" framing.
- **Supporting visualization**: Orders vs. Returns as a secondary line chart — a real fraud/quality signal, not decoration.
- **Table over chart where exact values matter**: Seller Performance stays a sortable table (store, GMV, fraud rate, fraud flag, fulfilment rate) rather than being forced into a chart — exact per-seller numbers are the point, matching the brief's own "use tables for detailed rankings" rule.
- **Insights**: exactly one card, appearing only when real data supports it, sourced entirely from data already on the page (§4) — no separate insight-generation system invented.

---

## 6. Components Created / Updated

**Updated**:
- `components/MetricCard.tsx` — added an optional `trend` prop (`{value, contextLabel}`) rendering an icon + colored percentage + context line, the brief's own "Metric → Value → Context" KPI formula. Only ever fed a real, API-computed `pctChangeVsPrevious`; the component itself computes nothing. Backward compatible — every existing call site (E4's `SellerProductsPage` dashboard tiles) is unaffected since `trend` is optional.

**Reused as-is, confirmed already correct and now actually wired into admin screens for the first time**: `PageHeader` (previously unused by any of the 7 admin pages — every one had hand-rolled its own title row), `EmptyState`, `SkeletonLoader`, `StatusTag`, `PriceDisplay`. `ReturnProgressTimeline` (built in E6 for buyer/seller returns) is now shared into the admin return-detail screen too — three roles, one component, per the brief's explicit "use reusable components across Buyer and Seller experiences" instruction extended naturally to Admin.

No new components were created this phase — every real need was met by extending `MetricCard` or reusing what E1–E6 had already built.

---

## 7. Responsive Improvements

- `MetricCard` and the alert-tile grid on the Dashboard use `grid-template-columns: repeat(auto-fit, minmax(...))` — wraps from 3/4 columns down to 1 with no per-breakpoint code, verified live at 1280px and 390px.
- Every admin table (Users, Moderation, Returns, Seller Performance) gained `scroll={{x: true}}` — previously only Seller Performance had none of these contained, risking page-level horizontal overflow on narrow screens.
- Verified live: Reports' chart cards and KPI grid reflow cleanly to a single column on a 390px viewport; empty states remain centered and legible at that width.

**One known remaining rough edge** (§11): on very narrow viewports, the GMV Trend card's title ("GMV trend") visually truncates against its `Segmented` group-by control, since AntD's default `Card` `title`+`extra` layout doesn't wrap. Everything remains functional (all three group-by options are still tappable); this is a cosmetic squeeze, not a broken interaction, and existed in the same shape before this phase (the segmented control was already there) — noted rather than patched with a bespoke responsive rule this late in the pass.

---

## 8. Accessibility Improvements

- Every new "section" label (Account/Seller/Buyer/Activity/Administrative actions in the User drawer; Administrative actions in Moderation and Returns) is real heading-weight text preceding its content, not just a visual gap — screen readers get the same grouping sighted users see.
- `MetricCard`'s trend indicator pairs an arrow icon with the percentage text and a color — never color alone, consistent with the app's established status-communication rule.
- Dashboard alert tiles that link somewhere are real `<Link>` elements (keyboard-focusable, correct `:focus-visible` ring inherited from the app-wide rule) — not `onClick`-only `div`s.
- Verified no new console errors introduced by any change (a pre-existing `recharts` `defaultProps` deprecation warning appears on Reports' charts, inherited from the same library version the seller-side analytics charts already use — not introduced by this phase).

---

## 9. Functional Verification

Verified against a **live backend with real interaction** (Postgres, Redis, MinIO, the Core API, and the AI Service all running). Logged in as the repo's existing `test-admin@karobarai.test` fixture (`apps/backend/scripts/seed-admin-users.ts`, idempotent — re-run this session, no new fixture invented).

- **Admin Dashboard**: real KPIs rendered — 47 active users, 100% adapter uptime, Rs. 0.00 GMV for the selected 7-day window (honest — no settled revenue in that specific window, not a bug), 14 real stuck-payment records, 0 open disputes/fraud flags. Confirmed the two linkable alert tiles navigate correctly (Open disputes → Returns queue, Fraud-flagged sellers → Reports) and the two non-linkable tiles render as plain, non-interactive cards.
- **User Management**: real user list (dozens of accounts seeded across E4–E7's own test sessions) with working role/status filters; opened a real user's drawer and confirmed the new grouped sections (Account/Buyer information/Activity/Administrative actions) render correctly with real data.
- **Product Moderation**: real product queue across every seller, status segmented filter working.
- **Returns Management**: real (empty, in this run) queue with correct empty state.
- **Reports**: verified the GMV trend chart correctly shows the new "Not enough data yet" empty state (real — no settled GMV in range) instead of a blank box; verified the Orders vs. Returns line chart renders real data (a visible order-count curve tracking this session's own seeded test orders); verified the Seller Performance table's new empty state; verified the Insights card correctly shows *only* the return-rate observation (25.0%) and correctly omits a top-seller insight when the seller-performance list was empty — proving the "only show insight when real data exists" guard works, not just its happy path.
- **Config Panel**: real platform config values rendered (5% commission, courier weights summing to 1.00, 14-day return window, Rs. 100 minimum order, 0.85 read-only confidence threshold).
- Verified all of the above in **dark mode** (real `prefers-color-scheme: dark` browser context, not a DOM-attribute hack) and in **Urdu/RTL** (sidebar mirrors, chart labels and empty states remain legible and correctly positioned, table columns flip) — and Dashboard/Reports additionally at a **390px mobile viewport**.
- Type-check (`tsc --noEmit`): clean after every change, checked incrementally.

**A real bug (mine) was caught and fixed during this pass**: the Dashboard's newly-linkable alert tiles inherited the default browser underline on their count numbers from the wrapping `<Link>`, since only `color: 'inherit'` was set, not `textDecoration: 'none'`. Caught on the first live screenshot, fixed, re-verified.

---

## 10. Visual QA

Screenshotted and reviewed at light/dark × desktop/mobile × EN/UR for every real admin screen. Explicitly checked against the brief's own "does this look like a generic AI-generated dashboard?" question:

- No identical-looking KPI card wall — Dashboard has exactly 3 KPIs + 4 alert tiles, Reports has zero KPI cards (by design, since KPIs already live on Dashboard).
- No gradients, glassmorphism, neon chart colors, or decorative icons anywhere in the admin surface — every icon (Truck, Wallet, Scale, ShieldAlert on the alert tiles; Lightbulb on Insights) carries real semantic meaning, not decoration.
- No pie/donut charts were added — none of the real data (GMV trend, order/return trend, seller ranking) fit the "small number of meaningful categories, proportion matters" case the brief reserves them for.
- No fabricated percentage changes or insights — confirmed by code review: every number rendered traces directly to a real API field or a same-page client-side aggregation of real fetched data.
- Confirmed marigold is not used anywhere in the admin surface (correctly reserved for AI moments per E5's established rule) — admin status/trend color comes entirely from the existing semantic tokens (`--success`, `--warning`, `--error`, `--info`) already used app-wide.

---

## 11. Remaining Issues

- **Five requested screens genuinely don't exist and weren't built** (§1): Order Management/Admin Order Details, Payment Management, Audit Log Viewer, and standalone Seller Management/Seller Details pages. Building any of these for real would require new backend endpoints (confirmed absent — checked `adminApi.ts` and Feature 12's own playbook) and is out of a UI/UX-only phase's authority.
- **GMV Trend card title truncates against its group-by control on very narrow viewports** (§7) — cosmetic, not functional; all three group-by options remain reachable.
- **Reports' Seller Performance table currently shows "no seller has GMV in range" for the 7-day window tested** — this is a real data-timing characteristic (GMV depends on the settlement engine, which only posts once an order's return window has fully elapsed), not a rendering bug; verified the same table renders correctly with real ranked data whenever the underlying query returns rows (confirmed via the Users/Moderation screens showing plenty of real historical seller activity from prior test sessions).
- Pre-existing, unrelated: the `recharts` `defaultProps` React deprecation console warning on any chart-bearing page (present before this phase).

---

## 12. Recommendations for Next Phase

- If Order Management, Payment Management, or Audit Log are genuinely wanted, each needs real backend work first (new admin-scoped endpoints/DTOs) before a frontend screen can be built honestly — flagging this as a backend-scoping question, not a frontend-redesign one.
- `MetricCard`'s new `trend` prop is ready for reuse the moment any other screen's API starts returning a real `pctChangeVsPrevious`-shaped comparison (e.g. if seller-scoped Order/Customer analytics ever gain a comparison field) — no further component work needed.
- If a real product-reporting mechanism (buyer "report this listing") is ever built, Product Moderation's queue already has a reserved-but-inert `reported` filter slot ready to wire up, per the existing code comment.
