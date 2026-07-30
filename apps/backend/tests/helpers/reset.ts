import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';

// Order matters for FK constraints (children before parents). Addresses/payout_wallets/
// product_images aren't listed explicitly — all three cascade automatically (onDelete: Cascade)
// from buyerProfile/sellerProfile/product respectively. products.seller_id -> seller_profiles is
// onDelete: Restrict (Schema §9), NOT Cascade — sellerProfile.deleteMany() would fail with a
// foreign-key violation if a seller's products still existed, so products must be deleted first
// (Feature 4's catalog tests are the first to actually populate this table).
export async function resetDb(): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.product.deleteMany();
  await prisma.sellerProfile.deleteMany();
  await prisma.buyerProfile.deleteMany();
  await prisma.user.deleteMany();
}

export async function resetRedis(): Promise<void> {
  const prefixes = ['otp:*', 'lockout:*', 'denylist:*', 'resetpwd:*'];
  const keys = (await Promise.all(prefixes.map((pattern) => redis.keys(pattern)))).flat();
  if (keys.length > 0) await redis.del(...keys);
}
