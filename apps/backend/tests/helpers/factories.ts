import type { UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

import { config } from '../../src/core/config';
import { blindIndex, encryptField, normalizeEmail } from '../../src/core/crypto/fieldCipher';
import { signAccessToken } from '../../src/core/jwt';
import { prisma } from '../../src/core/prisma';
import { issueRefreshToken } from '../../src/modules/auth/auth.tokens';

// Test-only user/session creation, bypassing the real register/OTP flow — these tests exercise
// the Profile module, not registration, so this builds an ACTIVE user directly at the fixture
// level the same way a real login would leave things (a real refresh_tokens row + a matching
// access token), so denylist/session-revocation behavior under test is exactly what it would be
// against a genuine login.

export interface TestUser {
  userId: bigint;
  publicId: string;
  accessToken: string;
  cookieValue: string;
}

async function createUserRow(role: UserRole, email: string, password: string, onboarded: boolean) {
  const passwordHash = await bcrypt.hash(password, config.bcryptCost);
  const normalized = normalizeEmail(email);

  const user = await prisma.user.create({
    data: {
      email: encryptField(normalized),
      emailBidx: blindIndex(normalized),
      passwordHash,
      role,
      status: 'ACTIVE',
    },
  });

  if (role === 'BUYER') {
    await prisma.buyerProfile.create({ data: { userId: user.userId } });
  } else if (role === 'SELLER') {
    // Mirrors auth.service.ts's activateUser: a placeholder row always exists from account
    // activation. `onboarded` simulates a seller who has already completed Feature 3's
    // POST /profile/me/store — most business-info/branding tests need this, since Feature 3's
    // requireOnboardedSeller guard rejects those mutations otherwise (STORE_NOT_ONBOARDED, 422).
    await prisma.sellerProfile.create({
      data: {
        userId: user.userId,
        storeName: `Store-${user.userId}`,
        onboardingStep: onboarded ? 3 : 0,
        onboardingCompletedAt: onboarded ? new Date() : null,
      },
    });
  }

  return user;
}

export async function issueSession(
  user: { userId: bigint; publicId: string },
  role: UserRole,
): Promise<{ accessToken: string; cookieValue: string }> {
  const refresh = await issueRefreshToken(user.userId, {});
  const accessToken = signAccessToken(user.publicId, role, refresh.jti);
  return { accessToken, cookieValue: refresh.cookieValue };
}

export async function createTestUser(
  role: UserRole,
  overrides: { email?: string; password?: string; onboarded?: boolean } = {},
): Promise<TestUser> {
  const email = overrides.email ?? `${role.toLowerCase()}-${randomUUID()}@example.com`;
  const password = overrides.password ?? 'Correct1$Pass';

  const user = await createUserRow(role, email, password, overrides.onboarded ?? false);
  const session = await issueSession(user, role);

  return { userId: user.userId, publicId: user.publicId, ...session };
}

// line1/contactPhone must be stored encrypted — the real address.service.ts always encrypts
// them, and checkout's getOwnedAddressForOrder always decrypts them; a plaintext row written
// directly via Prisma (bypassing the service) makes decryptField throw "Invalid encrypted field
// payload" the moment any checkout test touches it.
export async function createAddress(
  buyerId: bigint,
  overrides: { isDefault?: boolean; city?: string; province?: string } = {},
) {
  return prisma.address.create({
    data: {
      buyerId,
      recipientName: 'Test Recipient',
      line1: encryptField('123 Test Street'),
      city: overrides.city ?? 'Lahore',
      province: overrides.province ?? 'Punjab',
      contactPhone: encryptField('03001234567'),
      isDefault: overrides.isDefault ?? false,
    },
  });
}

// Feature 4 (Product Management) — bypasses the API to set up a product row directly, for tests
// that need a pre-existing product rather than exercising the creation flow itself.
export async function createTestProduct(
  sellerId: bigint,
  overrides: {
    titleEn?: string;
    price?: number;
    stock?: number;
    status?: 'DRAFT' | 'LIVE' | 'OUT_OF_STOCK' | 'REMOVED';
    categoryId?: bigint | null;
  } = {},
) {
  return prisma.product.create({
    data: {
      sellerId,
      titleEn: overrides.titleEn ?? 'Test Product',
      price: overrides.price ?? 100,
      stock: overrides.stock ?? 10,
      status: overrides.status ?? 'DRAFT',
      categoryId: overrides.categoryId ?? null,
    },
  });
}
