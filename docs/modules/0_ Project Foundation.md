Claude Link For Complete Feature 0 : Project Setup  
  
[https://claude.ai/share/46ef8c59-fbec-4e36-bba7-c67e3e0a20e3](https://claude.ai/share/46ef8c59-fbec-4e36-bba7-c67e3e0a20e3)  
  
**KarobarAI — Engineering Execution Playbook**

## **Feature 0: Project Foundation**

**Source of truth:** PRD · TRD · App Flow · Backend Schema · Implementation Plan (Docs 1–6). This playbook does not introduce any decision not already present in those documents — it operationalizes them.

## **Table of Contents**

1.  [Feature Overview](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#feature-overview)
2.  [GitHub Repository](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-1-github-repository)
3.  [Development Environment](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-2-development-environment)
4.  [Frontend Project Setup](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-3-frontend-project-setup)
5.  [Backend Project Setup](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-4-backend-project-setup)
6.  Folder Structure *(pending)*
7.  Coding Standards *(pending)*
8.  Branch Strategy *(pending)*
9.  Shared Components *(pending)*
10.  Theme Configuration *(pending)*
11.  Routing *(pending)*
12.  API Structure *(pending)*
13.  Project Validation *(pending)*

## **Feature Overview**

**What Feature 0 covers:** the zero-business-logic scaffolding that every other feature (AI Store Builder, Logistics, Tracking, Returns, Analytics, Auth, Admin) will be built on top of. Maps directly to **Implementation Plan Phase 1 (Project Setup)** and **Phase 2 (Architecture)**, weeks 1–2.

**What it explicitly excludes:** authentication logic, database schema migration content, business endpoints, AI integration, adapters' real logic. Those are Feature 1+.

**Binding architectural facts this playbook assumes (do not re-derive, do not contradict):**

| **Decision** | **Source** | **Value** |
| --- | --- | --- |
| Datastore | PRD D1 | Single PostgreSQL 16, Prisma ORM |
| --- | --- | --- |
| External providers | PRD D2 | Adapter pattern, mock-first |
| --- | --- | --- |
| Services | TRD §1 | Two deployables: api (Node/Express/TS), ai-service (Python/FastAPI) + web (React/Vite PWA) |
| --- | --- | --- |
| Repo shape | TRD §12 | Single repo, pnpm workspaces, apps/\* + packages/shared + infra/ |
| --- | --- | --- |
| Architecture style | TRD §11 | Modular monolith (Core API) + one isolated AI service — **not** microservices |
| --- | --- | --- |
| Branching | Impl. Plan §20 | GitHub Flow |
| --- | --- | --- |
| Coverage gate | PRD REQ-NF-Quality-003 | ≥80% backend, enforced in CI |
| --- | --- | --- |
| Local run | PRD REQ-NF-Quality-005 | docker compose up — one command, full stack |
| --- | --- | --- |

**Definition of "Feature 0 done":** a developer can clone the repo, run one command, and have web + api + ai-service + postgres + redis + nginx all healthy, with CI green on an empty PR, linting enforced, and the folder/routing/theme/API skeletons in place for every subsequent feature to slot into without restructuring.

## **Task 1: GitHub Repository**

### **Purpose**

-   Establish the single monorepo that hosts all three deployables plus shared code, matching TRD §12 exactly.
-   Put branch protection and CI gating in place *before* any feature code lands, per Implementation Plan §20–21.
-   Prevent early structural drift that would force a costly re-split later (TRD §11 explicitly warns against this for the AI service boundary).

### **Expected Deliverables**

-   \[ \] GitHub repo karobarai created (private, org-owned)
-   \[ \] main branch protected (PR + green CI + 1 approval required)
-   \[ \] Base repo files: README.md, .gitignore, LICENSE, .env.example, CODEOWNERS
-   \[ \] Empty .github/workflows/ directory ready for CI (wired in Task 2/12)
-   \[ \] Initial commit tagged v0.0.0-scaffold

### **Prerequisites**

-   GitHub org/account access with repo-creation rights
-   Git installed locally, SSH key configured

### **Step-by-Step Execution**

**Step 1 — Create the repository**

-   **Objective:** stand up the empty monorepo shell.
-   **Action:** Create a **private** repo named karobarai. Do not initialize with a template license/gitignore from GitHub's UI — these are added manually in Step 3 to match project conventions.
-   **Expected Output:** empty repo with default branch main.
-   **Verification:** repo visible at github.com/<org>/karobarai, no files present.
-   **Next Step:** Step 2.

**Step 2 — Clone and set remote**

-   **Objective:** get a local working copy.
-   **Action:** git clone the repo locally.
-   **Expected Output:** local karobarai/ folder tracking origin/main.
-   **Verification:** git remote -v shows correct origin URL.
-   **Next Step:** Step 3.

**Step 3 — Add baseline files**

-   **Objective:** seed the repo with non-negotiable root files before any app code.
-   **Action:** Add:
    -   .gitignore — covering node\_modules/, dist/, .env, \_\_pycache\_\_/, \*.pyc, .venv/, Prisma migration lock artifacts to exclude, .turbo/
    -   README.md — placeholder with project name + "see Task 2 for setup" note (filled in properly at Task 12)
    -   .env.example — stub file, populated fully in Task 2 per TRD §27
    -   LICENSE — per FYP/academic requirements (confirm with supervisor; default to proprietary/UNLICENSED for FYP submission)
    -   CODEOWNERS — both students as owners of apps/, packages/, infra/
-   **Expected Output:** 5 files committed to main.
-   **Verification:** git log shows the baseline commit; files render correctly on GitHub.
-   **Next Step:** Step 4.

**Step 4 — Configure branch protection on main**

-   **Objective:** enforce Implementation Plan §20 rules from day one.
-   **Action:** In repo Settings → Branches, protect main:
    -   Require PR before merging
    -   Require 1 approving review
    -   Require status checks to pass (CI — will populate once Task 2's workflow exists; enable "require branches up to date" too)
    -   Disallow direct pushes (including for admins, if the team agrees)
-   **Expected Output:** main shows a lock icon; direct push attempt is rejected.
-   **Verification:** attempt a direct push to main locally → rejected with protection message.
-   **Next Step:** Step 5.

**Step 5 — Create workflow directory placeholder**

-   **Objective:** reserve the CI location so Task 2's Docker Compose work and Task 12's validation both have somewhere to attach checks.
-   **Action:** create .github/workflows/.gitkeep (actual pipeline YAML is written in Task 12 — do not write pipeline logic here).
-   **Expected Output:** empty workflows directory tracked in git.
-   **Verification:** .github/workflows/ visible in repo tree.
-   **Next Step:** proceed to Task 2.

### **Engineering Decisions**

| **Decision** | **Rationale** |
| --- | --- |
| Single repo (not multi-repo per service) | TRD §12 mandates one repo with apps/\*; keeps atomic PRs across api/web/ai-service |
| --- | --- |
| Branch protection enabled before any app code | Prevents "we'll add rules later" drift on a 2-person FYP team with a hard 20-week clock |
| --- | --- |
| No GitHub template .gitignore/license | Avoids pulling in irrelevant Node/Python boilerplate not matched to this exact stack |
| --- | --- |

### **Common Mistakes**

-   Initializing the repo as public — FYP source should stay private until the team decides otherwise.
-   Skipping branch protection "until later" — it never gets configured once feature work starts.
-   Creating apps/web, apps/api etc. in this task — that's Tasks 3–5, not here.

### **Definition of Done**

-   \[ \] Repo exists, private, cloned locally by both developers
-   \[ \] main protected per Step 4
-   \[ \] Baseline files committed
-   \[ \] No app code present yet (this task is repo plumbing only)

## **Task 2: Development Environment**

### **Purpose**

-   Guarantee REQ-NF-Quality-005 ("entire stack Docker-containerised; runnable locally with one command") from the very first week.
-   Eliminate "works on my machine" drift across the 2-person team on a fixed 20-week schedule.
-   Stand up Postgres/Redis/Nginx alongside the three app containers so later features never need infra changes.

### **Expected Deliverables**

-   \[ \] infra/docker-compose.yml — web, api, ai-service, postgres, redis, nginx
-   \[ \] .env.example fully populated per TRD §27
-   \[ \] Local tool versions pinned and documented
-   \[ \] docker compose up brings the full stack up with all health checks green

### **Prerequisites**

-   Task 1 complete
-   Docker + Docker Compose installed locally
-   Node.js 20 LTS, pnpm, Python 3.11 installed locally (for non-container dev/debug)

### **Step-by-Step Execution**

**Step 1 — Pin local tool versions**

-   **Objective:** remove version ambiguity across the two developers' machines.
-   **Action:** Add an .nvmrc (20) at repo root and a .python-version (3.11) at repo root; document both plus pnpm version in README.md.
-   **Expected Output:** two version-pin files committed.
-   **Verification:** node -v / python --version match on both dev machines.
-   **Next Step:** Step 2.

**Step 2 — Populate .env.example**

-   **Objective:** have one canonical list of every environment variable the stack needs, per TRD §27.
-   **Action:** Fill .env.example with all TRD §27 variables (grouped by concern): NODE\_ENV, ports, DATABASE\_URL, REDIS\_URL, JWT keys, BCRYPT\_COST, FIELD\_ENCRYPTION\_KEY, ADAPTER\_MODE=mock, OPENAI\_API\_KEY, LLM\_PRIMARY\_MODEL/LLM\_FALLBACK\_MODEL, RETURNS\_CONFIDENCE\_THRESHOLD, courier/wallet/SMS/WhatsApp/maps/storage vars (blank placeholders — real creds are Future/live-mode only), COMMISSION\_RATE\_DEFAULT, RETURN\_WINDOW\_DAYS, MIN\_ORDER\_VALUE\_PKR, CORS\_ALLOWED\_ORIGINS, SENTRY\_DSN. No real secrets — placeholders only (Sec-008).
-   **Expected Output:** .env.example with every variable name + a dummy/mock value or comment.
-   **Verification:** grep TRD §27's table against the file — 1:1 coverage, nothing missing.
-   **Next Step:** Step 3.

**Step 3 — Write infra/docker-compose.yml**

-   **Objective:** define the six-service local stack from Implementation Plan Phase 1.
-   **Action:** Define services: web (Vite dev server, hot reload), api (Node/Express, nodemon/ts-node-dev), ai-service (Uvicorn --reload), postgres (v16, named volume, healthcheck), redis (v7, healthcheck), nginx (reverse proxy, routes /api → api, static → web build, per TRD §1/§22). All services on one Docker network. api/ai-service/web read env from repo-root .env.
-   **Expected Output:** single docker-compose.yml under infra/.
-   **Verification:** docker compose config validates with no errors.
-   **Next Step:** Step 4.

**Step 4 — First boot**

-   **Objective:** confirm the one-command promise.
-   **Action:** Copy .env.example → .env, run docker compose -f infra/docker-compose.yml up.
-   **Expected Output:** all 6 containers start; postgres/redis report healthy.
-   **Verification:** docker compose ps shows all services Up/healthy; ports reachable (localhost for web/nginx, internal network for postgres/redis).
-   **Next Step:** Step 5.

**Step 5 — Document the one-command flow in README**

-   **Objective:** make onboarding trivial for both developers (and any grader/supervisor).
-   **Action:** Write the "Quick Start" section of README.md: clone → copy .env.example → docker compose up → URLs for web/api docs.
-   **Expected Output:** README quick-start section.
-   **Verification:** a teammate follows only the README and reaches a running stack with zero out-of-band help.
-   **Next Step:** proceed to Task 3.

### **Common Errors and Resolution**

| **Error** | **Resolution** |
| --- | --- |
| Postgres container "healthy" but API can't connect | DATABASE\_URL host must be the Compose service name (postgres), not localhost, from inside containers |
| --- | --- |
| Port conflicts on 5432/6379 with a locally-installed Postgres/Redis | Stop local services or remap host ports in Compose |
| --- | --- |
| ai-service fails to boot (missing deps) | Confirm requirements.txt/pyproject.toml exists — created in Task 4, not this task; if boot-tested early, expect a stub failure until Task 4 |
| --- | --- |

### **Engineering Decisions**

| **Decision** | **Rationale** |
| --- | --- |
| Nginx included from Task 2, not deferred | TRD §1/§22 name Nginx as a core component (TLS, routing); adding it later means re-testing routing under load with no time buffer |
| --- | --- |
| .env (not .env.local per app) | Single source of env vars shared by all three services, matching TRD's flat .env.example |
| --- | --- |
| Dev containers use hot-reload, not production build | Feature velocity for a 20-week team matters more than prod-parity at this stage; prod build path is Task 4/Deployment (Phase 13) |
| --- | --- |

### **Definition of Done**

-   \[ \] docker compose up (single command) brings up all 6 services healthy
-   \[ \] .env.example matches TRD §27 completely
-   \[ \] README quick-start verified by the second developer independently

## **Task 3: Frontend Project Setup**

### **Purpose**

-   Scaffold apps/web exactly to the TRD §4 stack so every later feature (Store Builder, Cart, Tracking, Analytics) has a consistent base.
-   Get the PWA/i18n/RTL foundation in early — Urdu RTL rendering is flagged as risk **T7/R7** and needs an early spike, not a late retrofit.
-   Avoid re-scaffolding mid-project by locking dependency choices now.

### **Expected Deliverables**

-   \[ \] apps/web Vite + React 18 + TypeScript project, strict mode
-   \[ \] All TRD §4 libraries installed and version-pinned
-   \[ \] PWA plugin configured (service worker present, even if offline caching logic is R1.1)
-   \[ \] ESLint + Prettier configured, zero errors on empty scaffold
-   \[ \] App boots inside the Task 2 Compose stack

### **Prerequisites**

-   Tasks 1–2 complete

### **Step-by-Step Execution**

**Step 1 — Scaffold the Vite project**

-   **Objective:** create apps/web with the React+TS template.
-   **Action:** Initialize a Vite React-TS app inside apps/web. Enable strict: true in tsconfig.json (TRD §13 — TypeScript strict mode).
-   **Expected Output:** working Vite dev server on a blank page.
-   **Verification:** pnpm --filter web dev serves without TS errors.
-   **Next Step:** Step 2.

**Step 2 — Install the full TRD §4 dependency set**

-   **Objective:** lock in every frontend library the PRD/TRD name, so no feature branch needs an ad-hoc pnpm add.
-   **Action:** Install: antd (RTL via ConfigProvider), @tanstack/react-query, zustand, react-hook-form + zod, react-i18next + Urdu font asset (Noto Nastaliq) + English (Plex, per Doc 4 tokens — confirmed in Task 9), recharts, socket.io-client, browser-image-compression, vite-plugin-pwa. Pin exact versions in package.json (no ^/~ ranges) to avoid mid-project drift.
-   **Expected Output:** package.json with all libraries listed.
-   **Verification:** pnpm install succeeds with no peer-dependency errors.
-   **Next Step:** Step 3.

**Step 3 — Configure vite-plugin-pwa**

-   **Objective:** stand up the service-worker skeleton now (REQ-NF-Perf007 is R1.1, but the plugin wiring is Feature-0-appropriate scaffolding).
-   **Action:** Add vite-plugin-pwa to vite.config.ts with a minimal manifest (name, icons placeholder, theme color — real tokens come from Task 9). Set registerType: 'prompt'; do not implement offline caching strategies yet (out of scope — R1.1, Phase 8/16).
-   **Expected Output:** service worker registers on build; app is installable.
-   **Verification:** pnpm --filter web build && pnpm --filter web preview — DevTools Application tab shows a registered service worker.
-   **Next Step:** Step 4.

**Step 4 — Configure ESLint + Prettier**

-   **Objective:** satisfy REQ-NF-Quality-006 (zero lint errors in CI) from the first commit.
-   **Action:** Add ESLint (TS + React hooks + a11y plugin, given WCAG 2.1 AA target) and Prettier config at repo root (shared with packages/shared, not duplicated per-app).
-   **Expected Output:** .eslintrc, .prettierrc at root; apps/web extends root config.
-   **Verification:** pnpm --filter web lint returns 0 errors on the blank scaffold.
-   **Next Step:** Step 5.

**Step 5 — Wire into Docker Compose**

-   **Objective:** confirm web boots inside the Task 2 stack, not just standalone.
-   **Action:** Add/adjust the web service Dockerfile (dev-mode, hot reload) referenced by infra/docker-compose.yml.
-   **Expected Output:** docker compose up serves the Vite app through the container.
-   **Verification:** blank scaffold page loads at the Compose-exposed port.
-   **Next Step:** proceed to Task 4.

### **Engineering Decisions**

| **Decision** | **Rationale** |
| --- | --- |
| AntD over MUI | TRD §4 states both are SRS-allowed; AntD chosen for first-class RTL (ConfigProvider direction="rtl") and dense tables needed for seller/admin dashboards |
| --- | --- |
| Zustand for client state (not Redux) | TRD §4 — minimal global state (auth, language, cart hydration) doesn't justify Redux overhead |
| --- | --- |
| Exact-pinned versions, no semver ranges | Small team, fixed 20-week clock — dependency surprises mid-sprint are not affordable |
| --- | --- |
| Service worker registered but not yet caching | Matches PRD scope tags: PWA offline support is R1.1 (F22), not MVP |
| --- | --- |

### **Common Mistakes**

-   Adding component-level styling decisions here — that belongs to Task 9 (Theme Configuration).
-   Building actual routes/pages here — that's Task 10.
-   Loose (^) version ranges that silently upgrade a UI library mid-sprint.

### **Definition of Done**

-   \[ \] apps/web boots via Compose and standalone
-   \[ \] All TRD §4 libraries installed, pinned
-   \[ \] Lint/format clean on scaffold
-   \[ \] Service worker registers (empty caching strategy is acceptable at this stage)

## **Task 4: Backend Project Setup**

### **Purpose**

-   Scaffold both backend deployables — apps/api (Node/Express/TS) and apps/ai-service (Python/FastAPI) — per TRD §5, keeping them isolated per the TRD §11 two-service decision.
-   Get Prisma pointed at the single PostgreSQL instance (D1) so Task 4-of-Implementation-Plan (schema) has a home to land in — **schema content itself is out of scope for Feature 0**.
-   Establish the AI service as internal-only from day one (TRD §8 — "never reachable from the public internet").

### **Expected Deliverables**

-   \[ \] apps/api — Express + TS project with Prisma initialized (no schema/models yet — empty schema.prisma with datasource/generator blocks only)
-   \[ \] apps/ai-service — FastAPI project with health endpoint only
-   \[ \] Both services containerized and wired into infra/docker-compose.yml
-   \[ \] Both pass lint/type-check with zero errors on scaffold

### **Prerequisites**

-   Tasks 1–2 complete

### **Step-by-Step Execution**

**Step 1 — Scaffold apps/api**

-   **Objective:** create the Express + TS project shell.
-   **Action:** Initialize apps/api with TypeScript strict mode, Express. Install core TRD §5.1 dependencies: prisma/@prisma/client, zod, jsonwebtoken, bcrypt, bullmq, ioredis, socket.io, swagger-jsdoc+swagger-ui-express, pino, undici/axios. Testing: jest, supertest, coverage via c8/istanbul.
-   **Expected Output:** apps/api/package.json with all TRD §5.1 deps pinned.
-   **Verification:** pnpm --filter api install succeeds.
-   **Next Step:** Step 2.

**Step 2 — Initialize Prisma (schema-empty)**

-   **Objective:** connect apps/api to PostgreSQL per D1, without pulling schema content into this feature.
-   **Action:** prisma init inside apps/api; set datasource db { provider = "postgresql" } pointed at DATABASE\_URL; leave schema.prisma model-free (only datasource + generator blocks). Actual 25-table schema is a separate feature (per Implementation Plan Phase 4 / Backend Schema Doc).
-   **Expected Output:** apps/api/prisma/schema.prisma (empty of models), Prisma Client generates cleanly.
-   **Verification:** pnpm --filter api prisma generate succeeds against a running Postgres container.
-   **Next Step:** Step 3.

**Step 3 — Add a single /health endpoint**

-   **Objective:** prove the Express app boots and can be probed, per TRD §24 monitoring pattern (full readiness/dependency checks come later — this is the scaffold-level check only).
-   **Action:** Add GET /health returning the standard envelope ({ success, data, error, timestamp } per TRD §9) with a static "ok" payload.
-   **Expected Output:** working health route.
-   **Verification:** curl localhost:<PORT\_API>/health returns 200 with the envelope shape.
-   **Next Step:** Step 4.

**Step 4 — Configure lint/type-check for apps/api**

-   **Objective:** satisfy REQ-NF-Quality-006 for the backend.
-   **Action:** Extend the root ESLint/Prettier config (Task 3, Step 4) into apps/api; add tsc --noEmit as a check script.
-   **Expected Output:** pnpm --filter api lint and pnpm --filter api typecheck both pass.
-   **Verification:** zero errors on scaffold.
-   **Next Step:** Step 5.

**Step 5 — Scaffold apps/ai-service**

-   **Objective:** create the FastAPI project shell per TRD §5.2.
-   **Action:** Initialize apps/ai-service with Python 3.11, FastAPI + Uvicorn, Pydantic. Add mypy, flake8, black, pytest as dev deps. Add a single GET /health endpoint. **Do not** implement /generate-listing or any AI logic here — out of scope for Feature 0.
-   **Expected Output:** apps/ai-service boots with Uvicorn, responds on /health.
-   **Verification:** curl localhost:<PORT\_AI>/health returns 200.
-   **Next Step:** Step 6.

**Step 6 — Enforce internal-only reachability**

-   **Objective:** satisfy TRD §8 — AI service must never be publicly reachable.
-   **Action:** In infra/docker-compose.yml and Nginx config, ensure ai-service has **no** host port published and is **not** routed through Nginx; only api can reach it over the internal Docker network.
-   **Expected Output:** ai-service unreachable from host machine's browser; reachable from api container via internal DNS name.
-   **Verification:** attempt curl localhost:<AI\_PORT> from host → connection refused; curl from inside the api container → 200.
-   **Next Step:** Step 7.

**Step 7 — Wire both into Docker Compose + verify full-stack boot**

-   **Objective:** confirm all Feature-0 pieces boot together.
-   **Action:** Finalize api and ai-service entries in infra/docker-compose.yml (dev-mode, hot reload: ts-node-dev/nodemon for api, uvicorn --reload for ai-service).
-   **Expected Output:** full docker compose up — all 6 services healthy, web reachable, api /health and ai-service /health (internally) both 200.
-   **Verification:** re-run Task 2 Step 4 verification; confirm no regressions.
-   **Next Step:** proceed to Task 5 (Folder Structure).

### **Common Errors and Resolution**

| **Error** | **Resolution** |
| --- | --- |
| Prisma can't reach Postgres at generate/migrate time | Ensure postgres container is healthy before api starts (Compose depends\_on: condition: service\_healthy) |
| --- | --- |
| ai-service accidentally exposed on host | Remove any ports: mapping for ai-service in Compose; route only through api's internal call |
| --- | --- |
| Type-check fails on strict mode with third-party JS libs | Add targeted @types/\* packages; do not disable strict |
| --- | --- |

### **Engineering Decisions**

| **Decision** | **Rationale** |
| --- | --- |
| Empty Prisma schema at this stage | Schema content (25 tables, Doc 5) is explicitly out of scope for Feature 0 — belongs to the Database feature (Implementation Plan Phase 4) |
| --- | --- |
| AI service has zero AI logic yet | Listing generation, ReturnsAI, and recommendations are separate features; TRD §5.2 stack is only scaffolded here |
| --- | --- |
| AI service never exposed on host or via Nginx | Hard requirement, TRD §8 — set as an architectural constant from the first container definition, not retrofitted |
| --- | --- |
| Standard response envelope used even for /health | TRD §9 envelope is a system-wide contract — introducing exceptions now creates inconsistency later |
| --- | --- |

### **Definition of Done**

-   \[ \] apps/api and apps/ai-service both boot via Compose
-   \[ \] /health on both returns correctly (envelope on api, plain on ai-service)
-   \[ \] ai-service confirmed unreachable from host
-   \[ \] Prisma Client generates against the live Postgres container (no models yet)
-   \[ \] Lint/type-check clean on both services

*End of Response 1 — Tasks 1–4 complete. Awaiting confirmation before continuing with Tasks 5–8 (Folder Structure, Coding Standards, Branch Strategy, Shared Components).*

Noted — MinIO patch to Task 2 deferred to the final consistency-check pass (Response 3). Continuing with Tasks 5–8.

## **Task 5: Folder Structure**

### **Purpose**

-   Lock the exact directory layout from TRD §12 before any feature branch starts, so no team member invents a divergent structure under deadline pressure.
-   Give every future feature (AI Store Builder, Logistics, Returns, etc.) a pre-known "slot" to land in.
-   Keep the adapter layer (D2), state machines, and module boundaries physically separated from day one.

### **Expected Deliverables**

-   \[ \] Full directory tree created (empty placeholder files where needed) matching TRD §12
-   \[ \] packages/shared initialized for cross-app TS types/enums/error codes
-   \[ \] .gitkeep/index.ts stubs so empty folders survive git tracking
-   \[ \] A FOLDER\_STRUCTURE.md reference committed at repo root (or in /docs)

### **Prerequisites**

-   Tasks 1–4 complete (both apps scaffolded)

### **Step-by-Step Execution**

**Step 1 — Create the top-level tree**

-   **Objective:** establish apps/, packages/, infra/ as siblings at repo root.
-   **Action:** Confirm/create: apps/web, apps/api, apps/ai-service (already scaffolded in Tasks 3–4), packages/shared, infra/.
-   **Expected Output:** root-level tree matches TRD §12's top structure exactly.
-   **Verification:** tree -L 2 output diffed against TRD §12.
-   **Next Step:** Step 2.

**Step 2 — Build out apps/web/src structure**

-   **Objective:** pre-create the frontend's internal folders so Task 10 (Routing) and every feature branch has a known home.
-   **Action:** Create empty (stub index.ts/.gitkeep) folders: app/ (routing, providers, i18n, theme), features/ with subfolders seller/, buyer/, admin/, auth/, components/ (shared UI), hooks/, lib/, api/ (TanStack Query clients), locales/ with en/ and ur/, pwa/.
-   **Expected Output:** apps/web/src tree matches TRD §12.
-   **Verification:** structure diff against TRD §12 web tree.
-   **Next Step:** Step 3.

**Step 3 — Build out apps/api/src structure**

-   **Objective:** pre-create backend module folders, adapter layer, and core cross-cutting folders.
-   **Action:** Create: modules/ with one empty subfolder per domain (auth/, catalog/, cart/, order/, payment/, logistics/, tracking/, returns/, notification/, admin/) — each with placeholder controller/service/routes/dto file stubs; adapters/ with payment/, courier/, sms/, whatsapp/, maps/ (each expecting index.ts interface + mock.ts + live.ts per D2, created empty here); core/ with state-machines/, errors/, middleware/, config/, logger/, redis/, queue/; prisma/ (already has empty schema.prisma from Task 4).
-   **Expected Output:** apps/api/src tree matches TRD §12.
-   **Verification:** structure diff against TRD §12 api tree; confirm adapters folder has one subfolder per D2 provider domain.
-   **Next Step:** Step 4.

**Step 4 — Build out apps/ai-service/app structure**

-   **Objective:** pre-create AI service folders per TRD §5.2/§12.
-   **Action:** Create: routers/ (stub for future generate\_listing, analyze\_return \[R1.1\], recommend \[R1.1\]), llm/ (provider client + fallback chain — D3, empty), vision/ \[R1.1 stub\], cnn/ \[R1.1 stub\], schemas/ (Pydantic models folder).
-   **Expected Output:** apps/ai-service/app tree matches TRD §12.
-   **Verification:** structure diff against TRD §12 ai-service tree.
-   **Next Step:** Step 5.

**Step 5 — Initialize packages/shared**

-   **Objective:** create the single location for cross-app TypeScript types, enums, and error codes (TRD §12) so web and api never duplicate contract definitions.
-   **Action:** Scaffold packages/shared as a pnpm workspace package (@karobarai/shared) exporting empty placeholders: types/ (to hold order status enums, DTOs later), errors/ (error-code constants, matching TRD §14's typed error hierarchy names), enums/ (mirroring Schema Doc §3 Postgres enums as TS string-literal unions — no values populated yet, just the file structure).
-   **Expected Output:** packages/shared/package.json + empty export structure; apps/web and apps/api can import from @karobarai/shared.
-   **Verification:** a test import (import {} from '@karobarai/shared') resolves with no build error from both web and api.
-   **Next Step:** Step 6.

**Step 6 — Document the structure**

-   **Objective:** give the team a single reference so nobody has to re-derive TRD §12 mid-sprint.
-   **Action:** Write FOLDER\_STRUCTURE.md — a rendered tree with a one-line purpose comment per top-level folder, linking back to TRD §12.
-   **Expected Output:** committed reference doc.
-   **Verification:** doc tree matches actual repo tree (spot-check).
-   **Next Step:** proceed to Task 6.

### **Engineering Decisions**

| **Decision** | **Rationale** |
| --- | --- |
| Folders created empty (not deferred to "whenever a feature needs them") | Prevents structural bikeshedding once feature work starts under the 20-week clock; the shape is a solved problem after Feature 0 |
| --- | --- |
| Adapter subfolders pre-created per provider domain | D2 is central to the whole build (payments, couriers all mocked); having the folder shape fixed avoids 5 different adapter conventions across features |
| --- | --- |
| packages/shared seeded now, even mostly empty | Enums (order\_status, payment\_status, etc.) will be needed by both web and api from the first real feature — the import path should already work |
| --- | --- |

### **Common Mistakes**

-   Putting shared types directly in apps/api/src and importing them into apps/web via relative paths (../../../api/...) instead of through packages/shared — breaks the moment either app is deployed separately.
-   Naming module folders inconsistently with Schema Doc entity names (e.g., orders/ vs order/) — TRD §12 uses singular (order/, payment/); keep singular for module folders, plural for DB tables (Schema Doc §2 naming standard) — these are deliberately different conventions and should not be unified.
-   Skipping empty-folder stubs — Git doesn't track empty directories; missing .gitkeep/index.ts means the structure silently disappears after clone.

### **Definition of Done**

-   \[ \] Full tree matches TRD §12 across web, api, ai-service, packages/shared
-   \[ \] packages/shared importable from both apps
-   \[ \] FOLDER\_STRUCTURE.md committed and accurate
-   \[ \] No empty-folder git-tracking gaps

## **Task 6: Coding Standards**

### **Purpose**

-   Encode TRD §13 (Coding Standards) and REQ-NF-Quality-006 (zero lint errors in CI) as enforced tooling, not tribal knowledge.
-   Prevent style debates from consuming review time on a 2-person team with 1 mandatory approval per PR (Implementation Plan §21).
-   Make "no magic values" (SRS §5.5 — commission, return window, courier weights, min order must come from config/DB) and "Prisma-only, no raw SQL" (Sec-009) enforceable, not just aspirational.

### **Expected Deliverables**

-   \[ \] Root ESLint + Prettier config (TS, shared by web/api/packages/shared)
-   \[ \] apps/ai-service Flake8 + Black + mypy config
-   \[ \] Pre-commit hook (lint-staged or equivalent) blocking bad commits locally
-   \[ \] CODING\_STANDARDS.md capturing naming/commit conventions

### **Prerequisites**

-   Tasks 3–5 complete

### **Step-by-Step Execution**

**Step 1 — Finalize root ESLint config**

-   **Objective:** one authoritative TS/React lint config, extended (not duplicated) by every TS package.
-   **Action:** At repo root: @typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-jsx-a11y (WCAG 2.1 AA target, PRD §13.4), import-order rule. apps/web/apps/api/packages/shared each extend this root config with app-specific overrides only where unavoidable (e.g., React rules only in web).
-   **Expected Output:** single root .eslintrc.\*; per-app configs are thin extensions.
-   **Verification:** pnpm -r lint (recursive across workspaces) returns 0 errors.
-   **Next Step:** Step 2.

**Step 2 — Finalize root Prettier config**

-   **Objective:** consistent formatting with zero manual bikeshedding.
-   **Action:** One .prettierrc at root (semi, single-quote, trailing-comma, print-width — team's choice, documented once and not revisited); .prettierignore excludes dist/, node\_modules/, Prisma generated client.
-   **Expected Output:** single formatting config, applied repo-wide.
-   **Verification:** pnpm -r format:check passes.
-   **Next Step:** Step 3.

**Step 3 — Configure Python tooling for apps/ai-service**

-   **Objective:** match TRD §13's Flake8 + Black + mypy requirement for the Python side.
-   **Action:** Add pyproject.toml (Black config), .flake8 (line length matched to Black), mypy.ini (strict-ish: disallow\_untyped\_defs = True on new code).
-   **Expected Output:** three config files in apps/ai-service.
-   **Verification:** black --check ., flake8 ., mypy . all pass on the Task 4 scaffold.
-   **Next Step:** Step 4.

**Step 4 — Install pre-commit enforcement**

-   **Objective:** catch lint/format violations before they reach CI, saving review cycles.
-   **Action:** Add husky + lint-staged at root (TS/JS files auto-fixed + linted on commit); for Python, a pre-commit (framework) hook running black/flake8 on staged .py files. Both wired into a single .husky/pre-commit script or documented as two separate local hooks if tooling can't unify.
-   **Expected Output:** a deliberately broken commit (e.g., unused variable) is blocked locally before it reaches GitHub.
-   **Verification:** attempt a bad commit → hook rejects it; fix → commit succeeds.
-   **Next Step:** Step 5.

**Step 5 — Write CODING\_STANDARDS.md**

-   **Objective:** capture the non-tool-enforceable conventions from TRD §13 in one place (naming, commit format, "no magic values", controller-thin/service-thick pattern).
-   **Action:** Document: naming conventions table (from TRD §13 — camelCase/PascalCase/snake\_case/SCREAMING\_SNAKE, mapped to where each applies); Conventional Commits format with examples (feat:, fix:, chore:, docs:); the "config/DB not hardcode" rule with a concrete KarobarAI example (commission rate, return window, courier weights — must be read from platform\_config, per Schema §4.25 seed keys, never hardcoded); controller-thin/service-thick/repository-persistence layering rule (TRD §13).
-   **Expected Output:** committed markdown doc.
-   **Verification:** doc reviewed against TRD §13 line-by-line for completeness.
-   **Next Step:** proceed to Task 7.

### **Engineering Decisions**

| **Decision** | **Rationale** |
| --- | --- |
| Root-level lint/format config, thin per-app extensions | Two config sources for the same rule set is how drift starts on small teams; one root source of truth |
| --- | --- |
| Pre-commit hooks, not just CI-gate | CI catches problems after a push; pre-commit catches them before a teammate ever sees a failing PR, saving review cycles (Impl. Plan §21's "CI is a hard gate" still applies as the backstop) |
| --- | --- |
| mypy on ai-service enforced from scaffold, not deferred | TRD §13 requires Python type hints + mypy; retrofitting types onto an untyped codebase later is expensive — start typed |
| --- | --- |

### **Common Mistakes**

-   Configuring ESLint separately per app "for speed" — guarantees the two configs diverge by Sprint 3.
-   Treating pre-commit hooks as optional/skippable (git commit --no-verify) as a habit — undermines the entire point; reserve --no-verify for genuine emergencies only.
-   Hardcoding business constants (commission %, courier weights) directly in service code "temporarily" — this is the exact anti-pattern TRD §13 and SRS §5.5 forbid; even in Feature 0 stub code, never introduce this habit.

### **Definition of Done**

-   \[ \] pnpm -r lint and pnpm -r format:check pass repo-wide
-   \[ \] black --check, flake8, mypy pass on ai-service
-   \[ \] Pre-commit hook verified to block a deliberately bad commit
-   \[ \] CODING\_STANDARDS.md committed and complete

## **Task 7: Branch Strategy**

### **Purpose**

-   Implement GitHub Flow exactly as specified in Implementation Plan §20 — no invented variant (no Git Flow, no trunk-based-with-feature-flags).
-   Give the 2-person team an unambiguous PR/merge/rollback process before the first feature branch opens.
-   Wire branch protection (Task 1) to actual CI checks (finalized in Task 12) so "green CI" is a real gate, not just a rule name.

### **Expected Deliverables**

-   \[ \] Branch naming convention documented and enforced by team agreement (feat/, fix/, chore/, docs/)
-   \[ \] PR template committed (.github/PULL\_REQUEST\_TEMPLATE.md)
-   \[ \] Release-tagging convention documented (vX.Y.Z)
-   \[ \] Hotfix procedure documented

### **Prerequisites**

-   Task 1 (branch protection) complete

### **Step-by-Step Execution**

**Step 1 — Document branch naming**

-   **Objective:** make branch names self-describing and traceable to REQ-IDs, per Implementation Plan §21's PR checklist.
-   **Action:** Document convention: feat/<area>-<short-desc> (e.g., feat/store-builder-image-upload), fix/<desc>, chore/<desc>, docs/<desc>. Branches cut from main only.
-   **Expected Output:** convention written into CODING\_STANDARDS.md or a new CONTRIBUTING.md.
-   **Verification:** first real feature branch (Feature 1, later) follows the pattern.
-   **Next Step:** Step 2.

**Step 2 — Create the PR template**

-   **Objective:** operationalize Implementation Plan §21's checklist (linked REQ-ID, tests added, docs updated, no secrets, RTL/UR-EN checked, migration reversible).
-   **Action:** Add .github/PULL\_REQUEST\_TEMPLATE.md with checkboxes exactly matching Implementation Plan §21 and §22 (Definition of Done): REQ-ID(s) linked; tests added/passing; coverage maintained ≥80%; Swagger/docs updated; no secrets/PII in diff; parameterised queries only; RTL + UR/EN checked (UI PRs); accessibility considered; migration reversible (schema PRs).
-   **Expected Output:** template auto-populates on every new PR.
-   **Verification:** open a test PR — template renders with all checkboxes.
-   **Next Step:** Step 3.

**Step 3 — Confirm staging/production deploy mapping**

-   **Objective:** document (not yet implement — that's Phase 13/Deployment, a later feature) how main and tags map to environments, so the team already knows the target shape.
-   **Action:** Document: staging auto-deploys from main on merge; production deploys only from a tagged release (v1.0.0 style); hotfixes branch from the release tag, patch-tag, merge back to main. **Note:** actual CD pipeline wiring is out of scope for Feature 0 (belongs to Implementation Plan Phase 13) — this step is documentation only.
-   **Expected Output:** a DEPLOYMENT\_FLOW.md stub (process documented, pipeline not yet built).
-   **Verification:** doc reviewed against Implementation Plan §20 for accuracy.
-   **Next Step:** Step 4.

**Step 4 — Rehearse the PR flow end-to-end**

-   **Objective:** prove the branch protection (Task 1) + CI-gate + 1-approval rule actually works before any real feature depends on it.
-   **Action:** Open a throwaway branch (chore/verify-pr-flow), make a trivial change, open a PR, have the second developer approve, confirm merge is blocked until CI (Task 12, if wired) and approval are both satisfied, then squash-merge.
-   **Expected Output:** one successfully merged test PR demonstrating the full flow.
-   **Verification:** main's commit history shows a clean squash-merge with a Conventional Commit message.
-   **Next Step:** proceed to Task 8.

### **Engineering Decisions**

| **Decision** | **Rationale** |
| --- | --- |
| GitHub Flow, not Git Flow | Implementation Plan §20 explicitly picks GitHub Flow as "right-sized for a two-person team" — no develop branch, no release branches beyond tags |
| --- | --- |
| Squash-merge only | Implementation Plan §21 — keeps main history clean and matches Conventional Commit tracking |
| --- | --- |
| CD pipeline documented but not built in Feature 0 | Deployment is its own Implementation Plan phase (13); Feature 0 only needs the *branch/PR* mechanics working, not live staging/prod targets |
| --- | --- |

### **Common Mistakes**

-   Introducing a long-lived develop branch "just in case" — directly contradicts Implementation Plan §20's GitHub Flow choice.
-   Merge-commit instead of squash-merge — breaks the clean Conventional-Commit history Implementation Plan §21 expects.
-   Skipping the end-to-end rehearsal (Step 4) — branch protection rules silently misconfigured (e.g., required check name typo) are only caught this way before real feature work is blocked by them.

### **Definition of Done**

-   \[ \] Branch naming convention documented
-   \[ \] PR template live and matches Implementation Plan §21/§22 checklist exactly
-   \[ \] Deploy-mapping documented (build deferred to Phase 13)
-   \[ \] End-to-end test PR successfully merged through the full protected flow

## **Task 8: Shared Components**

### **Purpose**

-   Stand up the reusable UI component layer named explicitly in Implementation Plan Phase 6 (MetricCard, ProductCard, OrderCard, BilingualField, StatusChip, EmptyState, AIRevealPanel) so no feature reinvents these independently.
-   Establish the **global UI states** pattern from App Flow §0 (skeleton loaders, toasts, progress bars on AI actions, offline banner stub, 401/403 handling) as shared, not per-screen, code.
-   Keep components theme-token-driven from the start, so Task 9 (Theme Configuration) has real consumers to wire into.

### **Expected Deliverables**

-   \[ \] apps/web/src/components/ populated with empty-but-typed component shells for each named component
-   \[ \] Global state components (Toast provider, Skeleton wrapper, ErrorBoundary, EmptyState) implemented at a basic functional level
-   \[ \] Storybook (or equivalent lightweight component preview) optional but recommended — noted as a decision, not mandatory
-   \[ \] COMPONENTS.md cataloguing each component's purpose and props contract

### **Prerequisites**

-   Task 3 (Frontend setup) and Task 5 (Folder structure) complete; Task 9 (Theme) will retrofit tokens into these once available — sequence is intentional (structure first, tokens next, so Task 9 has something to plug into)

### **Step-by-Step Execution**

**Step 1 — Scaffold the named component shells**

-   **Objective:** create typed, empty-state versions of every component Implementation Plan Phase 6 names explicitly.
-   **Action:** Create one folder per component under components/: MetricCard/, ProductCard/, OrderCard/, BilingualField/, StatusChip/, EmptyState/, AIRevealPanel/. Each gets index.tsx (typed props interface + minimal render, no real styling yet — that's Task 9) and co-located Component.test.tsx stub.
-   **Expected Output:** 7 component folders, each exporting a typed, minimally-rendering component.
-   **Verification:** each imports cleanly into a throwaway test page in apps/web; no TS errors.
-   **Next Step:** Step 2.

**Step 2 — Define each component's contract in COMPONENTS.md**

-   **Objective:** capture *why* each exists (tied to specific App Flow screens) so feature developers don't redefine props ad hoc.
-   **Action:** Document per component: purpose, which App Flow screens use it (e.g., MetricCard → SCR-S01 Seller Dashboard, SCR-S08 Analytics; AIRevealPanel → SCR-S02 AI Store Builder generation reveal; BilingualField → any EN/UR paired input, e.g. product title/description in SCR-S02/S04; StatusChip → order/return status across SCR-S05/S07/B07; EmptyState → every list screen's empty state per App Flow §0).
-   **Expected Output:** committed COMPONENTS.md.
-   **Verification:** cross-checked against App Flow Doc 3 screen specs for accuracy.
-   **Next Step:** Step 3.

**Step 3 — Implement global UI state primitives**

-   **Objective:** build the App Flow §0 "global UI states" as real, shared code — not something each feature screen re-implements.
-   **Action:** Implement: a ToastProvider (success/error toasts, used everywhere per App Flow §0); a Skeleton/SkeletonCard wrapper (used during fetch, per every screen spec's "Loading" state); an ErrorBoundary + NotAuthorized (403) page + SessionExpired (401→redirect-to-login) handler; a stub OfflineBanner component (visual only — real offline detection is R1.1/PWA, App Flow §0 flags it \[R1.1 PWA\]).
-   **Expected Output:** these mounted once at the app-shell level (app/ folder from Task 5), available to every route.
-   **Verification:** a throwaway page triggers a toast, a skeleton, and a forced error boundary — all render correctly.
-   **Next Step:** Step 4.

**Step 4 — Decide on and document component preview tooling**

-   **Objective:** give the team a fast way to iterate on shared components in isolation, without spinning up full app routes.
-   **Action:** Team decision: adopt Storybook, or skip it and preview components via throwaway routes in apps/web. Document the decision and rationale (time cost vs. benefit for a 20-week, 2-person team) — do not silently decide; record it.
-   **Expected Output:** a one-paragraph decision recorded in COMPONENTS.md or CODING\_STANDARDS.md.
-   **Verification:** decision is visible to both developers before Feature 1 component work starts.
-   **Next Step:** proceed to Task 9.

### **Engineering Decisions**

| **Decision** | **Rationale** |
| --- | --- |
| Components built empty/unstyled here, styled in Task 9 | Keeps this task focused on contracts (props, usage sites) rather than visual design, which depends on Doc 4 tokens not yet wired in |
| --- | --- |
| Global UI states built as shared primitives, not per-screen | App Flow §0 explicitly states these "apply everywhere, stated once" — treating them as shared infra avoids 20+ screens each reinventing toast/skeleton/error handling |
| --- | --- |
| AIRevealPanel scaffolded even though AI Store Builder (Feature X) isn't built yet | Named explicitly in Implementation Plan Phase 6's deliverable list; the shell existing now means Feature "AI Store Builder" only fills logic, not structure |
| --- | --- |
| Storybook adoption left as an explicit team decision, not assumed | Not named in any of the 5 source docs — must not be silently invented; recorded so it doesn't look like an unstated architecture choice |
| --- | --- |

### **Common Mistakes**

-   Styling components fully in this task before Task 9's tokens exist — leads to a rework pass once real brand colors/typography land.
-   Building AIRevealPanel or StatusChip with feature-specific logic (e.g., hardcoding return-status color mapping) here — Feature 0 components should be generic/prop-driven; feature-specific behavior belongs in the feature's own code, composed on top.
-   Skipping the EmptyState component and letting each screen write its own empty-state JSX — directly contradicts App Flow's screen-by-screen "Empty:" state pattern being consistent everywhere.

### **Definition of Done**

-   \[ \] All 7 named components scaffolded, typed, importable
-   \[ \] COMPONENTS.md complete and cross-referenced to App Flow screens
-   \[ \] Global UI state primitives (Toast, Skeleton, ErrorBoundary, 401/403 handling) implemented and mounted at app-shell level
-   \[ \] Component preview tooling decision recorded

*End of Response 2 — Tasks 5–8 complete. Awaiting confirmation before continuing with Tasks 9–12 (Theme Configuration, Routing, API Structure, Project Validation), followed by the final consistency pass (ToC update + Task 2 MinIO patch + cross-reference check).*

## **Task 9: Theme Configuration**

### **Purpose**

-   Encode the bilingual (UR/EN) RTL/LTR design tokens referenced across TRD §4 and every App Flow screen into a single, centrally-consumed theme layer.
-   De-risk **R7/T7 (Urdu RTL + Noto Nastaliq rendering/perf)** early via a dedicated spike, exactly as the PRD/TRD risk tables prescribe — not left until Feature 6 (Frontend UI).
-   Give Task 8's shared components (built unstyled) their real visual identity in one pass, avoiding per-component styling drift.

### **Expected Deliverables**

-   \[ \] AntD ConfigProvider theme object wired with design tokens (colors, spacing, typography)
-   \[ \] Noto Nastaliq Urdu + Plex (English) fonts loaded and subsetted
-   \[ \] RTL/LTR switching verified with no reload (react-i18next + dir attribute + AntD direction)
-   \[ \] Task 8 shared components re-styled using theme tokens
-   \[ \] THEME\_SPIKE\_NOTES.md documenting the R7 risk-mitigation findings

### **Prerequisites**

-   Task 3 (frontend libraries installed) and Task 8 (component shells) complete

### **Step-by-Step Execution**

**Step 1 — Load and subset fonts**

-   **Objective:** get Noto Nastaliq Urdu and the English typeface into the app without tanking 3G load times (PRD REQ-NF-Perf001).
-   **Action:** Add Noto Nastaliq Urdu (variable/static, whichever renders correctly for Urdu shaping) and the English face to apps/web/public/fonts/ or a CDN-hosted path; apply font-subsetting (only needed glyph ranges) per TRD's T7 mitigation note. Preload critical font weights via <link rel="preload">.
-   **Expected Output:** both fonts render correctly in a throwaway page, subset file sizes documented.
-   **Verification:** Lighthouse/network tab shows font payload size; visually confirm Urdu ligatures/shaping render correctly (not boxes/tofu).
-   **Next Step:** Step 2.

**Step 2 — Define the design token set**

-   **Objective:** centralize color, spacing, typography, and radius tokens in one file, matching whatever brand direction Doc 4 (UI/UX Brief) specifies.
-   **Action:** Create apps/web/src/app/theme/tokens.ts — color palette (primary/secondary/semantic status colors for StatusChip from Task 8), spacing scale, font-family map (ur: 'Noto Nastaliq Urdu', en: 'IBM Plex'), border radius, shadow scale. **Note:** if Doc 4 (UI/UX Design Brief) has not yet been produced/approved, use documented placeholder values here and flag them as pending Doc 4 sign-off — do not invent a "final" brand identity inside Feature 0.
-   **Expected Output:** tokens.ts committed, values clearly marked provisional if Doc 4 isn't finalized yet.
-   **Verification:** tokens file has no magic values duplicated elsewhere in the codebase (single source).
-   **Next Step:** Step 3.

**Step 3 — Wire AntD ConfigProvider**

-   **Objective:** apply tokens through AntD's theming API and enable dynamic RTL switching, per TRD §4.
-   **Action:** Wrap the app shell (app/ folder) in <ConfigProvider theme={{ token: ... }} direction={dir}>, where dir is driven by the active language from react-i18next. Map tokens.ts values into AntD's theme token shape.
-   **Expected Output:** AntD components (buttons, tables, forms) reflect KarobarAI tokens, not AntD defaults.
-   **Verification:** visually diff a default AntD button vs. themed button.
-   **Next Step:** Step 4.

**Step 4 — Implement live language/direction switch**

-   **Objective:** satisfy PRD §2.5 / REQ-NF-Quality "every surface supports UR/EN with no page reload."
-   **Action:** Wire a language toggle that updates i18next.changeLanguage(), flips the dir attribute on <html>, and flips AntD's direction prop simultaneously — all without a route change or reload.
-   **Expected Output:** toggling language instantly mirrors layout (RTL↔LTR) and swaps text.
-   **Verification:** manual test — toggle 10+ times rapidly, confirm no flicker/broken layout/stale text.
-   **Next Step:** Step 5.

**Step 5 — Re-style Task 8 shared components with tokens**

-   **Objective:** close the loop — give MetricCard, ProductCard, StatusChip, etc. their real visual treatment.
-   **Action:** Update each Task 8 component to consume tokens.ts / AntD theme instead of hardcoded values; verify each renders correctly in both UR (RTL) and EN (LTR).
-   **Expected Output:** all 7 named components visually themed and RTL-safe.
-   **Verification:** side-by-side UR/EN screenshots for each component, no mirrored-icon or overflow bugs.
-   **Next Step:** Step 6.

**Step 6 — Run and document the R7 risk spike**

-   **Objective:** formally close out the "early spike" risk mitigation named in PRD R7 / TRD T7, so it's not silently assumed done.
-   **Action:** Test rendering + interaction performance on a low-end Android device/emulator (per T7's explicit mitigation: "test on low-end Android"), with Urdu content in forms, tables, and long text. Record findings — font load time, layout shift, any input-method issues with Urdu text entry (relevant later for BilingualField).
-   **Expected Output:** THEME\_SPIKE\_NOTES.md with findings, pass/fail against REQ-NF-Perf001 (<3s on 3G), and any follow-up items flagged for later features.
-   **Verification:** doc reviewed by both developers; any blocking issues logged as tracked follow-ups, not silently dropped.
-   **Next Step:** proceed to Task 10.

### **Engineering Decisions**

| **Decision** | **Rationale** |
| --- | --- |
| Tokens centralized in one tokens.ts, consumed via AntD ConfigProvider | TRD §4 names AntD specifically for its RTL support; centralizing avoids the "some components hardcoded, some themed" split |
| --- | --- |
| Placeholder tokens allowed if Doc 4 isn't finalized | Feature 0 must not invent brand identity — that's Doc 4's (UI/UX Brief) job; this task only builds the *mechanism*, values are swappable |
| --- | --- |
| RTL spike executed here, not deferred to Phase 6 | PRD/TRD explicitly flag R7/T7 as needing an *early* spike; Feature 0 is the earliest correct point since it's before any feature UI is built on top |
| --- | --- |
| No page reload on language switch | Directly required by PRD §2.5; verified as a hard behavioral gate, not just a nice-to-have |
| --- | --- |

### **Common Mistakes**

-   Hardcoding a color/spacing value inside a component "just this once" instead of adding it to tokens.ts — reintroduces the magic-value problem Task 6 exists to prevent.
-   Treating the RTL spike as optional busywork and skipping Step 6 — this is a named project risk (R7/T7) with an explicit required mitigation; skipping it means the risk re-surfaces uncontrolled during a later feature crunch.
-   Using a non-subsetted, full Noto Nastaliq font family — blows the 3G performance budget (REQ-NF-Perf001) immediately.

### **Definition of Done**

-   \[ \] Fonts loaded, subsetted, performance-verified
-   \[ \] tokens.ts complete (provisional or final, clearly marked)
-   \[ \] AntD ConfigProvider wired app-wide
-   \[ \] Live UR/EN + RTL/LTR switch verified with no reload
-   \[ \] All Task 8 components re-styled and RTL-tested
-   \[ \] THEME\_SPIKE\_NOTES.md committed, R7/T7 risk formally addressed

## **Task 10: Routing**

### **Purpose**

-   Stand up the route skeleton for all three surfaces (Buyer Storefront /, Seller Portal /seller, Admin Console /admin, shared Auth) exactly as enumerated in App Flow Doc 3, so every screen has a real route before feature logic lands.
-   Wire auth guards and the global 401/403 behaviors (App Flow §0) at the routing layer, once, rather than per-screen.
-   Establish the login-free public route pattern (/t/:publicToken) correctly isolated from authenticated routes from the start.

### **Expected Deliverables**

-   \[ \] Full route table implemented (paths only — pages render placeholder content, not final UI)
-   \[ \] Role-based route guards (Guest/Buyer/Seller/Admin/Support) wired per PRD §11 permission matrix
-   \[ \] 401 → login redirect, 403 → "not authorised" page wired globally
-   \[ \] ROUTES.md documenting every route, its guard, and its App Flow screen ID

### **Prerequisites**

-   Task 5 (folder structure — app/ and features/ folders exist), Task 8 (NotAuthorized/SessionExpired components exist), Task 9 (theme wired so placeholder pages render themed shells)

### **Step-by-Step Execution**

**Step 1 — Enumerate the full route table from App Flow**

-   **Objective:** produce one authoritative list mapping every App Flow screen ID to a route path, before writing router code.
-   **Action:** Transcribe all routes from App Flow Docs §2–§5: Auth (/register, /verify-otp, /login, /forgot-password, /reset-password), Seller (/seller/setup, /seller, /seller/products/new, /seller/products, /seller/products/:id/edit, /seller/orders, /seller/orders/:id, /seller/returns, /seller/analytics, /seller/wallet, /seller/settings), Buyer (/, /search, /category/:slug, /product/:id, /cart, /checkout, /orders/:id/confirmation, /orders, /orders/:id/track, /t/:publicToken, /orders/:id/return, /orders/:id/return/status, /account), Admin (/admin, /admin/users, /admin/payments, /admin/disputes, /admin/moderation, /admin/config, /admin/audit; /admin/broadcast marked **\[R1.1\]** — route reserved, not linked in MVP nav).
-   **Expected Output:** a raw route list (used to build ROUTES.md in Step 5).
-   **Verification:** cross-checked 1:1 against every screen ID in App Flow Doc 3 — none missing, none invented.
-   **Next Step:** Step 2.

**Step 2 — Implement the router with placeholder pages**

-   **Objective:** get every route resolving to a themed placeholder before any feature builds real content.
-   **Action:** Using React Router (or the routing solution paired with Vite — confirm library choice, none named explicitly in TRD, so document the pick as an engineering decision below), implement all routes from Step 1 under app/routes or equivalent, each rendering a minimal placeholder (screen ID + "Coming soon" using Task 8/9 EmptyState).
-   **Expected Output:** every URL from Step 1 resolves without a 404.
-   **Verification:** navigate to each route manually (or scripted smoke test) — confirms no path typos.
-   **Next Step:** Step 3.

**Step 3 — Wire role-based guards**

-   **Objective:** enforce PRD §11's permission matrix at the routing layer.
-   **Action:** Implement a RequireRole wrapper reading the auth state (stubbed for now — real JWT auth is a later feature; Task 10 wires the *mechanism* against a mocked/placeholder auth context). Apply per PRD §11: Guest-only routes (Auth screens) redirect authenticated users away; Buyer routes require role=BUYER; Seller routes require role=SELLER (and gate all /seller/\* except /seller/setup behind onboarding completion, per App Flow SCR-S00); Admin routes require role=ADMIN (Support gets read-only access per PRD §11 — flagged here as a guard variant, fully implemented when Admin feature lands); /t/:publicToken explicitly **bypasses all auth** (App Flow SCR-B09 — resolves via token only, never order\_id).
-   **Expected Output:** guard components wrapping the relevant route groups.
-   **Verification:** with a mocked auth context, confirm role mismatches redirect correctly; confirm /t/:publicToken is reachable with zero auth context.
-   **Next Step:** Step 4.

**Step 4 — Wire global 401/403 behavior**

-   **Objective:** implement App Flow §0's "401 → redirect to Login; 403 → not authorised page" as router-level, not per-screen, logic.
-   **Action:** Connect Task 8's SessionExpired/NotAuthorized components to the guard logic from Step 3: any unauthenticated access to a protected route → redirect /login; any authenticated-but-wrong-role access → render NotAuthorized (no redirect, per App Flow §0's "403 → not authorised page" — this is a page, not a bounce).
-   **Expected Output:** both behaviors demonstrable via mocked auth states.
-   **Verification:** simulate expired/missing token → lands on /login; simulate wrong role → renders NotAuthorized in place.
-   **Next Step:** Step 5.

**Step 5 — Write ROUTES.md**

-   **Objective:** give the team a single reference table: route ↔ guard ↔ App Flow screen ID ↔ MVP/R1.1 tag.
-   **Action:** Produce the table from Step 1's enumeration, adding guard type and scope tag (MVP/R1.1) per route.
-   **Expected Output:** committed ROUTES.md.
-   **Verification:** spot-checked against App Flow Doc 3 for completeness and correct MVP/R1.1 tagging (e.g., /admin/broadcast, /orders/:id/return review flow bits marked R1.1 where App Flow specifies).
-   **Next Step:** proceed to Task 11.

### **Engineering Decisions**

| **Decision** | **Rationale** |
| --- | --- |
| React Router chosen for routing | Not explicitly named in TRD, but is the de facto standard pairing with Vite+React and required for this task to proceed — documented here as a Feature-0-level implementation choice, not a contradiction of any binding doc |
| --- | --- |
| All routes stubbed with placeholders before any feature UI | Prevents a scenario where routing structure is discovered/patched ad hoc mid-feature, causing navigation inconsistencies across surfaces |
| --- | --- |
| /t/:publicToken implemented as fully separate from the guard system | App Flow SCR-B09 and Schema §9 are explicit: public tracking resolves via token only, "never via sequential order\_id," and needs **no auth check at all** — not even a permissive one |
| --- | --- |
| 403 renders in-place, 401 redirects | Matches App Flow §0's global states precisely — these are deliberately different behaviors and must not be unified into one generic "access denied" redirect |
| --- | --- |

### **Common Mistakes**

-   Building /seller/\* routes without gating on Store-Setup Wizard completion — App Flow SCR-S00 explicitly states the wizard "blocks access to selling features until complete."
-   Treating /admin/broadcast as a normal MVP route link in navigation — it's R1.1 (App Flow SCR-AD07); the route can exist reserved, but must not appear in MVP nav/menus.
-   Applying the same guard pattern to the public tracking route — immediately breaks the login-free requirement that's core to REQ-F-Track005.

### **Definition of Done**

-   \[ \] Every App Flow-listed route resolves to a placeholder page
-   \[ \] Role guards enforce PRD §11 matrix (mocked auth context acceptable at this stage)
-   \[ \] 401/403 behaviors verified globally
-   \[ \] /t/:publicToken verified fully auth-free
-   \[ \] ROUTES.md committed and complete

## **Task 11: API Structure**

### **Purpose**

-   Stand up the REST conventions from TRD §9 (envelope, versioning, status codes, error codes, pagination, idempotency) as enforced middleware/utilities — before any real business endpoint is written.
-   Give every future feature module (auth, catalog, cart, orders, payments, etc.) a consistent controller→service→repository skeleton to fill in, per TRD §13's layering rule.
-   Wire Swagger/OpenAPI at /api-docs from the start (REQ-NF-Quality-004) so documentation is never a bolt-on.

### **Expected Deliverables**

-   \[ \] /api/v1 versioned base path wired
-   \[ \] Response envelope helper ({ success, data, error, timestamp }) used by all routes including /health
-   \[ \] Central error middleware mapping the TRD §14 typed error hierarchy to HTTP codes
-   \[ \] Zod validation harness pattern established
-   \[ \] Idempotency-key middleware scaffolded (logic stub — real use starts at Payments feature)
-   \[ \] Swagger live at /api-docs, documenting the /health endpoint as a working example
-   \[ \] One empty module (catalog/ or similar) built out with controller/service/routes/dto stubs as the reference pattern for all future modules

### **Prerequisites**

-   Task 4 (backend scaffolded), Task 5 (module folders exist), Task 6 (coding standards/layering rule documented)

### **Step-by-Step Execution**

**Step 1 — Implement the response envelope helper**

-   **Objective:** make TRD §9's envelope a reusable utility, not something re-typed per controller.
-   **Action:** Create core/utils/envelope.ts (or similar) exporting success(data) and failure(code, message, details?) helpers producing { success, data, error, timestamp }. Refactor the Task 4 /health endpoint to use it (retroactive consistency check).
-   **Expected Output:** envelope helper + updated /health route.
-   **Verification:** /health response shape matches TRD §9 exactly; helper unit-tested.
-   **Next Step:** Step 2.

**Step 2 — Build the central error middleware + typed error hierarchy**

-   **Objective:** implement TRD §14's AppError hierarchy (ValidationError(400), AuthError(401), ForbiddenError(403), NotFoundError(404), ConflictError(409), BusinessRuleError(422), RateLimitError(429), DependencyError(503)) as real classes + one Express error-handling middleware.
-   **Action:** Create core/errors/AppError.ts (base + subclasses) and core/middleware/errorHandler.ts — catches thrown AppError instances, maps to correct HTTP status + envelope error.code; catches unknown errors, logs them, returns a generic 500 **with no stack trace exposed** (REQ-NF-Safety-003).
-   **Expected Output:** middleware registered last in the Express app; error classes exported from core/errors.
-   **Verification:** a route deliberately throwing each error type returns the correct status + envelope; an unhandled generic Error returns 500 with no stack trace in the response body.
-   **Next Step:** Step 3.

**Step 3 — Establish the Zod validation harness pattern**

-   **Objective:** enforce "reject unknown fields, validate at every boundary" (TRD §9) as a repeatable pattern.
-   **Action:** Create a validate(schema) middleware factory in core/middleware/validate.ts that parses req.body/req.query/req.params against a passed Zod schema, throwing ValidationError (from Step 2) on failure with field-level details.
-   **Expected Output:** reusable validate() middleware.
-   **Verification:** a test route with a Zod schema rejects malformed input with a 400 + field-level error details in the envelope.
-   **Next Step:** Step 4.

**Step 4 — Scaffold idempotency-key middleware**

-   **Objective:** reserve the mechanism named in TRD §9 for payment-affecting routes, without implementing full Redis-backed idempotency logic yet (that's the Payments feature, Implementation Plan Phase 10).
-   **Action:** Create core/middleware/idempotency.ts — reads Idempotency-Key header, validates presence/format on routes that opt in; **stub the actual dedupe-check logic** with a clear // TODO: Phase 10 - Redis-backed idempotency store marker rather than building it now.
-   **Expected Output:** middleware exists, is attachable to routes, but does not yet prevent duplicate processing.
-   **Verification:** middleware rejects requests missing the header on opted-in routes; does not block on missing dedupe logic (documented as intentionally deferred).
-   **Next Step:** Step 5.

**Step 5 — Wire Swagger at /api-docs**

-   **Objective:** satisfy REQ-NF-Quality-004 from the first endpoint onward.
-   **Action:** Configure swagger-jsdoc + swagger-ui-express, generating OpenAPI 3.0 from JSDoc annotations on routes; document /health as the working example annotation pattern.
-   **Expected Output:** /api-docs renders a browsable UI showing /health.
-   **Verification:** navigate to /api-docs, confirm /health is documented with request/response shape.
-   **Next Step:** Step 6.

**Step 6 — Build one reference module end-to-end**

-   **Objective:** produce a single fully-wired example (controller → service → repository → route → DTO → Swagger doc) that every real feature module copies the shape of.
-   **Action:** Using the empty catalog/ module folder from Task 5, wire a trivial no-op example: GET /api/v1/catalog/ping → controller calls service → service calls a stub repository method → returns via envelope helper, validated with Zod, documented in Swagger. **No real catalog logic** — this is purely a structural reference.
-   **Expected Output:** one working, fully-layered endpoint demonstrating the pattern.
-   **Verification:** hits all of Steps 1–5's utilities in one request/response cycle; confirmed via integration test (Supertest).
-   **Next Step:** proceed to Task 12.

### **Engineering Decisions**

| **Decision** | **Rationale** |
| --- | --- |
| /api/v1 path versioning from the first route | TRD §9 mandates path-based versioning; retrofitting a version prefix after routes exist means updating every client call site |
| --- | --- |
| Idempotency middleware scaffolded but not fully implemented | TRD §9 names it as a general boundary concern, but the real dedupe store belongs to Payments (Phase 10, REQ-F-Payment-004); Feature 0 reserves the seam without building ahead of need |
| --- | --- |
| One reference module (catalog/ping) built fully end-to-end | Gives every subsequent feature a copy-paste-correct starting shape instead of each developer interpreting TRD §13's layering rule slightly differently |
| --- | --- |
| Error middleware never leaks stack traces, even in dev-mode responses | REQ-NF-Safety-003 is unconditional in the source docs — not gated behind NODE\_ENV, so it's built correctly from the start rather than "fixed before prod" |
| --- | --- |

### **Common Mistakes**

-   Building the idempotency middleware's full Redis dedupe logic now — scope creep into the Payments feature; Feature 0 should reserve the seam, not implement business logic ahead of its owning feature.
-   Skipping the /health → envelope-helper refactor from Task 4 — leaves one inconsistent endpoint that "doesn't count" as a bad precedent.
-   Documenting routes in Swagger only after they're "finished" — the annotation-as-you-go pattern (established here on /health and catalog/ping) needs to be habitual from the first real endpoint, not retrofitted at Phase 11.

### **Definition of Done**

-   \[ \] Envelope helper used by every route, including /health
-   \[ \] Typed error hierarchy + central middleware verified against all 8 error types
-   \[ \] Zod validation harness pattern proven on a test route
-   \[ \] Idempotency middleware scaffolded (header-check only, dedupe logic deferred and documented as such)
-   \[ \] /api-docs live and documents at least /health and catalog/ping
-   \[ \] One fully-layered reference module exists and is referenced in CODING\_STANDARDS.md as the pattern to copy

## **Task 12: Project Validation**

### **Purpose**

-   Prove Feature 0 is genuinely complete against every Definition of Done across Tasks 1–11, not just individually "looks done."
-   Stand up the actual CI pipeline (deferred from Task 1/2) so main's branch protection (Task 1) has a real, working gate.
-   Produce the final go/no-go checklist before Feature 1 (the first real business feature) begins — matching Implementation Plan Phase 1's completion criteria ("docker compose up brings the full stack up locally; CI green on an empty PR").

### **Expected Deliverables**

-   \[ \] .github/workflows/ci.yml — lint, type-check, test, build, coverage-gate pipeline
-   \[ \] CI green on a real PR (not just local verification)
-   \[ \] FEATURE\_0\_CHECKLIST.md — consolidated DoD checklist across all 11 prior tasks, each item checked off with evidence
-   \[ \] Full README.md finalized (quick start, architecture summary, links to all Feature 0 reference docs)
-   \[ \] Tagged release v0.1.0-foundation

### **Prerequisites**

-   Tasks 1–11 complete

### **Step-by-Step Execution**

**Step 1 — Build the CI pipeline**

-   **Objective:** implement Implementation Plan §23's CI steps as an actual GitHub Actions workflow, scoped to what Feature 0 has (no deploy step yet — that's Phase 13).
-   **Action:** Write .github/workflows/ci.yml: install + cache deps (pnpm + pip) → lint (ESLint/Prettier + Flake8/Black) → type-check (tsc --noEmit + mypy) → test (Jest/Supertest for api, pytest for ai-service, with ephemeral Postgres/Redis service containers) → coverage gate (≥80%, per REQ-NF-Quality-003 — acceptable to be trivially met on Feature 0's minimal test surface, but the *gate* must be real) → build (Docker images, tagged by commit SHA). **No deploy stage** — explicitly out of scope until Phase 13.
-   **Expected Output:** workflow file triggers on PR and on push to main.
-   **Verification:** push a trivial branch, open a PR, confirm all steps run and report status checks.
-   **Next Step:** Step 2.

**Step 2 — Attach CI as a required status check**

-   **Objective:** close the loop opened in Task 1, Step 4 — branch protection references real checks now.
-   **Action:** In repo Settings → Branches → main protection rule, add the CI workflow's job names as required status checks.
-   **Expected Output:** PRs cannot merge unless every CI job passes.
-   **Verification:** deliberately break lint on a test branch → PR merge button disabled until fixed.
-   **Next Step:** Step 3.

**Step 3 — Full-stack smoke test**

-   **Objective:** re-verify Implementation Plan Phase 1's literal completion criterion end-to-end, post all Task 1–11 changes.
-   **Action:** From a clean clone (simulate a brand-new teammate): copy .env.example → .env, run docker compose -f infra/docker-compose.yml up, hit web, api /health, api /api-docs, confirm ai-service /health reachable only internally, confirm every Task 10 route resolves.
-   **Expected Output:** entire stack functions from a truly clean clone with zero undocumented manual steps.
-   **Verification:** performed by the *second* developer independently (not the one who built it) — catches undocumented local-machine assumptions.
-   **Next Step:** Step 4.

**Step 4 — Consolidate the Feature 0 checklist**

-   **Objective:** produce one master checklist proving every task's Definition of Done is genuinely met, with evidence, not assumption.
-   **Action:** Create FEATURE\_0\_CHECKLIST.md — one section per Task (1–11), each DoD bullet copied in and checked off with a one-line evidence note (e.g., "Task 7 DoD item 4 → verified in test PR #3, squash-merged").
-   **Expected Output:** committed, fully checked-off master checklist.
-   **Verification:** both developers independently review and sign off.
-   **Next Step:** Step 5.

**Step 5 — Finalize README.md**

-   **Objective:** turn the placeholder README (Task 1) into the real onboarding document.
-   **Action:** Expand README with: project one-liner, architecture summary (linking to TRD), quick start (Task 2), folder structure summary (linking FOLDER\_STRUCTURE.md), coding standards summary (linking CODING\_STANDARDS.md), branch strategy summary (linking Task 7 docs), links to ROUTES.md, COMPONENTS.md, FEATURE\_0\_CHECKLIST.md.
-   **Expected Output:** complete, navigable README.
-   **Verification:** a fresh reader (per Implementation Plan Phase 15's later "fresh reader" test, applied early here) follows only the README to a working local environment.
-   **Next Step:** Step 6.

**Step 6 — Tag the foundation release**

-   **Objective:** mark Feature 0's completion as a real, referenceable milestone (Implementation Plan §17 targets Week 2 for this).
-   **Action:** Merge all Feature 0 work to main, tag v0.1.0-foundation.
-   **Expected Output:** tagged release visible in GitHub.
-   **Verification:** git tag shows v0.1.0-foundation; corresponds to a green main commit.
-   **Next Step:** Feature 0 complete — proceed to Feature 1 planning (out of scope for this playbook).

### **Engineering Decisions**

| **Decision** | **Rationale** |
| --- | --- |
| CI pipeline built only after Tasks 1–11 exist | Building CI against nothing produces a false-positive "green" pipeline; sequencing it last means every job (lint/type-check/test/build) has real targets to run against |
| --- | --- |
| No deploy stage in this CI pipeline | Matches Implementation Plan's own phase separation — Phase 1 (Setup) explicitly stops at "CI green on an empty PR," deployment is Phase 13 |
| --- | --- |
| Second developer performs the clean-clone smoke test, not the author | Single-author verification reliably misses undocumented local machine state (globally installed tools, cached credentials); this is the cheapest point in the project to catch that |
| --- | --- |
| Coverage gate enforced even though Feature 0 has minimal real logic | REQ-NF-Quality-003 is a standing CI gate from Phase 1 per Implementation Plan's "standing rule" — introducing it later would mean retrofitting tests onto already-written feature code |
| --- | --- |

### **Common Mistakes**

-   Treating Task 12 as a formality/rubber-stamp instead of an actual independent re-verification — the entire point is catching gaps Tasks 1–11 missed in isolation.
-   Adding a deploy step to CI "since we're here anyway" — scope creep into Implementation Plan Phase 13, not this feature.
-   Tagging v0.1.0-foundation before the clean-clone smoke test (Step 3) actually passes — the tag should represent a verified state, not an aspirational one.

### **Definition of Done**

-   \[ \] CI pipeline live, required on main, all jobs green
-   \[ \] Clean-clone smoke test passed by the non-author developer
-   \[ \] FEATURE\_0\_CHECKLIST.md complete, all items evidenced and signed off
-   \[ \] README.md finalized and independently followable
-   \[ \] v0.1.0-foundation tagged on a verified green main

## **Final Consistency Pass**

### **1\. Table of Contents (updated, final)**

1.  [Feature Overview](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#feature-overview)
2.  [GitHub Repository](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-1-github-repository)
3.  [Development Environment](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-2-development-environment)
4.  [Frontend Project Setup](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-3-frontend-project-setup)
5.  [Backend Project Setup](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-4-backend-project-setup)
6.  [Folder Structure](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-5-folder-structure)
7.  [Coding Standards](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-6-coding-standards)
8.  [Branch Strategy](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-7-branch-strategy)
9.  [Shared Components](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-8-shared-components)
10.  [Theme Configuration](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-9-theme-configuration)
11.  [Routing](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-10-routing)
12.  [API Structure](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-11-api-structure)
13.  [Project Validation](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-12-project-validation)

### **2\. Task 2 Patch — MinIO Addition**

As flagged earlier and deferred to this pass, **Task 2 (Development Environment)** is amended as follows:

**Amended Expected Deliverables (Task 2):**

-   \[ \] infra/docker-compose.yml — **web, api, ai-service, postgres, redis, nginx, minio** *(7 services — amended from the original 6)*

**Amended Step 3 — Write infra/docker-compose.yml:** Add a minio service (S3-compatible, per TRD §28's explicit "dev MinIO" instruction for the object-storage adapter) alongside the original six: named volume for bucket persistence, healthcheck, default console port exposed for dev inspection. This is **additive infra**, not a contradiction of PRD REQ-NF-Quality-005's 6-service description — that requirement lists the *application-tier* services; TRD §28 separately requires real local object storage so image upload/compression (REQ-F-Store007) is genuinely testable, not stubbed.

**Amended Step 2 — Populate .env.example:** Replace blank S3\_\*/CLOUDINARY\_\* placeholders with real local MinIO defaults: S3\_ENDPOINT=http://minio:9000, S3\_ACCESS\_KEY, S3\_SECRET\_KEY (dev defaults, not secrets), S3\_BUCKET=karobarai-dev, S3\_REGION (dummy value, MinIO doesn't require a real region). CLOUDINARY\_\* remains a blank/optional placeholder (live-mode alternative, not used in dev per TRD §28's "real (dev MinIO)" note).

**Amended Common Errors table (Task 2) — new row:**

| **Error** | **Resolution** |
| --- | --- |
| api can't reach MinIO / bucket not found on first boot | Add a one-time init step (Compose depends\_on + a small mc bucket-creation script or app-level bootstrap) that creates karobarai-dev bucket on first up |
| --- | --- |

**Amended Definition of Done (Task 2) — new item:**

-   \[ \] MinIO container healthy; karobarai-dev bucket exists and is reachable from api

*(No other task references object storage directly in Feature 0 — actual upload/compression logic belongs to the AI Store Builder feature. This patch only ensures the* ***infrastructure*** *exists so that feature isn't blocked later.)*

### **3\. Cross-Reference Verification**

| **Check** | **Result** |
| --- | --- |
| Every task references only PRD/TRD/App Flow/Schema/Implementation Plan — no invented architecture | ✅ Confirmed; the one non-sourced pick (React Router, Task 10) is explicitly flagged as a documented implementation decision, not presented as a binding-doc requirement |
| --- | --- |
| No task duplicates another task's explanation (per instruction: "reference, don't repeat") | ✅ Task 9 references Task 8 components rather than re-describing them; Task 11 references Task 6's layering rule; Task 12 references all prior DoDs rather than restating them |
| --- | --- |
| MVP vs R1.1 vs Future scope tags respected throughout | ✅ /admin/broadcast (R1.1), PWA offline caching (R1.1), idempotency full logic (deferred to Phase 10), AI logic (deferred to feature-specific work) all correctly flagged and *not* built in Feature 0 |
| --- | --- |
| Every "Definition of Done" traces to a concrete PRD/TRD/Implementation Plan requirement | ✅ e.g., Task 6 → REQ-NF-Quality-006; Task 11 → REQ-NF-Quality-004; Task 12 → Implementation Plan Phase 1 completion criteria |
| --- | --- |
| Task 2 MinIO gap identified mid-document is fully resolved before final delivery | ✅ Patched above — no open inconsistency remains |
| --- | --- |
| No task builds ahead of its owning feature (scope creep check) | ✅ Explicitly guarded in Tasks 4 (empty Prisma schema), 8 (AIRevealPanel shell only), 11 (idempotency stub only) |
| --- | --- |

**Feature 0.md — Engineering Execution Playbook is complete.** All 12 tasks are structurally consistent, cross-referenced, and traceable to the five binding source documents. Ready for the team to execute Week 1–2 of the Implementation Plan.

—---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# **Change 1 (IMPORTANT)**

## **Branch Strategy**

Earlier Claude was inconsistent.

Some places said

develop

release

Later it correctly switched to

GitHub Flow

main

↓

feature/\*

↓

PR

↓

main

Since your TRD chooses GitHub Flow,

keep ONLY

main

↓

feature/\*

↓

PR

↓

main

Delete any remaining references to

develop

release

unless your TRD explicitly includes them.

**Priority:** ⭐⭐⭐⭐⭐