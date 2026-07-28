# **1\. Overall Development Strategy**

## **Recommended Methodology: Pipelined Backend-First, One-Feature-Ahead Hybrid**

Not pure Backend-First. Not pure Vertical Slice. A hybrid built specifically around your one real constraint that most generic advice ignores: **you have one shared AI agent split across a day/night boundary, not two independent developers who can both prompt simultaneously.**

### **Why not the standard options as-is**

**Pure Backend-First (finish all 19 backend features, then start all frontend)** Wrong for you. Rafia would sit idle for potentially half the project. You have a fixed two-person team and no slack to burn — a frontend dev idle for weeks is a resource going to waste, not "waiting productively." Rejected.

**Pure Frontend-First (build all UI on assumption, backend fills in later)** Also wrong. Your schema, TRD, and playbooks already define exact contracts (DTOs, enums, response envelopes). Building frontend against guessed shapes before backend exists guarantees rework the moment real APIs land — and rework means re-prompting Claude CLI to fix things, burning your single scarce agent session on corrections instead of new work. Rejected.

**Pure Vertical Slice (one feature, full stack, together, before moving to next)** Closest to correct in spirit, but naively applied it collides with your day/night split: if Feature N's backend and frontend both need to happen "together," someone is always waiting for the CLI to free up mid-feature. Vertical slice needs to be *time-sliced* across your day/night boundary to actually work — which is exactly what the hybrid below does.

### **The actual strategy: pipeline it**

Treat the day/night boundary not as a scheduling inconvenience but as a **natural pipeline stage boundary** — the same pattern used in real engineering orgs where backend and frontend teams work in a producer/consumer relationship:

CR (night) → builds backend for Feature N (using Playbook N)

↓ commits, pushes, updates handoff notes

Rafia (day) → builds frontend for Feature N (using Playbook N, real API contract now live)

↓ commits, pushes

CR (next night) → backend for Feature N+1 (never waits on Rafia)

Rafia (next day) → frontend integration/polish for N, or starts N+1 frontend against mocks if N+1 backend isn't done yet

**Backend always stays exactly one feature (one day/night cycle) ahead of frontend.** This is the core rule. It means:

-   CR is **never blocked** — she always has the next feature's playbook ready to start the moment the previous backend is committed. She never waits on Rafia's output.
-   Rafia is **rarely blocked** — by the time she wakes up, last night's backend for her current feature already exists, tested and committed. She's not waiting on CR in real time; she's consuming what CR produced 8+ hours earlier.
-   The only place true waiting can occur is the **very first cycle** (Feature 0/1, before any backend exists) — solved by having Rafia's first 1–2 days build against the Database Schema + TRD contracts directly (which are already finalized) using mock data, so she's never fully idle even on day one.

### **Why feature-by-feature granularity (not epic-level, not story-level)**

Your 19 playbooks are already scoped at the right grain — each is a coherent, demoable, independently-testable unit with clear boundaries per Doc 6's phase structure. Pipelining at *this* granularity (not smaller) matters because:

-   Smaller units (individual endpoints) would mean handoffs every few hours — too much coordination overhead, too much time spent writing handoff notes instead of building.
-   Larger units (whole phases spanning 3–4 features) would mean Rafia waits multiple days for her first real API, reintroducing the idle-time problem Backend-First has.

One feature per day/night cycle is the sweet spot: small enough that neither dev waits long, large enough that context doesn't get chopped up mid-thought inside a single Claude CLI session.

### **Why this maximizes your specific constraints**

| **Constraint you stated** | **How this strategy addresses it** |
| --- | --- |
| One shared Claude CLI | Day/night ownership is never contested — there's no scenario where both devs need the agent at the same moment for the same feature |
| --- | --- |
| Minimize waiting | Backend leads by exactly one cycle, so frontend always has real, tested API contracts by the time it needs them |
| --- | --- |
| Minimize merge conflicts | Backend and frontend touch almost entirely disjoint files (apps/api/ vs apps/web/) in different time windows — conflicts become structurally rare, not just "unlikely" |
| --- | --- |
| Minimize AI context switching | Each CLI session (day or night) stays on exactly one feature, one playbook, one codebase area — no mid-session pivoting between frontend and backend concerns |
| --- | --- |
| Fixed 19-feature scope, playbooks locked | The pipeline maps 1:1 onto your existing feature numbering — no redesign of scope, just sequencing discipline |
| --- | --- |

This is the backbone the rest of the plan (timeline, daily workflow, dependency matrix, Git strategy) will be built on in the sections that follow.

Say **CONTINUE** for #2 — AI Agent Usage Strategy.

# **2\. AI Agent Usage Strategy**

This section defines the exact rules for *how* Claude CLI gets used — not just the sequencing (already set in §1), but the operating discipline around each session so the single shared agent is never wasted, confused, or working from stale context.

## **Core Principle: One Session = One Feature = One Owner**

Every Claude CLI session has exactly **one** playbook loaded, **one** developer driving, and **one** codebase area in scope (apps/api/ or apps/web/, never both in the same session). This is non-negotiable — it's what prevents context drift and keeps generated code consistent across a 19-feature build.

## **Answering your specific design questions directly**

**Should one feature be completed entirely before moving on?** Backend: **yes, always.** CR finishes Feature N's backend (all endpoints, services, tests per the playbook) fully before starting Feature N+1. Partial backend features create ambiguous contracts — Rafia can't safely build against "70% of Feature N's API," so backend completion is a hard gate.

Frontend: **mostly yes, with one controlled exception** — see "skip ahead" below. Rafia finishes Feature N's frontend before fully moving to N+1's *integration*, but she's allowed to start N+1's UI scaffolding early against mocks (detailed below) since that doesn't require anything from CR yet.

**Should frontend wait for backend?** Only for **integration**, never for **UI construction**. Rafia never sits idle waiting for an API to exist. She builds screens, forms, component structure, and client-side validation immediately using the Database Schema (Doc 5) + App Flow (Doc 3) + the feature's own playbook as the contract — all of which are already finalized and don't require CR to be actively working. She wires up real API calls only once CR's backend for that feature is committed.

**Should frontend build using mock APIs first?** **Yes, by default, for every feature**, not as a fallback — as the standing procedure. Concretely:

-   Rafia's day session starts by generating a typed mock API layer (matching the DTOs already defined in the Schema/TRD) via Claude CLI, then builds the full UI against that mock layer.
-   When backend lands (same day, from the previous night, per the pipeline), the *last* task of her day session is swapping the mock layer for the real API client — a mechanical, low-risk change since the contract was already known and matched.
-   This means mocks aren't a stopgap for a broken pipeline — they're the normal first step of every frontend session, which also means frontend never trails behind waiting on last-minute backend delays.

**Should backend always stay one feature ahead?** **Yes — this is the load-bearing rule of the whole plan** (established in §1). CR never builds Feature N backend the same night Rafia is integrating Feature N frontend; CR is always already on N+1 or later by then. Concretely: by the time Rafia sits down each morning, the backend she needs already exists from the previous night. She is a *consumer* of yesterday's output, not a *blocker* on today's.

**Should frontend ever skip ahead?** **Yes, but only for scaffolding, never for integration.** If Rafia finishes a feature's UI faster than expected and CR's backend for N+1 isn't ready yet (shouldn't happen under the pipeline, but allow for it), she may:

-   Start N+1's component/screen scaffolding and mock layer (no dependency on backend).
-   She may **not** start wiring real integration for a feature whose backend isn't committed yet — that risk of building against a guessed contract is exactly what §1 rejected in Frontend-First. Skip-ahead is for *UI construction only*, never for *integration*.

## **Session Discipline Rules (apply to every single CLI session, both devs)**

1.  **Always start a session by loading exactly one playbook** (Feature N) plus the three reference docs it needs: Schema (Doc 5 + addenda), TRD, and — for frontend sessions — App Flow. Never load multiple feature playbooks into one session; that's how cross-feature context bleed happens.
2.  **Never mix backend and frontend work in the same session**, even if both devs are technically free at that moment (e.g., a weekend). The agent's internal context should never have to reason about Express services and React components in the same conversation — this is the single biggest cause of inconsistent code style and duplicated logic across a shared-agent project.
3.  **One CLI session should map to one Git branch.** Starting a new session = strong signal to check out (or create) the corresponding feature branch first. This keeps the session's file edits scoped to what Git will actually diff.
4.  **End every session with a explicit "session summary" commit message and a short handoff note** (mechanics in §10) — this is what lets the *other* developer's next session start without re-deriving context from scratch.
5.  **A session should not span more than one feature's worth of work.** If CR finishes Feature N backend with time left in her window, she starts a **new** session for N+1 rather than continuing the same one — this keeps each session's context small, fast, and on-topic, and keeps Claude CLI's context window from accumulating irrelevant history from a completed feature.

## **Why this maximizes agent productivity specifically**

Because you have exactly one CLI session-slot per half-day, the single most expensive failure mode is **a session that goes sideways** — the agent losing track of what's already built, re-implementing something, or producing code inconsistent with an earlier feature. The rules above are all aimed at eliminating that specific risk:

-   Single playbook per session → no ambiguity about scope.
-   Single codebase area per session → no risk of the agent "fixing" the other dev's code without full context.
-   Hard feature-completion gates → no partially-built features that confuse the *next* session about what already exists.
-   Mock-first frontend → Rafia's sessions are never dead time waiting on a CLI she doesn't currently have access to anyway (it's CR's at night).

Say **CONTINUE** for #3 — Complete Development Timeline (Features 0–18).

# **3\. Complete Development Timeline (Features 0–18)**

## **Unit of time: the Cycle**

One **Cycle** = one night session (CR, backend) + the following day session (Rafia, frontend), per the pipeline established in §1–2. This timeline is expressed in cycles, not calendar weeks, because your actual velocity depends on how fast each Claude CLI session completes a playbook — but cycles give you a concrete, trackable unit to plan against. Some features are genuinely too large for one cycle and are explicitly split below rather than forced to fit.

**ASSUMPTION flagged:** the original Doc 6 20-week timeline assumed a fixed academic FYP pace without heavy AI-agent leverage. This timeline assumes AI-assisted development is meaningfully faster per unit of work, so cycle counts here are *not* a 1:1 remap of Doc 6's weeks — they're a fresh estimate for your actual workflow. Treat cycle counts as planning estimates to recalibrate after your first 3–4 cycles show real velocity.

## **Master Timeline Table**

| **Cycle** | **Night (CR — Backend)** | **Day (Rafia — Frontend)** | **Testing / Merge Note** |
| --- | --- | --- | --- |
| **1** | **F0 Backend** starts→finishes: monorepo, Docker Compose, CI skeleton, schema.prisma (all tables + §14/§15 addenda), migrations, seed data | **F0 Frontend** starts (parallel scope, no API dependency): Vite/React shell, design tokens, i18n scaffold (UR/EN), routing skeleton, AntD theme | Both merge to main independently by end of Cycle 1 — F0 has no cross-dependency between its two halves |
| --- | --- | --- | --- |
| **2** | **F1 Backend** starts→finishes: OTP, email/password auth, JWT RS256, refresh rotation, RBAC middleware, lockout | **F0 integration**: wire shell to /health endpoint, confirm Docker Compose boots both. **F1 Frontend** starts (mock API): Register/OTP/Login screens | F0 fully merged + tested end of Cycle 2. F1 backend merged; F1 frontend still on mocks |
| --- | --- | --- | --- |
| **3** | **F2 Backend** starts→finishes: buyer/seller profile CRUD, address book | **F1 integration**: swap mocks for real auth API, full register→verify→login→refresh→logout test pass | F1 fully merged + tested end of Cycle 3 |
| --- | --- | --- | --- |
| **4** | **F3 Backend** starts→finishes: Store Management (seller profile, store-setup wizard backend incl. §15.6 onboarding-step field, payout\_wallets from §14.1) | **F2 integration**: profile screens live. **F3 Frontend** starts (mock): Store-Setup Wizard UI | F2 fully merged + tested end of Cycle 4 |
| --- | --- | --- | --- |
| **5** | **F4 Backend** starts→finishes: Product Management CRUD, inventory (stock/oversell), image upload+compression pipeline | **F3 integration**: wizard wired to real API, resumable-step behavior tested | F3 fully merged + tested end of Cycle 5 |
| --- | --- | --- | --- |
| **6** | **F5 Backend** starts→finishes: Buyer Marketplace — search/browse, tsvector FTS, filters/sort, autocomplete | **F4 integration**: Products list/edit screens live, oversell guard tested | F4 fully merged + tested end of Cycle 6 |
| --- | --- | --- | --- |
| **7** | **F6 Backend (part 1 of 2)**: persisted cart, multi-seller split-at-checkout logic, min-order enforcement | **F5 integration**: Search/Browse + Product Detail screens live | F5 fully merged + tested end of Cycle 7 |
| --- | --- | --- | --- |
| **8** | **F6 Backend (part 2 of 2)**: checkout finalize — address/payment-method collection, idempotency key middleware, mock payment kickoff | **F6 Frontend** starts (mock): Cart + Checkout UI (this is flagged "complex" in AppFlow — expect full cycle) | — |
| --- | --- | --- | --- |
| **9** | **F7 Backend** starts→finishes: Order Management (state machine, seller/buyer order views, tracking\_events writes per §15.3 rule) | **F6 integration**: Cart→Checkout wired to real APIs, split-order flow tested end-to-end | F6 fully merged + tested end of Cycle 9 |
| --- | --- | --- | --- |
| **10** | **F8 Backend** starts→finishes: Courier scoring/booking (mock adapters), retry/fallback logic, PENDING\_MANUAL\_LOGISTICS path | **F7 integration**: Order Detail + Order Management tabs live for seller/buyer | F7 fully merged + tested end of Cycle 10 |
| --- | --- | --- | --- |
| **11** | **F9 Backend** starts→finishes: Notification Center — BullMQ producers/consumers, SMS mock adapter, in-app bell, templates | **F8 integration**: Courier booking UI, tracking timeline + map embed wired, WebSocket live-push tested | F8 fully merged + tested end of Cycle 11 |
| --- | --- | --- | --- |
| **12** | **F10 Backend** starts→finishes: Returns workflow (non-AI) — window enforcement, photo upload, manual-review queue, appeal | **F9 integration**: notification bell + preferences live, template rendering UR/EN verified | F9 fully merged + tested end of Cycle 12 |
| --- | --- | --- | --- |
| **13** | **F11 Backend** starts→finishes: Analytics core — seller\_daily\_stats rollup job (§15.1), revenue/trend/top-products endpoints | **F10 integration**: Returns Wizard + seller Returns view live, appeal flow tested | F10 fully merged + tested end of Cycle 13 |
| --- | --- | --- | --- |
| **14** | **F12 Backend (part 1 of 2)**: Payments — mock JazzCash/Easypaisa/COD adapters, HMAC webhook verify, settlement engine (§14.2 gross/commission rule), COD ledger | **F11 integration**: Analytics Dashboard charts live, date-range filter tested against rollup table | F11 fully merged + tested end of Cycle 14 |
| --- | --- | --- | --- |
| **15** | **F12 Backend (part 2 of 2)**: Admin Ops — user mgmt, payment release, config panel, audit log writes, KPI queries | **F12 Frontend** starts (mock): Wallet/Payout screens + Admin Console shell | — |
| --- | --- | --- | --- |
| **16** | **F13 Backend** starts→finishes: AI Store Builder — ai-service FastAPI, GPT-4V→GPT-3.5 fallback chain, JSON-schema enforcement | **F12 integration**: Wallet screens + full Admin Console wired to real APIs, override/audit flows tested | F12 fully merged + tested end of Cycle 16 |
| --- | --- | --- | --- |
| **17** | **F14 Backend** starts→finishes: AI Returns — Cloud Vision + CNN inference, returns\_confidence\_threshold routing | **F13 integration**: AI Store Builder upload→generate→publish flow live, GPT-3.5 fallback tested | F13 fully merged + tested end of Cycle 17 |
| --- | --- | --- | --- |
| **18** | **F15 Backend** starts→finishes: AI Analytics — seller\_recommendations table (§15.2), recommendation generation job | **F14 integration**: AI assessment badge + report shown in seller/admin returns views, manual-review routing tested | F14 fully merged + tested end of Cycle 18 |
| --- | --- | --- | --- |
| **19** | **F16 Backend** starts→finishes: External APIs — live-adapter interfaces finalized/documented (still mock-mode default per D2), WhatsApp channel adapter | **F15 integration**: Recommendation cards live, dismiss-14-days behavior tested | F15 fully merged + tested end of Cycle 19 |
| --- | --- | --- | --- |
| **20–21** | **F17 — Final Integration** (both devs, pipeline paused — see note below) | **F17 — Final Integration** (both devs, same window) | Cross-feature E2E bug-fixing, joint session |
| --- | --- | --- | --- |
| **22–24** | **F18 — Testing & Deployment** (both devs, pipeline paused — see note below) | **F18 — Testing & Deployment** (both devs, same window) | E2E suites, load test, OWASP review, staging→prod deploy |
| --- | --- | --- | --- |

## **Why Features 17 and 18 break the pipeline pattern — on purpose**

Every feature 0–16 follows the clean backend-leads-by-one-cycle pipeline. **F17 (Final Integration) and F18 (Testing & Deployment) cannot follow that pattern**, and forcing them to would be a mistake: by definition, they require both devs looking at the *same* cross-cutting surface (full E2E flows spanning every module, security review, deploy pipeline) rather than disjoint backend/frontend slices. Trying to pipeline these two features would just recreate artificial waiting.

**How to handle the single-CLI constraint during F17/F18:** revert to strict day/night *turn-taking* on the **same** shared task list rather than parallel feature tracks — e.g., CR's night session fixes backend-side integration bugs found during the day's E2E run; Rafia's day session fixes frontend-side ones found overnight. Same CLI-sharing rule applies (one session, one dev, one clear task list), but the "one feature ahead" rule is suspended for these two features only. This is called out explicitly in §12 (Final Operating System) so it doesn't get missed.

## **Reading the table correctly**

-   **"Backend starts→finishes"** in one cell means the entire feature's backend playbook is completed and merged within that single night session. If a feature is too large (F6, F12), it's explicitly split across two consecutive night sessions rather than silently assumed to fit.
-   **Frontend "integration"** always refers to swapping that feature's mock API layer for the real one and running the full flow per the App Flow doc's acceptance criteria — not first UI construction (which, per §2, may have started a cycle earlier against mocks).
-   **13 cycles for AI features (13–15)** assumes the underlying commerce spine (0–12) is fully stable first — this matches Doc 6's own sequencing logic (AI-completion as R1.1, built on a working MVP) and avoids building AI orchestration against a shifting foundation.

Say **CONTINUE** for #4 — Daily Work Plan.

# **4\. Daily Work Plan**

This translates the pipeline from §1–3 into an actual repeatable daily rhythm. This is the template both developers follow **every single cycle**, Feature 0 through Feature 16 (F17/F18 use the modified version noted at the end).

## **Standard Cycle Template**

### **🌙 NIGHT — CR (Backend) — Claude CLI window**

**Pre-session (10 min, before opening CLI):**

-   Pull main, confirm yesterday's Rafia PR merged clean.
-   Create/checkout tonight's feature branch: feat/be-f<N>-<short-desc>.
-   Open the night's assigned playbook (Feature N) alongside Schema (Doc 5 + §14/§15 addenda) and TRD.

**CLI session:**

1.  Load context: playbook N + relevant schema tables + relevant TRD module section only. (Not the whole doc set — see §6 for exact context rules.)
2.  Work the playbook task-by-task: models/migrations → repositories → services → controllers/routes → validation (Zod) → tests.
3.  Run tests locally after each major task block, not just at the end — catch failures while context is still fresh in the session.
4.  If schema needs a change mid-session (discovered gap), **do not silently improvise** — log it in docs/schema-change-log.md (see §11) and flag it for the addendum process, then proceed with the documented workaround for tonight only.

**Expected output by end of session:**

-   Feature N backend: all endpoints from the playbook implemented, Swagger-documented, tests passing, coverage ≥80% maintained.
-   Feature N marked BACKEND\_DONE in the shared tracker (§10 mechanics).

**Commits:**

-   Multiple small commits during the session (Conventional Commits: feat(api): ...), not one giant commit — this keeps the diff reviewable and gives Rafia granular history to read in the morning.
-   Final commit of the night: the **handoff commit** — includes an updated HANDOFF.md (template in §10) describing exactly what's ready, what changed in the API contract, and any deviations from the playbook.
-   Push branch, open PR against main, do **not** merge yet if Feature N-1's frontend integration is still pending review — but *do* merge if the previous feature's full cycle already closed (standard case).

### **☀️ DAY — Rafia (Frontend) — Claude CLI window**

**Pre-session (10 min, before opening CLI):**

-   Pull main, read last night's HANDOFF.md for Feature N.
-   Two possible states to check:
    -   **State A:** Feature N backend just landed → today is **integration day** for N.
    -   **State B:** Feature N backend isn't due yet (still N-1's cycle) → today is **mock-first UI construction** for the next feature in queue.
-   Checkout/create today's branch: feat/fe-f<N>-<short-desc>.

**CLI session (State A — Integration Day):**

1.  Load context: playbook N (frontend tasks only) + App Flow screens for N + the real API contract from last night's committed code (not guessed — read the actual DTOs/routes CR shipped).
2.  Swap the mock API layer for the real client.
3.  Wire forms, validation, loading/error/empty states per App Flow spec for each screen in N.
4.  Run through the feature's acceptance criteria (Doc 1 §14) as manual/automated checks.
5.  Component tests + accessibility (axe) check for AA compliance.

**CLI session (State B — Mock-First Construction Day):**

1.  Load context: playbook N+1 (frontend tasks) + App Flow screens + Schema (for shape only, no live API yet).
2.  Generate typed mock API layer matching expected DTOs.
3.  Build screens/components/routing against mocks.
4.  This work is **not mergeable to main as "done"** yet — it merges as a clearly-flagged in-progress branch, finished next cycle once real integration happens.

**Expected output by end of session:**

-   State A: Feature N fully integrated, tested, marked FEATURE\_COMPLETE in tracker.
-   State B: Feature N+1 UI scaffolded against mocks, marked FRONTEND\_SCAFFOLD\_DONE, ready for fast integration once backend lands.

**Commits:**

-   Multiple small commits (feat(web): ...) through the session.
-   Final commit: updated HANDOFF.md confirming integration status, any UI deviations from the App Flow spec (with reason), and screenshots/notes for CR if anything on the backend needs adjustment.
-   Push, open PR. If State A (integration complete + tested), this PR merges to main same day — closing the full cycle for Feature N.

## **Weekly Rhythm (illustrative — 7 cycles ≈ roughly one calendar week if running nightly)**

| **Day** | **Night (CR)** | **Day (Rafia)** |
| --- | --- | --- |
| Mon night → Tue day | F-N backend | F-N integration (or F-N+1 mock scaffold if N not ready) |
| --- | --- | --- |
| Tue night → Wed day | F-N+1 backend | F-N+1 integration |
| --- | --- | --- |
| Wed night → Thu day | F-N+2 backend | F-N+2 integration |
| --- | --- | --- |
| ... | ... | ... |
| --- | --- | --- |
| **Every 5th cycle** | **Reserve for buffer/catch-up** — no new feature; use for fixing any HANDOFF.md-flagged issues, running full regression, or absorbing a feature that ran long | Same |
| --- | --- | --- |

**Why a buffer cycle every 5:** in a two-person, single-agent pipeline, a single delayed session (illness, a feature running long, a schema surprise) with zero slack cascades through every subsequent cycle. Building in a periodic no-new-work buffer absorbs that without silently eating into F17/F18's calendar.

## **End-of-Day Checklist (both devs, every session — non-negotiable)**

-   \[ \] All tests passing locally before push
-   \[ \] HANDOFF.md updated (see §10 template)
-   \[ \] Feature status updated in shared tracker
-   \[ \] Branch pushed, PR opened
-   \[ \] If merging: CI green, no unresolved conflicts
-   \[ \] Claude CLI session's final message includes a **one-paragraph summary** of what was built — this becomes the raw material for the handoff note, so write it deliberately, not as an afterthought

## **Modified rhythm for F17 (Final Integration) and F18 (Testing & Deployment)**

As flagged in §3, these two features suspend the backend-ahead pipeline. The daily plan becomes:

-   **Shared task board** (not per-dev feature ownership) listing every cross-cutting bug/gap found during E2E runs.
-   Night session (CR): picks top unclaimed backend-side items off the board.
-   Day session (Rafia): picks top unclaimed frontend-side items off the board.
-   Same commit/handoff discipline applies, but HANDOFF.md during this phase logs **bugs closed**, not **features shipped**.

Say **CONTINUE** for #5 — Dependency Matrix.

# **5\. Dependency Matrix**

This section makes explicit, for every feature, exactly what must exist before it can start, what can run in parallel, and where hard blocking points are. This is the reference both devs check before starting any session to avoid guessing.

## **Notation**

-   **Hard dependency (⛔):** cannot start until the listed item is merged to main.
-   **Soft dependency (🟡):** can start UI/scaffolding work without it, but cannot integrate/finish without it.
-   **No dependency (✅):** fully parallel, no blocking relationship.

## **Feature-by-Feature Dependency Table**

| **Feature** | **Backend hard deps (⛔)** | **Frontend hard deps (⛔)** | **Frontend soft deps (🟡 — mock-first OK)** | **Can overlap with** |
| --- | --- | --- | --- | --- |
| **F0 — Foundation** | None | None | — | Nothing else — must complete first |
| --- | --- | --- | --- | --- |
| **F1 — Auth** | F0 (DB schema, Docker env) | F0 (app shell) | F1 backend contract | F2 backend can't start without F1's users table live, but F1 frontend UI can be scaffolded in parallel with F1 backend |
| --- | --- | --- | --- | --- |
| **F2 — Profiles** | F1 (users table + auth working) | F1 (login must work to reach profile screens) | F2 backend contract | F3 backend prep (reading schema) can begin once F2 DB tables exist |
| --- | --- | --- | --- | --- |
| **F3 — Store Mgmt** | F2 (seller\_profiles) | F2 (seller must be logged in) | F3 backend contract, payout\_wallets (§14.1) | F4 backend cannot start until F3's seller\_profiles/wizard-completion logic exists (products need a completed seller) |
| --- | --- | --- | --- | --- |
| **F4 — Product Mgmt** | F3 (seller onboarding complete) | F3 (store must exist to attach products) | F4 backend contract | F5 backend (search) needs F4's products table populated/structured, but can scaffold FTS setup once table exists, before all CRUD is finished |
| --- | --- | --- | --- | --- |
| **F5 — Buyer Marketplace** | F4 (products, categories) | F4 (products must exist to browse) | F5 backend contract | F6 (cart) can begin schema/logic work once products exists — doesn't need search to be finished, just the table |
| --- | --- | --- | --- | --- |
| **F6 — Cart & Checkout** | F5 not strictly required (only needs products), but sequenced after for realistic browse→cart flow | F5 (buyer needs to find a product to add to cart) | F6 backend contract | F7 (orders) is tightly coupled — checkout *creates* the order, so F6 and F7 backend are almost one unit; kept separate per your playbook boundaries but expect minimal gap |
| --- | --- | --- | --- | --- |
| **F7 — Orders** | F6 (checkout produces the order) | F6 (checkout must complete to have an order) | F7 backend contract | F8 (courier) needs F7's order + PAYMENT\_CONFIRMED state to trigger booking |
| --- | --- | --- | --- | --- |
| **F8 — Courier & Tracking** | F7 (orders table, order state machine) | F7 (order must exist) | F8 backend contract | F9 (notifications) can be built in parallel — it only needs *an event to fire*, not a finished courier flow; notification templates can be built against F7's order-lifecycle events directly |
| --- | --- | --- | --- | --- |
| **F9 — Notifications** | F7 (order events) minimum; enriched by F8 (tracking events) | Any feature producing events (F1 OTP, F7 order placed, F8 tracking) | F9 backend contract | Can start backend work as early as F7, doesn't strictly need F8 done — flagged as a scheduling opportunity if a cycle runs short |
| --- | --- | --- | --- | --- |
| **F10 — Returns & Refunds** | F7 (order must be delivered) | F7 (buyer needs a completed order to return) | F10 backend contract | F11 (analytics) doesn't need F10, can run independently once F7 exists |
| --- | --- | --- | --- | --- |
| **F11 — Analytics** | F7 (orders), F10 (optional — for return-rate metrics) | F7 (needs order history to show anything) | F11 backend contract, seller\_daily\_stats (§15.1) | Fully independent of F8/F9 — can be pulled forward if courier/notification work runs long |
| --- | --- | --- | --- | --- |
| **F12 — Payments & Admin Ops** | F6 (checkout initiates payment), F7 (settlement needs delivered orders) | F6, F7 | F12 backend contract, payout\_wallets (§14.1) | Admin-ops half (user mgmt, config, audit) has **no dependency on payments** at all — could theoretically be pulled earlier if needed, see note below |
| --- | --- | --- | --- | --- |
| **F13 — AI Store Builder** | F4 (products table, ai\_generated flag) | F4 (product creation flow must exist to attach AI generation to it) | F13 backend contract | Fully independent of F5–F12 — could technically be built any time after F4. Sequenced late here only because Doc 6 treats AI as R1.1-style core-completion, not because of a real technical block |
| --- | --- | --- | --- | --- |
| **F14 — AI Returns** | F10 (returns workflow), returns\_confidence\_threshold config | F10 (manual-review UI must exist first) | F14 backend contract | Independent of F11/F12/F13 — only real dependency is F10 |
| --- | --- | --- | --- | --- |
| **F15 — AI Analytics** | F11 (seller\_daily\_stats must exist to derive recommendations from) | F11 (analytics dashboard must exist to show cards on) | F15 backend contract, seller\_recommendations (§15.2) | Hard dependency on F11 specifically, nothing else |
| --- | --- | --- | --- | --- |
| **F16 — External APIs** | All adapter-consuming features (F6 payments, F8 courier, F9 SMS) should exist so live-adapter interfaces have something real to validate against | Same | — | Mostly backend-only work; frontend has minimal surface here (maybe an admin toggle for adapter mode) |
| --- | --- | --- | --- | --- |
| **F17 — Final Integration** | **Everything** (F0–F16 backend) | **Everything** (F0–F16 frontend) | — | Nothing — this is the convergence point, pipeline suspended per §3/§4 |
| --- | --- | --- | --- | --- |
| **F18 — Testing & Deployment** | F17 | F17 | — | Nothing |
| --- | --- | --- | --- | --- |

## **Explicit answers to your three framing questions**

**"Frontend cannot begin until \_\_\_\_\_\_\_"** Frontend UI *construction* almost never has a hard blocker — Schema + App Flow are enough to start scaffolding for nearly any feature at any time. Frontend *integration* cannot begin until the corresponding backend feature is merged to main with its handoff note confirming BACKEND\_DONE.

**"Backend depends on \_\_\_\_\_\_\_"** Backend depends **only on other backend features**, in this order-of-truth: F0 → F1 → F2 → F3 → F4 → (F5 ∥ F6-prep) → F6 → F7 → (F8 ∥ F9) → F10 → (F11 ∥ F12) → F13 → F14 → F15 → F16 → F17 → F18. Backend never depends on frontend for anything — this is by design and is what keeps CR's night sessions never blocked.

**"Frontend can continue independently after \_\_\_\_\_\_\_"** Once a feature's mock API layer is built (Day 1 of that feature's frontend work), Rafia can continue independently for the rest of that session regardless of backend progress — she only re-syncs with backend reality at the integration step.

## **Overlap Opportunities (features that CAN run out of strict numeric order if a cycle frees up)**

These are the pairs where the dependency table above shows no real technical blocker, only playbook-numbering order — useful if you ever need to reshuffle to absorb a delay:

-   **F9 (Notifications)** only needs F7, not F8 — could be pulled forward if F8 (courier, more complex) is running long.
-   **F11 (Analytics)** only needs F7 — could run in parallel with F8/F9/F10 if you ever wanted to double up (not recommended under a single-CLI constraint, but useful to know if reordering).
-   **F13 (AI Store Builder)** only needs F4 — technically could be built right after F4/F5 instead of waiting until Cycle 16. Kept late here to match Doc 6's MVP-first philosophy (commerce spine before AI layer), but if AI Store Builder is your flagship demo feature and you want it working early for stakeholder confidence, this is the one candidate worth reordering.
-   **F12's admin-ops half** (user mgmt, config, audit log) has zero dependency on payments — could be split out and built earlier if needed for demo purposes.

## **Hard Blocking Points (never reorder these)**

-   F0 before literally everything.
-   F1 before F2 (no profile without auth).
-   F3 before F4 (no product without a completed seller).
-   F6 before F7 (order is *created by* checkout).
-   F7 before F8/F9/F10/F11 (everything downstream needs an order to exist).
-   F10 before F14 (AI returns needs the manual workflow to route into).
-   F11 before F15 (AI analytics needs the rollup table populated).
-   F0–F16 before F17, F17 before F18.

Say **CONTINUE** for #6 — AI Prompt Workflow.

# **6\. AI Prompt Workflow**

This is the operating discipline for the actual moment-to-moment use of Claude CLI — the layer beneath §2's strategy and §4's daily rhythm. Get this wrong and every other part of the plan degrades, because a single shared agent that drifts or forgets context costs you real calendar time to recover from.

## **When to Start a New Claude CLI Session**

Start a **new session** at every one of these boundaries — never continue an old session across them:

1.  **Every feature boundary.** Finishing F3 backend and starting F4 backend = new session, always, even if it's the same night and there's time left. A session that has "F3 done" in its history will subtly bias how it approaches F4 — better to start clean and load only what F4 needs.
2.  **Every day/night handoff.** CR's night session never continues into Rafia's day session, even conceptually — they are different people, different concerns (backend vs frontend), different context needs. This is automatic under your workflow (different physical people using the CLI), but worth stating as a rule so no one is tempted to "just keep the conversation going" by pasting the previous session's transcript in.
3.  **After any major correction or false start.** If a session goes sideways — the agent misunderstands the playbook, produces something that needs significant rework, or you find yourself repeatedly re-explaining the same constraint — **kill the session and start fresh** rather than trying to course-correct deep into a confused context. A confused agent doesn't "snap out of it" by being told "no, actually do X" three times; it accumulates contradictory history that makes things worse. Cheaper to restart with a clean, well-formed prompt than to argue a bad session back on track.
4.  **When switching between playbook task-types within a large feature** (e.g., F12 Payments — moving from "build the settlement engine" to "build the admin config panel"). These are different enough concerns within the same feature that a fresh session with narrower context outperforms one long session trying to hold both in mind.

## **When to Continue the Same Session**

Only within a single, coherent unit of work:

-   Moving through a playbook's tasks **in the order the playbook lists them**, for the same feature, same codebase area (backend-only or frontend-only).
-   Fixing a bug or test failure that the *same session* just introduced — e.g., you asked it to build the returns service, tests fail, you paste the failure back in the same session. This is the one case where continuing is clearly better than restarting, because the fix requires the exact context of what was just built.
-   Iterating on a single component/endpoint's shape based on immediate review feedback (see "how to review" below) before moving to the next task.

**Rule of thumb:** if what you're about to ask requires the agent to remember something from more than ~30–45 minutes ago in the same session, or from a different feature, don't rely on session memory — restate it explicitly in the new prompt instead (see "how much context" below).

## **How Much Context to Provide Per Session**

**Standard context load for every session (this is the floor, not negotiable):**

1.  The single feature's playbook (Feature N only — never adjacent features "just in case").
2.  The specific Schema tables/sections that feature touches (not the whole 15-section doc — name the tables: e.g., "orders, order\_items, payments, settlements — see §4.10–4.13 and addendum §14.2").
3.  The specific TRD section relevant to that feature's module (e.g., §5.1 stack table + §12 folder structure for that module — not the entire TRD).
4.  For frontend sessions: the specific App Flow screens for that feature (e.g., "SCR-S02 AI Store Builder" — not all 34 screens).
5.  **The previous feature's HANDOFF.md** (see §10) — this is what tells the agent "here's what already exists that you'll be building on top of," without needing to re-paste entire prior codebases.

**What to explicitly exclude:**

-   Other features' playbooks.
-   The full PRD (business rationale isn't needed to write code against an already-decided spec — if a "why" question comes up, answer it yourself from the PRD rather than loading the whole document into the agent's context).
-   Prior sessions' full transcripts. Ever. Handoff notes exist specifically so you never need to do this.

**Why this matters more for you than a typical team:** with one shared agent and no calendar slack, every token of irrelevant context is time spent on the agent parsing things it doesn't need, and — more importantly — a real risk vector for it blending unrelated feature logic together. Narrow context isn't just efficient, it's a correctness safeguard given your specific single-agent, high-feature-count situation.

## **When to Attach the Execution Playbook**

**Always, every session, no exceptions.** The playbook is the actual spec — it's what makes this "execution," not "improvisation." A session started without its playbook attached is a session where the agent is guessing at scope, and guessed scope is exactly what causes feature-boundary violations (e.g., backend accidentally building something that was supposed to be Feature N+2's job) that are expensive to unwind later.

Attach it **first**, before any other context — it should frame everything else the agent reads.

## **How to Prevent Context Drift**

Context drift — the agent slowly losing track of established patterns/decisions as a session or project progresses — is your single biggest risk across a 19-feature build. Concrete countermeasures:

1.  **The HANDOFF.md chain is your drift-prevention backbone.** Every session reads the immediately-prior handoff before starting, which re-anchors the agent to current reality instead of its training-data assumptions about "how an e-commerce app is usually built."
2.  **Never let a session infer a decision that's already been made.** If the schema addenda (§14/§15) already decided that settlements.gross = subtotal, state that explicitly in the prompt rather than letting the agent re-derive it — even though it's "obvious" from the schema, restating locked decisions in-prompt costs one sentence and eliminates a whole class of subtle inconsistency.
3.  **Maintain a single living docs/decisions-log.md** (distinct from HANDOFF.md) — a running list of every ad-hoc decision made *during* implementation that wasn't already in the six blueprint docs (e.g., "we chose to validate wallet format with regex X" or "pagination default changed to 25, not 20"). Attach the relevant excerpt of this log when starting a session for a feature that touches the same area. This is what stops Cycle 14's backend session from contradicting a naming/pattern choice Cycle 3 made.
4.  **Re-state cross-feature invariants explicitly whenever they're relevant**, even though they're "already decided" — specifically: the BigInt→string serialization rule (§15.4), the append-only financial tables list (§8 of Schema), the ownership/RBAC pattern (TRD §8/§9). These are exactly the kind of global rules that get silently dropped three features later if not actively re-surfaced.

## **How to Keep Generated Code Consistent**

1.  **Lock conventions in Cycle 1 (F0) and never deviate without updating the decisions log.** Folder structure, naming (camelCase/snake\_case per TRD §13), error-handling pattern (typed error hierarchy per TRD §14), response envelope shape (TRD §9) — all get established once, early, and every subsequent session is explicitly told "follow the existing pattern in apps/api/src/core/errors/" rather than being asked to invent its own each time.
2.  **Point the agent at a real existing file as a pattern reference**, not just a written rule. "Build the returns service following the same structure as apps/api/src/modules/order/order.service.ts" produces far more consistent output than a written style guide alone — concrete precedent beats abstract instruction with LLM-generated code.
3.  **First feature of each "type" is the template.** F2 (Profiles) sets the pattern for all subsequent CRUD-heavy backend modules; F5 (Marketplace/Search) sets the pattern for all subsequent read-heavy/filtered-list frontend screens. Explicitly tell later sessions which earlier feature to mirror.

## **How to Review Generated Code**

Given you only have one shared agent and limited review bandwidth, review has to be efficient, not exhaustive-by-hand:

1.  **Automated first pass, always:** lint, type-check, test suite, coverage gate — before a human looks at anything (this is already in your Definition of Done from Doc 6 §22; keep it as the hard gate here too).
2.  **Human review focuses only on what automation can't catch:** does this match the playbook's actual intent (not just "does it run"), does it follow the established pattern from step 2 above, does it correctly implement the specific business rule (e.g., is commission really calculated on subtotal per §14.2, not total\_amount).
3.  **The *other* developer is the reviewer, not the same person who prompted the session.** CR reviews Rafia's frontend PR the following night before starting new backend work (5–10 min, not a deep dive — she's checking contract adherence, not re-litigating UI decisions); Rafia reviews CR's backend PR each morning before starting integration (this is a natural byproduct of §4's integration step — she has to understand the API anyway, which doubles as review).
4.  **When in doubt about correctness of a business rule, check it against the source doc directly** (Schema addenda, PRD REQ-ID, or the playbook) rather than trusting either the agent's implementation or your own memory — this project has enough cross-referenced precision (REQ-IDs, addenda) that "check the doc" is almost always faster than debating from memory.

Say **CONTINUE** for #7 — Git Strategy.

# **7\. Git Strategy**

The Git model has to do real work here beyond "keep history clean" — it's the mechanism that makes the day/night pipeline in §1–4 actually safe, since backend and frontend are being built by different people at different times against a shared main. Get the branching wrong and you reintroduce exactly the merge-conflict risk the whole pipeline was designed to avoid.

## **Base Model: GitHub Flow, Extended with a Feature-Track Convention**

Doc 6 already specifies GitHub Flow (§20) — short-lived branches off a protected main, PR + CI + review to merge. That's the right base for a two-person team. What needs to be added on top, specific to your day/night pipeline, is a **branch-naming convention that encodes owner + area + feature**, so it's instantly obvious from git branch -a alone who owns what and whether it's safe to start touching a given area.

## **Branch Naming**

feat/be-f<N>-<short-desc> → CR, backend, Feature N

feat/fe-f<N>-<short-desc> → Rafia, frontend, Feature N

fix/be-f<N>-<short-desc> → backend bugfix within a feature

fix/fe-f<N>-<short-desc> → frontend bugfix within a feature

chore/<short-desc> → tooling, CI, non-feature work

docs/<short-desc> → doc updates (HANDOFF.md doesn't count — see below)

Examples: feat/be-f7-order-state-machine, feat/fe-f7-order-detail-screen, fix/be-f6-idempotency-key-bug.

**Why the be-f<N> / fe-f<N> prefix matters specifically for you:** with two people sharing one main and a strict day/night rhythm, this prefix is what lets either dev glance at open branches/PRs and instantly know "is this mine to build on, or someone else's in-flight work I should leave alone." It's a cheap convention that directly prevents the exact confusion a shared-agent, alternating-shift team is prone to.

## **Commit Frequency**

-   **Small, frequent commits within a session** — one commit per playbook task completed, not one giant commit at session end. Conventional Commits format throughout (feat(api): add order state machine, feat(web): wire checkout to real API).
-   **Never one squashed "did the whole feature" commit until the final PR squash-merge.** Granular commits during the session are what make the *next* session's git log readable when someone (including future-you) needs to understand exactly what happened and why, without re-reading the whole diff.
-   **The final commit of every session is always the handoff commit** — updates HANDOFF.md, no code changes bundled into it. Keeping this separate means anyone can find "what changed in the contract" without digging through feature commits.

## **Pull Request Timing**

-   **Open the PR early — at the start of the session, as a draft**, not at the end. This lets CI start running incrementally and gives the other dev visibility into in-progress work without needing a Slack message — they can see the diff building in real time if they check.
-   **Mark PR "Ready for review" only when the feature is fully done per the playbook** (backend: all endpoints + tests + Swagger; frontend: full integration + acceptance criteria pass) — not partial.
-   **Backend PRs are opened by CR at the end of her night session**, ready for Rafia to review as literally the first thing she does each morning (this doubles as her required context-load for that day's integration work — see §6).
-   **Frontend PRs are opened by Rafia at the end of her day session**, ready for CR to glance at that night before starting new backend work (quick contract-adherence check, not deep review).

## **Merge Timing**

**The core rule: merge backend before its corresponding frontend integration begins, every time, no exceptions.**

-   CR's backend PR for Feature N merges to main **before** Rafia starts her integration session for N. In practice this means: CR merges her own PR at the end of her night session (after CI passes) — she doesn't wait for Rafia to review-then-merge, because that would reintroduce the exact blocking she's supposed to be immune from. Rafia's morning review happens *after* merge, as a follow-up check, not a merge gate.
-   **Exception — payment/settlement/schema-touching backend PRs:** per Doc 6 §21, these get the "mentor/lead review" treatment. Since you don't have a third person, this means: for anything touching money (F6 part 2, F7, F12) or a live schema migration, CR should self-review against the checklist in §21 with extra care before merging, and flag it explicitly in HANDOFF.md as "financial/schema-sensitive — reviewed against Doc 5 §14.2 gross/commission rule" so Rafia knows to double-check that specific area rather than skimming.
-   **Frontend PR for Feature N merges once integration is verified against the App Flow acceptance criteria** — same day, by Rafia, at the end of her session. This closes the full cycle for that feature.
-   **Never let a feature's frontend PR sit un-merged into the next night's backend session.** If Rafia's integration ran long and isn't finished by end-of-day, that's fine — it merges the next morning instead — but CR still proceeds to Feature N+1 backend regardless (the whole point of the pipeline is that backend never waits).

## **Conflict Avoidance**

Given the branch-naming + timing rules above, conflicts should be structurally rare, but here's why and what remains:

-   **Backend and frontend touch almost entirely disjoint file trees** (apps/api/\*\* vs apps/web/\*\*), so even without perfect timing, most changes don't collide at the file level.
-   **The only real collision surface is packages/shared/** (shared TS types/enums, per TRD §12) — when backend adds/changes a type here, frontend needs it. **Rule:** any change to packages/shared/ is called out explicitly, by name, in that night's HANDOFF.md — Rafia pulls main before starting specifically because of this, never works from a stale local branch that predates a shared-types change.
-   **Two people never work on the same feature's same-area code simultaneously** — enforced automatically by the day/night split, but worth stating: if you ever deviate from the standard rhythm (e.g., both working during F17/F18's shared-task-board mode), make sure the task board explicitly assigns individual files/areas per person to prevent two people editing the same file in the same window.
-   **Migrations are the one place a "conflict" can be silent rather than a Git merge conflict** — two schema changes in sequence can both apply cleanly to Git but produce a broken migration order. Mitigation: only CR touches prisma/migrations/ (frontend never has a reason to), and every migration is reviewed against the addenda (§14/§15) before being written, per the reversibility discipline already in Doc 6 §12/§20.

## **Who Merges First**

**Backend, always, for every feature.** This isn't a coin-flip convention — it's a direct consequence of the whole pipeline design: frontend integration is *defined* as "build against what backend already merged." If frontend ever merged first, it would mean frontend was integrated against unmerged, potentially-changing backend code — exactly the risk the mock-first/integration-after-merge discipline in §2 and §4 was built to eliminate.

The only exception is F0 (§3's table shows both halves as independent, no cross-dependency) — either can merge first there, since F0 frontend/backend genuinely don't touch each other.

Say **CONTINUE** for #8 — Frontend Workflow (complete, per-feature, for Rafia).

# **8\. Frontend Workflow (Rafia — Complete, Per-Feature)**

This is Rafia's operating manual — the concrete answer to "what do I actually do" for every one of the 19 features, building on the daily template from §4 but broken out feature-by-feature so nothing is ambiguous when she sits down each day.

## **Standing Rules (apply to every feature below, stated once)**

-   **Always start by reading HANDOFF.md** from last night's CR session before opening Claude CLI.
-   **Always check State A vs State B** (§4): is today's target feature's backend merged, or still pending? This determines whether today is integration or mock-scaffold work.
-   **Always load: this feature's playbook + relevant App Flow screens + Design tokens/component library (once F0 establishes them) + last handoff note.**
-   **Commit granularly, open PR as draft at session start, mark ready-for-review only when integration passes acceptance criteria.**

## **Feature-by-Feature Frontend Workflow**

### **F0 — Project Foundation**

-   **Begins:** Cycle 1, immediately, in parallel with backend F0 (no dependency).
-   **When to wait:** never — nothing here depends on backend.
-   **Mock APIs:** n/a, this feature has no API surface.
-   **What gets built:** Vite + React + TS scaffold, AntD ConfigProvider + RTL setup, i18n (UR/EN) with Noto Nastaliq font loading, base routing, design tokens from the (already-approved, separate) UI/UX Brief, shared component shells (empty states, skeletons, toasts).
-   **Integrate:** wire the app shell to hit the backend's /health endpoint once F0 backend lands, to prove Docker Compose + Nginx routing works end-to-end.
-   **Test:** visual check in both languages, RTL rendering confirmed on a real screen (not just devtools), Lighthouse/axe baseline pass.
-   **Commit:** end of Cycle 1/2 boundary once /health check passes.

### **F1 — Authentication & Authorization**

-   **Begins:** Cycle 2, mock-first (backend not ready until end of Cycle 2 night).
-   **When to wait:** integration waits until F1 backend HANDOFF.md confirms BACKEND\_DONE.
-   **Mock APIs:** mock register/OTP/login/refresh/logout matching TRD §7's token shapes.
-   **What gets built:** SCR-A01–A04 (Register, OTP Verify, Login, Forgot/Reset Password) — role toggle, OTP 6-box input with countdown, password strength meter, lockout messaging.
-   **Integrate:** swap to real endpoints, verify full register→verify→login→refresh→logout cycle, confirm 401/403 redirect behavior (global rule from AppFlow §0).
-   **Test:** all AC from PRD §14 "Epic: Auth & Accounts"; lockout-after-5-fails; suspended-account messaging.
-   **Commit:** Cycle 3.

### **F2 — User Profiles**

-   **Begins:** Cycle 3 (backend just landed same cycle it's needed — check State A/B).
-   **What gets built:** buyer address book CRUD, seller profile view (pre-wizard).
-   **Integrate:** wire address CRUD, default-address selection logic.
-   **Test:** CRUD flow generic pattern (AppFlow §6.8) — create/read/update/soft-delete all confirmed.
-   **Commit:** Cycle 4.

### **F3 — Store Management**

-   **Begins:** Cycle 4, mock-first.
-   **What gets built:** SCR-S00 Store-Setup Wizard — stepper UI, wallet-add form (against payout\_wallets, §14.1 — multiple wallets, set-default), resumable step state (against onboarding\_step, §15.6).
-   **Integrate:** verify partial-completion persistence — leave mid-wizard, reload, confirm it resumes at the correct step (this is the exact behavior §15.6 was added to support — test it specifically).
-   **Test:** wizard AC, wallet format validation, resumability.
-   **Commit:** Cycle 5.

### **F4 — Product Management**

-   **Begins:** Cycle 5, mock-first.
-   **What gets built:** SCR-S03 (Products list/management), SCR-S04 (Product Edit) — **not** SCR-S02 (AI Store Builder — that's F13, deferred). Note: since AI Store Builder is F13 per your playbook split, F4's "Add Product" here should be the *manual* fallback path only (title/price/stock/category form), not AI generation.
-   **Integrate:** wire product CRUD, stock/oversell display, soft-delete-with-active-orders-guard behavior.
-   **Test:** oversell prevention, out-of-stock hide-from-storefront behavior.
-   **Commit:** Cycle 6.

### **F5 — Buyer Marketplace**

-   **Begins:** Cycle 6, mock-first.
-   **What gets built:** SCR-B01 (Home), SCR-B02 (Search Results/Browse), SCR-B03 (Product Detail) — autocomplete, filters, sort, infinite scroll.
-   **Integrate:** wire to real tsvector FTS endpoint, confirm Urdu query matching, confirm out-of-stock hidden by default.
-   **Test:** search <1s target (informal check, real perf testing is F18), filter/sort AC.
-   **Commit:** Cycle 7.

### **F6 — Cart & Checkout**

-   **Begins:** Cycle 8 (backend split across two nights per §3 — this is a "complex" screen per AppFlow, budget the full cycle).
-   **What gets built:** SCR-B04 (Cart, grouped by seller) and SCR-B05 (Checkout — address, payment method, shipping line, split-order preview).
-   **Integrate:** Cycle 9 — wire persisted cart (cross-device — test by logging in on two sessions), multi-seller split-at-checkout, idempotency-key-protected submit (no double-submit on double-click).
-   **Test:** full PRD §14 "Epic: Cart & Checkout" AC — two-seller split creates two orders, below-minimum blocked, COD shows shipping as separate line.
-   **Commit:** Cycle 9.

### **F7 — Orders**

-   **Begins:** Cycle 9, mock-first (parallel with F6 integration if timing is tight — otherwise sequential per State A/B check).
-   **What gets built:** SCR-S05 (seller Order Management, tab-mapped states), SCR-B07 (buyer My Orders), SCR-B06 (Order Confirmation).
-   **Integrate:** Cycle 10 — wire tab filters to real order\_status enum groupings, confirm PENDING\_MANUAL\_LOGISTICS alert badge shows correctly.
-   **Test:** status-tab AC, empty-state-per-tab.
-   **Commit:** Cycle 10.

### **F8 — Courier & Tracking**

-   **Begins:** Cycle 10, mock-first.
-   **What gets built:** SCR-S06 (Order Detail + Courier Booking — recommended-courier card, override dropdown, Confirm & Book), SCR-B08 (authenticated tracking, timeline + map), SCR-B09 (public login-free tracking page).
-   **Integrate:** Cycle 11 — wire WebSocket live-push (test with two browser tabs — book courier in one, watch tracking update live in the other without refresh), confirm map-down text-fallback degradation.
-   **Test:** one-click booking AC, override logging, 3-failed-polls in-app alert.
-   **Commit:** Cycle 11.

### **F9 — Notifications**

-   **Begins:** Cycle 11, mock-first.
-   **What gets built:** in-app notification bell (unread count, chronological list), SCR-S10/SCR-B12 notification-preferences tabs (critical toggles locked on).
-   **Integrate:** Cycle 12 — confirm bell updates on real lifecycle events, confirm critical notifications can't be disabled in the UI.
-   **Test:** template rendering in both UR/EN.
-   **Commit:** Cycle 12.

### **F10 — Returns & Refunds**

-   **Begins:** Cycle 12, mock-first.
-   **What gets built:** SCR-B10 (Returns Wizard — stepper, ≥3 photo upload, Next-disabled-until-3-photos), SCR-B11 (Return Status/Appeal), SCR-S07 (seller Returns view, manual-review state).
-   **Integrate:** Cycle 13 — wire 14-day-window check, one-return-per-order block, appeal submission.
-   **Test:** full PRD §14 "Epic: Returns" AC.
-   **Commit:** Cycle 13.

### **F11 — Analytics Dashboard**

-   **Begins:** Cycle 13, mock-first.
-   **What gets built:** SCR-S08 — revenue cards, trend chart, top-products table, date-range filter (7d/30d/3m/custom).
-   **Integrate:** Cycle 14 — wire to seller\_daily\_stats rollup endpoint (§15.1), confirm <3s reload target informally, confirm sparse-data (new seller) empty state.
-   **Test:** date-range AC, empty-state for zero-order sellers.
-   **Commit:** Cycle 14.

### **F12 — Payments & Admin Operations**

-   **Begins:** Cycle 15, mock-first.
-   **What gets built:** SCR-S09 (Wallet/Payout Settings — wallet list, settlement history, COD remittance ledger), full Admin Console (SCR-AD01–AD08: dashboard KPIs, user mgmt, payment release, disputes queue, moderation, config panel, audit log viewer).
-   **Integrate:** Cycle 16 — wire payout wallet CRUD against payout\_wallets (§14.1), confirm settlement records render as immutable/read-only, confirm admin override actions require mandatory reason field before submit is enabled.
-   **Test:** immutability display (no edit affordance on settled records), audit-log completeness.
-   **Commit:** Cycle 16.

### **F13 — AI Store Builder**

-   **Begins:** Cycle 16, mock-first.
-   **What gets built:** SCR-S02 — drag-drop upload, AI-progress bar, all-fields-locked-during-generation, editable bilingual fields, Retry-on-failure.
-   **Integrate:** Cycle 17 — wire to real ai-service endpoint, confirm 30s soft-target progress bar honesty, confirm GPT-3.5 fallback is silent to the seller (no visible difference in UI when fallback triggers).
-   **Test:** full PRD §14 "Epic: AI Store Builder" AC — AC1–AC4.
-   **Commit:** Cycle 17.

### **F14 — AI Returns**

-   **Begins:** Cycle 17, mock-first.
-   **What gets built:** AI-assessment badge + image-analysis report added to SCR-S07/SCR-B10, "AI is reviewing your return… (≤60s)" loading state.
-   **Integrate:** Cycle 18 — wire confidence-threshold routing, confirm low-confidence/failed cases visibly land in manual-review state for both seller and admin.
-   **Test:** REQ-F-Return-004/007 AC — auto-decision above threshold, manual routing below.
-   **Commit:** Cycle 18.

### **F15 — AI Analytics**

-   **Begins:** Cycle 18, mock-first.
-   **What gets built:** AI Recommendation card on SCR-S08, dismiss action (14-day suppression).
-   **Integrate:** Cycle 19 — wire to seller\_recommendations (§15.2), confirm dismissed card doesn't reappear until the 14-day window passes (can be tested by manipulating dismissed\_until directly in a dev DB).
-   **Test:** REQ-F-Analytics-004 AC.
-   **Commit:** Cycle 19.

### **F16 — External APIs**

-   **Begins:** Cycle 19, minimal frontend surface (mostly backend-only per §5's dependency table).
-   **What gets built:** if applicable, an admin-facing adapter-mode indicator/toggle (dev/staging convenience, not end-user-facing).
-   **Integrate:** trivial — confirm the indicator reflects ADAPTER\_MODE correctly.
-   **Commit:** Cycle 19, same day as backend.

### **F17 — Final Integration**

-   **Begins:** Cycle 20, shared-task-board mode (§3, §4 modified rhythm).
-   **What gets built/fixed:** cross-feature E2E bugs pulled from the shared board — frontend-side items only.
-   **Test:** full end-to-end journeys per AppFlow §1 and §7's textual flowchart, walked manually screen-by-screen.
-   **Commit:** continuous throughout Cycles 20–21.

### **F18 — Testing & Deployment**

-   **Begins:** Cycle 22, shared-task-board mode.
-   **What gets built/fixed:** accessibility AA audit fixes, cross-browser/platform fixes (Doc 6's REQ-NF-Quality-009 matrix), any UI-side findings from the OWASP review, RTL/UR final polish pass.
-   **Test:** the E2E/Cypress suite itself (frontend half), full cross-platform matrix.
-   **Commit:** continuous throughout Cycles 22–24.

Say **CONTINUE** for #9 — Backend Workflow (complete, per-feature, for CR).

# **9\. Backend Workflow (CR — Complete, Per-Feature)**

CR's operating manual — the mirror of §8, covering repository/database/service/controller/DTO/validation/testing/integration work for all 19 features. Since backend always leads (§1's core rule), this workflow never has a "wait" state — CR always has the next playbook ready.

## **Standing Rules (apply to every feature below, stated once)**

-   **Always start by confirming the previous night's PR merged clean to main** before branching.
-   **Always load: this feature's playbook + relevant Schema sections/tables (including §14/§15 addenda where they touch this feature) + relevant TRD module section + previous HANDOFF.md.**
-   **Standard task order per feature, every time:** Prisma models/migration → repository layer → service layer (business logic) → controller/routes → DTO + Zod validation → tests → Swagger docs → handoff note.
-   **Never merge a feature that doesn't hit ≥80% coverage** (Doc 6 DoD, non-negotiable even under schedule pressure — a coverage gap compounds into every downstream feature that builds on shaky code).
-   **Self-review financial/schema-sensitive PRs extra carefully** before merging solo (§7) — flag explicitly in HANDOFF.md when this applies.

## **Feature-by-Feature Backend Workflow**

### **F0 — Project Foundation**

-   **Repository work:** n/a yet — this feature *creates* the repository pattern's home (apps/api/src/modules/\*/, apps/api/src/core/\*).
-   **Database work:** full schema.prisma authored from Doc 5 §1–§13 **plus** addenda §14/§15 in full — this is the single most important session of the whole project, since every later feature inherits whatever's decided here. Run the initial migration, seed categories + platform\_config defaults.
-   **Services/Controllers/DTOs:** adapter layer skeleton (D2) — interfaces + MockAdapter stubs for payment/courier/SMS/WhatsApp/maps, ADAPTER\_MODE factory, error hierarchy (TRD §14), pino logger + correlation IDs, response envelope helper, Zod validation harness, Redis + BullMQ wiring, Socket.IO stub.
-   **Validation:** establish the Zod pattern here — this is the template every later feature's DTOs will mirror.
-   **Testing:** CI smoke test (all services boot, /health responds), adapter-factory unit test (mock↔live selection).
-   **Integration:** none needed — no frontend dependency for this feature.
-   **Commit:** end of Cycle 1.

### **F1 — Authentication & Authorization**

-   **Repository work:** UserRepository, RefreshTokenRepository.
-   **Database work:** confirm users, refresh\_tokens tables migrated (already in F0's schema, this is just the first feature to *use* them).
-   **Services:** OTP generation/verify (Redis-backed, hashed, TTL), bcrypt password hashing (cost 12), JWT RS256 issue/verify, refresh rotation + jti Redis denylist, lockout counter logic.
-   **Controllers:** /auth/register, /auth/verify-otp, /auth/login, /auth/refresh, /auth/logout, /auth/forgot-password, /auth/reset-password.
-   **DTOs/Validation:** phone/email format, password complexity (≥8, upper/lower/digit/special), OTP 6-digit shape.
-   **Testing:** OTP lifecycle, lockout-after-5-fails, token rotation, revocation-on-suspend, RBAC denial (401/403) cases.
-   **Integration note in handoff:** exact token payload shape (sub, role, jti), cookie name/flags for refresh token — Rafia needs this precisely.
-   **Commit:** Cycle 2.

### **F2 — User Profiles**

-   **Repository work:** BuyerProfileRepository, SellerProfileRepository, AddressRepository.
-   **Services:** profile read/update, address CRUD with default-address logic, ownership checks (buyer can only touch own addresses).
-   **Controllers:** /profile/buyer, /profile/seller, /addresses CRUD.
-   **Validation:** address fields (city/province required for later courier matching — flag this dependency explicitly, per §14.4's plain-city rule).
-   **Testing:** ownership-violation returns 403, default-address-swap transaction correctness.
-   **Commit:** Cycle 3.

### **F3 — Store Management**

-   **Repository work:** extend SellerProfileRepository, new PayoutWalletRepository (per §14.1 addendum table).
-   **Database work:** if F0's migration didn't already include payout\_wallets/onboarding\_step (it should have, per addenda being part of the schema from day one) — confirm here, don't re-migrate.
-   **Services:** store-setup wizard step-tracking logic (onboarding\_step increments, §15.6), wallet add/set-default (only-one-default-per-seller transaction, §14.1's stated rule).
-   **Controllers:** /seller/setup, /seller/wallets CRUD.
-   **Testing:** resumability (partial completion persists across sessions), wallet-default-swap transaction, onboarding\_completed\_at correctly blocks selling features until set (REQ-F-Auth005 enforcement).
-   **Commit:** Cycle 4.

### **F4 — Product Management**

-   **Repository work:** ProductRepository, ProductImageRepository.
-   **Services:** CRUD, atomic stock decrement (REQ-F-Inv-001), oversell guard, soft-delete-with-active-orders-block, image upload + server-side magic-byte validation (Sec-012) + compression pipeline hookup.
-   **Controllers:** /seller/products CRUD, /seller/products/:id/images.
-   **Testing:** oversell prevention under concurrent requests (this is a real race condition — test with parallel requests, not just sequential), soft-delete-blocks-hard-delete-with-orders.
-   **Commit:** Cycle 5.

### **F5 — Buyer Marketplace**

-   **Repository work:** ProductRepository extended with search methods.
-   **Database work:** confirm search\_vector generated column + GIN index live (from F0's migration), verify unaccent extension enabled.
-   **Services:** FTS query builder (UR/EN via 'simple' config per Schema §7), filter/sort composition, autocomplete (short-TTL cached).
-   **Controllers:** /products/search, /products/autocomplete, /categories.
-   **Testing:** Urdu-query and English-query both hit the GIN index correctly, filter combination correctness, out-of-stock excluded from default results.
-   **Commit:** Cycle 6.

### **F6 — Cart & Checkout (split across two nights, Cycles 7–8)**

-   **Cycle 7 — Repository/Services (Part 1):** CartRepository, CartItemRepository; persisted-cart logic (buyer\_id-scoped, cross-device by design since it's DB-backed not session-backed); multi-seller split-at-checkout algorithm (group cart items by seller → one draft order per seller).
-   **Cycle 8 — Controllers/Payment kickoff (Part 2):** /cart CRUD, /checkout — address collection, payment-method selection, min-order enforcement (PKR 100, per-resulting-order not per-cart), idempotency-key middleware on the checkout POST, mock payment adapter invocation.
-   **Testing:** two-seller cart produces exactly two orders each with correct shipping line; idempotency key blocks duplicate submission; below-minimum blocked with correct error code (STOCK\_INSUFFICIENT-style stable error strings per TRD §9).
-   **This is a financial/schema-sensitive feature — self-review extra carefully before merging, flag in handoff.**
-   **Commit:** Cycle 9.

### **F7 — Orders**

-   **Repository work:** OrderRepository, OrderItemRepository.
-   **Services:** order state machine (single source of valid transitions, TRD §3's stated pattern), status-transition writes to tracking\_events **per the §15.3 binding rule** — every status change, not just courier ones.
-   **Controllers:** /seller/orders, /buyer/orders, /orders/:id.
-   **Testing:** invalid state transitions rejected, every transition produces a tracking\_events row (explicitly test this — it's the addendum's binding rule and easy to forget in a rushed session).
-   **Commit:** Cycle 10.

### **F8 — Courier & Tracking**

-   **Repository work:** CourierQuoteRepository, TrackingEventRepository.
-   **Services:** parallel courier-adapter calls (Promise.all, 10s timeout each per REQ-F-Logistics-002), weighted scoring (40/30/20/10, admin-configurable via platform\_config), COD-coverage filtering (uses orders.ship\_city plain column per §14.4 — confirm this wiring specifically), retry×3@30s→next-best, PENDING\_MANUAL\_LOGISTICS fallback, 5-min poll job (BullMQ), Socket.IO push on status change.
-   **Controllers:** /seller/orders/:id/courier-quotes, /seller/orders/:id/book, WebSocket /tracking namespace.
-   **Testing:** all-adapters-fail path, COD routes only to COD-capable couriers, WebSocket push fires without client polling.
-   **Commit:** Cycle 11.

### **F9 — Notifications**

-   **Repository work:** NotificationRepository, NotificationPreferenceRepository.
-   **Services:** BullMQ producer (enqueue on lifecycle event) + consumer (dispatch via adapter), template rendering (UR/EN, decoupled from code), critical-non-disableable enforcement.
-   **Controllers:** /notifications (list, mark-read), /notification-preferences.
-   **Testing:** queue idempotency (duplicate job doesn't double-send), retry/dead-letter behavior, critical toggle can't be disabled server-side even if client sends the request.
-   **Commit:** Cycle 12.

### **F10 — Returns & Refunds**

-   **Repository work:** ReturnRepository (with seller\_id denormalized per §15.5), ReturnImageRepository, DisputeRepository.
-   **Services:** 14-day window check, one-per-order enforcement (hard unique, post-§14.5 fix using status not deleted\_at), ≥3-photo requirement, manual-review queue logic, appeal window (5 business days).
-   **Controllers:** /buyer/returns, /seller/returns, /admin/disputes.
-   **Testing:** window-closed rejection, second-return-blocked, appeal-resolution-is-final (BR-008).
-   **Commit:** Cycle 13.

### **F11 — Analytics Dashboard**

-   **Repository work:** SellerDailyStatsRepository (per §15.1's new table).
-   **Services:** rollup job (BullMQ, nightly + on-settlement trigger per §15.1's rule — **never computed synchronously in the request path**, this is explicitly stated in the addendum, don't let a rushed session skip the async design and query raw orders live instead).
-   **Controllers:** /seller/analytics (revenue/trend/top-products, date-range filtered against the rollup table, not raw orders).
-   **Testing:** rollup job correctness (spot-check against manually-summed raw data), date-range filter correctness, reload time informally under 3s.
-   **Commit:** Cycle 14.

### **F12 — Payments & Admin Operations (split across two nights, Cycles 14–15)**

-   **Cycle 14 — Payments (Part 1):** PaymentRepository, SettlementRepository, CodRemittanceRepository; mock JazzCash/Easypaisa/COD adapters with webhook simulation + HMAC verify; settlement engine implementing **§14.2's binding gross/commission rule exactly** (gross = subtotal, never total\_amount) with the chk\_settlements\_net constraint in place; COD remittance ledger.
-   **Cycle 15 — Admin Ops (Part 2):** AuditLogRepository, PlatformConfigRepository; user suspend/ban (immediate session revocation via Redis denylist), payment manual-release, AI/return override with mandatory-reason-in-same-transaction (per Schema §10's stated rule), config panel endpoints, KPI aggregation queries for the admin dashboard.
-   **Testing:** idempotency (duplicate webhook callback), signature-rejection (invalid HMAC → 401, no status change), settlement math exactly matches §14.2's formula, immutability (attempt to UPDATE a SETTLED settlement should fail), audit-log-in-same-transaction-as-override (test that a failed audit insert rolls back the override, not just that both happen — this is the "or the transaction rolls back" rule from Schema §10).
-   **This is the most financial/schema-sensitive feature in the whole build — extra self-review, explicit flag in handoff.**
-   **Commit:** Cycle 16.

### **F13 — AI Store Builder**

-   **Repository work:** none new (uses existing ProductRepository with ai\_generated flag).
-   **Services (in ai-service, Python/FastAPI, not apps/api):** GPT-4V primary → GPT-3.5-turbo fallback chain (config-only switch per REQ-AI-Store001), Pydantic schema enforcement (title\_en/title\_ur/description\_en/description\_ur/category/tags), prompt templates.
-   **Controllers:** ai-service /generate-listing endpoint, apps/api proxy route /seller/products/generate that calls it internally (private Docker network only, per TRD §1).
-   **Testing:** JSON-schema conformance on generated output, fallback triggers correctly when primary model errors/times out, generation failure returns clean error (not a crash) so frontend's Retry button has something to act on.
-   **Commit:** Cycle 17.

### **F14 — AI Returns**

-   **Repository work:** extend ReturnRepository for AI fields (ai\_condition, ai\_authenticity, ai\_confidence — already in schema §4.15).
-   **Services (in ai-service):** Cloud Vision label analysis, CNN inference + confidence score.
-   **Services (in apps/api):** confidence-threshold routing logic — reads platform\_config.returns\_confidence\_threshold, routes ≥threshold to auto-decision, <threshold or AI-failure to manual review (D3's binding pattern).
-   **Controllers:** ai-service /analyze-return, apps/api orchestration in the returns service.
-   **Testing:** above-threshold auto-decides, below-threshold/failure routes to manual review without exception, image-mismatch never auto-approves (REQ-AI-Return-002, explicitly test this as its own case, not just the confidence-number path).
-   **Commit:** Cycle 18.

### **F15 — AI Analytics**

-   **Repository work:** SellerRecommendationRepository (per §15.2's new table).
-   **Services (in ai-service):** /recommend — generates plain-language recommendation from seller\_daily\_stats data.
-   **Services (in apps/api):** dismiss logic (dismissed\_until = now() + 14 days), active-recommendation query (dismissed\_until IS NULL OR dismissed\_until < now() per §15.2's rule).
-   **Controllers:** /seller/recommendations, /seller/recommendations/:id/dismiss.
-   **Testing:** dismissed card doesn't reappear before 14 days, generation is async (never blocks the analytics page load).
-   **Commit:** Cycle 19.

### **F16 — External APIs**

-   **Repository work:** none new.
-   **Services:** finalize LiveAdapter interfaces (still unused/mock-default per D2) for payment/courier/SMS providers so they're structurally ready for real credentials later; WhatsApp adapter (Meta Cloud API interface, mock for now).
-   **Testing:** interface contract tests (mock and live adapters both satisfy the same TypeScript interface — a compile-time check, not a runtime one).
-   **Commit:** Cycle 19, same day.

### **F17 — Final Integration**

-   **Work:** cross-feature backend bugs off the shared task board — e.g., a state-machine edge case only surfaced when the full buyer→seller→courier→return chain runs end-to-end.
-   **Testing:** full E2E flows (Playwright/Cypress backend-supporting fixtures), re-run coverage gate project-wide.
-   **Commit:** continuous, Cycles 20–21.

### **F18 — Testing & Deployment**

-   **Work:** load testing (k6/JMeter) against realistic single-node target, OWASP Top 10 review + remediation, deployment pipeline (prisma migrate deploy gating, rollback rehearsal), monitoring setup (/health//ready, Sentry, uptime pinger).
-   **Testing:** this phase *is* testing — all HIGH/CRITICAL security findings resolved before sign-off.
-   **Commit:** continuous, Cycles 22–24.

Say **CONTINUE** for #10 — AI Agent Handoff Procedure.

# **10\. AI Agent Handoff Procedure**

This formalizes the HANDOFF.md mechanism referenced throughout §4, §6, §7, §8, §9 into an actual concrete, fill-in-the-blank procedure. This is arguably the single most important operational artifact in the whole plan — with one shared agent and two devs never overlapping in real time, **the handoff note is the only thing standing between "seamless pipeline" and "context lost, rework required."**

## **Where It Lives**

One file per feature, committed to the repo (not Slack, not a doc outside version control — it has to travel with the code and be readable by the next Claude CLI session):

docs/handoffs/F<N>-<short-desc>.md

Example: docs/handoffs/F07-orders.md. A running index file docs/handoffs/INDEX.md lists all handoffs in feature order with status, so anyone (or any session) can see project state at a glance without opening 19 files.

## **The Handoff Template (fill this exactly, every session, every feature)**

\# Handoff — Feature <N>: <Feature Name>

\*\*Session:\*\* <Backend / Frontend> · \*\*Owner:\*\* <CR / Rafia> · \*\*Date:\*\* <date> · \*\*Cycle:\*\* <N>

\*\*Status:\*\* BACKEND\_DONE | FRONTEND\_SCAFFOLD\_DONE | FEATURE\_COMPLETE | BLOCKED

\---

\## What was built

<2-4 sentences, plain language. What exists now that didn't exist before this session.>

\## API Contract (backend sessions only)

<Every new/changed endpoint: method, path, request DTO shape, response shape, auth requirement, error codes it can return.>

\## Schema/Data changes (if any)

<New tables/columns/enums added this session, with reference to which addendum section (§14/§15) or new decision this came from. If a brand-new decision was made that isn't in the blueprint docs, log it here AND append it to docs/decisions-log.md.>

\## Deviations from the playbook (if any)

<Anything implemented differently than the playbook specified, and why. If none, write "None — implemented per playbook exactly.">

\## Known issues / incomplete pieces

<Anything left unfinished, any test skipped, any TODO. Be honest — this is what prevents the next session from assuming something works when it doesn't.>

\## What the next session needs to know

<Direct instructions for whoever picks this up next — "frontend: the register endpoint returns \`role\` as a string enum, not lowercase" type of thing.>

\## Testing status

<What was tested, coverage %, what wasn't tested and why.>

\## Financial/schema-sensitive flag

<YES/NO — if YES, note what was self-reviewed extra carefully per §7/§9's rule.>

## **What Must Be Committed (every session, no exceptions)**

1.  All code changes for the session's scope, following the granular-commit discipline from §7.
2.  The filled HANDOFF.md for that feature — as its own final commit, separate from code commits.
3.  Updated docs/handoffs/INDEX.md (one-line status update).
4.  If a new architectural decision was made mid-session: an entry in docs/decisions-log.md (see §6's drift-prevention section — this is the same file, referenced here as part of the formal handoff duty).
5.  If the session touched packages/shared/: explicit call-out at the top of the handoff (per §7's conflict-avoidance rule) — this is the one file both frontend and backend actually share, so a missed call-out here is the most likely single point of confusion in the whole workflow.

## **What Documentation Must Be Updated**

Beyond the handoff file itself:

-   **Swagger annotations** (backend) — must be current before the session ends, not deferred; TRD §5.1 already requires this, but it matters doubly here because Rafia's next session literally reads the live Swagger doc as part of loading context.
-   **Feature tracker** (a simple table — could be a PROJECT\_STATUS.md or a project board) — update the row for this feature to reflect current status (Not Started / Backend In Progress / Backend Done / Frontend In Progress / Feature Complete).
-   **docs/decisions-log.md** — only touched when a genuinely new decision was made (not every session needs an entry here — most sessions are just executing an already-decided playbook).

## **What Claude Context Must Be Preserved**

This is the critical distinction: **you are not preserving the Claude CLI session itself** (per §6, sessions are meant to end and not carry forward) — **you are preserving the information a fresh session needs to be as effective as a continued one would have been.** Concretely, that means the handoff note must contain everything the next session would need to ask the *same* quality of follow-up questions a continued session could — nothing more, nothing less:

-   Exact contract shapes (not "auth is done," but the literal request/response JSON shape).
-   Any non-obvious decision the agent made that isn't traceable back to the playbook/schema alone (e.g., "chose to return null rather than omit the field for consistency with X").
-   Anything flagged as a deviation, with the reason, so the next session doesn't "fix" an intentional deviation back to a now-wrong default.

**What you explicitly do NOT need to preserve:** the agent's reasoning process, false starts within the session, or exploratory back-and-forth — none of that needs to survive into the next session's context. Only the *decisions and their outcomes* need to travel forward, per §6's context-minimization principle.

## **How the Next Developer Resumes Work with Minimal Context Loss**

The actual resumption sequence, every single time:

1.  git pull main.
2.  Open docs/handoffs/INDEX.md — confirm which feature/status you're picking up.
3.  Open that feature's specific HANDOFF.md — read in full (it's short by design, 2–5 minutes).
4.  If integrating (frontend, State A): open the actual committed code for the endpoints mentioned (Swagger UI or the route files directly) — the handoff tells you *what* to expect, the live code is ground truth for *exact* shape if anything's ambiguous.
5.  Open Claude CLI, start a **new session** (per §6), load: this feature's playbook + the handoff note you just read + relevant Schema/App Flow/TRD sections.
6.  Proceed with the session per §8 or §9's per-feature workflow.

**This sequence should take under 10 minutes** from sitting down to starting productive work with the agent. If it's regularly taking longer, that's a signal the handoff notes from the previous session weren't detailed enough — the fix is tightening handoff discipline, not adding a sync call (you don't have that luxury with a day/night split, and shouldn't need it if handoffs are done right).

## **Why This Specific Design, For This Specific Team**

A normal team with overlapping hours can resolve ambiguity with a 2-minute Slack message. You cannot — by the time Rafia has a question about something CR built, CR is asleep, and vice versa. That constraint is what makes the handoff template far more rigorous than a typical team would bother with: **every field in the template exists specifically to answer a question that would otherwise require a same-day conversation you structurally cannot have.** This isn't process for its own sake — it's the direct substitute for synchronous communication that a two-person, opposite-shift, single-agent team doesn't have access to.

Say **CONTINUE** for #11 — Risk Analysis.