import { ValidationError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import { requestMeta, setRefreshCookie } from '../../core/http/session';
import type {
  ChangePasswordInput,
  SetDefaultAddressInput,
  UpdateSellerProfileInput,
  UpdateSettingsInput,
} from './profile.dto';
import * as profileService from './profile.service';

// Requires `authenticate` (mounted once on the whole router, profile.routes.ts) — req.user is
// guaranteed set in every handler below.

export const getMeHandler = asyncHandler(async (req, res) => {
  const profile = await profileService.getMyProfile(req.user!.sub);
  res.status(200).json(ok(profile));
});

export const updateSellerProfileHandler = asyncHandler(async (req, res) => {
  const input = req.body as UpdateSellerProfileInput;
  const profile = await profileService.updateSellerProfile(req.user!.sub, input);
  res.status(200).json(ok(profile));
});

export const setDefaultAddressHandler = asyncHandler(async (req, res) => {
  const input = req.body as SetDefaultAddressInput;
  const profile = await profileService.setDefaultAddress(req.user!.sub, input);
  res.status(200).json(ok(profile));
});

export const uploadAvatarHandler = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ValidationError('No file uploaded (expected multipart field "avatar")', undefined, 'AVATAR_INVALID_FILE');
  }
  const profile = await profileService.uploadAvatar(req.user!.sub, {
    buffer: req.file.buffer,
    size: req.file.size,
  });
  res.status(200).json(ok(profile));
});

export const removeAvatarHandler = asyncHandler(async (req, res) => {
  const profile = await profileService.removeAvatar(req.user!.sub);
  res.status(200).json(ok(profile));
});

// Reissues a fresh token pair for the current session (profile.service.changePassword revokes
// every session first) — same cookie-setting helper Auth uses, so the browser's refresh cookie
// updates exactly the same way it does after login/refresh.
export const changePasswordHandler = asyncHandler(async (req, res) => {
  const input = req.body as ChangePasswordInput;
  const auth = await profileService.changePassword(req.user!.sub, input, requestMeta(req));

  setRefreshCookie(res, auth.refreshCookie);
  res.status(200).json(ok({ accessToken: auth.accessToken, expiresIn: auth.expiresIn }));
});

export const getSettingsHandler = asyncHandler(async (req, res) => {
  const settings = await profileService.getSettings(req.user!.sub);
  res.status(200).json(ok(settings));
});

export const updateSettingsHandler = asyncHandler(async (req, res) => {
  const input = req.body as UpdateSettingsInput;
  const settings = await profileService.updateSettings(req.user!.sub, input);
  res.status(200).json(ok(settings));
});
