# Handoff — F2 User Profiles (Backend → Frontend)

**Status:** Backend complete and verified — 2026-07-29. Full Jest suite green (76/76 tests,
16/16 suites) including a dedicated adversarial sweep over every protected route.

Covers profile retrieval/update, avatar upload, change-password, and account settings. Store
setup wizard (SCR-S00) and full address CRUD remain out of scope (unchanged from F1's handoff).

---

## Base path & envelope

All endpoints are under `/api/v1/profile`, all require `Authorization: Bearer <accessToken>` (the
router mounts `authenticate` once for the whole router — there is no unauthenticated profile
route). Same standard envelope as Auth: `{success, data, error, timestamp}`. Switch on
`error.code` — full list in `packages/shared/src/errors/index.ts` (`PROFILE_ERROR_CODES`):
`ADDRESS_NOT_FOUND`, `ADDRESS_NOT_OWNED`, `INVALID_CURRENT_PASSWORD`, `AVATAR_INVALID_FILE`,
`AVATAR_TOO_LARGE`.

Live interactive docs: `GET /api-docs` (Swagger UI) once the backend is running — every endpoint
below is also documented there with request/response schemas.

## Response shapes (`ProfileDTO`)

`GET /me` returns one of three shapes depending on the caller's own role — there's no separate
endpoint per role, just one contract that discriminates on `role`:

```ts
// Buyer
{ id, role: 'BUYER', status, preferredLanguage, avatarUrl, createdAt, defaultAddressId }

// Seller
{ id, role: 'SELLER', status, preferredLanguage, avatarUrl, createdAt,
  storeName, storeDescription, logoUrl }

// Admin / Support
{ id, role: 'ADMIN' | 'SUPPORT', status, preferredLanguage, avatarUrl, createdAt }
```

`id` is `user.publicId` (never the internal BigInt). `defaultAddressId` is only the address's id
(string, since it's a BigInt) — the full `Address` object is deferred to the not-yet-built
addresses feature; the frontend will need a separate lookup once that lands. **Seller shape
deliberately excludes `commissionRate`/`fraudRate30d`/payout wallet fields** — those are
admin/payout concerns, not profile data, and are never selected server-side (not just stripped
post-fetch). **Admin/Support gets identity fields only** — confirmed against App Flow AD01–AD08:
none of those screens is a self-profile view, so nothing beyond base fields is built for them.
Flag to the frontend team if a self-profile screen for Admin/Support turns out to be needed later
— it isn't in the current App Flow.

Every mutating profile endpoint (update, avatar upload/remove, default-address swap) returns the
**same `ProfileDTO`** shape as `GET /me`, refetched after the write — so the frontend can treat
every one of these calls as "here's your fresh profile," no separate re-fetch needed.

## Endpoints

### `GET /me`
Returns `ProfileDTO` (see above). `401` if the token is missing/invalid/expired/revoked.

### `PATCH /me` — Seller only
Body (all fields optional, at least conceptually a partial update):
```json
{ "storeName": "...", "storeDescription": "..." | null, "logoUrl": "..." | null }
```
Returns the updated `SellerProfileDTO`. `403` if the caller isn't a Seller (Buyer/Admin tokens are
rejected by `authorize('SELLER')` before the handler runs — there's no silent no-op). No
phone/email/name field exists here — App Flow's SCR-S10 "Store/Brand" tab only covers these
three; nothing else was invented.

### `PATCH /me/default-address` — Buyer only
Body: `{ "addressId": "123" }` (numeric string — `Address` has no public UUID column yet). Returns
the updated `BuyerProfileDTO`. This is a **transactional swap**: unset old default → set new
default → update `buyerProfile.defaultAddressId`, all in one `prisma.$transaction`, so a partial
failure can never leave two addresses marked default or a dangling pointer. Confirmed by a
dedicated test that forces a failure mid-swap and asserts the DB is left in a consistent
pre-swap state.
- `403 ADDRESS_NOT_OWNED` — the address exists but belongs to a different buyer.
- `404 ADDRESS_NOT_FOUND` — no such address (or it's soft-deleted).
- Full address CRUD (add/edit/delete addresses) is **not** part of this feature — this endpoint
  only re-points which existing address is the default.

### `POST /me/avatar` — multipart/form-data
Field name: `avatar` (binary). Max 10MB (rejected by multer at the transport layer before the
buffer is even fully read — same limit re-checked in the service). Server validates the actual
file bytes via **magic-byte sniffing** (JPEG/PNG/WEBP), never the client-supplied `mimetype`
header — do not rely on setting a correct `Content-Type` to pass validation; the bytes must
actually match.
- `200` → fresh `ProfileDTO` with the new `avatarUrl` (a public, permanently-accessible URL — not
  a presigned link, so it's safe to cache/store client-side long-term).
- `400 AVATAR_TOO_LARGE`, `400 AVATAR_INVALID_FILE`.
- Replacing an existing avatar deletes the old object from storage in the background
  (fire-and-forget) — the response doesn't wait on that cleanup.

### `DELETE /me/avatar`
No body. Returns fresh `ProfileDTO` with `avatarUrl: null`. Always `200`, including when there was
no avatar to begin with.

### `POST /me/password` — re-auth required
Body: `{ "currentPassword": "...", "newPassword": "...", "confirmNewPassword": "..." }`.
Password-complexity rule is the **exact same schema Auth uses** (`passwordSchema` from
`schemas/auth.ts`, imported not redefined) — do not build separate copy for this form.
- `200` → `{ accessToken, expiresIn }` **plus a rotated `karobarai_rt` cookie for the current
  session** (handled by the browser automatically, same as `/auth/login`/`/auth/refresh`).
- `401 INVALID_CURRENT_PASSWORD` if `currentPassword` doesn't match.
- **⚠️ Same "logs out everywhere" behavior as Auth's reset-password**: every *other* session/
  device is revoked. The current session gets a fresh token pair so this device stays logged in,
  but the frontend should show the same "you've been signed out on your other devices" messaging
  used on the reset-password success screen (see `HO-F1-Auth.md`).

### `GET /me/settings`
Returns `AccountSettingsDTO`: `{ smsEnabled, whatsappEnabled, emailEnabled, inappEnabled,
preferredLanguage }`. A user with no `notification_preferences` row yet (pre-dates this feature)
gets the schema's own defaults (all channels `true`) rather than an error — don't build an empty
state for this.

### `PATCH /me/settings`
Body: any subset of the same fields as above. Returns the updated `AccountSettingsDTO`.
**`smsEnabled` and `inappEnabled` cannot be disabled** (REQ-F-Notif004) — sending `false` for
either is **silently forced back to `true`** server-side, not rejected with an error. The
frontend should render these two toggles as visually locked/disabled in the UI to match — a user
who manages to flip them client-side and save will see them silently snap back to on, which will
look like a bug if the UI doesn't already prevent the toggle. `whatsappEnabled`/`emailEnabled`
are freely toggleable.

---

## Storage adapter (context for whoever touches infra/env config)

Avatars are stored via an S3-compatible adapter (`adapters/storage/`) — MinIO in dev, real S3 in
prod, selected purely by which `S3_*`/`MINIO_*` env vars are set (no `ADAPTER_MODE` gate, unlike
`sms`/`email` — storage is always "live" since there's no meaningful mock beyond an in-memory
stub used only by tests). Public-read bucket policy — avatar URLs are permanent public links, not
presigned/expiring ones, since there's no privacy requirement for avatar images and expiring URLs
would just produce broken images later.

## Known limitations / assumptions (backend-confirmed)

- No editable phone/email/display-name field anywhere in this feature — App Flow's SCR-S10/
  SCR-B12 don't list one, so nothing was invented.
- Admin/Support self-profile is identity-only; flag if a future App Flow revision adds a real
  self-profile screen for those roles.
- Full address CRUD (add/edit/delete, not just default-selection) is a separate, not-yet-built
  feature.
