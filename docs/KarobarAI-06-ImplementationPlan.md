# KarobarAI — Implementation Plan

**Document 6 of 6 — Software Blueprint Series**
**Project:** KarobarAI — Generative-AI E-Commerce Platform for Micro-Sellers in Pakistan
**Version:** 1.0 (Implementation Plan)
**Timeline:** Fixed **20-week FYP** schedule, no dedicated budget (SRS §2.5)
**Depends on:** Documents 1–5 — decisions D1–D5 binding
**Status:** Draft for approval

---

## 0. How to Read This Plan

The 16 phases below are **logical workstreams**, not 16 sequential calendar blocks — several run in parallel. Section 17 maps them onto the real 20-week timeline and 10 two-week sprints. Scope tags: **MVP** ships first; **R1.1** is the core-AI-completion release (built if the schedule holds); **Future** is post-FYP. Complexity is **Low / Medium / High**. Every phase references the requirements and decisions it satisfies.

**Standing rule:** testing and ≥80% coverage (REQ-NF-Quality-003) are **continuous from Phase 1**, not deferred to Phase 11 — Phase 11 is dedicated *system/integration/E2E/security* hardening on top of unit tests written alongside each feature.

**Parallel track (starts Week 3):** ReturnsAI **dataset curation** for the custom CNN runs as a background workstream so the model is trainable by the time Phase 8 begins (mitigates risk R10 / T3).

---

## Phase 1 — Project Setup
- **Objective:** a runnable, CI-gated monorepo skeleton.
- **Deliverables:** monorepo (apps/web, apps/api, apps/ai-service, packages/shared, infra), Docker Compose (web, api, ai-service, postgres, redis, nginx), one-command local run (REQ-NF-Quality-005), ESLint/Prettier/Flake8/Black, base GitHub Actions (lint+test+build), `.env.example`, README.
- **Dependencies:** none.
- **Complexity:** Low.
- **Risks:** two-service local complexity (T5) → mitigated by Compose + README.
- **Testing:** CI smoke test that all services boot and `/health` responds.
- **Completion criteria:** `docker compose up` brings the full stack up locally; CI green on an empty PR.

## Phase 2 — Architecture
- **Objective:** lock the structural scaffolding from the TRD into code.
- **Deliverables:** folder structure (TRD §12), **adapter layer skeleton** with interfaces + `MockAdapter` stubs for payments/couriers/SMS/WhatsApp/maps (D2), `ADAPTER_MODE` factory, error hierarchy + central error middleware, pino logger + correlation IDs, response-envelope helper, Zod/Pydantic validation harness, config loader, Redis + BullMQ wiring, Socket.IO gateway stub.
- **Dependencies:** Phase 1.
- **Complexity:** Medium.
- **Risks:** over-engineering for an FYP → keep adapters thin; mocks first.
- **Testing:** unit tests for the adapter factory (mock↔live selection) and the error/envelope middleware.
- **Completion criteria:** a sample endpoint flows request → validation → service → repository → enveloped response, with a mock adapter call and structured logs.

## Phase 3 — Authentication
- **Objective:** secure identity, sessions, and RBAC.
- **Deliverables:** mobile-OTP (via mock SmsAdapter) + email/password registration, OTP verify, login, lockout, forgot/reset; bcrypt(12); JWT RS256 access + rotating HttpOnly refresh; Redis `jti` denylist; RBAC + ownership middleware; store-setup-wizard backend (REQ-F-Auth001–007).
- **Dependencies:** Phases 2, 4 (users tables).
- **Complexity:** Medium.
- **Risks:** token/lockout edge cases → covered by tests; secret handling (T10) → secrets store.
- **Testing:** unit + integration on OTP lifecycle, lockout, token rotation, revocation-on-suspend, RBAC denials (401/403).
- **Completion criteria:** full register→verify→login→refresh→logout works for all roles; suspended session dies immediately; security cases pass.

## Phase 4 — Database
- **Objective:** the single-Postgres schema, live and seeded.
- **Deliverables:** complete `schema.prisma` (all 25 tables, enums, relations, cascades per Doc 5), initial migration, `tsvector` generated column + GIN index, partial unique indexes, soft-delete middleware, seed (categories, platform_config), field-encryption + blind-index helpers.
- **Dependencies:** Phase 1; informs Phase 3.
- **Complexity:** Medium.
- **Risks:** migration/data-integrity slips → expand→migrate→contract discipline.
- **Testing:** migration up/down on a clean DB; constraint tests (CHECK, unique, FK); FTS query test (UR + EN).
- **Completion criteria:** `prisma migrate deploy` + seed run clean; ownership FKs and append-only constraints verified.

## Phase 5 — Backend APIs
- **Objective:** the REST surface for the commerce spine.
- **Deliverables:** CRUD + business endpoints for catalog, inventory (atomic stock, oversell guard), cart (persisted, multi-seller split logic), orders, order-items, addresses, search/browse (tsvector + filters/sort), admin (users, config, KPIs, audit), Swagger at `/api-docs`; idempotency middleware on payment-affecting routes.
- **Dependencies:** Phases 3, 4.
- **Complexity:** High.
- **Risks:** multi-seller split edge cases (R12) → split-at-checkout model from Doc 1/3; N+1 queries → Prisma `include/select`.
- **Testing:** integration tests per endpoint (happy + error + authz + ownership); coverage ≥80% maintained.
- **Completion criteria:** all MVP non-AI, non-payment endpoints documented in Swagger and passing integration tests.

## Phase 6 — Frontend UI
- **Objective:** the design system + app shell across all three surfaces.
- **Deliverables:** React+Vite PWA shell, AntD `ConfigProvider` themed to Doc-4 tokens, RTL + i18n (UR/EN, Noto Nastaliq + Plex), routing/auth guards, custom component layer (MetricCard, ProductCard, OrderCard, BilingualField, StatusChip, EmptyState, AIRevealPanel), skeletons/toasts/modals, TanStack Query clients, client-side image compression.
- **Dependencies:** Phases 2–5 (consumes APIs as they land).
- **Complexity:** High.
- **Risks:** Urdu RTL/Nastaliq rendering & perf (T7) → early spike + subsetting.
- **Testing:** component tests; visual checks in UR + EN; accessibility (axe) checks for AA.
- **Completion criteria:** authenticated navigation across seller/buyer/admin shells in both languages; design tokens applied; AA checks pass on built screens.

## Phase 7 — Core Features (MVP flagships)
- **Objective:** the features that prove the thesis.
- **Deliverables:** **AI Store Builder** (upload→GPT-4V→GPT-3.5 fallback→bilingual JSON→editable→publish/draft, REQ-F-Store/AI-Store, D3); **Intelligent Logistics** (parallel mock-courier scoring 40/30/20/10, confirm/override/book, manual-logistics fallback); **Live Tracking** (5-min poll job, Socket.IO push, map embed, login-free page); **Checkout** (multi-seller split, shipping line, min-order); **Returns workflow** (window, ≥3 photos, manual-review queue, appeal, admin override).
- **Dependencies:** Phases 5, 6, 10 (payments), 9 (notifications).
- **Complexity:** High.
- **Risks:** scope creep (R9) → MVP fence; LLM cost (T2) → monitor from Week 2, cache, GPT-3.5 default for non-critical.
- **Testing:** E2E flows (photo→publish; order→book→track→deliver; return→manual decision→refund) against mock adapters incl. simulated failures.
- **Completion criteria:** MVP success bar from PRD §16 demonstrable end-to-end on mocks.

## Phase 8 — Advanced Features (R1.1 core-AI completion)
- **Objective:** complete the AI story.
- **Deliverables:** **ReturnsAI automation** (Cloud Vision labels + custom CNN inference + **confidence-thresholded routing to manual review**, D3, REQ-AI-Return); **AI analytics recommendation cards**; **reviews & ratings** (verified purchase); seller AI-override on returns.
- **Dependencies:** Phase 7; the parallel dataset/CNN track.
- **Complexity:** High.
- **Risks:** CNN below 95% (T3) → confidence floor + manual review means the feature ships regardless; dataset scarcity (R10) → early curation track.
- **Testing:** model validation accuracy report; pipeline E2E (high-confidence auto-decision; low-confidence→manual); regression on the manual fallback.
- **Completion criteria:** returns auto-decide above threshold, route to manual below; recommendation cards render; reviews gated to purchases. *(If schedule slips, Phase 8 reduces to the MVP returns workflow already shipped in Phase 7 — the AI layer is the cuttable scope.)*

## Phase 9 — Notifications
- **Objective:** reliable, async, bilingual messaging.
- **Deliverables:** BullMQ producers/consumers, SMS (mock/real adapter) + in-app bell + preferences (critical non-disableable), bilingual templates decoupled from code, lifecycle hooks at all 8 events; **WhatsApp channel [R1.1]**.
- **Dependencies:** Phases 2 (queue), 4, 5.
- **Complexity:** Medium.
- **Risks:** queue consistency (T9) → idempotent consumers, retries, dead-letter queue.
- **Testing:** queue unit tests, idempotency/retry tests, template rendering in UR/EN.
- **Completion criteria:** every lifecycle event enqueues and dispatches without blocking the request path; in-app bell accurate.

## Phase 10 — Payments
- **Objective:** safe payment + settlement on mocks (real later).
- **Deliverables:** mock JazzCash/Easypaisa/COD adapters with webhook simulation + HMAC verify, idempotency keys, 3× retry, settlement engine (value−commission; 24–48h / 48–72h COD), **COD remittance ledger + reconciliation** (F12), refund-on-approval, immutable records.
- **Dependencies:** Phases 4, 5; feeds Phase 7.
- **Complexity:** High.
- **Risks:** real-API access blocked (R1) → mocks fully emulate shapes; webhook spoofing (T8) → HMAC + idempotency; reconciliation complexity (R8) → explicit ledger model.
- **Testing:** idempotency (duplicate-callback) tests, signature-rejection (401) tests, settlement-timing tests, COD reconciliation tests, immutability tests.
- **Completion criteria:** prepaid + COD flows settle correctly on mocks; refunds issue; no double charges; records immutable.

## Phase 11 — Testing (system hardening)
- **Objective:** prove quality beyond unit coverage.
- **Deliverables:** integration + E2E suites (Playwright/Cypress) for the critical journeys, load tests (k6/JMeter) to a realistic single-node target with the scaling path documented (REQ-NF-Perf), cross-platform/browser matrix (REQ-NF-Quality-009), accessibility audit (AA), **OWASP Top 10 security review** (REQ-NF-Security-013).
- **Dependencies:** Phases 3–10.
- **Complexity:** Medium.
- **Risks:** perf vs 3G/uploads (T4) → client compression already in; capacity (T6) → reframed target.
- **Testing:** this phase *is* testing; all HIGH/CRITICAL security findings resolved before deploy.
- **Completion criteria:** green E2E, documented load results, AA pass, zero open HIGH/CRITICAL security findings.

## Phase 12 — Optimization
- **Objective:** hit the performance budgets.
- **Deliverables:** Redis cache tuning (5-min products, 1-min courier rates), DB index/query review (`EXPLAIN ANALYZE` on hot paths), pre-aggregated analytics, image/CDN + lazy-load, bundle splitting + font subsetting, gzip/brotli.
- **Dependencies:** Phase 11 findings.
- **Complexity:** Medium.
- **Risks:** premature optimization → drive changes from measured bottlenecks only.
- **Testing:** before/after perf benchmarks against PRD §13.1 targets.
- **Completion criteria:** <3s on 3G primary screens, <1s search, <30s AI generation met in benchmarks.

## Phase 13 — Deployment
- **Objective:** a reproducible production deploy.
- **Deliverables:** built+tagged images, managed Postgres + Redis, Nginx TLS (Let's Encrypt), staging→prod pipeline with gated `prisma migrate deploy`, `ADAPTER_MODE` per environment, rollback-by-tag procedure (REQ-NF-Safety-006).
- **Dependencies:** Phases 11, 12.
- **Complexity:** Medium.
- **Risks:** config/secret drift (T10) → secrets store, `.env` git-ignored.
- **Testing:** deploy to staging, run smoke + a subset of E2E; rehearse rollback.
- **Completion criteria:** staging mirrors prod; a tagged release deploys and rolls back cleanly within 30 min.

## Phase 14 — Monitoring
- **Objective:** know when something breaks.
- **Deliverables:** `/health` + `/ready` per service, Sentry error tracking, uptime pinger (99.5% SLO), adapter success/failure + queue-depth metrics, BullMQ board, alert thresholds, admin KPI dashboard wired to live data (REQ-F-Admin-005).
- **Dependencies:** Phase 13.
- **Complexity:** Low–Medium.
- **Risks:** alert fatigue → tune thresholds.
- **Testing:** induce a failure and confirm it's detected/alerted; verify KPI numbers.
- **Completion criteria:** errors surface in Sentry; uptime tracked; KPIs render for admins.

## Phase 15 — Documentation
- **Objective:** the FYP-grade documentation set.
- **Deliverables:** user + seller manuals, quick-start, FAQs, admin ops manual (UR/EN where applicable, SRS §2.6), live Swagger, this blueprint set, README run/deploy guide, the SRS diagrams reconciled to the implemented schema, and the FYP report/defense materials.
- **Dependencies:** all prior phases.
- **Complexity:** Low–Medium.
- **Risks:** left to the end → start docs alongside features, finalize here.
- **Testing:** a fresh reader follows the quick-start to a working local run and a published product.
- **Completion criteria:** complete, accurate, submission-ready documentation.

## Phase 16 — Future Enhancements (post-FYP)
- **Objective:** record the credible roadmap beyond v1.
- **Deliverables (documented, not built):** self-hosted LLaMA fallback (F24, needs GPU), wishlist (F17), analytics export (F25), seller 2FA, native apps (F27), OpenSearch migration, `pgvector` semantic search/recommendations, multi-AZ/multi-region DR, international + multi-currency (F26), and the **tool-using agentic layer** (F28) that would make the "agentic" positioning literal.
- **Dependencies:** v1 shipped.
- **Complexity:** n/a (planning).
- **Risks:** n/a.
- **Testing:** n/a.
- **Completion criteria:** roadmap captured in the PRD/TRD Future-Scope sections.

---

## 17. Development Timeline (20 weeks)

| Weeks | Focus (phases) | Output |
|-------|----------------|--------|
| 1–2 | P1 Setup · P2 Architecture | Bootable stack, adapter skeleton, CI |
| 3–4 | P4 Database · P3 Authentication · *(CNN dataset track starts)* | Schema live, auth+RBAC working |
| 5–7 | P5 Backend APIs · P6 Frontend UI (start) | Commerce APIs + Swagger; themed app shell (UR/EN) |
| 8–9 | P10 Payments · P9 Notifications · P6 (cont.) | Mock payments+settlement+COD ledger; async notifications |
| 10–12 | **P7 Core Features** | AI Store Builder, Logistics, Tracking, Checkout, Returns workflow — **MVP feature-complete** |
| 13–14 | **P8 Advanced (R1.1)** | ReturnsAI automation, AI analytics cards, reviews |
| 15–16 | P11 Testing | E2E, load, cross-platform, accessibility, OWASP review |
| 17 | P12 Optimization | Performance budgets met |
| 18 | P13 Deployment · P14 Monitoring | Staging→prod, health/alerts/KPIs |
| 19 | P15 Documentation · buffer | Manuals, report, defense prep |
| 20 | Final QA · demo · submission | Locked, demoed, submitted |

*Buffer is intentionally front-loaded into the testing/optimization/doc weeks; if any phase slips, Phase 8 (R1.1 AI automation) is the designated cut line — the MVP shipped at Week 12 stands on its own.*

---

## 18. Milestone Plan

| # | Milestone | Target | Gate |
|---|-----------|--------|------|
| M0 | Skeleton + CI green | End W2 | Stack boots locally |
| M1 | Auth + DB complete | End W4 | All-role login; schema migrated |
| M2 | Commerce APIs + app shell | End W7 | Swagger + navigable bilingual UI |
| M3 | Payments + notifications | End W9 | Mock settle/COD + async messages |
| **M4 (mid-term demo)** | **MVP feature-complete** | **End W12** | **PRD §16 success bar on mocks — supervisor demo** |
| M5 | R1.1 AI complete | End W14 | ReturnsAI auto+manual; recommendations; reviews |
| M6 | Quality hardened | End W16 | Green E2E; zero HIGH/CRITICAL security findings |
| M7 | Deployed + monitored | End W18 | Live staging/prod; alerts + KPIs |
| **M8 (final defense)** | **Submission-ready** | **End W20** | **Docs complete; demoed; OWASP review signed off** |

---

## 19. Sprint Plan (10 × 2-week sprints)

| Sprint | Weeks | Goal |
|--------|-------|------|
| S1 | 1–2 | Setup + architecture scaffolding; adapter mocks; CI |
| S2 | 3–4 | Database schema + auth/RBAC; start CNN dataset track |
| S3 | 5–6 | Catalog/inventory/cart/order APIs; app shell + theme + i18n/RTL |
| S4 | 7–8 | Search/browse + admin APIs; payments (mock) + settlement/COD ledger |
| S5 | 9–10 | Notifications; AI Store Builder; checkout (multi-seller split) |
| S6 | 11–12 | Logistics scoring/booking; live tracking; returns workflow → **MVP complete (M4)** |
| S7 | 13–14 | ReturnsAI automation + confidence routing; analytics AI cards; reviews |
| S8 | 15–16 | System/integration/E2E tests; load; accessibility; OWASP review |
| S9 | 17–18 | Optimization; deployment; monitoring |
| S10 | 19–20 | Documentation; final QA; demo; submission |

Each sprint: planning (goal + backlog), daily async standup, demo at sprint end, retro. Backlog items trace to REQ-IDs.

---

## 20. Git Branching Strategy

**GitHub Flow** (simple, right-sized for a two-person team):
- `main` is always deployable; **protected** (no direct pushes; PR + green CI + 1 approval required).
- Short-lived branches off `main`: `feat/<area>-<short-desc>`, `fix/<desc>`, `chore/<desc>`, `docs/<desc>` (Conventional-Commit aligned).
- Open a **PR early** (draft) → CI runs lint/test/build/coverage → review → squash-merge to `main`.
- **Staging** auto-deploys from `main`; **production** deploys from a **tagged release** (`v1.0.0`), enabling tag-based rollback (REQ-NF-Safety-006).
- Hotfixes branch from the release tag, fix, tag a patch, then merge back to `main`.

---

## 21. Code Review Process

- **Every change via PR**; at least **one approving review** (students review each other; mentor/lead review for security-, payment-, or schema-touching PRs).
- **CI is a hard gate:** lint (zero errors), type-check, tests passing, coverage ≥80%, security scan clean — no merge otherwise.
- **PR template checklist:** linked REQ-ID(s); tests added; Swagger/docs updated; no secrets/PII in code or logs; parameterised queries only; RTL + UR/EN checked (UI); accessibility considered; migration reversible (if schema).
- **Review focus:** correctness, security (OWASP), ownership/authz, error/edge handling, and adherence to the blueprint — not style (lint owns style).
- Squash-merge with a clean Conventional-Commit message.

---

## 22. Definition of Done

A unit of work is **Done** when:
1. Acceptance criteria (Doc 3 user stories) met for all happy/error/edge paths.
2. Unit tests written; suite green; coverage ≥80% maintained.
3. Lint + type-check clean; no console/debug noise.
4. AuthZ + ownership enforced; inputs validated; errors enveloped (no stack traces leaked).
5. No secrets/PII logged; queries parameterised.
6. UI: responsive 320–1920, **RTL + UR/EN verified**, AA (keyboard, contrast, alt, focus), loading/empty/error states present.
7. Swagger/docs updated; migration reversible (if schema).
8. PR reviewed, approved, CI-green, squash-merged to `main`.
9. Traceable to its REQ-ID(s).

---

## 23. Deployment Checklist (per release)

- [ ] All target tests green in CI; coverage gate met.
- [ ] `ADAPTER_MODE` correct for the environment (mock on staging-demo / live where credentials exist).
- [ ] Secrets present in the secrets store; **none** in VCS; `.env.example` current.
- [ ] `prisma migrate deploy` reviewed, reversible, and run **before** app cutover.
- [ ] Seed/config (`platform_config`: commission, weights, return window, min order, confidence threshold) verified.
- [ ] TLS 1.3 + forced HTTPS; strict CORS allowlist; security headers on.
- [ ] Health/readiness endpoints green; Sentry + uptime monitor live.
- [ ] Image tagged (`vX.Y.Z`); rollback tag identified and tested.
- [ ] Backup taken immediately pre-deploy; restore path confirmed.
- [ ] Smoke + critical-path E2E pass on staging.

## 24. Launch Checklist (FYP go-live / defense)

- [ ] **OWASP Top 10 review complete; zero open HIGH/CRITICAL** (REQ-NF-Security-013).
- [ ] PRD §16 MVP success bar demonstrable end-to-end (live demo rehearsed).
- [ ] R1.1 status accurately represented (what's automated vs. manual-review).
- [ ] Performance budgets met on a simulated 3G profile (PRD §13.1).
- [ ] Accessibility AA verified across seller/buyer/admin in **UR and EN**.
- [ ] Cross-platform pass: Android/Chrome, iOS/Safari, Windows/Chrome+Edge, macOS/Safari.
- [ ] Mock adapters clearly labelled as mock; real-integration path documented (D2).
- [ ] Backups + DR runbook (RTO 4h/RPO 1h) documented and tested.
- [ ] All user/seller/admin docs + Swagger published; FYP report finalized.
- [ ] Demo data seeded; demo script prepared; fallback recording captured.
- [ ] Supervisor sign-off; submission package complete.

---

## 25. Closing Note

This completes the six-document blueprint. Together they form an internally consistent, contradiction-resolved, MVP-first specification: the **PRD** (what & why), **TRD** (how, technically), **App Flow** (every screen & journey), **UI/UX Brief** (the look, bilingual identity, and tokens), **Backend Schema** (the single-Postgres physical model), and this **Implementation Plan** (the 20-week path to a defensible FYP). The five decisions (single Postgres, mock-first adapters, GPT-3.5 fallback + confidence-routed returns, one-seller/persisted-cart/buyer-pays-shipping, MVP-first) thread through all six, and every requirement traces back to the source SRS. An AI coding agent (Claude Code, Cursor, etc.) can now implement from these with minimal further clarification.

---

*End of Document 6 — and of the KarobarAI Software Blueprint Series.*
