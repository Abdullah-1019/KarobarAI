# Handoff — F3 Store Management (Frontend)

**Status:** Complete — 2026-07-31. Built against `F3-store-management-backend.md` (already real,
no mocks used). Verified live: registered a Seller, ran the full wizard → settings → status flow
against the real backend + Postgres.

## Screens built

| Route | Screen |
|---|---|
| `/seller/setup` | Store-Setup Wizard — store name, description, JazzCash/Easypaisa wallet (single-page form, not a stepper — backend only sees one final POST) |
| `/seller/profile/settings` | Seller gets a new **Store/Brand** tab alongside Notifications & Language — business info edit, logo upload, banner upload, read-only status badge |

## Route gating

`RequireStore` (`features/seller/RequireStore.tsx`) wraps every `/seller/*` route except
`/seller/setup` — redirects to `/seller/setup` if `hasStore` is false. Nested inside the existing
role-based `ProtectedRoute`.

## Key files

- `features/profile/profileApi.ts` — `createStore`, `uploadStoreLogo`/`removeStoreLogo`,
  `uploadStoreBanner`/`removeStoreBanner`, `getStoreStatus`
- `features/seller/StoreSetupWizard.tsx`, `features/seller/RequireStore.tsx`
- `features/profile/StoreBrandTab.tsx`
- `components/ImageUploader.tsx` (generalized from the old `AvatarUpload.tsx` pattern — reused for logo + banner)
- `components/StatusChip.tsx` (maps `UserStatus` → color/label)

## Removed

`EditProfilePage.tsx` (`/seller/profile/edit`) — was silently broken (still submitted `logoUrl`,
which the backend's schema no longer accepts, `.strict()`). Its two fields moved into the
Store/Brand tab.

## Bug fixed (not scoped to F3, found while testing)

`RegisterPage.tsx` never sent the toggled UI language in the register payload, so every new
account defaulted to Urdu regardless of what was picked at signup — then `LoginPage`/
`AppProviders` correctly restore the *saved* preference on every login/boot, which was always
Urdu. Fixed by including `preferredLanguage` in the register call.

## Known environment gap (not a code bug)

Logo/banner upload will 500 with `getaddrinfo ENOTFOUND minio` on any machine without MinIO
running (this dev sandbox has no Docker/MinIO) — works fine wherever `docker compose up` (or a
real S3 bucket) is available.
