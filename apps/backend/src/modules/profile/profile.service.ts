import { CRITICAL_NOTIFICATION_CHANNELS } from '@karobarai/shared';
import type {
  AccountSettingsDTO,
  BuyerProfileDTO,
  ProfileDTO,
  SellerProfileDTO,
} from '@karobarai/shared';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

import { getStorageAdapter } from '../../adapters/storage';
import { config } from '../../core/config';
import { AuthError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors/AppError';
import { signAccessToken } from '../../core/jwt';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';
import type { AuthTokensResult } from '../auth/auth.service';
import {
  REFRESH_COOKIE_NAME,
  issueRefreshToken,
  revokeAllRefreshTokensForUser,
  type RefreshMeta,
} from '../auth/auth.tokens';
import type {
  ChangePasswordInput,
  SetDefaultAddressInput,
  UpdateSellerProfileInput,
  UpdateSettingsInput,
} from './profile.dto';

async function loadUser(publicId: string) {
  const user = await prisma.user.findUnique({
    where: { publicId },
    include: { sellerProfile: true, buyerProfile: true },
  });
  if (!user) throw new AuthError();
  return user;
}

// Task 1.4's role-branch stub, filled in here (Task 2). One endpoint, branches internally by
// role, so the frontend contract is always "GET /me = my own profile, shaped for my role".
export async function getMyProfile(publicId: string): Promise<ProfileDTO> {
  const user = await loadUser(publicId);

  const base = {
    id: user.publicId,
    status: user.status,
    preferredLanguage: user.preferredLanguage,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };

  if (user.role === 'BUYER') {
    return {
      ...base,
      role: 'BUYER',
      // Full address object deferred to the addresses feature — only the id is returned here.
      defaultAddressId: user.buyerProfile?.defaultAddressId?.toString() ?? null,
    };
  }

  if (user.role === 'SELLER') {
    return {
      ...base,
      role: 'SELLER',
      // Explicitly select only these three — never commissionRate/fraudRate30d/wallets
      // (Task 0's stated assumption). Selecting the allowed set explicitly, not stripping
      // post-fetch, is the whole point: there's nothing to accidentally leak.
      storeName: user.sellerProfile?.storeName ?? '',
      storeDescription: user.sellerProfile?.storeDescription ?? null,
      logoUrl: user.sellerProfile?.logoUrl ?? null,
    };
  }

  // ADMIN / SUPPORT — identity fields only, per the confirmed Task 0 assumption (no App Flow
  // screen AD01-AD08 is a self-profile view).
  return { ...base, role: user.role as 'ADMIN' | 'SUPPORT' };
}

// Feature 2 Task 3 (Profile Update) — the module doc's Task 3 heading/content was missing (only
// referenced by later tasks as a dependency). Scope derived from App Flow SCR-S10's "Store/Brand"
// tab (store_name, store_description, logo_url) — Seller-only; there is no editable identity tab
// for Buyer/Admin in App Flow, so nothing is invented for them here. Role enforcement itself
// lives in profile.routes.ts's authorize('SELLER'), not duplicated here.
export async function updateSellerProfile(
  publicId: string,
  input: UpdateSellerProfileInput,
): Promise<SellerProfileDTO> {
  const user = await prisma.user.findUnique({ where: { publicId } });
  if (!user) throw new AuthError();

  await prisma.sellerProfile.update({
    where: { userId: user.userId },
    data: {
      ...(input.storeName !== undefined && { storeName: input.storeName }),
      ...(input.storeDescription !== undefined && { storeDescription: input.storeDescription }),
      ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
    },
  });

  return getMyProfile(publicId) as Promise<SellerProfileDTO>;
}

// The buyer-side half of Task 3 — SCR-B12's "default address used at checkout" relationship.
// Full address CRUD is a separate feature; this only re-points the existing default.
export async function setDefaultAddress(
  publicId: string,
  input: SetDefaultAddressInput,
): Promise<BuyerProfileDTO> {
  const user = await prisma.user.findUnique({ where: { publicId } });
  if (!user) throw new AuthError();

  const addressId = BigInt(input.addressId);

  const address = await prisma.address.findUnique({ where: { addressId } });
  if (!address || address.deletedAt) {
    throw new NotFoundError('Address not found', undefined, 'ADDRESS_NOT_FOUND');
  }
  if (address.buyerId !== user.userId) {
    throw new ForbiddenError('This address does not belong to you', undefined, 'ADDRESS_NOT_OWNED');
  }

  // Transactional swap: unset the old default, set the new one, and update the buyer_profiles
  // pointer, all atomically — a partial failure must never leave two addresses marked default
  // or a defaultAddressId pointing at a non-default row.
  await prisma.$transaction([
    prisma.address.updateMany({
      where: { buyerId: user.userId, isDefault: true, addressId: { not: addressId } },
      data: { isDefault: false },
    }),
    prisma.address.update({ where: { addressId }, data: { isDefault: true } }),
    prisma.buyerProfile.update({
      where: { userId: user.userId },
      data: { defaultAddressId: addressId },
    }),
  ]);

  return getMyProfile(publicId) as Promise<BuyerProfileDTO>;
}

const AVATAR_MAX_BYTES = 10 * 1024 * 1024; // Assumption (Task 4.2): reuse REQ-F-Store001's 10MB
// accept-then-compress ceiling — no avatar-specific limit is defined anywhere in the docs.

const MAGIC_BYTE_CHECKS: Array<{ mime: string; check: (buf: Buffer) => boolean }> = [
  { mime: 'image/jpeg', check: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    check: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mime: 'image/webp',
    check: (b) =>
      b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

// Sec-012: server-side magic-byte validation — never trust the client-supplied mimetype.
function detectImageType(buffer: Buffer): string | null {
  return MAGIC_BYTE_CHECKS.find((entry) => entry.check(buffer))?.mime ?? null;
}

function extractStorageKey(url: string): string | null {
  const prefix = `${config.storage.publicBaseUrl}/${config.storage.bucket}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

export async function uploadAvatar(
  publicId: string,
  file: { buffer: Buffer; size: number },
): Promise<ProfileDTO> {
  if (file.size > AVATAR_MAX_BYTES) {
    throw new ValidationError('Avatar file is too large (max 10MB)', undefined, 'AVATAR_TOO_LARGE');
  }

  const mimeType = detectImageType(file.buffer);
  if (!mimeType) {
    throw new ValidationError(
      'File is not a valid JPEG, PNG, or WEBP image',
      undefined,
      'AVATAR_INVALID_FILE',
    );
  }

  const user = await prisma.user.findUnique({ where: { publicId } });
  if (!user) throw new AuthError();

  const extension = mimeType.split('/')[1];
  const key = `avatars/${user.userId}/${randomUUID()}.${extension}`;
  const storage = getStorageAdapter();
  const { url } = await storage.upload({ buffer: file.buffer, key, contentType: mimeType });

  const previousAvatarUrl = user.avatarUrl;
  await prisma.user.update({ where: { userId: user.userId }, data: { avatarUrl: url } });

  // Fire-and-forget (Task 4.3): never block the response on cleaning up the replaced file.
  if (previousAvatarUrl) {
    const previousKey = extractStorageKey(previousAvatarUrl);
    if (previousKey) {
      storage.delete(previousKey).catch((err) => {
        logger.warn({ err }, 'Failed to delete replaced avatar (non-fatal)');
      });
    }
  }

  return getMyProfile(publicId);
}

export async function removeAvatar(publicId: string): Promise<ProfileDTO> {
  const user = await prisma.user.findUnique({ where: { publicId } });
  if (!user) throw new AuthError();

  await prisma.user.update({ where: { userId: user.userId }, data: { avatarUrl: null } });

  if (user.avatarUrl) {
    const key = extractStorageKey(user.avatarUrl);
    if (key) {
      getStorageAdapter()
        .delete(key)
        .catch((err) => {
          logger.warn({ err }, 'Failed to delete avatar on remove (non-fatal)');
        });
    }
  }

  return getMyProfile(publicId);
}

// Reuses Auth's exact bcrypt/revocation utilities (Feature 1) — does not reimplement any of
// them. Revokes every session (current included), then issues a fresh pair for the current
// request, mirroring auth.service.ts's resetPassword exactly, so this device isn't logged out.
export async function changePassword(
  publicId: string,
  input: ChangePasswordInput,
  meta: RefreshMeta,
): Promise<AuthTokensResult> {
  const user = await prisma.user.findUnique({ where: { publicId } });
  if (!user) throw new AuthError();

  const currentOk = await bcrypt.compare(input.currentPassword, user.passwordHash ?? '');
  if (!currentOk) {
    throw new AuthError('Current password is incorrect', undefined, 'INVALID_CURRENT_PASSWORD');
  }

  const passwordHash = await bcrypt.hash(input.newPassword, config.bcryptCost);
  await prisma.user.update({ where: { userId: user.userId }, data: { passwordHash } });

  await revokeAllRefreshTokensForUser(user.userId, user.publicId);
  const refreshToken = await issueRefreshToken(user.userId, meta);
  const accessToken = signAccessToken(user.publicId, user.role, refreshToken.jti);

  return {
    accessToken,
    expiresIn: config.jwt.accessTtlSeconds,
    refreshCookie: {
      name: REFRESH_COOKIE_NAME,
      value: refreshToken.cookieValue,
      maxAgeSeconds: config.jwt.refreshTtlSeconds,
    },
    user: {
      id: user.publicId,
      role: user.role,
      status: user.status,
      preferredLanguage: user.preferredLanguage,
    },
  };
}

export async function getSettings(publicId: string): Promise<AccountSettingsDTO> {
  const user = await prisma.user.findUnique({
    where: { publicId },
    include: { notificationPreference: true },
  });
  if (!user) throw new AuthError();

  const prefs = user.notificationPreference;
  return {
    // Default-safe (Task 6.2): a user created before this feature shipped has no
    // notification_preferences row yet — return the schema's own defaults, don't error.
    smsEnabled: prefs?.smsEnabled ?? true,
    whatsappEnabled: prefs?.whatsappEnabled ?? true,
    emailEnabled: prefs?.emailEnabled ?? true,
    inappEnabled: prefs?.inappEnabled ?? true,
    preferredLanguage: user.preferredLanguage,
  };
}

type ToggleField = 'smsEnabled' | 'whatsappEnabled' | 'emailEnabled' | 'inappEnabled';
const TOGGLE_FIELDS: readonly ToggleField[] = ['smsEnabled', 'whatsappEnabled', 'emailEnabled', 'inappEnabled'];

export async function updateSettings(
  publicId: string,
  input: UpdateSettingsInput,
): Promise<AccountSettingsDTO> {
  const user = await prisma.user.findUnique({ where: { publicId } });
  if (!user) throw new AuthError();

  // REQ-F-Notif004, enforced server-side (Task 6.3): a critical channel is silently forced back
  // to true rather than rejected — neutralizes a frontend bug or direct-API misuse without
  // punishing the caller with a hard error (the module doc's stated assumption).
  const sanitized: Partial<Record<ToggleField, boolean>> = {};
  for (const field of TOGGLE_FIELDS) {
    const value = input[field];
    if (value !== undefined) {
      const isCritical = (CRITICAL_NOTIFICATION_CHANNELS as readonly string[]).includes(field);
      sanitized[field] = isCritical ? true : value;
    }
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(sanitized).length > 0) {
      await tx.notificationPreference.upsert({
        where: { userId: user.userId },
        update: sanitized,
        create: { userId: user.userId, ...sanitized },
      });
    }
    if (input.preferredLanguage !== undefined) {
      await tx.user.update({
        where: { userId: user.userId },
        data: { preferredLanguage: input.preferredLanguage },
      });
    }
  });

  return getSettings(publicId);
}
