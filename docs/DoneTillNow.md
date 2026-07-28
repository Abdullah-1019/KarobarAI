# KarobarAI — Progress Log

**Purpose:** a running, human-readable record of what has actually been built, verified, and
decided — so either developer (or a fresh AI session) can pick up context without re-deriving it
from chat history. Updated at the end of each feature/phase, not line-by-line.

Format per entry: what shipped, how it was verified (not just "written"), and anything assumed
or flagged for follow-up. Newest entries at the top.

---

## Feature: Authentication (Implementation Plan Phase 3)

**Status:** Code complete — 2026-07-28. **Verification blocked**: Redis (Memurai) is not yet
installed on the dev machine, so the OTP/lockout/session-revocation test suite has not been run
end-to-end yet. `fieldCipher.test.ts` (no Redis/DB dependency) passes (8/8). Everything else is
written and typechecks but is unverified until Memurai is installed — update this entry once the
full suite runs.

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

*Next: finish verifying Phase 3 (Authentication) once Memurai is installed and the full Jest
suite runs clean, then move to Phase 3's remaining Architecture leftovers or straight into the
next feature per the Implementation Plan.*
