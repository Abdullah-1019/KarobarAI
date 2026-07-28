import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';

// Auth-relevant tables only — this suite doesn't touch products/orders/etc. Order matters for
// FK constraints (children before parents).
export async function resetDb(): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.sellerProfile.deleteMany();
  await prisma.buyerProfile.deleteMany();
  await prisma.user.deleteMany();
}

export async function resetRedis(): Promise<void> {
  const prefixes = ['otp:*', 'lockout:*', 'denylist:*', 'resetpwd:*'];
  const keys = (await Promise.all(prefixes.map((pattern) => redis.keys(pattern)))).flat();
  if (keys.length > 0) await redis.del(...keys);
}
