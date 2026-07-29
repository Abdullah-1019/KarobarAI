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

async function createUserRow(role: UserRole, email: string, password: string) {
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
    await prisma.sellerProfile.create({
      data: { userId: user.userId, storeName: `Store-${user.userId}`, onboardingStep: 0 },
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
  overrides: { email?: string; password?: string } = {},
): Promise<TestUser> {
  const email = overrides.email ?? `${role.toLowerCase()}-${randomUUID()}@example.com`;
  const password = overrides.password ?? 'Correct1$Pass';

  const user = await createUserRow(role, email, password);
  const session = await issueSession(user, role);

  return { userId: user.userId, publicId: user.publicId, ...session };
}

export async function createAddress(
  buyerId: bigint,
  overrides: { isDefault?: boolean } = {},
) {
  return prisma.address.create({
    data: {
      buyerId,
      line1: '123 Test Street',
      city: 'Lahore',
      province: 'Punjab',
      isDefault: overrides.isDefault ?? false,
    },
  });
}
