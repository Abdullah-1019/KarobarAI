import { CRITICAL_NOTIFICATION_CHANNELS } from '@karobarai/shared';
import type {
  AccountSettingsDTO,
  BuyerProfileDTO,
  PayoutWalletType,
  ProfileDTO,
  SellerProfileDTO,
  StoreStatusDTO,
} from '@karobarai/shared';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

import { getStorageAdapter } from '../../adapters/storage';
import { config } from '../../core/config';
import { encryptField } from '../../core/crypto/fieldCipher';
import {
  AuthError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/errors/AppError';
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
  CreateStoreInput,
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
      bannerUrl: user.sellerProfile?.bannerUrl ?? null,
      // Feature 3 Task 1.4: a seller_profiles row always exists from account activation (a
      // placeholder — see auth.service.ts's activateUser), so "hasStore" can't mean "row
      // exists". It means onboarding has actually been completed (POST /profile/me/store).
      hasStore: user.sellerProfile?.onboardingCompletedAt != null,
    };
  }

  // ADMIN / SUPPORT — identity fields only, per the confirmed Task 0 assumption (no App Flow
  // screen AD01-AD08 is a self-profile view).
  return { ...base, role: user.role as 'ADMIN' | 'SUPPORT' };
}

// Feature 3 Task 3.2 — a seller who hasn't completed onboarding (createStore, below) has nothing
// to edit yet. Guards business-info edits and logo/banner uploads alike; a clear 422 instead of
// a confusing update-into-the-void or a Prisma crash.
async function requireOnboardedSeller(userId: bigint): Promise<void> {
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId },
    select: { onboardingCompletedAt: true },
  });
  if (!seller?.onboardingCompletedAt) {
    throw new BusinessRuleError(
      'Complete store onboarding before editing store details',
      undefined,
      'STORE_NOT_ONBOARDED',
    );
  }
}

// Feature 2 Task 3 (Profile Update) — the module doc's Task 3 heading/content was missing (only
// referenced by later tasks as a dependency). Scope derived from App Flow SCR-S10's "Store/Brand"
// tab (store_name, store_description) — Seller-only; there is no editable identity tab for Buyer/
// Admin in App Flow, so nothing is invented for them here. Role enforcement itself lives in
// profile.routes.ts's authorize('SELLER'), not duplicated here. logoUrl/bannerUrl are NOT
// editable here (Feature 3 Task 4's validated upload endpoints own those exclusively — see the
// shared schema's comment for why the old direct-URL path was removed).
export async function updateSellerProfile(
  publicId: string,
  input: UpdateSellerProfileInput,
): Promise<SellerProfileDTO> {
  const user = await prisma.user.findUnique({ where: { publicId } });
  if (!user) throw new AuthError();
  await requireOnboardedSeller(user.userId);

  await prisma.sellerProfile.update({
    where: { userId: user.userId },
    data: {
      ...(input.storeName !== undefined && { storeName: input.storeName }),
      ...(input.storeDescription !== undefined && { storeDescription: input.storeDescription }),
    },
  });

  return getMyProfile(publicId) as Promise<SellerProfileDTO>;
}

// Feature 3 Task 2 — the SCR-S00 wizard's "Finish" action. A seller_profiles row already exists
// (a placeholder, created at account activation — auth.service.ts's activateUser), so this is
// NOT an insert; it's a guarded UPDATE completing onboarding exactly once. Race-safety comes from
// a conditional UPDATE ("WHERE onboarding_completed_at IS NULL") and checking the affected row
// count, mirroring the spirit of the module doc's "DB-constraint-first, never check-then-insert"
// rule but adapted to a row that's already there — the module doc's literal Task 2.1 design
// (insert + catch unique-violation) assumed no row existed yet, which isn't true in this system.
export async function createStore(publicId: string, input: CreateStoreInput): Promise<SellerProfileDTO> {
  const user = await prisma.user.findUnique({ where: { publicId } });
  if (!user) throw new AuthError();

  const wallets: Array<{ type: PayoutWalletType; accountNumber: string }> = [];
  if (input.jazzcashAccountNumber) {
    wallets.push({ type: 'JAZZCASH', accountNumber: input.jazzcashAccountNumber });
  }
  if (input.easypaisaAccountNumber) {
    wallets.push({ type: 'EASYPAISA', accountNumber: input.easypaisaAccountNumber });
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.sellerProfile.updateMany({
      where: { userId: user.userId, onboardingCompletedAt: null },
      data: {
        storeName: input.storeName,
        storeDescription: input.storeDescription ?? null,
        // 3-step wizard per auth.service.ts's SellerProfile.onboardingStep contract comment —
        // this single "Finish" submission is the whole wizard server-side (Task 2.4's
        // assumption: per-step wizard progress is frontend-only, never persisted mid-flow).
        onboardingStep: 3,
        onboardingCompletedAt: new Date(),
      },
    });

    if (count === 0) {
      throw new ConflictError(
        'Store onboarding has already been completed',
        undefined,
        'ONBOARDING_ALREADY_COMPLETE',
      );
    }

    // account_number is encrypted at rest (Schema §14.1) — reuses Feature 1's generic field
    // cipher, built specifically to be reusable by later features like this one.
    await tx.payoutWallet.createMany({
      data: wallets.map((wallet, index) => ({
        sellerId: user.userId,
        type: wallet.type,
        accountNumber: encryptField(wallet.accountNumber),
        isDefault: index === 0,
      })),
    });
  });

  return getMyProfile(publicId) as Promise<SellerProfileDTO>;
}

// Feature 3 Task 6 — read-only, derived from users.status; no store-status column exists
// anywhere in the schema (see the module doc's Documentation Gaps table). `since` is
// approximated from users.updated_at (no dedicated status-change-timestamp column exists) — the
// precise history lives in audit_logs, out of scope for this seller-facing read.
export async function getStoreStatus(publicId: string): Promise<StoreStatusDTO> {
  const user = await prisma.user.findUnique({
    where: { publicId },
    select: { status: true, updatedAt: true },
  });
  if (!user) throw new AuthError();

  return { status: user.status, since: user.updatedAt.toISOString() };
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

const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // Assumption (Task 4.2): reuse REQ-F-Store001's 10MB
// accept-then-compress ceiling — no avatar/logo/banner-specific limit is defined anywhere in the
// docs. Shared by avatar (Feature 2) and store logo/banner (Feature 3 Task 4.3's assumption).

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

// Shared by uploadAvatar/uploadStoreLogo/uploadStoreBanner (Feature 3 Task 4.1's generalization
// decision, applied backend-side too — one validation path, not three copies) — only the error
// codes differ per target, so the avatar's already-shipped/documented codes stay stable.
function validateImageFile(
  file: { buffer: Buffer; size: number },
  tooLargeCode: string,
  invalidFileCode: string,
): string {
  if (file.size > IMAGE_MAX_BYTES) {
    throw new ValidationError('Image file is too large (max 10MB)', undefined, tooLargeCode);
  }
  const mimeType = detectImageType(file.buffer);
  if (!mimeType) {
    throw new ValidationError('File is not a valid JPEG, PNG, or WEBP image', undefined, invalidFileCode);
  }
  return mimeType;
}

function extractStorageKey(url: string): string | null {
  const prefix = `${config.storage.publicBaseUrl}/${config.storage.bucket}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

export async function uploadAvatar(
  publicId: string,
  file: { buffer: Buffer; size: number },
): Promise<ProfileDTO> {
  const mimeType = validateImageFile(file, 'AVATAR_TOO_LARGE', 'AVATAR_INVALID_FILE');

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

// Feature 3 Task 4.2/4.3 — identical mechanism to avatar upload/remove, targeting
// seller_profiles.logoUrl/bannerUrl instead of users.avatarUrl. Both guarded by
// requireOnboardedSeller: a seller mid-wizard has nothing to attach a logo/banner to yet.
async function uploadStoreImage(
  publicId: string,
  file: { buffer: Buffer; size: number },
  field: 'logoUrl' | 'bannerUrl',
  keyPrefix: 'store-logos' | 'store-banners',
): Promise<SellerProfileDTO> {
  const mimeType = validateImageFile(file, 'STORE_IMAGE_TOO_LARGE', 'STORE_IMAGE_INVALID_FILE');

  const user = await prisma.user.findUnique({ where: { publicId } });
  if (!user) throw new AuthError();
  await requireOnboardedSeller(user.userId);

  const existing = await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: user.userId } });
  const previousUrl = existing[field];

  const extension = mimeType.split('/')[1];
  const key = `${keyPrefix}/${user.userId}/${randomUUID()}.${extension}`;
  const storage = getStorageAdapter();
  const { url } = await storage.upload({ buffer: file.buffer, key, contentType: mimeType });

  await prisma.sellerProfile.update({ where: { userId: user.userId }, data: { [field]: url } });

  if (previousUrl) {
    const previousKey = extractStorageKey(previousUrl);
    if (previousKey) {
      storage.delete(previousKey).catch((err) => {
        logger.warn({ err }, `Failed to delete replaced ${field} (non-fatal)`);
      });
    }
  }

  return getMyProfile(publicId) as Promise<SellerProfileDTO>;
}

async function removeStoreImage(
  publicId: string,
  field: 'logoUrl' | 'bannerUrl',
): Promise<SellerProfileDTO> {
  const user = await prisma.user.findUnique({ where: { publicId } });
  if (!user) throw new AuthError();
  await requireOnboardedSeller(user.userId);

  const existing = await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: user.userId } });
  const previousUrl = existing[field];

  await prisma.sellerProfile.update({ where: { userId: user.userId }, data: { [field]: null } });

  if (previousUrl) {
    const key = extractStorageKey(previousUrl);
    if (key) {
      getStorageAdapter()
        .delete(key)
        .catch((err) => {
          logger.warn({ err }, `Failed to delete ${field} on remove (non-fatal)`);
        });
    }
  }

  return getMyProfile(publicId) as Promise<SellerProfileDTO>;
}

export const uploadStoreLogo = (publicId: string, file: { buffer: Buffer; size: number }) =>
  uploadStoreImage(publicId, file, 'logoUrl', 'store-logos');
export const removeStoreLogo = (publicId: string) => removeStoreImage(publicId, 'logoUrl');
export const uploadStoreBanner = (publicId: string, file: { buffer: Buffer; size: number }) =>
  uploadStoreImage(publicId, file, 'bannerUrl', 'store-banners');
export const removeStoreBanner = (publicId: string) => removeStoreImage(publicId, 'bannerUrl');

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
