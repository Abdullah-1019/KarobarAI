# KarobarAI — Progress Log

**Purpose:** a running, human-readable record of what has actually been built, verified, and
decided — so either developer (or a fresh AI session) can pick up context without re-deriving it
from chat history. Updated at the end of each feature/phase, not line-by-line.

Format per entry: what shipped, how it was verified (not just "written"), and anything assumed
or flagged for follow-up. Newest entries at the top.

---

## Feature: Store Management (Implementation Plan Phase 6 / Feature 3)

**Status:** Done — 2026-07-30. Extends Feature 2's profile module (no parallel store module
built — per the module doc's explicit boundary decision). Full backend suite green: **117/117
tests, 17/17 suites** (confirmed non-flaky across 3 consecutive clean runs, including the
concurrent-onboarding race test), coverage 87.45% statements / 65.83% branches / 80.74% functions
/ 89.29% lines overall (profile module: 90.68% stmts / 94.59% lines). Full contract in
`docs/handoffs/F3-store-management-backend.md`.

**Real design conflict found and reconciled before writing any code:** the module doc's Task 2
("Create Store") assumed `seller_profiles` doesn't exist until this feature creates it — insert,
catch a unique-constraint violation for race-safety. That's not true in this system: Feature 1's
`auth.service.ts` already creates a **placeholder** `seller_profiles` row the moment a Seller
account activates (`onboardingStep: 0`), exactly per the handoff contract F1 documented for this
feature. So "Create Store" is actually "**complete onboarding**" — a guarded `UPDATE ... WHERE
onboarding_completed_at IS NULL`, not an `INSERT`, with race-safety coming from the affected-row
count instead of a unique-violation catch. `hasStore` was redefined accordingly: **not** "does a
row exist" (always true post-activation) but "has onboarding actually completed"
(`onboardingCompletedAt !== null`).

**What shipped:**
- `banner_url` added to `seller_profiles` (Feature-3 schema addition, mirrors Feature 2's
  `avatar_url` precedent) via a clean hand-created migration (the recurring `search_vector`
  spurious-diff trap struck again on this migration too, stripped as always).
- **Payout wallets, previously entirely unimplemented** despite the `payout_wallets` table
  existing since the Database feature: `POST /profile/me/store` now captures ≥1 wallet
  (JazzCash/Easypaisa account number, REQ-F-Auth005), encrypted at rest via Feature 1's generic
  `encryptField` (built specifically to be reusable by exactly this kind of later feature).
- **Onboarding-step tracking, previously initialized but never advanced**: completing `POST
  /store` now sets `onboardingStep: 3` and `onboardingCompletedAt`, closing the gap between what
  Feature 1 initialized and what nothing ever completed.
- `POST`/`DELETE /profile/me/store/logo` and `/banner` — same validated-upload mechanism as
  Feature 2's avatar (magic-byte checked, 10MB ceiling), targeting `seller_profiles.logoUrl`/
  `bannerUrl` instead of `users.avatarUrl`. Both guarded by a new `requireOnboardedSeller` check.
- `GET /profile/me/store/status` — read-only, derived from `users.status`; no mutation path
  exists anywhere (tested adversarially, permanently, per the module doc's Task 6.2/7.4).
- **Correction to Feature 2's already-shipped `PATCH /profile/me`:** removed `logoUrl` as a
  directly-settable field. It previously accepted an arbitrary client-supplied URL with no
  validation; now that a real validated upload endpoint exists for logos, leaving that bypass
  open would have undercut the validation entirely. `logoUrl`/`bannerUrl` are now exclusively
  settable via the upload endpoints — a deliberate tightening, not a silent regression (Feature
  2's own test for this was updated to assert the old field is now rejected).
- `SellerProfileDTO` extended with `bannerUrl`/`hasStore`; new `StoreStatusDTO`.

**Real bugs found and fixed during this feature (not all new — some pre-existing, surfaced by
this feature's heavier test load):**
- **Pre-existing test-suite hang, present since Feature 1, only now surfaced**: no test file
  anywhere in the suite ever called `redis.quit()` — only `prisma.$disconnect()` in `afterAll`.
  Since Jest gives every test file its own isolated module registry, each file that touches Redis
  creates a brand-new `ioredis` client that's never torn down. With enough test files/connections
  accumulated, the process stopped exiting cleanly after all tests finished, hanging indefinitely
  (piped output never flushed, looked identical to a real deadlock until confirmed otherwise via
  `pg_stat_activity`, an isolated ioredis connectivity check, and process CPU-time sampling
  showing zero progress). Fixed by adding `await redis.quit()` to all 14 test files that touch
  Redis (13 already had a `prisma.$disconnect()` afterAll to extend; `rbac.test.ts` had no afterAll
  at all and needed one added).
- **Own test bug, not a service bug**: `store.test.ts`'s logo-removal test used an arbitrary
  `mock://storage/...` URL that didn't match `extractStorageKey()`'s real expected prefix
  (`config.storage.publicBaseUrl`/`bucket`), so the delete-on-remove assertion failed even though
  the actual service code was correct — same gotcha `avatar.test.ts` had already correctly worked
  around. Fixed by constructing the mock URL with the real config prefix, matching that precedent.
- **Suspicious file corruption caught before it shipped**: mid-session, `profile.controller.ts`
  was found with a nonsensical line of text appended after its last valid statement (not
  something introduced by any edit made here) — flagged to the user as a possible injection
  rather than silently "fixed and forgotten," then removed once confirmed to be corrupted,
  non-functional content. Full suite re-verified clean afterward.

**Known limitations / assumptions (see the handoff doc for full detail):**
- Wallet editing after onboarding (add/remove/change default) is out of scope — a separate
  Wallet & Payout feature (SCR-S09). Wallets are captured once, at `POST /store`, only.
- Task 6.4's "block writes when `status !== ACTIVE`" cross-check was deliberately not built as a
  separate gate — the module doc itself calls it largely defensive, since a suspended/banned
  account's sessions are already immediately revoked by Auth's existing mechanism
  (REQ-F-Auth006); a suspended Seller's token stops working at `authenticate` before it ever
  reaches a store endpoint.
- Wizard step-by-step progress is frontend-only state — the server only ever sees the final
  `POST /store` submission (no draft/partial persistence anywhere, matching the schema).

---

## Feature: User Profiles (Implementation Plan Phase 5 / Feature 2)

**Status:** Done — 2026-07-29. Full backend test suite green: **76/76 tests, 16/16 suites**,
coverage 87.1% statements / 65.3% branches / 78.6% functions / 88.8% lines overall (profile
module itself: 91.6% stmts / 95.8% lines). Full contract in
`docs/handoffs/F2-profiles-backend.md`.

**What shipped:**
- **New storage adapter** (`adapters/storage/`) — approved by the user before building, since it
  wasn't in the original module doc. Same D2 shape as `sms`/`email` (interface + mock + live) but
  deliberately **not** gated by `ADAPTER_MODE` — always live, since there's no meaningful mock
  beyond an in-memory test stub. `LiveStorageAdapter` wraps `@aws-sdk/client-s3`, works against
  MinIO (dev) or real S3 (prod) purely via env config, with an idempotent `ensureBucket()`
  (create + public-read policy) run on first use.
- `users.avatar_url` column added (Feature-2 addition, not in the base Schema Doc) via a clean
  hand-created migration (the recurring `search_vector` spurious-diff issue struck again and was
  stripped, as documented in the Auth entry below).
- Full profile module (`modules/profile/`): `GET /me` (role-branched `ProfileDTO` — Buyer/Seller/
  Admin each get a distinct shape, Admin intentionally minimal per confirmed App Flow check),
  `PATCH /me` (Seller store/brand fields), `PATCH /me/default-address` (Buyer, transactional
  swap), `POST`/`DELETE /me/avatar` (multer + magic-byte validation, never trusts client
  mimetype), `POST /me/password` (re-auth, reuses Auth's exact bcrypt/revocation utilities —
  nothing reimplemented), `GET`/`PATCH /me/settings` (notification channels + language,
  server-enforced non-disableable critical channels per REQ-F-Notif004).
- Password-complexity validation on change-password imported directly from Auth's
  `passwordSchema` — confirmed assumption, never redefined.
- Swagger/OpenAPI wired up for the first time (`core/swagger/`, `swagger-jsdoc` +
  `swagger-ui-express`, mounted at `/api-docs`) — every profile endpoint documented via JSDoc
  `@swagger` blocks directly on `profile.routes.ts`, reusable pattern for all future modules.
- Dedicated adversarial test sweep (Task 7): every protected route checked for 401 with no/garbage
  token, plus explicit 403 checks for role violations (Buyer hitting Seller-only routes and vice
  versa) and address-ownership violations.

**Real bugs found and fixed during implementation (via the Task 7 adversarial tests, not found by
the user):**
- **Session-revocation timing race** — the most significant bug this feature surfaced. Comparing
  the standard JWT `iat` claim (whole-second precision) against a millisecond-precision Redis
  mass-revocation timestamp was wrong in *both* directions: truncated to seconds, a genuinely-
  revoked "other device" session issued in the same wall-clock second could wrongly survive, while
  change-password's revoke-then-immediately-reissue-a-fresh-token-for-this-device flow could
  wrongly reject its own brand-new token. Fixed by adding a custom millisecond-precision `iatMs`
  claim to the access token (`core/jwt/index.ts`) and comparing real millisecond timestamps on
  both sides (`core/middleware/authenticate.ts`). Verified non-flaky via 3 consecutive clean full
  test-suite runs.
- **Garbage refresh cookie caused a 500, not a 401** — a malformed `jti` (not UUID-shaped) reached
  a Prisma query against a `@db.Uuid` column and Postgres rejected it as invalid input syntax,
  surfacing as an unhandled 500. Fixed with a `UUID_PATTERN` check in `auth.tokens.ts`'s
  `parseCookieValue` before any DB query runs.
- **`MulterError` (oversized avatar upload) was unhandled**, would have been a 500 — added
  explicit handling in `core/middleware/errorHandler.ts` mapping `LIMIT_FILE_SIZE` → 400
  `AVATAR_TOO_LARGE`, other Multer errors → 400 `VALIDATION_ERROR`.
- A `core → modules` import-direction violation was introduced (and caught before it shipped)
  while extracting cookie-session helpers — fixed by creating `core/http/session.ts` as the true
  owner of `REFRESH_COOKIE_NAME`/`RefreshMeta`, with `auth.tokens.ts` re-exporting from it instead
  of the reverse.

**Known limitations / assumptions (see `docs/handoffs/F2-profiles-backend.md` for the
frontend-facing detail):**
- No editable phone/email/display-name anywhere in this feature — neither App Flow screen
  (SCR-S10, SCR-B12) lists one.
- Admin/Support `GET /me` returns identity fields only — confirmed against App Flow AD01-AD08
  (none is a self-profile screen); flagged as something to revisit if that changes later.
- Full address CRUD (add/edit/delete) is out of scope — only default-address selection exists,
  against the already-seeded `addresses` table.
- Avatar URLs are public-read, non-expiring links (not presigned) — a deliberate call, confirmed
  with the user, since there's no privacy requirement for avatar images and presigned URLs going
  stale would just produce broken images later.

---

## Feature: Frontend Foundation (Day 1, Feature 0)

**Status:** Done — 2026-07-29. Standalone shell only, no backend calls wired yet. Full contract
in `docs/handoffs/F0-foundation-frontend.md`.

**What shipped:** design tokens (UIUX §5/§11, light+dark, CSS vars + AntD `ConfigProvider`
theme), i18n (`react-i18next`, EN/UR `common` bundle, Zustand-driven language/direction switch),
IBM Plex Sans/Plex Sans Arabic + lazy Noto Nastaliq Urdu fonts, routing skeleton
(`react-router-dom`, one placeholder per feature area, no guards yet), provider composition
(`QueryClientProvider` + `ConfigProvider` + router), a shared axios client typed to the backend's
`ApiEnvelope`, and four shared component shells (`SkeletonLoader`, `toast`, `Modal`,
`EmptyState`).

**Real bug found and fixed:** a top-level `src/App.tsx` importing from the `src/app/` folder
hit `TS2303: Circular definition of import alias` — on case-insensitive filesystems (Windows,
this dev machine) `./app` and `./App.tsx` resolve to the same path. Fixed by moving the root
component into `app/AppProviders.tsx` and deleting the top-level `App.tsx`; `main.tsx` now
imports directly from `./app`.

**Verified:** `pnpm install` (via `npx pnpm@9`, corepack couldn't write to `Program Files` in
this sandbox — documented as a possible one-off environment quirk, not a repo issue), `tsc
--noEmit` clean, `vite build` clean, dev server booted and driven headless with Playwright
(Chromium) — all four placeholder routes render, zero console errors, UIUX color/type tokens
visibly applied in the screenshot.

**Known limitations:** RTL/Urdu flip is wired (i18n + AntD `direction` + `<html dir>`) but not
yet manually eyeballed, since no header/nav component with a language switcher exists yet — first
feature to add one should do that check. `@karobarai/shared` added as a real frontend dependency
for the first time (just the `Language` type today).

---

## Feature: Authentication (Implementation Plan Phase 3)

**Status:** Done — 2026-07-28. Memurai installed, full suite verified end-to-end; every endpoint
also manually smoke-tested via Thunder Client. Code pushed to GitHub once all endpoints confirmed
working.

**What shipped:**
- `core/crypto/fieldCipher.ts` — AES-256-GCM field encryption + HMAC-SHA256 blind indexing, keys
  HKDF-derived from `FIELD_ENCRYPTION_KEY`. Reusable by later features (addresses, wallets), not
  auth-only.
- `core/jwt/` — pure RS256 sign/verify, split out from the refresh-token lifecycle specifically
  so `core/middleware` never has to import from `modules/` (would've inverted the intended
  core←modules layering).
- `modules/auth/auth.tokens.ts` — refresh-token issue/rotate/revoke. Refresh tokens are **not**
  JWTs (an opaque `<jti>.<secret>` pair, DB-lookupable, hash-only storage). Two Redis denylist
  mechanisms: `denylist:jti:<jti>` (single-session kill — logout, superseded rotation) and
  `denylist:user:<publicId>` (mass revoke — password reset, future admin suspend/ban). Refresh
  rotation includes reuse detection (replaying an already-rotated token mass-revokes the user).
- `modules/auth/auth.otp.ts` — 6-digit OTP, Redis-only, `GETDEL`-based single-use on success,
  wrong guesses restore the code (5 attempts against one code) rather than burning it on a typo.
- `modules/auth/auth.lockout.ts` — 5 fails/15 min → 30-min lock (REQ-F-Auth007), keyed on
  `blindIndex(normalized identifier)` so phone and email logins share one bucket type.
- `adapters/sms/` — first real D2 adapter implementation (interface + mock + live-stub),
  previously just a placeholder. `adapters/email/` — new, needed for password-reset delivery to
  email-registered accounts (no REQ-ID for this; added because forgot-password needs *a*
  delivery channel for non-phone accounts).
- Full endpoint set: register (mobile+OTP / email+password), otp/verify, otp/resend, login,
  refresh, logout, forgot-password, reset-password, `/me`. Contract fully documented in
  `docs/handoffs/HO-F1-Auth.md`.
- `authenticate` + `authorize` middleware (`core/middleware/`) — structurally split so any token
  problem is 401 and any role problem is 403, per App Flow's global UI-state requirement.
- `/ready` endpoint (`modules/health/health.routes.ts`) — added alongside Auth since it's the
  first real Redis dependency; checks Postgres + Redis with a **2-second bounded timeout**.
- `packages/shared` enums (`UserRole`/`UserStatus`/`Language`) and error codes
  (`AUTH_ERROR_CODES`) populated for frontend reuse.

**Real bugs found and fixed during implementation (not just written blind):**
- **`/ready` itself hung indefinitely** the first time it was tested — ioredis retries connection
  attempts forever by default (required elsewhere for BullMQ), so a bare `redis.ping()` never
  rejects when Redis is down. Fixed with a `Promise.race` timeout wrapper. Exactly the kind of
  "confusing mid-request hang" this endpoint exists to prevent, so it was worth catching in the
  endpoint meant to prevent it.
- **Schema bug: `users.phone`/`phone_bidx` were `NOT NULL`**, which made email-only registration
  literally impossible (TRD §7 requires mobile+OTP *or* email+password). Found while writing
  `register()`, fixed with a proper new migration (`make_phone_optional`) making both nullable
  plus a `chk_users_has_identifier` CHECK requiring at least one of phone/email.
- **That same migration's auto-generated SQL tried to `DROP INDEX idx_products_search`** and
  drop a phantom "default" on the generated `search_vector` column — Prisma's diff engine doesn't
  understand `GENERATED ALWAYS AS ... STORED` columns (declared as `Unsupported("tsvector")` in
  schema.prisma) and treated the real generated column as unexplained drift it wanted to strip.
  Removed both statements by hand before applying. **This will resurface on every future
  migration that touches `products`** — always re-check generated migration SQL before applying.
- `RateLimitError`/`ValidationError`/etc. in `core/errors/AppError.ts` only supported a fixed
  per-class error code; extended all subclasses to accept an optional `code` override so
  endpoint-specific codes (`OTP_RESEND_LIMIT`, `ACCOUNT_LOCKED`, etc.) could be surfaced at the
  same HTTP status without inventing new status codes outside TRD §9's enumerated list.

**Known limitations / assumptions (see `docs/handoffs/HO-F1-Auth.md` for the frontend-facing ones):**
- No IP-based rate limiting on `/login`/OTP endpoints — per-identifier lockout only. Conscious
  scope decision (confirmed with the user), not an oversight; TRD §18's general IP-rate-limit
  middleware is cross-cutting and wasn't built in Phase 2 either.
- `SellerProfile` is created with a placeholder store name at activation time, not deferred to
  the (out-of-scope) store-setup wizard — see the explicit handoff contract in
  `docs/handoffs/HO-F1-Auth.md`.
- Password-reset tokens live in Redis only (30-min TTL), no `password_reset_tokens` table —
  consistent with Schema Doc §11's stated principle for short-lived auth state.
- RS256 keys and `FIELD_ENCRYPTION_KEY` are dev-only, generated via a one-off `node -e` command;
  `.env.example` flags that production needs secrets-manager-issued values instead.

---

## Feature: Database (Implementation Plan Phase 4)

**Status:** Done — 2026-07-28

**What shipped:**
- Complete `apps/backend/prisma/schema.prisma`: 25 base tables from `docs/KarobarAI-05-Schema.md`
  §4, plus 3 tables added by the binding addenda — `payout_wallets` (§14.1), `seller_daily_stats`
  (§15.1), `seller_recommendations` (§15.2). 19 enums. All FK/cascade rules per §5.
- All 6 corrections from addenda §14/§15 applied: wallet columns moved off `seller_profiles` into
  `payout_wallets`; `settlements.gross` defined as `orders.subtotal` (never `shipping_fee`);
  `orders.ship_*` fields split per the explicit encryption spec (city/province/postal stay plain
  for courier-coverage queries); `returns` has no `deleted_at` (status enum is the lifecycle,
  per §14.5); `returns.seller_id` denormalized (§15.5); `seller_profiles.onboarding_step` /
  `onboarding_completed_at` added (§15.6).
- Constraints Prisma's schema DSL can't express, added by hand-editing the generated migration
  SQL (`prisma/migrations/20260728160924_init/migration.sql`) instead of being silently dropped:
  - `products.search_vector` as a real `GENERATED ALWAYS AS (...) STORED` tsvector column
    (`'simple'` config, EN+UR bilingual) + GIN index (§7)
  - Partial unique indexes (`WHERE deleted_at IS NULL`) on `users.phone_bidx`, `users.email_bidx`,
    `payout_wallets(seller_id, type, account_number)`
  - Partial index `idx_products_live`
  - 6 CHECK constraints incl. `chk_settlements_net` (`net = gross - commission`, §14.2)
- `prisma/seed.ts`: seeds the 5 `platform_config` keys from §4.25 (commission rate, courier
  weights, return window, min order value, returns confidence threshold) and 8 starter bilingual
  categories (EN/UR).
- Local Postgres set up: native PostgreSQL 18 (not Docker) on the dev machine, dedicated
  `karobarai` role/database created (matches `.env.example` — only the host differs:
  `localhost` for native, `postgres` for Docker Compose).
- Fixed a real bug this surfaced: env-loading was CWD-dependent, so running commands from
  `apps/backend` vs the repo root picked up `.env` differently (or not at all). Fixed in two
  places: `apps/backend/src/core/config/index.ts` now walks up to find the repo root
  (`pnpm-workspace.yaml`) regardless of CWD; Prisma CLI scripts (`prisma:generate`,
  `prisma:migrate`, `prisma:seed`, `prisma:studio`) use `dotenv-cli` pointed at the root `.env`.

**Verified (not just written):**
- `prisma migrate dev` applied the hand-edited migration cleanly; `prisma migrate status` reports
  "up to date" (no drift) afterward.
- `prisma generate` succeeds (previously failed with the Feature-0 model-free schema — see below).
- `\d products` confirms `search_vector` is a genuine generated column; direct SQL confirms all 6
  CHECK constraints and all partial indexes exist.
- Seed ran; verified via direct `psql` query that `platform_config` and `categories` rows are
  correct, including Urdu rendering.
- A Prisma Client smoke script queried real rows end-to-end (`category.count()`,
  `platformConfig.count()`, a `findUnique` by slug).
- Backend `tsc --noEmit` and Jest suite still green after all schema/config changes.

**Known limitations / assumptions:**
- `prisma migrate dev`'s shadow-database step required granting the `karobarai` role `CREATEDB`
  and `pg_signal_backend` locally — one-time, documented in README for the second developer.
- Local dev Postgres is native (v18) on this machine, not the Docker Compose `postgres` service
  (v16) — nobody has actually booted the Docker stack yet (no Docker installed in this sandbox).
  The `.env` here points at `localhost`; the committed `.env.example` still defaults to the Docker
  service hostname for whoever runs `docker compose up`.
- `tracking_events` and `product_images`/`cart_items` skip a couple of doc-listed plain indexes
  where a composite unique index already leads with the same column (avoids redundant indexes) —
  called out inline in `schema.prisma` comments where this decision was made.

---

## Feature: Project Foundation (Implementation Plan Phase 1, partial Phase 2)

**Status:** Done — 2026-07-28

**What shipped:**
- Monorepo: `apps/frontend` (React 18 + TS + Vite + PWA scaffold), `apps/backend` (Express + TS),
  `apps/ai-service` (FastAPI), `packages/shared` (placeholder types/errors/enums), `infra/`
  (Docker Compose + Nginx config + a Dockerfile per service).
  - Renamed from the TRD's literal `apps/web` / `apps/api` to `apps/frontend` / `apps/backend`
    per explicit user request (package names, workspace config, Dockerfiles, compose, README all
    updated to match).
- Root `package.json` (pnpm workspaces), `.env.example` (every TRD §27 variable), `.gitignore`,
  `.nvmrc` (20) / `.python-version` (3.11), `tsconfig.base.json` (strict TS).
- `apps/backend`: typed error hierarchy (`AppError` → `ValidationError`/`AuthError`/etc, TRD §14),
  central error middleware, response envelope (`{success, data, error, timestamp}`, TRD §9), pino
  logger, config loader, Redis/BullMQ connection stubs, `/health` endpoint, empty
  `schema.prisma` (datasource/generator only, at this stage), folder stubs for every module
  (`auth/`, `catalog/`, `cart/`, ...) and adapter (`payment/`, `courier/`, `sms/`, ...).
- `apps/ai-service`: FastAPI `/health`, folder stubs for `llm/`, `vision/`, `cnn/`, `schemas/`.
- Docker Compose: web/api/ai-service/postgres/redis/minio/nginx, ai-service has no host port
  (TRD §8 — internal-only), Nginx routes `/api` → api, `/` → the Vite dev server with HMR
  websocket upgrade.

**Verified (not just written):**
- `pnpm install` succeeds across the workspace.
- `apps/backend`: `tsc --noEmit` clean, Jest passes (`/health` returns the correct envelope),
  `tsc` production build compiles, and the compiled `dist/server.js` was actually booted and
  curled — real 200 response. Also verified booting via plain `cd apps/backend && npm run dev`
  (not just `pnpm` from the root) since the user wanted that exact workflow to work.
- `apps/frontend`: `tsc --noEmit` clean, `vite build` succeeds (service worker + manifest
  generated). Fixed a real bug found here: a `tsc -b`/`noEmit` conflict and a missing
  `skipLibCheck` that broke on `vite-plugin-pwa`'s type declarations.
- `apps/ai-service`: `pytest` passes, `black`/`flake8`/`mypy` all clean.
- `packages/shared`: typechecks clean.
- `infra/docker-compose.yml`: valid YAML (checked with a Python parser) — **not** run through
  actual `docker compose up`, since Docker isn't installed in this sandbox. Flagged to the user
  as something to verify on their own machine.

**Known limitations / assumptions:**
- Docker was never actually run here — compose file is syntactically valid but unverified live.
- Dependency versions are pinned but were not checked against the live npm registry for latest
  patch releases.
- Jest coverage gate temporarily set to 0% (can't hit the TRD's 80% target with zero features
  built yet) — needs ratcheting up as real modules land.
- Sandbox has Node 24 / Python 3.13 installed vs. the TRD's Node 20 LTS / Python 3.11 — everything
  tested fine on the newer versions, but `.nvmrc`/`.python-version` pin the TRD's versions.
- Did not touch: GitHub repo creation, branch protection, CI workflows, PR templates (Playbook
  Tasks 1/12) — out of scope for "runs locally," not requested.

---

*Next: Feature 3 (Store Management) is done — Feature 4 (Product Management) is next per the
day-by-day plan (`docs/DailyPlan.md` Days 6-9, PB-F4).*
