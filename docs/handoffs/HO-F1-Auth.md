# Handoff — F1 Authentication (Backend → Frontend)

**Status:** Backend complete, pending final test-suite run (blocked on Redis/Memurai install —
see `docs/DoneTillNow.md` for current status). Contract below is stable regardless.

Covers: SCR-A01 (Register), SCR-A02 (OTP Verify), SCR-A03 (Login), SCR-A04 (Forgot/Reset
Password). Store-setup wizard (SCR-S00) is **out of scope** — deferred to the Store Management
feature (see the SellerProfile contract at the bottom).

---

## Base path & envelope

All endpoints are under `/api/v1/auth`. Every response uses the standard envelope:
```json
{ "success": true, "data": { ... }, "error": null, "timestamp": "..." }
{ "success": false, "data": null, "error": { "code": "...", "message": "...", "details": {} }, "timestamp": "..." }
```
**Switch on `error.code`, not HTTP status or message text** — messages may change; codes won't.
The full code list is exported from `packages/shared/src/errors/index.ts` (`AUTH_ERROR_CODES`).

## Refresh token cookie

Name: `karobarai_rt`. `HttpOnly`, `SameSite=Lax`, `Secure` in production, scoped to
`Path=/api/v1/auth` — the frontend never reads or sends this manually; the browser attaches it
automatically to requests under that path. Access tokens are returned in the JSON body
(`data.accessToken`) and must be sent as `Authorization: Bearer <token>` — 1 hour lifetime
(`data.expiresIn` seconds).

## Endpoints

### `POST /register`
Body (discriminated on `method`):
```json
{ "method": "mobile", "role": "BUYER" | "SELLER", "phone": "0300...", "password": "..." }
{ "method": "email",  "role": "BUYER" | "SELLER", "email": "...", "password": "..." }
```
- **mobile** → `202`, `{ "status": "PENDING_VERIFICATION" }`, no tokens yet — proceed to SCR-A02.
- **email** → `201`, tokens issued immediately, **no verification step** (explicit product
  decision — PRD only mandates OTP verification for mobile; skip building an email-verify UI).
- `409 ACCOUNT_EXISTS` — "already exists, log in" (SCR-A01's exact requirement).
- A duplicate **pending** mobile registration doesn't error — it silently resends the OTP.
- Password rule (`400` if violated): ≥8 chars, upper + lower + digit + special.

### `POST /otp/verify`
Body: `{ "phone": "...", "code": "123456" }` → `200` with tokens on success.
Errors: `400 OTP_INCORRECT`, `400 OTP_EXPIRED`, `429 OTP_MAX_ATTEMPTS` (5 wrong guesses against
one code — request a fresh one via `/otp/resend`).

### `POST /otp/resend`
Body: `{ "phone": "..." }` → `200 { "resent": true, "expiresInSeconds": 600 }`.
`429 OTP_RESEND_LIMIT` after 5 resends in an hour — `error.details.retryAfterSeconds` is the
countdown SCR-A02 wants ("try again in N min").

### `POST /login`
Body: `{ "identifier": "phone-or-email", "password": "..." }` → `200` with tokens.
- `401 INVALID_CREDENTIALS` — **identical response** whether the identifier doesn't exist or the
  password is wrong. Do not build any UI that could reveal which case it was.
- `403 ACCOUNT_SUSPENDED`, `403 ACCOUNT_NOT_VERIFIED`.
- `429 ACCOUNT_LOCKED` after 5 failed attempts in 15 minutes — locked 30 minutes;
  `error.details.retryAfterSeconds` for the countdown.

### `POST /refresh`
No body — reads the `karobarai_rt` cookie. `200` with a new access token (and a rotated cookie,
handled by the browser automatically). `401 SESSION_EXPIRED` on anything wrong — treat exactly
like a normal 401 (redirect to login); don't special-case it.

### `POST /logout`
No body. Always `200 { "loggedOut": true }` — never errors, safe to call unconditionally on any
"log out" click even if the session already looks expired client-side.

### `POST /forgot-password`
Body: `{ "identifier": "..." }` → **always** `200 { "sent": true }`, regardless of whether the
identifier matched an account. Do not build a "no such account" error state — there isn't one,
by design (no enumeration).

### `POST /reset-password`
Body: `{ "token": "...", "newPassword": "...", "confirmPassword": "..." }` → `200 { "reset": true }`.
`400 RESET_TOKEN_INVALID` for an expired/garbage/already-used token — send the user back to
"forgot password" to request a new one.

**⚠️ Frontend must surface this explicitly:** a successful reset **logs the user out of every
device/session**, not just the current one. The success screen should say so (e.g. "Password
updated. You've been signed out everywhere — log in again with your new password.") — otherwise
a user with another tab/device open will see it suddenly log out and think it's a bug.

### `GET /me`
Requires `Authorization: Bearer <accessToken>`. Returns
`{ id, role, status, preferredLanguage, createdAt }` — no decrypted PII (no phone/email in the
response). Use this on app load / after refresh to restore session state and do the role-based
redirect (Buyer → storefront, Seller → dashboard, Admin → admin) — there's no separate
"whoami"-style redirect hint in the login response beyond `data.user`, which has the same shape.

---

## SellerProfile / onboarding contract (for whoever builds Store Management later)

Every `SELLER`-role account gets a `SellerProfile` row created automatically the moment it
becomes `ACTIVE` (email: at registration; mobile: at OTP verify) — **with a placeholder store
name** (`"Seller-<8 chars>"`) and `onboardingStep: 0`, `onboardingCompletedAt: null`. This is
intentional, not a bug: the row exists so seller-scoped features never have to special-case a
missing profile.

**Action required from the frontend when this lands:** after a seller logs in, check
`onboardingCompletedAt === null` (or `onboardingStep < 3`) and redirect into the SCR-S00 setup
wizard instead of the dashboard — don't display the placeholder store name anywhere as if it
were real. This backend phase does not build the wizard itself; it only guarantees the row and
the field contract exist for it to update.
