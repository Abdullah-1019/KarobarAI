# Handoff — F3 Store Management (Backend → Frontend)

**Status:** Backend complete — 2026-07-30. Extends Feature 2's profile module (no parallel store
module was built — see the boundary note below). Full contract covers SCR-S00 (Store-Setup
Wizard's persistence layer), SCR-S10's "Store/Brand" tab, and the seller-facing store-status read.

---

## The one thing to internalize before building any UI here

**A `seller_profiles` row exists for every Seller from the moment their account activates** — it's
created as a placeholder (Feature 1, `auth.service.ts`'s `activateUser`) with a throwaway store
name like `"Seller-a1b2c3d4"` and `onboardingStep: 0`. **`hasStore` on the profile DTO does NOT
mean "does a row exist"** — it means **"has onboarding actually been completed"**
(`onboardingCompletedAt !== null`). Never render the placeholder `storeName` anywhere as if it
were a real store name — check `hasStore` first.

`POST /profile/me/store` (below) is really "**complete onboarding**," not "create a row from
nothing." The wizard's "Finish" button should call it exactly once.

## Route ownership boundary

All store logic lives in the existing profile module (`/api/v1/profile/me/store/*`) — there is
no separate store module or separate base path. The Store-Setup Wizard's **UI and its
first-login redirect gate** remain the frontend's own responsibility (check `hasStore`, redirect
to the wizard if false); this feature only owns the **persistence endpoints** the wizard calls.

## Endpoints

All require `Authorization: Bearer <accessToken>` and are **Seller-only** (`403` for Buyer/Admin
tokens) — tighter than the rest of the profile router, which is shared across roles.

### `POST /profile/me/store` — the wizard's "Finish" action
Body:
```json
{
  "storeName": "My Store",
  "storeDescription": "optional",
  "jazzcashAccountNumber": "03001234567",
  "easypaisaAccountNumber": "03019876543"
}
```
**At least one of `jazzcashAccountNumber`/`easypaisaAccountNumber` is required** (`400` if
neither is present) — REQ-F-Auth005's "≥1 payout wallet before selling" requirement. If both are
sent, JazzCash is marked the default wallet; wallets are captured **once, here, only** — there is
no wallet-editing surface anywhere in this feature (Wallet & Payout is a separate, later feature).
Wallet account numbers are encrypted at rest before storage.

- `201` → the updated `SellerProfileDTO`, now with `hasStore: true`.
- `409 ONBOARDING_ALREADY_COMPLETE` — onboarding was already finished (don't retry automatically;
  this means the wizard was called twice, e.g. a double-click or a stale "Finish" button state).
  This is race-safe under real concurrency, not just sequential double-submits.

### `POST` / `DELETE /profile/me/store/logo`, `POST` / `DELETE /profile/me/store/banner`
Same shape as Feature 2's avatar upload — `multipart/form-data`, field name `logo` or `banner`,
max 10MB, server-side magic-byte validated (JPEG/PNG/WEBP only, never trusts the client
`mimetype`). Returns the updated `SellerProfileDTO` with the new `logoUrl`/`bannerUrl` (or `null`
after `DELETE`). Logo and banner are fully independent — removing one never touches the other.

- `422 STORE_NOT_ONBOARDED` — onboarding (`POST /store`) hasn't completed yet. **This should be
  unreachable in normal use** if the frontend's route guard correctly blocks `/seller/*` routes
  until `hasStore` is true — but it's enforced here too as defense-in-depth, so don't treat it as
  "shouldn't happen, don't handle it."
- `400 STORE_IMAGE_TOO_LARGE` / `400 STORE_IMAGE_INVALID_FILE`.

### `GET /profile/me/store/status` — read-only
Returns `{ status, since }` — `status` is the raw `user_status` enum value
(`PENDING_VERIFICATION | ACTIVE | SUSPENDED | BANNED | DEACTIVATED`), `since` is an ISO timestamp
**approximated from `users.updated_at`** (there's no dedicated status-change-timestamp column —
the precise audit history lives in `audit_logs`, out of scope for this read). **Map enum → label/
color entirely on the frontend** (e.g. `ACTIVE` → green "Active", `SUSPENDED` → red "Suspended —
contact support") — the backend intentionally returns the raw value so wording changes never
require a backend deploy.

**There is no mutation endpoint for store status anywhere** — a Seller can never change this
themselves (status changes are Admin-only, a separate feature). This is a tested, permanent
guarantee (see the adversarial suite), not an oversight to work around.

## Business-info editing (Feature 2's existing endpoint, tightened here)

`PATCH /profile/me` (unchanged path, already documented in `HO-F2-profiles-backend.md`) now:
- **Requires completed onboarding** — `422 STORE_NOT_ONBOARDED` if `hasStore` is false.
- **No longer accepts `logoUrl` as a direct field.** Previously this endpoint let a Seller set
  `logoUrl` to an arbitrary URL string with no validation. Now that a real validated upload
  endpoint exists (above), that bypass has been closed — `logoUrl`/`bannerUrl` are **only**
  settable via the upload endpoints. Sending `logoUrl` in this PATCH now returns `400` (unknown
  field, rejected by the schema's `.strict()`).

## `SellerProfileDTO` — updated shape

```ts
{
  id, role: 'SELLER', status, preferredLanguage, avatarUrl, createdAt,  // base fields
  storeName, storeDescription, logoUrl,
  bannerUrl,   // new
  hasStore,    // new — see "the one thing to internalize" above
}
```

## Known limitations / assumptions

- **Wallet management after creation** (add/remove/set-default, view history) is explicitly out
  of scope — a separate Wallet & Payout feature (SCR-S09). Wallets captured at onboarding can't
  be edited through any endpoint in this feature.
- **Task 6.4's "block writes when status ≠ ACTIVE" cross-check was not built as a separate
  per-endpoint gate.** The module doc itself calls this "largely defensive/belt-and-suspenders,"
  since a suspended/banned account's sessions are already immediately revoked by Auth's existing
  mechanism (REQ-F-Auth006) — a suspended Seller's access token stops working at the
  `authenticate` middleware layer before it ever reaches a store endpoint. Flagged as a
  deliberately deferred hardening item, not a gap that silently slipped through.
- Wizard step-by-step progress (which step the user is currently on) is **frontend-only** state —
  the server only ever sees the final, complete `POST /store` submission. There is no partial/
  draft persistence anywhere (matches the schema — no draft columns exist).
- `banner_url` is a Feature-3 schema addition (not in the base Schema Doc), mirroring
  `avatar_url`'s precedent from Feature 2.
