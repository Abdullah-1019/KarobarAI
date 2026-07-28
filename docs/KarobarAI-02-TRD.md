# KarobarAI — Technical Requirements Document (TRD)

**Document 2 of 6 — Software Blueprint Series**
**Project:** KarobarAI — Generative-AI E-Commerce Platform for Micro-Sellers in Pakistan
**Version:** 1.0 (TRD)
**Depends on:** Document 1 (PRD) — all PRD decisions D1–D5 are binding here
**Status:** Draft for approval

---

## 0. Decision Recap (binding)

| # | Decision | Technical consequence in this TRD |
|---|----------|-----------------------------------|
| D1 | Single **PostgreSQL** via Prisma | One relational datastore; JSONB for flexible AI content; `tsvector` for bilingual search; `pgvector`-ready |
| D2 | **Adapter pattern**, mock now / real later | Every external provider sits behind a TypeScript interface with a `MockAdapter` and a (later) `LiveAdapter`; selection by env/config |
| D3 | **GPT-3.5 fallback** + ReturnsAI **confidence routing** | Provider-agnostic AI client with fallback chain; decision engine with a confidence threshold and a manual-review floor |
| D4 | One seller/order, **persisted cart**, buyer-paid shipping | Cart and order-splitting logic; shipping as an order line item |
| D5 | **MVP-first** | Components tagged MVP / R1.1 / Future; nothing gold-plated beyond a 20-week build |

---

## 1. Overall System Architecture

KarobarAI is a **two-service modular system** behind a single reverse proxy, backed by one PostgreSQL database and one Redis instance:

1. **Web Client** — React + TypeScript PWA (seller portal, buyer storefront, admin console).
2. **Core API** (`api`) — Node.js + Express + TypeScript. The orchestration and business-logic layer: auth, catalog, cart, orders, payments/settlement, logistics orchestration, tracking, returns workflow, notifications, admin. Owns the database (via Prisma) and all external **adapters** (payments, couriers, SMS/WhatsApp, maps).
3. **AI Service** (`ai-service`) — Python + FastAPI. The AI/ML layer: listing generation (LLM client with fallback chain), and — in R1.1 — ReturnsAI (Cloud Vision + custom CNN inference + confidence-scored decisions) and AI analytics recommendations. Called by the Core API over REST on the private Docker network; never exposed publicly.
4. **PostgreSQL** — single source of truth (D1).
5. **Redis** — cache + BullMQ job/queue backend (notifications, polling jobs, async AI tasks).
6. **Object storage / CDN** — product and return images (S3-compatible; Cloudinary or local MinIO in dev).
7. **Nginx** — reverse proxy, TLS termination, static asset serving, routing `/api` → Core API.

This is a **modular monolith per service**, not microservices (justified in §11). The two-service split exists for one technical reason: the custom CNN and CV pipeline (R1.1) genuinely belong in Python, so the AI surface is isolated from day one to avoid a costly re-split later.

### 1.1 Why this shape fits the constraints
- **Single DB (D1)** removes the SRS's impossible cross-store FK and keeps transactions ACID across orders, payments, and settlements.
- **Adapters (D2)** mean the entire system is buildable and demoable with zero real provider access; flipping `ADAPTER_MODE=live` later changes no caller code.
- **AI isolated** so the LLM/CV work can iterate, scale, or move to GPU independently without touching commerce logic.
- **Stateless services** (sessions in JWT, shared state in Redis/Postgres) give a clean horizontal-scale path when capacity is needed.

---

## 2. Architecture Diagram (textual)

```
                         ┌───────────────────────────────────────────────┐
                         │                  CLIENTS                        │
                         │  Seller Portal · Buyer Storefront · Admin (PWA) │
                         │     React + TS + Vite + Workbox (offline)       │
                         └───────────────────────┬─────────────────────────┘
                                                  │ HTTPS / TLS 1.3 (REST + WSS)
                                                  ▼
                         ┌───────────────────────────────────────────────┐
                         │            NGINX  (reverse proxy)               │
                         │     TLS termination · static · /api routing     │
                         └───────────────────────┬─────────────────────────┘
                                                  │
                         ┌────────────────────────▼────────────────────────┐
                         │              CORE API  (Node + Express + TS)      │
                         │  Modules: auth · catalog · cart · order ·         │
                         │  payment/settlement · logistics · tracking ·      │
                         │  returns · notification · admin                   │
                         │  Cross-cutting: RBAC · validation(Zod) ·          │
                         │  error handler · logger(pino) · rate-limit        │
                         │                                                   │
                         │  ┌─────────── ADAPTER LAYER (D2) ───────────────┐ │
                         │  │ PaymentAdapter  CourierAdapter  SmsAdapter   │ │
                         │  │ WhatsAppAdapter  MapsAdapter                 │ │
                         │  │  mode = mock | live  (env-selected)          │ │
                         │  └──────────────────────────────────────────────┘ │
                         └───┬──────────────┬──────────────┬─────────────────┘
                             │ Prisma       │ ioredis      │ REST (private net)
                             ▼              ▼              ▼
                  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
                  │ PostgreSQL   │  │   Redis      │  │  AI SERVICE (FastAPI) │
                  │ (single DB,  │  │ cache +      │  │  /generate-listing    │
                  │  D1)         │  │ BullMQ queue │  │  /analyze-return (R1.1)│
                  │ tsvector FTS │  │              │  │  /recommend (R1.1)    │
                  │ JSONB        │  └──────────────┘  │  LLM client + fallback│
                  └──────────────┘                    │  CV + CNN (R1.1)      │
                             ▲                         └───────────┬──────────┘
                             │ images (URL)                        │
                  ┌──────────┴───────┐                  ┌──────────▼──────────┐
                  │ Object store/CDN │                  │ External AI/CV (D3) │
                  │ (S3 / Cloudinary)│                  │ OpenAI GPT-4V →      │
                  └──────────────────┘                  │ GPT-3.5 fallback;    │
                                                         │ Google Cloud Vision │
                                                         └─────────────────────┘

   EXTERNAL (all via adapters, mock in MVP):
   Couriers: TCS / Leopards / Trax   Wallets: JazzCash / Easypaisa / COD
   Messaging: Twilio/SNS (SMS) · Meta Cloud (WhatsApp, R1.1)   Maps: Google Maps
```

---

## 3. Design Patterns

| Pattern | Where used | Why |
|---------|-----------|-----|
| **Adapter** | All external providers (D2) | Swap mock↔live without touching callers |
| **Strategy** | Courier scoring; LLM fallback chain; payment method selection | Interchangeable algorithms behind one interface |
| **Factory** | Adapter instantiation by `ADAPTER_MODE` | Centralised, env-driven construction |
| **Repository** | Data access via Prisma-backed repositories | Isolates persistence from business logic; testable |
| **Service layer** | One service class per domain module | Keeps controllers thin, logic unit-testable |
| **State machine** | Order lifecycle, Return lifecycle | Single source of valid transitions (shared module) |
| **Queue / Producer-Consumer** | Notifications, tracking polls, async AI | Decouple slow work from request path (BullMQ) |
| **Outbox / idempotency key** | Payments, webhooks | Exactly-once payment effects (REQ-F-Payment-004) |
| **Circuit breaker + retry-with-backoff** | Adapter calls | Graceful degradation (REQ-NF-Safety-004) |
| **DTO + schema validation** | API boundaries (Zod / Pydantic) | Reject malformed input at the edge |
| **Observer (WebSocket)** | Live tracking push | Real-time updates without polling the client |

---

## 4. Frontend Technology Stack

| Concern | Choice | Justification |
|---------|--------|---------------|
| Framework | **React 18 + TypeScript** | SRS-mandated React; TS for safety on a multi-developer FYP |
| Build / PWA | **Vite + vite-plugin-pwa (Workbox)** | Fast builds; service-worker offline caching (REQ-NF-Perf007, R1.1); lighter than SSR for a phone-first SPA |
| UI library | **Ant Design** (MUI as alternative) | SRS allows MUI/AntD; AntD has first-class **RTL** (`ConfigProvider direction="rtl"`) and dense data tables ideal for seller/admin dashboards |
| Server state | **TanStack Query** | Caching, retries, background refetch — keeps the 3G experience snappy |
| Client state | **Zustand** | Minimal global state (auth, language, cart hydration) without Redux overhead |
| Forms + validation | **React Hook Form + Zod** | Shared Zod schemas with the API contract |
| i18n / RTL | **react-i18next** + Noto Nastaliq Urdu | Live language switch without reload (SRS §2.5); RTL toggling via AntD + `dir` attribute |
| Charts | **Recharts** (or AntD Charts) | Analytics dashboard (F6) |
| Maps | **Google Maps JS API** | Tracking map (REQ-F-Track003); behind a mockable wrapper |
| Real-time | **socket.io-client** | Tracking updates (REQ-F-Track002) |
| Images | Client-side compression (`browser-image-compression`) before upload | Honours <30s / <3s targets on 3G (PRD latency correction) |

**Accessibility:** WCAG 2.1 **AA** (PRD §13.4 correction) — semantic HTML, keyboard nav, ≥4.5:1 contrast, descriptive alt text, focus management, skeleton loaders during fetch, progress indicators on all AI actions.

---

## 5. Backend Technology Stack

### 5.1 Core API (`api`)
| Concern | Choice | Justification |
|---------|--------|---------------|
| Runtime | **Node.js 20 LTS** | SRS ≥18; 20 LTS for longevity |
| Framework | **Express + TypeScript** | SRS-specified; mature, well-understood for an FYP team |
| ORM | **Prisma** over **PostgreSQL 16** (D1) | Type-safe queries, migrations, parameterised by default (REQ-NF-Security-009) |
| Validation | **Zod** | Edge validation; shared types with frontend |
| Auth | **jsonwebtoken (RS256)** + **bcrypt (cost 12)** | REQ-F-Auth003, REQ-NF-Security-003/004 |
| Queue | **BullMQ + Redis 7** | Async notifications, polling, AI dispatch (REQ-F-Notif005) |
| Cache | **ioredis** | Product (5-min TTL) and courier-rate (1-min TTL) caching (SRS §3.3.6) |
| Real-time | **Socket.IO** (WSS, JWT-authenticated) | Tracking push (REQ-F-Track002) |
| API docs | **swagger-jsdoc + swagger-ui-express** at `/api-docs` | REQ-NF-Quality-004 |
| Logging | **pino** (structured JSON) | Fast, low-overhead structured logs |
| HTTP client | **undici/axios** behind adapter interfaces | External calls (mockable) |
| Testing | **Jest + Supertest**, coverage via **Istanbul/c8** | ≥80% coverage (REQ-NF-Quality-003) |

### 5.2 AI Service (`ai-service`)
| Concern | Choice | Justification |
|---------|--------|---------------|
| Runtime | **Python 3.11** | SRS-specified for AI/ML |
| Framework | **FastAPI + Uvicorn** | Async, typed (Pydantic), auto OpenAPI |
| LLM client | Provider-agnostic wrapper: **GPT-4 Vision → GPT-3.5-turbo fallback** (D3) | Config-only switch (REQ-AI-Store001) |
| Schema | **Pydantic** models enforcing `{title_en,title_ur,description_en,description_ur,category,tags}` | REQ-AI-Store002 |
| CV (R1.1) | **Google Cloud Vision** client (behind adapter) | Return labels (REQ-F-Return-003) |
| CNN (R1.1) | **PyTorch** (or TF) inference + confidence score | REQ-AI-Return-001 target + manual-review routing (D3) |
| Testing | **pytest** | Parity with coverage goals |

**MVP note:** in MVP the AI Service serves **listing generation** only (keeping all prompt templates, fallback logic, and JSON-schema enforcement in one place). ReturnsAI inference and AI recommendations are added in R1.1. (If the team prefers fewer moving parts for MVP, listing generation could temporarily live in the Core API calling OpenAI directly; the recommended default is the dedicated service to avoid a later re-split.)

---

## 6. Database Technology

**PostgreSQL 16, single instance, Prisma ORM (D1).** Rationale and capabilities are detailed in Document 5 (Backend Schema). Key technical points:
- **JSONB** for AI-generated content and language-tagged `tags` arrays (PRD assumption 13).
- **Full-text search** via generated `tsvector` columns + GIN indexes over UR/EN title/description/tags (REQ-F-Browse-001), removing the need for a separate search engine at MVP scale (≤100k listings, REQ-NF-Perf003).
- **ACID transactions** across order → payment → settlement → inventory, including atomic stock decrement (REQ-F-Inv-001) and idempotent payment effects (REQ-F-Payment-004).
- **Money** stored as `DECIMAL` (never float); **PII fields** (phone, wallet IDs, addresses) encrypted at rest (REQ-NF-Security-007).
- **`pgvector`** extension reserved for future semantic search / recommendation (not in v1).
- **Soft deletes** (`deleted_at`) and audit timestamps (`created_at`, `updated_at`) standard on all entities.

---

## 7. Authentication Strategy

- **Registration:** mobile-number + SMS OTP (via `SmsAdapter`, mock in MVP) **or** email + password (REQ-F-Auth001/002).
- **OTP:** 6 digits, 10-min validity, single-use, max 5 resends/hour (REQ-F-Auth001, REQ-NF-Security-006). Stored hashed with short TTL in Redis.
- **Passwords:** bcrypt cost 12; complexity ≥8 chars incl. upper/lower/digit/special (REQ-F-Auth002, REQ-NF-Security-003).
- **Tokens:** JWT **access** token, RS256-signed, 1-hour expiry, carrying `sub`, `role`, `jti`; **refresh** token, HttpOnly + Secure + SameSite cookie, 7-day expiry, rotated on use (REQ-F-Auth003).
- **Session invalidation:** suspension/ban revokes refresh tokens immediately via a Redis denylist keyed on `jti`/`sub` (REQ-F-Auth006).
- **Lockout:** 5 failed logins in 15 min → 30-min lock or reset (REQ-F-Auth007).
- **Keys:** RS256 private key in the secrets store; public key distributed to services for verification.
- **Future:** seller SMS 2FA (REQ-F-Auth008).

---

## 8. Authorization Strategy

- **RBAC** with roles Guest / Buyer / Seller / Admin / Support (PRD §10–11).
- **Middleware chain:** `authenticate` (verify JWT, load principal) → `authorize(roles)` (role gate) → `ownership` (record-level checks, e.g. a seller may only mutate their own products/orders) (REQ-F-Auth004, REQ-NF-Security-005).
- **Permission matrix** from PRD §11 is the canonical authority; encoded as a route→required-permission map.
- **Audited privileged actions:** AI/return overrides, payment release, suspensions, and config changes write to an immutable `audit_log` with actor, reason (mandatory where applicable), before/after, timestamp (REQ-F-Admin-003).
- **AI Service** trusts only internal calls (shared secret / network policy); it is never reachable from the public internet.

---

## 9. API Design Standards

- **Style:** RESTful JSON over HTTPS; resource-oriented nouns; verbs via HTTP methods.
- **Versioning:** path-based `/api/v1/...`.
- **Envelope (SRS §3.4):** every response is `{ success: boolean, data: T | null, error: { code, message, details? } | null, timestamp: ISO8601 }`. Response bodies kept under ~50 KB (SRS §3.4).
- **Status codes:** 200/201 success, 400 validation, 401 auth, 403 authorization, 404 not found, 409 conflict (e.g. oversell, duplicate return), 422 business-rule violation, 429 rate limit, 5xx server.
- **Error codes:** stable machine-readable strings (e.g. `RETURN_WINDOW_CLOSED`, `STOCK_INSUFFICIENT`, `PAYMENT_SIGNATURE_INVALID`) for client i18n.
- **Pagination:** cursor or `page`/`limit` with `meta` totals; default limit 20.
- **Idempotency:** `Idempotency-Key` header required on payment-affecting POSTs (REQ-F-Payment-004).
- **Validation:** Zod (Node) / Pydantic (Python) at every boundary; reject unknown fields.
- **Docs:** OpenAPI 3.0 auto-generated, browsable at `/api-docs` (REQ-NF-Quality-004).
- **CORS:** strict allowlist, no wildcards in production (REQ-NF-Security-002).
- **Real-time:** Socket.IO namespace `/tracking`, JWT-authenticated, events `order_status_update`, `tracking_location_update`; HTTP long-poll fallback (SRS §3.4).

---

## 10. REST vs GraphQL Justification

**Decision: REST.**
- The domain is a set of well-bounded resources (products, orders, returns, payments) with predictable access patterns — REST maps cleanly.
- The SRS already specifies a REST envelope, Swagger docs, and ≤50 KB responses; REST honours that contract.
- **Webhooks** (payments) and **idempotency** are first-class in REST tooling; GraphQL mutations would add ceremony here.
- A non-specialist FYP team ships faster and debugs more easily on REST + Swagger than on a GraphQL schema/resolver/caching stack.
- GraphQL's main win (client-shaped queries to avoid over-fetching) is marginal for fixed mobile screens and is better served by a few purpose-built REST endpoints + TanStack Query caching.
- **Future:** a read-only GraphQL/BFF layer could be added if a richer client emerges; not needed for v1.

---

## 11. Microservices vs Monolith Justification

**Decision: a modular monolith for the Core API, plus a single separate AI service.** Not microservices.
- A 20-week, no-budget, small-team FYP cannot absorb the operational overhead of many services (independent deploys, service discovery, distributed tracing, network-partition handling).
- A modular monolith keeps clear domain boundaries (module folders, service classes, repositories) while preserving local transactions across order/payment/inventory — which a microservice split would turn into hard distributed-transaction problems.
- The **only** justified split is the **AI Service**, because the CV/CNN stack (R1.1) is Python and benefits from isolated scaling/GPU later. Isolating it now avoids a painful re-split.
- **Future:** if specific modules (notifications, tracking pollers) become scaling hotspots, they can be peeled off as services because they already communicate via queues and clean interfaces.

---

## 12. Folder Structure

A single repository with three deployables and shared types (pnpm workspaces; Turborepo optional):

```
karobarai/
├── apps/
│   ├── web/                      # React + Vite PWA
│   │   ├── src/
│   │   │   ├── app/              # routing, providers, i18n, theme (RTL)
│   │   │   ├── features/         # seller/, buyer/, admin/, auth/
│   │   │   ├── components/       # shared UI (AntD-based)
│   │   │   ├── hooks/  lib/  api/ (TanStack Query clients)
│   │   │   ├── locales/          # en/, ur/ translation bundles
│   │   │   └── pwa/              # service worker config
│   │   └── vite.config.ts
│   │
│   ├── api/                      # Node + Express + TS (Core API)
│   │   ├── src/
│   │   │   ├── modules/          # one folder per domain
│   │   │   │   ├── auth/         # controller, service, routes, dto
│   │   │   │   ├── catalog/      products + inventory
│   │   │   │   ├── cart/         # persisted cart, split-at-checkout
│   │   │   │   ├── order/        # + state-machine usage
│   │   │   │   ├── payment/      # + settlement + COD ledger
│   │   │   │   ├── logistics/    # scoring + booking orchestration
│   │   │   │   ├── tracking/     # poll jobs + WebSocket gateway
│   │   │   │   ├── returns/      # workflow (MVP) + AI calls (R1.1)
│   │   │   │   ├── notification/ # BullMQ producers/consumers
│   │   │   │   └── admin/        # users, config, KPIs, audit
│   │   │   ├── adapters/         # D2: payment/ courier/ sms/ whatsapp/ maps/
│   │   │   │   └── <provider>/   #   index.ts (iface), mock.ts, live.ts
│   │   │   ├── core/             # state-machines/, errors/, middleware/
│   │   │   │   │                 #   (authn, authz, rate-limit, error)
│   │   │   │   ├── config/  logger/  redis/  queue/
│   │   │   ├── prisma/           # schema.prisma, migrations, seed
│   │   │   └── server.ts
│   │   └── tests/                # jest + supertest
│   │
│   └── ai-service/               # Python + FastAPI
│       ├── app/
│       │   ├── routers/          # generate_listing, analyze_return(R1.1), recommend(R1.1)
│       │   ├── llm/              # provider client + fallback chain (D3)
│       │   ├── vision/           # Cloud Vision adapter (R1.1)
│       │   ├── cnn/              # model load + inference + confidence (R1.1)
│       │   ├── schemas/          # Pydantic
│       │   └── main.py
│       └── tests/                # pytest
│
├── packages/
│   └── shared/                   # shared TS types, error codes, enums
│
├── infra/
│   ├── docker-compose.yml        # web, api, ai-service, postgres, redis, nginx
│   ├── nginx/
│   └── .env.example
├── .github/workflows/            # CI pipelines
└── README.md                     # one-command setup (REQ-NF-Quality-005)
```

---

## 13. Coding Standards

- **Languages:** TypeScript strict mode (web + api); Python type hints + `mypy` (ai-service).
- **Linting/formatting:** ESLint + Prettier (JS/TS), Flake8 + Black (Python); zero lint errors in CI (REQ-NF-Quality-006).
- **Naming:** `camelCase` (TS vars/functions), `PascalCase` (types/components), `snake_case` (DB columns, Python), `SCREAMING_SNAKE` (env/constants).
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`…) for readable history and changelogs.
- **No magic values:** business parameters (commission, return window, courier weights, min order) come from config/DB, never hard-coded (SRS §5.5).
- **Functions small and single-purpose;** controllers thin, logic in services, persistence in repositories.
- **No raw SQL string concatenation;** Prisma/parameterised only (REQ-NF-Security-009).

---

## 14. Error Handling

- **Central error middleware** maps thrown typed errors → the standard envelope; **no stack traces ever reach end users** (REQ-NF-Safety-003).
- **Typed error hierarchy:** `AppError` → `ValidationError(400)`, `AuthError(401)`, `ForbiddenError(403)`, `NotFoundError(404)`, `ConflictError(409)`, `BusinessRuleError(422)`, `RateLimitError(429)`, `DependencyError(503)`.
- **Adapter failures** raise `DependencyError`, triggering circuit-breaker/graceful-degradation messaging (REQ-NF-Safety-004) — e.g. maps down → text-only tracking; all couriers down → `PENDING_MANUAL_LOGISTICS`.
- **Correlation ID** (`x-request-id`) attached to every request and log line for traceability across api ↔ ai-service.
- **User-facing messages** are i18n keys (UR/EN), never raw exceptions.

---

## 15. Logging Strategy

- **Structured JSON logs** (pino / Python `structlog`) with level, timestamp, correlation ID, actor, module, event.
- **Levels:** `error` (failures, alertable), `warn` (degradations, retries), `info` (lifecycle events: order placed, payment confirmed), `debug` (dev only).
- **Sensitive-data redaction:** never log payment payloads, OTPs, tokens, PINs, or full PII (REQ-NF-Security, SRS §3.3.3).
- **Audit log** (separate, immutable, in Postgres) for privileged/financial actions, distinct from operational logs.
- **Aggregation:** stdout → container logs in dev; pluggable shipper (e.g. to a hosted log service) for prod.

---

## 16. Security Requirements

Implements PRD §13.3 (SRS §5.3), mapped to OWASP Top 10:

| Control | Implementation | Req |
|---------|----------------|-----|
| Transport | TLS 1.3 min, forced HTTPS redirect at Nginx | Sec-001 |
| CORS | Strict allowlist, no wildcards | Sec-002 |
| Passwords | bcrypt cost 12 | Sec-003 |
| Tokens | RS256 JWT, short-lived access + rotating refresh | Sec-004 |
| AuthZ | Auth + RBAC + ownership on every endpoint | Sec-005 |
| OTP | Expiry + single-use, Redis-hashed | Sec-006 |
| Data at rest | AES-256 for phone, wallet IDs, addresses (§17) | Sec-007 |
| Secrets | Secrets manager (prod) / Docker secrets + `.env` (dev), never in VCS | Sec-008 |
| Injection | Prisma parameterised queries only | Sec-009 |
| XSS | React escaping; `dangerouslySetInnerHTML` banned | Sec-010 |
| Webhooks | HMAC verification, reject invalid 401 | Sec-011 |
| Uploads | Server-side magic-byte + size validation | Sec-012 |
| Review | Full OWASP Top 10 audit before submission | Sec-013 |

Plus: Helmet security headers, CSRF protection on cookie-based flows, request-size limits, dependency scanning (`npm audit` / `pip-audit`) in CI.

---

## 17. Encryption

- **In transit:** TLS 1.3 (clients), TLS 1.2+ with HMAC for adapter calls (SRS §3.4).
- **At rest:** PostgreSQL volume encryption (managed-provider default) **plus** application-level **AES-256-GCM** field encryption for the most sensitive PII (phone numbers, wallet IDs, delivery addresses) using a key from the secrets store (REQ-NF-Security-007).
- **Passwords:** bcrypt (not encryption — one-way hash).
- **Tokens/OTPs:** signed (JWT) / hashed (OTP) — never stored in plaintext.
- **Key management:** keys in AWS Secrets Manager / equivalent in prod; rotation procedure documented; **no credential ever committed** (SRS §3.4).

---

## 18. Rate Limiting

- **Default:** 100 requests/min/IP at the API gateway (REQ-NF-Safety-005), backed by Redis (`rate-limiter-flexible` / `express-rate-limit` Redis store) so limits hold across multiple API instances.
- **Tighter buckets:** auth/OTP endpoints (e.g. OTP resends capped at 5/hour per the auth rules), payment endpoints, and AI-generation endpoints (cost control).
- **Response:** HTTP 429 with `Retry-After`.

---

## 19. Caching

| Cache | TTL | Purpose | Req |
|-------|-----|---------|-----|
| Product listings | 5 min | Reduce DB load on browse/detail | SRS §3.3.6 |
| Courier rate quotes | 1 min | Avoid re-querying adapters per view | SRS §3.3.6 |
| Search autocomplete | short | Fast suggestions | REQ-F-Browse-002 |
| Pre-aggregated analytics | per-range | <3s analytics reload | REQ-F-Analytics-005 |
| Session denylist (`jti`) | token TTL | Immediate revocation | REQ-F-Auth006 |

Cache invalidation on writes (e.g. product update busts its key). CDN caches static assets and images; service worker caches previously loaded pages (PWA, R1.1).

---

## 20. Scalability Strategy

- **Stateless services** (no in-process session state) → run N replicas behind Nginx; sticky sessions only for Socket.IO or use the Redis adapter for Socket.IO to share across instances.
- **Redis-backed queues** (BullMQ) absorb spikes; notification/tracking/AI work never blocks the request path.
- **DB scaling path:** connection pooling (PgBouncer), read replicas for analytics/browse-heavy reads, partitioning of high-volume tables (notifications, tracking history) when needed.
- **AI Service scales independently** (more replicas; GPU node for the CNN later).
- **Horizontal scale** is the primary lever; vertical only as a stopgap.

---

## 21. Performance Requirements

Targets carried from PRD §13.1 (SRS §5.1): primary screens <3s on 3G; AI generation <30s (with client-side compression); search <1s ≤100k listings; non-AI REST p95 <1s; tracking page <2s; PWA offline (R1.1). **Concurrency (REQ-NF-Perf005):** the SRS's flat 1,000-concurrent figure is treated as a **load-tested target matched to provisioned infrastructure** — MVP runs and is k6/JMeter-tested at a realistic level for a single small node, with the stateless/queue design above providing the path to 1,000+ when horizontally scaled. Techniques: Redis cache, CDN, lazy image loading, query indexing, pagination, gzip/brotli.

---

## 22. Deployment Architecture

- **Local / dev (REQ-NF-Quality-005):** `docker compose up` brings up web, api, ai-service, postgres, redis, nginx — full platform, one command.
- **Containerisation:** every service has a multi-stage Dockerfile; images built in CI.
- **Production (pragmatic for FYP):** a single VPS or a managed PaaS (e.g. Railway / Render) running the containers, with **managed PostgreSQL** (automated backups) and **managed Redis**. Nginx terminates TLS (Let's Encrypt). Object storage via Cloudinary/S3.
- **Config by environment:** dev / staging / prod via env files + secrets store; `ADAPTER_MODE` flips mock↔live per environment (D2).
- **Zero-downtime-ish deploys:** rolling container replace where the host supports it; otherwise brief maintenance window with health-gated cutover.

---

## 23. CI/CD Pipeline

**GitHub Actions**, triggered on PR and on merge to `main`:

1. **Install & cache** dependencies (pnpm, pip).
2. **Lint** — ESLint + Prettier check, Flake8 + Black, `tsc --noEmit`, `mypy`.
3. **Test** — Jest + Supertest (api), pytest (ai-service), with **coverage ≥80%** gate (REQ-NF-Quality-003); ephemeral Postgres/Redis service containers.
4. **Build** — production Docker images; tag by commit SHA.
5. **Security** — `npm audit` / `pip-audit`; secret scanning.
6. **Deploy** — on `main`, push images and deploy to staging; manual approval → prod.
7. **Migrations** — `prisma migrate deploy` runs gated before app cutover.

Branching and review process are detailed in Document 6.

---

## 24. Monitoring

- **Health endpoints:** `/health` (liveness) and `/ready` (readiness — DB, Redis, AI service reachable) per service.
- **Error tracking:** Sentry (or equivalent) on web, api, ai-service.
- **Uptime monitoring:** external pinger against `/health` for the 99.5% SLO (REQ-NF-Quality-001).
- **Metrics (lightweight for FYP):** request rate/latency/error-rate via pino logs + optional Prometheus client; adapter success/failure counters; queue depth and job failures (BullMQ board).
- **Alerts:** error-rate and queue-backlog thresholds notify the team.
- **KPI dashboard** (GMV, active users, adapter uptime) surfaced in the admin console (REQ-F-Admin-005) — product metrics, distinct from ops monitoring.

---

## 25. Backup Strategy

- **Database:** automated daily backups via the managed-Postgres provider; point-in-time recovery where available (REQ-NF-Safety-001). The SRS's "≥3 copies across separate AZs" is the **production target**; MVP relies on the provider's automated multi-copy backups, with multi-AZ/multi-region as Future scope (budget-dependent).
- **Object storage:** versioning enabled on the image bucket.
- **Restore drills:** a documented, periodically tested restore procedure (a backup is only as good as its last successful restore test).
- **Migrations:** every schema change is a reversible Prisma migration committed to VCS.

---

## 26. Disaster Recovery

- **Documented DR plan** with **RTO 4h / RPO 1h** (REQ-NF-Safety-002) — pragmatic for FYP: restore from the latest automated backup + redeploy containers from tagged images.
- **Rollback:** redeploy the last stable image tag within 30 minutes of a bad deploy (REQ-NF-Safety-006); migrations written to be reversible.
- **Graceful degradation** (REQ-NF-Safety-004) is the first line of defence: a single dependency outage degrades one feature, not the platform.
- **Financial integrity:** settlement/payment records immutable; recovery never rewrites them — corrections are compensating entries only (REQ-NF-Safety-007, REQ-F-COD-004).

---

## 27. Environment Variables

`.env.example` (no real secrets committed — Sec-008):

| Variable | Example / Purpose |
|----------|-------------------|
| `NODE_ENV` | `development` / `production` |
| `PORT_API` / `PORT_AI` | service ports |
| `DATABASE_URL` | Postgres connection string (D1) |
| `REDIS_URL` | Redis connection string |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | RS256 key pair (from secrets store) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | `3600` / `604800` |
| `BCRYPT_COST` | `12` |
| `FIELD_ENCRYPTION_KEY` | AES-256 key for PII fields (§17) |
| `ADAPTER_MODE` | `mock` (MVP) / `live` (D2) |
| `OPENAI_API_KEY` | LLM access (D3) |
| `LLM_PRIMARY_MODEL` / `LLM_FALLBACK_MODEL` | `gpt-4-vision...` / `gpt-3.5-turbo` (D3) |
| `RETURNS_CONFIDENCE_THRESHOLD` | e.g. `0.85` — below → manual review (D3) |
| `GCP_VISION_CREDENTIALS` | Cloud Vision service account (R1.1) |
| `JAZZCASH_*` / `EASYPAISA_*` | wallet creds (live mode only) |
| `TCS_*` / `LEOPARDS_*` / `TRAX_*` | courier creds (live mode only) |
| `TWILIO_*` / `AWS_SNS_*` | SMS (live mode) |
| `META_WHATSAPP_*` | WhatsApp (R1.1, live mode) |
| `GOOGLE_MAPS_API_KEY` | maps |
| `S3_*` / `CLOUDINARY_*` | object storage / CDN |
| `COMMISSION_RATE_DEFAULT` | `0.05` (admin-overridable in DB) |
| `RETURN_WINDOW_DAYS` | `14` (admin-overridable) |
| `MIN_ORDER_VALUE_PKR` | `100` (admin-overridable) |
| `CORS_ALLOWED_ORIGINS` | comma-separated allowlist |
| `SENTRY_DSN` | error tracking |

---

## 28. Third-Party Integrations (Adapter Layer)

All sit behind a stable interface; **mock in MVP, live later (D2)**.

| Domain | Providers | Adapter interface (key methods) | MVP | Live req'mt |
|--------|-----------|-------------------------------|-----|-------------|
| Payments | JazzCash, Easypaisa, COD | `charge()`, `refund()`, `verifyWebhook()`, `status()` | mock | merchant onboarding |
| Couriers | TCS, Leopards, Trax | `getRate()`, `checkCoverage()`, `book()`, `track()`, `cancel()` | mock | merchant API access |
| SMS | Twilio / AWS SNS | `sendSms(to, templateKey, vars, lang)` | mock/real | API key |
| WhatsApp (R1.1) | Meta Cloud API | `sendTemplate(to, template, vars)` | — | Business approval |
| Email (optional) | SendGrid / SES | `sendEmail(...)` | optional | API key |
| LLM | OpenAI GPT-4V → GPT-3.5 (D3) | `generateListing(image, hint) -> JSON` | real (low cost) | API key |
| Vision (R1.1) | Google Cloud Vision | `analyze(images) -> labels` | — | service account |
| Maps | Google Maps JS / Geocoding / Distance Matrix | `geocode()`, `distanceMatrix()`, render | mockable | API key |
| Object storage | S3 / Cloudinary / MinIO | `upload()`, `getUrl()` | real (dev MinIO) | bucket |

Each adapter ships with: the interface, a `MockAdapter` (deterministic, demo-friendly responses incl. simulated failures/timeouts to exercise degradation paths), and a `LiveAdapter` added later. Selection via `ADAPTER_MODE` + a factory.

---

## 29. Technical Risks

| ID | Risk | Mitigation |
|----|------|------------|
| T1 | Real provider access blocked for students | D2 adapters; mocks emulate full request/response/webhook shapes |
| T2 | LLM cost overrun | Monitor from Week 2; cache; GPT-3.5 default for non-critical; per-key rate limits |
| T3 | CNN below 95% (R1.1) | D3 confidence threshold → manual review; never blocks deploy |
| T4 | 3G perf vs large uploads | Client-side compression; lazy load; CDN; brotli |
| T5 | Two-service local complexity | One-command Docker Compose; thorough README (REQ-NF-Quality-005) |
| T6 | Single-node capacity vs 1,000 concurrent | Stateless + queue design; horizontal-scale path; realistic MVP load target |
| T7 | Urdu RTL/font rendering & perf | Early spike; font subsetting; test on low-end Android |
| T8 | Webhook spoofing | HMAC verification (Sec-011); idempotency keys |
| T9 | Distributed work consistency (queues) | Idempotent consumers; retries with backoff; dead-letter queues |
| T10 | Secret leakage | Secrets store; secret scanning in CI; `.env` git-ignored |

---

## 30. Future Scaling Strategy

- **Search:** migrate FTS from Postgres `tsvector` to OpenSearch/Elasticsearch if listings far exceed 100k.
- **AI:** dedicated GPU node for self-hosted models (LLaMA fallback, F24) and the CNN; batch inference.
- **Data:** read replicas, table partitioning (notifications, tracking history), `pgvector` for semantic search/recommendations.
- **Services:** peel notifications/tracking pollers into independent workers (already queue-isolated).
- **Multi-region:** active-passive DR, multi-AZ backups (Future per budget) to meet the full SRS safety target.
- **Edge:** CDN for the PWA shell; regional image edge caching.

---

*End of Document 2 (TRD). On approval, the next document is the **Application Flow Document** — every screen (purpose, components, inputs/outputs, navigation, validation, and all UI states), plus the auth/admin/user/notification/payment/CRUD/search/filter/profile/settings flows and a full textual flowchart.*
