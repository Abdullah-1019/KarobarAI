# Handoff — F2 User Profiles (Frontend)

**Status:** Frontend complete for everything the backend supports — 2026-07-30. Built directly
against the real API per `docs/handoffs/F2-profiles-backend.md`, no mocks.

Same day, also closed two Day-1 loose ends that Profile depended on: Forgot/Reset Password
(SCR-A04) and session-restore + RBAC route guarding (previously deferred — see
`docs/handoffs/F0-foundation-frontend.md` / `HO-F1-Auth.md`).

---

## What shipped

**Session/RBAC** (`apps/frontend/src/app/`):
- `AppProviders.tsx` calls `POST /auth/refresh` then `GET /auth/me` on boot to restore a session
  from the `karobarai_rt` cookie — `authStore.status` is `'restoring'` until that resolves.
- `ProtectedRoute.tsx` — role-gated route wrapper; unauthenticated → `/login` (401 case), wrong
  role → an "not authorised" `EmptyState` (403 case), both per App Flow's global UI states.
- `api/client.ts` gained a response interceptor: any `401` outside of login/register/refresh/otp
  clears the session store, which `ProtectedRoute` picks up reactively and redirects on its own.
- `/seller/*` and `/admin/*` are now fully gated (`SELLER`/`ADMIN` respectively). `/buyer/*` stays
  public except `/buyer/profile*`, which is gated to `BUYER`.

**Auth — Forgot/Reset Password** (`apps/frontend/src/features/auth/`):
- `ForgotPasswordPage.tsx` (`/forgot-password`), `ResetPasswordPage.tsx` (`/reset-password?token=`).
- Reset success screen explicitly states the account was signed out on every other device, per
  `HO-F1-Auth.md`'s requirement.

**Profile** (`apps/frontend/src/features/profile/`, new):
- `ProfilePage.tsx` — role-branched view (Buyer/Seller/Admin), first real `useQuery` consumer of
  the app's `queryClient`.
- `EditProfilePage.tsx` — Seller-only, storeName/storeDescription/logoUrl.
- `AvatarUpload.tsx` — upload/remove, writes the returned `ProfileDTO` straight into the query
  cache (no extra round-trip, per the backend contract).
- `SettingsPage.tsx` — 4 notification toggles; `smsEnabled`/`inappEnabled` rendered locked
  (disabled, always on) per `CRITICAL_NOTIFICATION_CHANNELS` from `@karobarai/shared` — matches
  the backend's silent-force-true behavior instead of letting the UI show a toggle that snaps back.
- `ChangePasswordPage.tsx` — re-auth required; on success rotates the current session's token
  (`setSession` with the new `accessToken`) and shows the same "signed out elsewhere" messaging as
  Reset Password, without logging the current device out.

## Known limitations / deferred

- **Default-address swap is not wired up.** `setDefaultAddress()` exists in `profileApi.ts` but no
  screen calls it — there is no address-list/create endpoint anywhere in the backend today (only
  `PATCH /profile/me/default-address`, which needs an `addressId` nothing can currently supply).
  Flagging this to Abdullah rather than building speculative UI around it. Full address CRUD is
  explicitly out of scope for F2 per the backend handoff.
- Admin/Support has no self-profile screen — `ProfilePage` renders their `AdminProfileDTO` shape
  defensively if ever reached, but no route points at it (matches the backend handoff: no App Flow
  screen calls for one).
- Logo upload for Sellers is a plain URL text field (`logoUrl`), not a file picker — there is no
  dedicated logo-upload endpoint (only avatar has one). A real upload widget can replace this once
  Store Management (F3) adds one, if it doesn't reuse this field as-is.
