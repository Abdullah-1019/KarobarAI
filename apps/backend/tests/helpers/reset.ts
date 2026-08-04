import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';

// Order matters for FK constraints (children before parents). Addresses/payout_wallets/
// product_images/cart_items aren't listed explicitly — all cascade automatically (onDelete:
// Cascade) from buyerProfile/sellerProfile/product/cart respectively. products.seller_id ->
// seller_profiles is onDelete: Restrict (Schema §9), NOT Cascade — sellerProfile.deleteMany()
// would fail with a foreign-key violation if a seller's products still existed, so products must
// be deleted first (Feature 4's catalog tests are the first to actually populate that table).
//
// Feature 6 adds a second layer of the same problem: orders.buyer_id/seller_id and
// order_items.product_id are ALL onDelete: Restrict (append-only order history, Schema §0), and
// payments.order_id is Restrict too — payment -> order (cascades order_items automatically) must
// both be deleted before product/sellerProfile/buyerProfile, or checkout tests would break every
// later test's resetDb() call with a foreign-key violation.
export async function resetDb(): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.dispute.deleteMany(); // Feature 10 — Dispute.returnId is onDelete: Restrict, must precede return.deleteMany()
  await prisma.return.deleteMany(); // cascades return_images; Return.orderId is onDelete: Restrict, must precede order.deleteMany()
  await prisma.order.deleteMany(); // cascades order_items/tracking_events/courier_quotes
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
