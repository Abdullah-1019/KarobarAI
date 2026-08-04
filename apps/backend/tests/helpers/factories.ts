import type { CourierCode, OrderStatus, PaymentMethod, Product, UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

import { config } from '../../src/core/config';
import { blindIndex, encryptField, normalizeEmail, normalizePhone } from '../../src/core/crypto/fieldCipher';
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

async function createUserRow(role: UserRole, email: string, password: string, onboarded: boolean, phone?: string) {
  const passwordHash = await bcrypt.hash(password, config.bcryptCost);
  const normalized = normalizeEmail(email);
  const normalizedPhone = phone ? normalizePhone(phone) : undefined;

  const user = await prisma.user.create({
    data: {
      email: encryptField(normalized),
      emailBidx: blindIndex(normalized),
      ...(normalizedPhone && { phone: encryptField(normalizedPhone), phoneBidx: blindIndex(normalizedPhone) }),
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
  overrides: { email?: string; password?: string; onboarded?: boolean; phone?: string } = {},
): Promise<TestUser> {
  const email = overrides.email ?? `${role.toLowerCase()}-${randomUUID()}@example.com`;
  const password = overrides.password ?? 'Correct1$Pass';

  const user = await createUserRow(role, email, password, overrides.onboarded ?? false, overrides.phone);
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

// Feature 7 (Order Management) — builds a full order (+ order_item + payment row) directly via
// Prisma, bypassing checkout.service.ts entirely. Order-lifecycle tests need orders sitting in
// specific statuses (PROCESSING, DELIVERED, ...) that checkout itself can never produce — only
// transitionOrderStatus (exercised directly, standing in for Feature 8's future caller) does.
export async function createTestOrder(
  buyerId: bigint,
  sellerId: bigint,
  product: Pick<Product, 'productId' | 'titleEn' | 'price'>,
  overrides: {
    status?: OrderStatus;
    paymentMethod?: PaymentMethod;
    quantity?: number;
    deliveredAt?: Date | null;
    shipCity?: string;
    courier?: CourierCode | null;
    trackingNo?: string | null;
    courierOverridden?: boolean;
  } = {},
) {
  const quantity = overrides.quantity ?? 1;
  const unitPrice = new Prisma.Decimal(product.price);
  const subtotal = unitPrice.times(quantity);
  const shippingFee = new Prisma.Decimal(150);
  const paymentMethod = overrides.paymentMethod ?? 'COD';

  return prisma.order.create({
    data: {
      buyerId,
      sellerId,
      status: overrides.status ?? 'PAYMENT_PENDING',
      paymentMethod,
      subtotal,
      shippingFee,
      totalAmount: subtotal.plus(shippingFee),
      commissionRateSnapshot: new Prisma.Decimal(0.05),
      shipName: 'Test Recipient',
      shipLine1: encryptField('123 Test Street'),
      shipCity: overrides.shipCity ?? 'Lahore',
      shipProvince: 'Punjab',
      shipPhone: encryptField('03001234567'),
      deliveredAt: overrides.deliveredAt ?? null,
      courier: overrides.courier ?? null,
      trackingNo: overrides.trackingNo ?? null,
      courierOverridden: overrides.courierOverridden ?? false,
      items: {
        create: {
          productId: product.productId,
          titleSnapshot: product.titleEn,
          unitPrice,
          quantity,
        },
      },
      payment: {
        create: {
          method: paymentMethod,
          amount: subtotal.plus(shippingFee),
          idempotencyKey: randomUUID(),
        },
      },
    },
  });
}

// Feature 11 (Analytics) — Task 2's revenue figures are sourced from settlements.net WHERE
// status=SETTLED, but no production code path creates Settlement rows anywhere in this codebase
// yet (see the handoff doc's known limitation). Tests seed rows directly via Prisma to prove the
// aggregation logic itself is correct, independent of that gap.
export async function createTestSettlement(
  orderId: bigint,
  sellerId: bigint,
  overrides: { gross?: number; commission?: number; status?: 'PENDING' | 'SETTLED' | 'ON_HOLD'; settledAt?: Date | null } = {},
) {
  const gross = overrides.gross ?? 1000;
  const commission = overrides.commission ?? 50;
  const net = gross - commission; // DB CHECK constraint chk_settlements_net enforces net = gross - commission exactly
  return prisma.settlement.create({
    data: {
      orderId,
      sellerId,
      gross: new Prisma.Decimal(gross),
      commission: new Prisma.Decimal(commission),
      net: new Prisma.Decimal(net),
      status: overrides.status ?? 'SETTLED',
      settledAt: overrides.status === 'PENDING' ? null : (overrides.settledAt ?? new Date()),
    },
  });
}
