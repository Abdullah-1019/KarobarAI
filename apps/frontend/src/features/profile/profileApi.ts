import type {
  AccountSettingsDTO,
  ChangePasswordInput,
  ProfileDTO,
  SetDefaultAddressInput,
  UpdateSellerProfileInput,
  UpdateSettingsInput,
} from '@karobarai/shared';

import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';

// Shapes/behavior mirror docs/handoffs/F2-profiles-backend.md exactly. Every mutating endpoint
// (update/avatar upload/avatar remove/default-address) returns the same fresh ProfileDTO as
// GET /me — callers can treat every response here as "here's your current profile," no separate
// re-fetch needed.

// Shared TanStack Query key so every screen that reads/writes the profile (view, edit, avatar)
// stays in sync via the same cache entry instead of each maintaining its own copy.
export const PROFILE_QUERY_KEY = ['profile', 'me'] as const;

export function getProfile(): Promise<ProfileDTO> {
  return unwrap(apiClient.get<ApiEnvelope<ProfileDTO>>('/profile/me'));
}

export function updateSellerProfile(input: UpdateSellerProfileInput): Promise<ProfileDTO> {
  return unwrap(apiClient.patch<ApiEnvelope<ProfileDTO>>('/profile/me', input));
}

// Not wired into any screen yet — the endpoint requires an existing addressId, and there is no
// address-list/create endpoint anywhere in the backend yet to source one from (see
// docs/handoffs/F2-profiles-backend.md: "Full address CRUD ... is not part of this feature").
// Kept here so the default-address screen has a real call to wire up once that gap is closed.
export function setDefaultAddress(input: SetDefaultAddressInput): Promise<ProfileDTO> {
  return unwrap(apiClient.patch<ApiEnvelope<ProfileDTO>>('/profile/me/default-address', input));
}

export function uploadAvatar(file: File): Promise<ProfileDTO> {
  const formData = new FormData();
  formData.append('avatar', file);
  // No explicit Content-Type here — axios/the browser must set it themselves for a FormData body
  // so it includes the multipart boundary. Hardcoding 'multipart/form-data' without a boundary
  // breaks multer's parsing server-side.
  return unwrap(apiClient.post<ApiEnvelope<ProfileDTO>>('/profile/me/avatar', formData));
}

export function removeAvatar(): Promise<ProfileDTO> {
  return unwrap(apiClient.delete<ApiEnvelope<ProfileDTO>>('/profile/me/avatar'));
}

// Rotates the current session's access token too (fresh accessToken/expiresIn) — every *other*
// session is revoked. Caller must update authStore with the returned token so this device stays
// logged in, same "signed out everywhere else" messaging as auth's reset-password.
export function changePassword(input: ChangePasswordInput): Promise<{ accessToken: string; expiresIn: number }> {
  return unwrap(
    apiClient.post<ApiEnvelope<{ accessToken: string; expiresIn: number }>>('/profile/me/password', input),
  );
}

export function getSettings(): Promise<AccountSettingsDTO> {
  return unwrap(apiClient.get<ApiEnvelope<AccountSettingsDTO>>('/profile/me/settings'));
}

export function updateSettings(input: UpdateSettingsInput): Promise<AccountSettingsDTO> {
  return unwrap(apiClient.patch<ApiEnvelope<AccountSettingsDTO>>('/profile/me/settings', input));
}
