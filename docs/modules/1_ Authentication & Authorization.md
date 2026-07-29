# KarobarAI — Engineering Execution Playbook

## Feature 1: Authentication & Authorization

**Source of truth:** PRD (Doc 1) · TRD (Doc 2) · App Flow (Doc 3) · Backend Schema (Doc 5) · Implementation Plan (Doc 6) **Scope:** Registration, OTP Verification, Login, JWT, RBAC, Session Handling, Forgot/Reset Password, Logout. **Out of scope:** Any other feature (catalog, orders, payments, logistics, tracking, returns, analytics).

## Table of Contents

1.  [Feature Overview](#feature-overview)
2.  [Authentication Flow Overview](#authentication-flow-overview)
3.  [Task 1 — Foundation](#task-1--foundation)
4.  [Task 2 — User Registration](#task-2--user-registration)
5.  [Task 3 — OTP Verification](#task-3--otp-verification)
6.  [Task 4 — Login](#task-4--login)
7.  [Task 5 — JWT Authentication](#task-5--jwt-authentication)
8.  [Task 6 — RBAC](#task-6--role-based-access-control-rbac)
9.  [Task 7 — Session Handling](#task-7--session-handling)
10.  [Task 8 — Forgot / Reset Password](#task-8--forgot--reset-password)
11.  [Task 9 — Logout](#task-9--logout)
12.  [Final Verification](#final-verification)

## Feature Overview

| **Item** | **Value** |
| --- | --- |
| **Owning module** | apps/api/src/modules/auth/ |
| --- | --- |
| **Depends on tables** | users, seller\_profiles, buyer\_profiles, refresh\_tokens (Schema §4.1–4.3, §4.23) |
| --- | --- |
| **Depends on infra** | PostgreSQL (Prisma), Redis (OTP + lockout + jti denylist), SmsAdapter (mock, D2) |
| --- | --- |
| **Req IDs covered** | REQ-F-Auth001–007, REQ-NF-Security-003/004/005/006, REQ-F-Auth006 (session invalidation) |
| --- | --- |
| **Deferred (Future)** | REQ-F-Auth008 (Seller SMS 2FA) — not built in this feature |
| --- | --- |
| **Phases mapped** | Implementation Plan Phase 3 (Authentication), depends on Phase 2 (Architecture) and Phase 4 (Database) |
| --- | --- |

**Expected Feature Deliverable (restated as exit criteria):**

-   Seller can register and log in.
-   Buyer can register and log in.
-   Admin can log in (admin accounts are provisioned, not self-registered — PRD §10 has no Admin self-registration flow).
-   Protected APIs enforce JWT authentication.
-   Role-based authorization works correctly (RBAC + ownership, TRD §8).
-   Password reset flow is functional.
-   Secure session management is implemented (rotation, revocation, lockout).

**Assumption (stated explicitly, not invented silently):** The PRD/App Flow define registration only for Buyer/Seller (SCR-A01 role toggle: Buyer/Seller). Admin and Support accounts are internal/provisioned (PRD §10: "Admin and Support are role flags on internal accounts"). This playbook builds Admin **login** only, not Admin **self-registration**. Admin/Support account creation is a seed/internal-tooling concern, not part of this feature's API surface.

## Authentication Flow Overview

Canonical flow, reconciled from App Flow §2 and §6.1, TRD §7, Schema §11:

Guest

│

▼

Register (role: BUYER | SELLER, method: mobile | email) \[Task 2\]

│

├─ mobile → OTP Verification (6-digit, 10-min TTL, ≤5 resends/hr) \[Task 3\]

└─ email → Email verification link (same pattern, different channel)

│

▼

Login (identifier + password OR OTP) \[Task 4\]

│ → lockout check (5 fails / 15 min → 30-min lock, REQ-F-Auth007)

▼

JWT issued: access (RS256, 1h) + refresh (HttpOnly cookie, 7d) \[Task 5\]

│

▼

Every subsequent request → authenticate → authorize(role) → ownership \[Task 6\]

│

▼

Session lifecycle: refresh rotation, jti denylist, suspension kill-switch \[Task 7\]

│

▼

Forgot Password → Reset Password (single-use token) \[Task 8\]

│

▼

Logout → revoke refresh + denylist jti \[Task 9\]

**Non-negotiable cross-cutting rules (apply to every task below):**

-   No plaintext PII: phone/email stored encrypted with a blind-index column for lookup (Schema §4.1, §0).
-   No stack traces or raw exceptions ever reach the client (TRD §14).
-   Every response uses the standard envelope: { success, data, error, timestamp } (TRD §9).
-   All auth endpoints are Zod-validated at the boundary; unknown fields rejected.
-   All auth secrets (JWT keys, encryption keys) come from env/secrets store — never hard-coded (TRD §27).

## Task 1 — Foundation

### Purpose

-   Stand up the schema, keys, and infrastructure every later auth task depends on.
-   Prevent rework: get encryption, blind-indexing, and token infra right once, before any endpoint exists.
-   Establish the module skeleton so Registration/OTP/Login slot in without restructuring.

### Dependencies

-   Implementation Plan Phase 1 (monorepo, Docker Compose) and Phase 2 (architecture: error hierarchy, envelope, adapter factory, Redis wiring) complete.
-   Phase 4 Database groundwork available in parallel (this task creates the auth-relevant subset of that schema).

### Expected Deliverables

-   users, seller\_profiles, buyer\_profiles, refresh\_tokens tables migrated (Schema §4.1–4.3, §4.23).
-   RS256 keypair generated and loaded from secrets store.
-   AES-256-GCM field-encryption helper + blind-index helper for phone/email.
-   Redis connection confirmed for OTP storage, lockout counters, and jti denylist.
-   Mock SmsAdapter (D2) returning deterministic OTPs in non-prod.
-   apps/api/src/modules/auth/ skeleton: auth.routes.ts, auth.controller.ts, auth.service.ts, auth.dto.ts (empty/stubbed).

### Step-by-Step Execution

**Step 1.1 — Migrate auth-relevant schema**

-   **Objective:** Get users, seller\_profiles, buyer\_profiles, refresh\_tokens live in Postgres exactly as specified in Schema §4.1, §4.2, §4.3, §4.23.
-   **Action:** Write/extend schema.prisma with these four models plus enums user\_role, user\_status, language (Schema §3); run prisma migrate dev.
-   **Expected Output:** Migration applies cleanly; tables visible via psql \\d.
-   **Verification:** Confirm partial unique indexes on phone\_bidx/email\_bidx (WHERE deleted\_at IS NULL) exist (Schema §4.1).
-   **Next Step:** 1.2.

**Step 1.2 — Field encryption + blind index helpers**

-   **Objective:** Centralize PII encryption so no service ever calls raw crypto directly.
-   **Action:** Build core/security/encryption.ts (AES-256-GCM encrypt/decrypt using FIELD\_ENCRYPTION\_KEY, TRD §17) and core/security/blindIndex.ts (deterministic HMAC of normalized phone/email → \*\_bidx columns, Schema §4.1).
-   **Expected Output:** encryptField(value), decryptField(cipher), computeBlindIndex(value) unit-testable pure functions.
-   **Verification:** Round-trip test: encrypt → decrypt returns original; same input → same blind index (deterministic), different input → different index.
-   **Next Step:** 1.3.

**Step 1.3 — JWT key management**

-   **Objective:** Prepare RS256 signing infrastructure ahead of Task 5.
-   **Action:** Generate RS256 keypair; load JWT\_PRIVATE\_KEY / JWT\_PUBLIC\_KEY from secrets store (TRD §27); build core/security/jwt.ts with signAccessToken() / verifyAccessToken() stubs (implemented fully in Task 5).
-   **Expected Output:** Keys loadable at boot; app fails fast with a clear error if keys are missing.
-   **Verification:** Boot the API locally; confirm no crash and a log line confirms key load (never logs the key itself).
-   **Next Step:** 1.4.

**Step 1.4 — Redis wiring for OTP, lockout, denylist**

-   **Objective:** Confirm Redis is reachable and namespaced correctly before OTP/lockout logic is written.
-   **Action:** Extend core/redis/ client with key-prefix conventions: otp:{userId}, lockout:{identifier}, denylist:{jti} (Schema §11, TRD §7).
-   **Expected Output:** redis.set/get/del wrappers with TTL support.
-   **Verification:** Write a throwaway integration test that sets/gets/expires a key with TTL.
-   **Next Step:** 1.5.

**Step 1.5 — Mock SmsAdapter**

-   **Objective:** Unblock OTP delivery without real Twilio/SNS credentials (D2).
-   **Action:** Implement adapters/sms/index.ts (interface: sendSms(to, templateKey, vars, lang)), mock.ts (logs OTP to console/log line in dev, returns success), factory keyed on ADAPTER\_MODE.
-   **Expected Output:** Calling smsAdapter.sendSms(...) in mock mode returns a resolved promise and logs the OTP for dev visibility.
-   **Verification:** Unit test mock adapter returns deterministic success; confirm no real network call is attempted.
-   **Next Step:** 1.6.

**Step 1.6 — Auth module skeleton**

-   **Objective:** Create the folder structure so every later task only adds logic, not scaffolding.
-   **Action:** Create auth.routes.ts (empty router mounted at /api/v1/auth), auth.controller.ts, auth.service.ts, auth.dto.ts (Zod schemas file, empty).
-   **Expected Output:** /api/v1/auth/\_ping (temporary) returns the standard envelope.
-   **Verification:** curl the ping route; confirm envelope shape matches TRD §9.
-   **Next Step:** Proceed to Task 2.

### Common Errors

-   Forgetting WHERE deleted\_at IS NULL on partial unique indexes → phone/email reuse after soft-delete breaks (Schema §4.1).
-   Storing JWT keys in .env committed to VCS — must be gitignored (Sec-008).

## Task 2 — User Registration

### Purpose

-   Deliver REQ-F-Auth001/002/005 entry point: create a Buyer or Seller account via mobile+OTP or email+password.
-   Enforce password complexity and duplicate-account handling at the edge, before any downstream auth logic runs.
-   Produce a PENDING\_VERIFICATION user ready for Task 3 (OTP) or email verification.

### Dependencies

-   Task 1 complete (schema, encryption, blind index, mock SMS, module skeleton).

### Expected Deliverables

-   POST /api/v1/auth/register endpoint (SCR-A01).
-   Zod DTO enforcing role, phone-or-email, password rules.
-   Duplicate-account and unverified-resend handling.
-   Seller/Buyer profile stub row created alongside users (extends 1:1, Schema §4.2/§4.3).

### Step-by-Step Execution

**Step 2.1 — Define registration DTO**

-   **Objective:** Lock the exact input contract before writing service logic.
-   **Action:** In auth.dto.ts, define RegisterSchema (Zod): role: enum(BUYER, SELLER), phone?: string (PK format), email?: string, password: string (≥8, upper/lower/digit/special — REQ-F-Auth002), refine: exactly one of phone/email required.
-   **Expected Output:** Schema rejects malformed payloads with 400 + field-level errors.
-   **Verification:** Unit test each validation branch (missing role, weak password, both/neither identifier).
-   **Next Step:** 2.2.

**Step 2.2 — Duplicate-account check via blind index**

-   **Objective:** Detect existing accounts without decrypting stored PII (REQ-NF-Security-007 compliant lookup).
-   **Action:** In auth.service.ts::register(), compute phone\_bidx/email\_bidx from input, query users for a match where deleted\_at IS NULL.
-   **Expected Output:** If found and status != PENDING\_VERIFICATION → 409 ACCOUNT\_ALREADY\_EXISTS ("log in instead"); if found and still PENDING\_VERIFICATION → treat as resend (skip to Step 2.4).
-   **Verification:** Integration test: register same phone twice → second call returns 409 or triggers resend path, never a duplicate row.
-   **Next Step:** 2.3.

**Step 2.3 — Create user + role profile row**

-   **Objective:** Persist the account and its role-specific profile in one transaction.
-   **Action:** In a Prisma transaction: insert users (encrypted phone/email + bidx, bcrypt-hashed password cost 12, role, status='PENDING\_VERIFICATION'); insert matching seller\_profiles or buyer\_profiles row (empty/stub fields, e.g. Seller store\_name left for the setup wizard per App Flow SCR-S00).
-   **Expected Output:** One users row + one profile row committed atomically.
-   **Verification:** Query DB directly; confirm both rows exist and roll back correctly on forced failure (test a mid-transaction error).
-   **Next Step:** 2.4.

**Step 2.4 — Trigger verification (OTP or email link)**

-   **Objective:** Hand off to the correct verification channel (this task stops at "dispatch"; Task 3 owns OTP verification logic).
-   **Action:** If phone path → call OTP-generation routine (implemented fully in Task 3; for now, stub a call and log a TODO(Task 3) marker) → dispatch via mock SmsAdapter. If email path → generate a single-use verification token (short TTL) and log it (real email adapter is optional per TRD §28).
-   **Expected Output:** Response envelope: { success: true, data: { userId, status: 'PENDING\_VERIFICATION', verificationMethod } }.
-   **Verification:** Confirm no password hash, token, or OTP ever appears in the response body or logs (TRD §15 redaction rule).
-   **Next Step:** 2.5.

**Step 2.5 — Wire the route + error mapping**

-   **Objective:** Expose the endpoint per API standards (TRD §9).
-   **Action:** Mount POST /register in auth.routes.ts; map service errors to ValidationError(400) / ConflictError(409) via the central error middleware.
-   **Expected Output:** Endpoint reachable at /api/v1/auth/register, documented in Swagger (/api-docs).
-   **Verification:** Postman/curl: valid payload → 201 envelope; duplicate → 409 with stable error code ACCOUNT\_ALREADY\_EXISTS; weak password → 400 with field details.
-   **Next Step:** Proceed to Task 3.

### Common Errors

-   Decrypting PII just to check duplicates (leaks data into logs/memory unnecessarily) — always use the blind index for lookups (Schema §4.1).
-   Returning "email already exists" vs "phone already exists" with enough specificity to enable account enumeration — keep the message generic per REQ-NF-Security best practice. **Recommended Enhancement (Optional).**

## Task 3 — OTP Verification

### Purpose

-   Deliver REQ-F-Auth001/REQ-NF-Security-006: verify mobile ownership via a 6-digit, time-boxed, single-use OTP.
-   Transition the user from PENDING\_VERIFICATION to ACTIVE, unblocking Login (Task 4).
-   Enforce resend throttling to prevent SMS-cost abuse (T2 risk, TRD §29).

### Dependencies

-   Task 1 (Redis OTP storage, mock SmsAdapter) and Task 2 (user created in PENDING\_VERIFICATION) complete.

### Expected Deliverables

-   POST /api/v1/auth/otp/verify and POST /api/v1/auth/otp/resend endpoints (SCR-A02).
-   OTP generation, hashing, TTL, and resend-count logic in Redis.
-   User activation + first token issuance on success (hands off into Task 4/5 territory — access/refresh tokens are minted here since App Flow SCR-A02 states "tokens issued" immediately on verify).

### Step-by-Step Execution

**Step 3.1 — OTP generation routine**

-   **Objective:** Produce and store a verifiable 6-digit code without ever persisting it in plaintext.
-   **Action:** In auth.service.ts::generateOtp(userId): generate a random 6-digit code, hash it (e.g. HMAC with a server secret), store otp:{userId} = { hash, expiresAt, attempts:0 } in Redis with a 10-minute TTL (REQ-F-Auth001).
-   **Expected Output:** Redis key exists with 10-min TTL; plaintext OTP only ever passed to the SMS adapter, never returned in any API response.
-   **Verification:** Inspect Redis key via redis-cli TTL — confirm ≈600s; confirm response body from registration/resend never contains the code (except in mock-adapter dev logs).
-   **Next Step:** 3.2.

**Step 3.2 — Resend endpoint with rate limit**

-   **Objective:** Cap resends at 5/hour per REQ-F-Auth001.
-   **Action:** POST /otp/resend: check a Redis counter otp\_resend\_count:{userId} (1-hour TTL); if ≥5 → 429 OTP\_RESEND\_LIMIT; else increment, regenerate OTP (Step 3.1), dispatch via SmsAdapter.
-   **Expected Output:** Successful resends increment the counter; 6th attempt within the hour is blocked.
-   **Verification:** Integration test: call resend 6× within an hour; assert 5 succeed, 6th returns 429 with Retry-After.
-   **Next Step:** 3.3.

**Step 3.3 — Verify endpoint**

-   **Objective:** Validate the submitted code against the stored hash, enforcing single-use and expiry.
-   **Action:** POST /otp/verify with { userId, code }: fetch otp:{userId}; if missing/expired → 400 OTP\_EXPIRED; hash submitted code and compare; on mismatch increment attempts (cap at 5, then force a fresh resend) → 400 OTP\_INVALID; on match → delete the Redis key (single-use, REQ-NF-Security-006) and set users.status = 'ACTIVE'.
-   **Expected Output:** On success, user row updated; OTP key deleted so it cannot be replayed.
-   **Verification:** Test replay: verify once (success), verify again with the same code → OTP\_EXPIRED/OTP\_INVALID (key gone).
-   **Next Step:** 3.4.

**Step 3.4 — Issue tokens on successful verification**

-   **Objective:** Match App Flow SCR-A02 behavior — verification immediately starts a session.
-   **Action:** Call the token-issuance routine (full implementation lands in Task 5; for now, stub issueTokenPair(user) returning placeholder access/refresh values so the response contract is stable) and return them in the envelope.
-   **Expected Output:** { success: true, data: { accessToken, refreshToken, role, redirectTo } } — redirectTo computed per role (Seller → store-setup wizard, Buyer → storefront, per App Flow §6.1).
-   **Verification:** Confirm response shape matches what Task 5 will later populate with real signed tokens (contract test, not full crypto yet).
-   **Next Step:** 3.5.

**Step 3.5 — Wire routes + Swagger**

-   **Objective:** Finalize endpoint exposure.
-   **Action:** Mount both routes under /api/v1/auth; document request/response schemas in Swagger.
-   **Expected Output:** Both endpoints callable and documented.
-   **Verification:** End-to-end manual test: register (Task 2) → resend if needed → verify → user status flips to ACTIVE in DB.
-   **Next Step:** Proceed to Task 4 (Login) — pending confirmation.

### Common Errors

-   Comparing OTP in plaintext instead of hashed comparison — always hash-compare (REQ-NF-Security-006).
-   Not deleting the Redis key after successful verification — enables replay attacks.
-   Letting attempts grow unbounded — cap and force resend to avoid brute-force of a 6-digit space within the 10-minute window.

## Task 4 — Login

### Purpose

-   Deliver REQ-F-Auth003/007 (SCR-A03): authenticate an existing, active user by identifier + password (or OTP for mobile-only accounts) and issue a session.
-   Enforce lockout (5 fails/15 min → 30-min lock) before any credential comparison result is trusted.
-   Return the correct role-based redirect so the frontend routes to storefront / seller dashboard / admin console.

### Dependencies

-   Task 1 (encryption/blind index, Redis), Task 2 (user exists), Task 3 (user is ACTIVE) complete.
-   Token issuance in this task is still the **stub** from Step 3.4 — full signing lands in Task 5. Login calls the same stub for now.

### Expected Deliverables

-   POST /api/v1/auth/login endpoint.
-   Lockout counter logic in Redis.
-   Generic invalid-credentials error (no user enumeration).
-   Suspended/banned account handling (REQ-F-Auth006 tie-in).

### Step-by-Step Execution

**Step 4.1 — Define login DTO**

-   **Objective:** Lock the input contract.
-   **Action:** LoginSchema (Zod): identifier: string (phone or email), password: string, both required.
-   **Expected Output:** 400 on missing fields before any DB/Redis work runs.
-   **Verification:** Unit test empty/missing-field payloads return 400 without touching lockout counters.
-   **Next Step:** 4.2.

**Step 4.2 — Lockout pre-check**

-   **Objective:** Reject attempts on an already-locked identifier before comparing credentials (REQ-F-Auth007).
-   **Action:** Compute blind index of identifier; check lockout:{bidx} in Redis. If a lock flag exists → 423/403 with message "account locked, try again in N min" (do not reveal exact fail count).
-   **Expected Output:** Locked identifiers short-circuit immediately.
-   **Verification:** Force 5 failed logins (Step 4.4), confirm 6th attempt is blocked by the pre-check, not by re-evaluating the password.
-   **Next Step:** 4.3.

**Step 4.3 — Resolve user + status checks**

-   **Objective:** Look up the account and gate on account status before password comparison.
-   **Action:** Query users by blind index (deleted\_at IS NULL). If not found → proceed to Step 4.4 anyway with a dummy bcrypt comparison (timing-attack mitigation, **Recommended Enhancement (Optional)**) so response time doesn't leak existence. If found: check status — SUSPENDED/BANNED → 403 "account suspended, contact support" (SCR-A03); PENDING\_VERIFICATION → 403 "please verify your account first".
-   **Expected Output:** Only ACTIVE accounts proceed to password check.
-   **Verification:** Test each status value returns its mapped, correct error without leaking which check failed differently for existent vs non-existent accounts.
-   **Next Step:** 4.4.

**Step 4.4 — Password verification + fail counting**

-   **Objective:** Compare password and track failures toward the lockout threshold.
-   **Action:** bcrypt.compare(password, user.password\_hash). On mismatch: increment login\_fail:{bidx} in Redis (15-min TTL, reset on success); at count ≥5 within the window, set lockout:{bidx} (30-min TTL) and return the locked message. On match: clear both counters.
-   **Expected Output:** Generic INVALID\_CREDENTIALS (401) on any mismatch; lock applied exactly at the 5th failure inside 15 minutes.
-   **Verification:** Integration test: 4 fails → still INVALID\_CREDENTIALS; 5th fail → locked message; wait/mock TTL expiry → unlocked.
-   **Next Step:** 4.5.

**Step 4.5 — Issue session + role redirect**

-   **Objective:** On success, start a session exactly like OTP verification does (Step 3.4).
-   **Action:** Call issueTokenPair(user) (still the Task 5 stub); update last\_login\_at; compute redirectTo by role (BUYER→'/', SELLER→'/seller' or /seller/setup if profile incomplete, ADMIN→'/admin').
-   **Expected Output:** { success: true, data: { accessToken, refreshToken, role, redirectTo } }.
-   **Verification:** Manual test per role: seed one Buyer, one Seller (profile incomplete), one Admin (provisioned directly in DB/seed per Task 1 assumption) → confirm each gets the correct redirectTo.
-   **Next Step:** 4.6.

**Step 4.6 — Wire route + Swagger**

-   **Objective:** Finalize exposure.
-   **Action:** Mount POST /login; document in Swagger; map errors to AuthError(401) / ForbiddenError(403) / RateLimitError(429 via lockout).
-   **Expected Output:** Endpoint live and documented.
-   **Verification:** curl all four outcomes (success, wrong password, locked, suspended).
-   **Next Step:** Proceed to Task 5 (JWT Authentication is now fully implemented — this replaces the stub used above).

### Common Errors

-   Returning different error messages for "user not found" vs "wrong password" — enables account enumeration; always return the same INVALID\_CREDENTIALS message (SCR-A03).
-   Resetting the fail counter on a *locked* account before the lock TTL expires — the lock must hold for the full 30 minutes regardless of new attempts.

## Task 5 — JWT Authentication

### Purpose

-   Replace the Task 3/4 token stub with real RS256-signed access tokens and rotating refresh tokens (REQ-F-Auth003).
-   Provide the authenticate middleware every protected route in the platform depends on (TRD §8).
-   Persist refresh sessions durably (refresh\_tokens table) so rotation and revocation are auditable (Schema §4.23, §11).

### Dependencies

-   Task 1 (RS256 keys loaded), Task 4 (login produces a user object to sign against).

### Expected Deliverables

-   signAccessToken(user) / verifyAccessToken(token) fully implemented (Step 1.3 stub completed).
-   issueTokenPair(user) fully implemented (replaces stubs in Steps 3.4 and 4.5).
-   refresh\_tokens persistence + rotation-on-use logic.
-   authenticate Express middleware usable by all other modules.
-   POST /api/v1/auth/refresh endpoint.

### Step-by-Step Execution

**Step 5.1 — Implement access token signing**

-   **Objective:** Produce a stateless, verifiable 1-hour access token.
-   **Action:** signAccessToken(user): sign a JWT with RS256, payload { sub: user.user\_id, role: user.role, jti: uuid() }, expiresIn: '1h' (TRD §7, JWT\_ACCESS\_TTL).
-   **Expected Output:** A JWT string decodable with the public key, containing sub, role, jti, exp.
-   **Verification:** Unit test: sign → verify → payload matches input; tampered token fails verification.
-   **Next Step:** 5.2.

**Step 5.2 — Implement refresh token issuance + persistence**

-   **Objective:** Create a 7-day refresh token that is durable, hashed at rest, and revocable.
-   **Action:** Generate a random refresh token string; hash it (e.g. SHA-256) before storing; insert a row into refresh\_tokens (user\_id, jti, token\_hash, user\_agent, ip\_hash, expires\_at = now()+7d) (Schema §4.23). Return the **raw** token to the client only, set as HttpOnly + Secure + SameSite cookie (TRD §7).
-   **Expected Output:** One refresh\_tokens row per issued session; raw token never stored.
-   **Verification:** Query DB — confirm token\_hash does not equal the raw cookie value; confirm cookie flags (HttpOnly, Secure, SameSite) are set in the response headers.
-   **Next Step:** 5.3.

**Step 5.3 — Wire issueTokenPair into Task 3 & 4**

-   **Objective:** Replace both stubs with this real implementation — no duplicate logic.
-   **Action:** Update auth.service.ts so both OTP-verify success (Step 3.4) and login success (Step 4.5) call this single issueTokenPair(user) function.
-   **Expected Output:** One code path for token issuance used everywhere.
-   **Verification:** Re-run the Task 3 and Task 4 manual tests — confirm real signed JWTs now come back instead of placeholders.
-   **Next Step:** 5.4.

**Step 5.4 — authenticate middleware**

-   **Objective:** Provide the single gate every protected route uses.
-   **Action:** core/middleware/authenticate.ts: extract Authorization: Bearer <token>; verify signature + expiry; check jti against the Redis denylist (denylist:{jti}, populated in Task 7); on success attach req.user = { id, role, jti }; on any failure → AuthError(401).
-   **Expected Output:** Middleware usable as router.use(authenticate) or per-route.
-   **Verification:** Unit test: valid token → req.user populated; expired token → 401; denylisted jti → 401.
-   **Next Step:** 5.5.

**Step 5.5 — Refresh + rotation endpoint**

-   **Objective:** Let a client silently obtain a new access token using the refresh cookie, rotating the refresh token itself (Schema §11: "rotated on every use").
-   **Action:** POST /auth/refresh: read refresh cookie → hash it → look up matching refresh\_tokens row by user\_id+hash where revoked\_at IS NULL and not expired → if valid: mark old row revoked\_at = now(), issue a brand-new access token + brand-new refresh token/row (new jti), set new cookie. If invalid/expired/revoked → 401, clear cookie.
-   **Expected Output:** Old refresh token becomes unusable immediately after one refresh call; a new one takes its place.
-   **Verification:** Integration test: refresh once (succeeds, get new cookie) → attempt to reuse the **old** cookie → rejected (401) — proves rotation, not just renewal.
-   **Next Step:** 5.6.

**Step 5.6 — Wire route + Swagger**

-   **Objective:** Finalize exposure.
-   **Action:** Mount POST /refresh; document; apply authenticate middleware globally to all future protected routers (catalog, cart, orders, etc. — out of scope here, but the middleware contract is now frozen for them to consume).
-   **Expected Output:** Middleware exported from core/middleware/authenticate.ts ready for reuse platform-wide.
-   **Verification:** Smoke-test a throwaway protected dummy route with/without a valid token.
-   **Next Step:** Proceed to Task 6 (RBAC).

### Common Errors

-   Storing the raw refresh token instead of a hash — defeats the purpose of "never plaintext" (TRD §17).
-   Forgetting to revoke the *old* refresh row on rotation — allows a stolen old token to still work (replay).
-   Signing access tokens with a symmetric secret instead of RS256 — breaks the "public key distributed to services for verification" model (TRD §7) needed if/when other services verify tokens independently.

## Task 6 — Role-Based Access Control (RBAC)

### Purpose

-   Enforce the PRD §11 permission matrix as executable middleware, not just documentation.
-   Layer role checks and per-record ownership checks on top of authenticate (TRD §8 middleware chain).
-   Guarantee privileged actions are always audited (Schema §10).

### Dependencies

-   Task 5 (authenticate middleware attaches req.user.role) complete.

### Expected Deliverables

-   authorize(...roles) middleware.
-   ownership(resourceLoader) middleware pattern for record-level checks.
-   Route→permission mapping encoding PRD §11 for the auth module's own endpoints (broader platform-wide mapping is consumed by later features, but the pattern is finalized here).
-   Audit-log write helper wired for any mandatory-reason action (used later by Admin features; contract finalized now).

### Step-by-Step Execution

**Step 6.1 — authorize(roles\[\]) middleware**

-   **Objective:** Gate a route to one or more roles.
-   **Action:** core/middleware/authorize.ts: factory authorize(...allowedRoles) returns middleware that checks req.user.role (set by authenticate) against allowedRoles; mismatch → ForbiddenError(403).
-   **Expected Output:** router.get('/admin/x', authenticate, authorize('ADMIN'), handler) pattern works.
-   **Verification:** Unit test: BUYER hitting an authorize('ADMIN') route → 403; ADMIN → passes through.
-   **Next Step:** 6.2.

**Step 6.2 — ownership(resourceLoader) middleware**

-   **Objective:** Enforce "seller may only mutate their own products/orders" style rules (PRD §11 footnote, Schema §9).
-   **Action:** core/middleware/ownership.ts: factory takes a resourceLoader(req) function that fetches the target record's owner id; compares to req.user.id; Admin/Support bypass (per Schema §9) but flagged for audit if the action is privileged.
-   **Expected Output:** Reusable middleware other modules (catalog, orders, returns) will plug their own resourceLoader into later.
-   **Verification:** Contract test with a fake resource loader: owner → passes; non-owner → 403; admin → passes + audit-flag set on req.
-   **Next Step:** 6.3.

**Step 6.3 — Apply RBAC to this module's own routes**

-   **Objective:** Prove the pattern end-to-end using auth-module routes that need it (e.g., a future "admin creates support account" or "view my sessions" endpoint) — if no such route exists yet in this feature, apply it to a placeholder GET /auth/me (return the authenticated principal's role/profile summary), useful to every frontend shell (App Flow: role-based redirect after login/refresh).
-   **Action:** Add GET /api/v1/auth/me: authenticate only (no role restriction — any authenticated principal may read their own identity).
-   **Expected Output:** Returns { userId, role, status, preferredLanguage } for the calling principal.
-   **Verification:** Call with Buyer, Seller, Admin tokens — each gets their own correct data, never another user's.
-   **Next Step:** 6.4.

**Step 6.4 — Mandatory-reason audit helper (contract only)**

-   **Objective:** Finalize the shape later Admin features (suspend, ban, override) will call — not built out fully here, since those actions belong to other features, but the auth module owns "suspension invalidates sessions" (Step 7.x) which is a privileged action requiring audit.
-   **Action:** core/audit/writeAuditLog.ts: writeAuditLog({ actorId, action, entity, entityId, reason, before, after }) — inserts into audit\_logs (Schema §4.24) in the same transaction as the triggering mutation.
-   **Expected Output:** A single reusable function; any missing reason on a mandatory-reason action throws before the mutation commits.
-   **Verification:** Unit test: call without reason on an action type requiring it → throws; call with reason → row inserted with correct before/after JSONB.
-   **Next Step:** Proceed to Task 7 (Session Handling), which is the first consumer of this audit helper (suspension → immediate session kill).

### Common Errors

-   Checking role in the controller instead of middleware — inconsistent enforcement across endpoints; always gate at the router level (TRD §8 chain: authenticate → authorize → ownership).
-   Letting Admin bypass ownership *silently* — bypass is allowed (Schema §9) but must always be audit-logged when the action is privileged/destructive.

## Task 7 — Session Handling

### Purpose

-   Deliver REQ-F-Auth006: suspension/ban must invalidate active sessions **immediately**, not at next natural token expiry.
-   Complete the jti denylist loop that Task 5's authenticate middleware already checks against.
-   Add scheduled cleanup so refresh\_tokens doesn't grow unbounded with expired/revoked rows.

### Dependencies

-   Task 5 (authenticate checks denylist; refresh\_tokens table populated), Task 6 (audit helper for the suspension trigger) complete.

### Expected Deliverables

-   Redis jti denylist populated on suspend/ban/logout/password-reset/refresh-rotation.
-   Admin/internal suspend-account routine that revokes all of a user's active sessions at once.
-   Scheduled cleanup job for expired/revoked refresh\_tokens rows.

### Step-by-Step Execution

**Step 7.1 — Denylist-on-suspend routine**

-   **Objective:** Kill every active session for a user the instant they're suspended or banned.
-   **Action:** auth.service.ts::revokeAllSessions(userId, reason): query all refresh\_tokens rows for the user where revoked\_at IS NULL; for each, set revoked\_at = now() and add its jti to denylist:{jti} in Redis with TTL = remaining access-token lifetime (≤1h, since access tokens self-expire); call writeAuditLog (Task 6, Step 6.4) with action='SUSPEND' and the mandatory reason.
-   **Expected Output:** All refresh rows for the user revoked in one transaction; denylist entries added for any jti that could still have a live access token.
-   **Verification:** Integration test: log in as a user (get access+refresh) → call revokeAllSessions → immediately retry a protected route with the *old* access token → 401 (denylist hit) → retry /refresh with the old refresh cookie → 401 (revoked row).
-   **Next Step:** 7.2.

**Step 7.2 — Hook suspension into user status change**

-   **Objective:** Ensure this fires automatically, not only when manually called.
-   **Action:** Anywhere users.status transitions to SUSPENDED or BANNED (this feature exposes the *mechanism*; the Admin UI trigger itself belongs to the Admin feature, out of scope here) — call revokeAllSessions. Expose this as auth.service.ts::onStatusChangeToSuspended(userId, reason) so the future Admin module can call it directly.
-   **Expected Output:** A single exported function the Admin feature will invoke; this feature's responsibility ends at "the hook exists and works."
-   **Verification:** Unit test calling the exported hook directly with a mock reason — confirms the same behavior as Step 7.1.
-   **Next Step:** 7.3.

**Step 7.3 — Denylist check performance**

-   **Objective:** Keep the per-request denylist check O(1) and cheap, since it runs on every authenticated call (TRD §7: "Redis denylist keyed on jti/sub").
-   **Action:** Confirm authenticate (Task 5, Step 5.4) does a single EXISTS denylist:{jti} Redis call; do not scan refresh\_tokens on the hot path.
-   **Expected Output:** Auth middleware adds one Redis round-trip, no DB call, per request.
-   **Verification:** Log/measure middleware latency in a local load test; confirm no N+1 or table scan appears in query logs.
-   **Next Step:** 7.4.

**Step 7.4 — Scheduled cleanup job**

-   **Objective:** Prevent refresh\_tokens from growing unbounded (Schema §11: "a scheduled job purges expired/revoked refresh rows").
-   **Action:** Add a BullMQ repeatable job (daily) that deletes refresh\_tokens rows where expires\_at < now() or (revoked\_at IS NOT NULL and revoked\_at < now() - interval '30 days') — keep recently revoked rows briefly for forensic/audit visibility, per **Recommended Enhancement (Optional)**.
-   **Expected Output:** Job registered in the BullMQ scheduler (TRD §5.1 queue infra).
-   **Verification:** Manually trigger the job in a test DB seeded with expired rows; confirm only the targeted rows are deleted.
-   **Next Step:** Proceed to Task 8 (Forgot/Reset Password).

### Common Errors

-   Only deleting the refresh\_tokens row on suspend without also denylisting the jti — the *access* token (still valid up to 1h) keeps working until it naturally expires, violating "immediately" (REQ-F-Auth006).
-   Setting the denylist TTL shorter than the remaining access-token lifetime — a suspended user's old access token could outlive the denylist entry.

## Task 8 — Forgot / Reset Password

### Purpose

-   Deliver REQ-F-Auth (Forgot/Reset flow, SCR-A04): let a user regain access without support intervention.
-   Use a single-use, short-TTL reset token — never re-use the OTP mechanism's storage key space (avoid cross-flow collisions).
-   On successful reset: clear any active lockout and rotate all sessions (a password reset is a trust-boundary event, same as suspension).

### Dependencies

-   Task 1 (Redis, encryption), Task 4 (lockout counters exist and must be clearable), Task 7 (revokeAllSessions exists and is reused here).

### Expected Deliverables

-   POST /api/v1/auth/forgot-password endpoint.
-   POST /api/v1/auth/reset-password endpoint.
-   Reset-token generation, single-use enforcement, expiry.
-   Lockout-clear + full session revocation on successful reset.

### Step-by-Step Execution

**Step 8.1 — Forgot-password request**

-   **Objective:** Accept an identifier and dispatch a reset mechanism without revealing account existence.
-   **Action:** POST /forgot-password { identifier }: compute blind index, look up user. Regardless of found/not-found, return the **same** generic response ("if an account exists, a reset link/code has been sent") to avoid enumeration (**Recommended Enhancement (Optional)** — SCR-A04 doesn't specify this explicitly, but it follows the same non-enumeration principle already applied in Login). If found: generate a random reset token, hash it, store reset:{hash} = { userId, expiresAt } in Redis (short TTL, e.g. 15 min — reusing the OTP pattern but a distinct key namespace), dispatch via mobile SMS (mock adapter) or email link depending on the account's registration method.
-   **Expected Output:** Reset token dispatched via the appropriate channel; generic success response either way.
-   **Verification:** Test with an existing and a non-existing identifier — confirm identical response bodies and status codes; confirm Redis key only created for the existing case.
-   **Next Step:** 8.2.

**Step 8.2 — Reset-password submission**

-   **Objective:** Validate the token, enforce password complexity, and apply the new password atomically.
-   **Action:** POST /reset-password { token, newPassword, confirmPassword }: Zod validation (newPassword ≥8 incl. upper/lower/digit/special, matches confirmPassword — REQ-F-Auth002); hash the submitted token, look up reset:{hash} in Redis; if missing/expired → 400 RESET\_TOKEN\_EXPIRED ("link expired, request again," SCR-A04); if valid → bcrypt-hash the new password, update users.password\_hash, delete the Redis reset key (single-use).
-   **Expected Output:** Password updated; reset token consumed and unusable for a second call.
-   **Verification:** Integration test: reset once (succeeds) → replay the same token → RESET\_TOKEN\_EXPIRED (key already deleted).
-   **Next Step:** 8.3.

**Step 8.3 — Clear lockout + revoke all sessions on reset**

-   **Objective:** A password reset must both unblock a locked-out user and treat the reset as a full trust-boundary reset (Schema §11: "reset clears active lockout; reset rotates refresh tokens").
-   **Action:** In the same transaction/flow as Step 8.2: delete lockout:{bidx} and login\_fail:{bidx} Redis keys; call revokeAllSessions(userId, reason='PASSWORD\_RESET') (Task 7, Step 7.1) so any session obtained before the reset (e.g., by an attacker who had the old password) is killed.
-   **Expected Output:** User can immediately log in fresh with the new password; no stale sessions survive.
-   **Verification:** Test: lock an account (5 fails) → reset password → attempt login with new password immediately succeeds (lock cleared); confirm any pre-reset access/refresh tokens now fail (denylisted/revoked).
-   **Next Step:** 8.4.

**Step 8.4 — Wire routes + Swagger**

-   **Objective:** Finalize exposure.
-   **Action:** Mount both routes under /api/v1/auth; document; map errors to ValidationError(400) for expired tokens/weak passwords.
-   **Expected Output:** Both endpoints live and documented.
-   **Verification:** Full manual walkthrough: forgot → receive mock token/log → reset → login with new password.
-   **Next Step:** Proceed to Task 9 (Logout).

### Common Errors

-   Reusing the OTP Redis key namespace (otp:{userId}) for reset tokens — collides if a user triggers both flows; always use a distinct namespace (reset:{hash}).
-   Forgetting to revoke sessions on reset — leaves a window where a compromised-password attacker's existing session outlives the credential change.

## Task 9 — Logout

### Purpose

-   Deliver a clean, explicit session-termination endpoint (App Flow §6.1: "Logout → clear tokens + revoke refresh (jti denylist) → /login").
-   Reuse the exact same revocation primitives as suspension/reset (Task 7) — logout is just a **self-initiated, single-session** version of the same mechanism.
-   Close out the feature: after this task, all nine deliverable checkboxes in the Feature Overview should be verifiable end-to-end.

### Dependencies

-   Task 5 (refresh\_tokens, access token jti), Task 7 (revokeAllSessions pattern — logout reuses the single-session variant).

### Expected Deliverables

-   POST /api/v1/auth/logout endpoint.
-   Single-session revocation (not all sessions — a user logging out on one device shouldn't kill their other devices, unless explicitly a "logout everywhere" variant is desired).
-   Cookie clearing on the client response.

### Step-by-Step Execution

**Step 9.1 — Single-session revocation helper**

-   **Objective:** Revoke *only* the calling session's refresh row + denylist its jti, distinct from revokeAllSessions.
-   **Action:** auth.service.ts::revokeSession(userId, jti): find the refresh\_tokens row matching user\_id + jti where revoked\_at IS NULL; set revoked\_at = now(); add jti (from the **access** token, via req.user.jti set by authenticate) to the Redis denylist with TTL = remaining access-token lifetime.
-   **Expected Output:** Only the current device/session is terminated; other active sessions for the same user remain valid.
-   **Verification:** Test: log in from two "sessions" (two token pairs) → logout session A → confirm session A's tokens now fail while session B's tokens still work.
-   **Next Step:** 9.2.

**Step 9.2 — Logout endpoint**

-   **Objective:** Expose the action, authenticated, with no body required.
-   **Action:** POST /api/v1/auth/logout: authenticate middleware required (must know *which* session to kill); call revokeSession(req.user.id, req.user.jti); clear the refresh-token HttpOnly cookie (Set-Cookie with immediate expiry).
-   **Expected Output:** { success: true, data: { message: 'logged out' } }; cookie cleared in response headers.
-   **Verification:** curl with -c/-b cookie jar: login → logout → confirm cookie is cleared and a subsequent /refresh call with the old cookie value returns 401.
-   **Next Step:** 9.3.

**Step 9.3 — (Optional) "Logout everywhere"**

-   **Objective:** Give a security-conscious user the ability to kill all sessions, not just the current one.
-   **Action:** **Recommended Enhancement (Optional)** — not required by any cited REQ-ID, but a natural extension: POST /auth/logout-all calling revokeAllSessions(req.user.id, reason='USER\_INITIATED\_LOGOUT\_ALL') (Task 7, Step 7.1).
-   **Expected Output:** All of the user's sessions terminated at once, same guarantees as suspension.
-   **Verification:** Same test pattern as Step 7.1.
-   **Next Step:** 9.4.

**Step 9.4 — Final wiring + Swagger**

-   **Objective:** Close out the module.
-   **Action:** Mount route(s); document in Swagger; ensure authenticate is applied.
-   **Expected Output:** Feature-complete auth module: register → verify → login → JWT → RBAC → session mgmt → password recovery → logout, all reachable under /api/v1/auth.
-   **Verification:** Run the full checklist in the Feature Overview end-to-end against a seeded Buyer, Seller, and Admin account.
-   **Next Step:** Hand off to Phase 5 (Backend APIs) — every future protected route consumes authenticate + authorize + ownership from this feature without modification.

### Common Errors

-   Logout accidentally calling revokeAllSessions instead of revokeSession — logs the user out of every device when they only asked to log out of one.
-   Not clearing the cookie client-side — the browser keeps sending a now-revoked refresh token, causing confusing 401s on next silent-refresh attempt instead of a clean re-login prompt.

## Final Verification

### Updated Table of Contents

1.  [Feature Overview](#feature-overview)
2.  [Authentication Flow Overview](#authentication-flow-overview)
3.  [Task 1 — Foundation](#task-1--foundation)
4.  [Task 2 — User Registration](#task-2--user-registration)
5.  [Task 3 — OTP Verification](#task-3--otp-verification)
6.  [Task 4 — Login](#task-4--login)
7.  [Task 5 — JWT Authentication](#task-5--jwt-authentication)
8.  [Task 6 — RBAC](#task-6--role-based-access-control-rbac)
9.  [Task 7 — Session Handling](#task-7--session-handling)
10.  [Task 8 — Forgot / Reset Password](#task-8--forgot--reset-password)
11.  [Task 9 — Logout](#task-9--logout)
12.  [Final Verification](#final-verification)

### Cross-Reference Check

| **Task** | **Consumes from** | **Produces for** |
| --- | --- | --- |
| 1\. Foundation | Phase 1/2 infra | Tables, keys, encryption, mock SMS, module skeleton → all later tasks |
| --- | --- | --- |
| 2\. Registration | Task 1 | A PENDING\_VERIFICATION user → Task 3 |
| --- | --- | --- |
| 3\. OTP Verification | Tasks 1, 2 | ACTIVE user + token-issuance contract → Tasks 4, 5 |
| --- | --- | --- |
| 4\. Login | Tasks 1, 3 | Authenticated user + lockout counters → Tasks 5, 8 |
| --- | --- | --- |
| 5\. JWT Authentication | Task 1 (keys), Tasks 3–4 (stub replaced) | authenticate middleware, refresh\_tokens rows → Tasks 6, 7, 9 |
| --- | --- | --- |
| 6\. RBAC | Task 5 (req.user) | authorize/ownership middleware + audit helper → Task 7, and every future platform feature |
| --- | --- | --- |
| 7\. Session Handling | Tasks 5, 6 | revokeAllSessions primitive → Task 8; denylist loop closes Task 5's middleware |
| --- | --- | --- |
| 8\. Forgot/Reset Password | Tasks 1, 4, 7 | Password recovery; reuses Task 7's revocation |
| --- | --- | --- |
| 9\. Logout | Tasks 5, 7 | revokeSession (single-session variant of Task 7); closes the feature |
| --- | --- | --- |

### Requirement Traceability Confirmation

| **Req ID** | **Covered by** |
| --- | --- |
| REQ-F-Auth001 (OTP rules) | Task 3 |
| --- | --- |
| REQ-F-Auth002 (password complexity) | Tasks 2, 8 |
| --- | --- |
| REQ-F-Auth003 (JWT access/refresh) | Task 5 |
| --- | --- |
| REQ-F-Auth004 (RBAC) | Task 6 |
| --- | --- |
| REQ-F-Auth005 (store-setup wizard trigger) | Task 4, Step 4.5 (redirect only — wizard itself is out of scope) |
| --- | --- |
| REQ-F-Auth006 (suspension kills sessions) | Task 7 |
| --- | --- |
| REQ-F-Auth007 (lockout) | Task 4 |
| --- | --- |
| REQ-F-Auth008 (seller SMS 2FA) | **Deferred — Future scope, not built (per PRD §17.2)** |
| --- | --- |
| REQ-NF-Security-003 (bcrypt cost 12) | Tasks 2, 8 |
| --- | --- |
| REQ-NF-Security-004 (RS256 JWT) | Task 5 |
| --- | --- |
| REQ-NF-Security-005 (auth+RBAC on every endpoint) | Task 6 (pattern), enforced platform-wide going forward |
| --- | --- |
| REQ-NF-Security-006 (OTP expiry/single-use) | Task 3 |
| --- | --- |
| REQ-NF-Security-007 (PII encryption) | Task 1 |
| --- | --- |

### Document Alignment Confirmation

-   **PRD:** Roles, permission matrix (§11), Auth requirements (§12.6) — reflected in Tasks 2–9 and the Feature Overview assumption on Admin provisioning.
-   **TRD:** Auth strategy (§7), Authorization strategy (§8), error/logging rules (§14–15) — reflected in every task's error mapping and the RBAC middleware chain.
-   **App Flow:** SCR-A01–A04 screen contracts — reflected in Tasks 2–4 and 8's endpoint behaviors/response shapes.
-   **Schema:** users, seller\_profiles, buyer\_profiles, refresh\_tokens, audit\_logs (§4.1–4.3, §4.23–4.24), session rules (§11) — reflected in Tasks 1, 5, 6, 7.
-   **Implementation Plan:** Phase 3 deliverables and testing bar — fully covered; this playbook sequences Phase 3 into 9 dependency-ordered tasks as requested.

No contradictions with the five source documents were introduced. All deviations from a literal reading are flagged inline as either an **explicit stated assumption** (Admin provisioning) or a **Recommended Enhancement (Optional)** (timing-attack mitigation, generic forgot-password response, logout-everywhere).

*End of Playbook — Feature 1: Authentication & Authorization, Tasks 1–9 complete.*

—---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# **Problem 2**

Task 1

creates

JWT helper

Then

Task 5

implements JWT.

Good.

But Step 1.3 says

build signAccessToken()

Later Task 5 again says

implement signAccessToken()

This sounds duplicate.

Instead write

Task1

create jwt.ts skeleton

Task5

implement signing logic

Cleaner.