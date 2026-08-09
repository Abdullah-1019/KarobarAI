// One-off dev fixture for manually testing Feature 10 (Returns) end-to-end — creates a Buyer,
// a Seller with a completed store, a product, and an Order already in DELIVERED status (within
// the 14-day return window, no existing Return row) so the "Return" action is immediately
// eligible on the Buyer's My Orders list. Not part of the app — run once, then delete.
import bcrypt from 'bcrypt';

import { config } from '../src/core/config';
import { blindIndex, encryptField, normalizeEmail } from '../src/core/crypto/fieldCipher';
import { prisma } from '../src/core/prisma';

async function main() {
  const password = 'Test1234!';
  const passwordHash = await bcrypt.hash(password, config.bcryptCost);

  const sellerEmail = normalizeEmail('test-seller@karobarai.test');
  const buyerEmail = normalizeEmail('test-buyer@karobarai.test');

  const category = await prisma.category.findUniqueOrThrow({ where: { slug: 'electronics' } });

  // emailBidx has only a partial-unique index (WHERE deleted_at IS NULL, added via raw SQL in
  // the migration) — not a Prisma-recognized unique field, so this is find-then-create rather
  // than upsert.
  const sellerBidx = blindIndex(sellerEmail);
  const sellerUser =
    (await prisma.user.findFirst({ where: { emailBidx: sellerBidx, deletedAt: null } })) ??
    (await prisma.user.create({
      data: {
        email: encryptField(sellerEmail),
        emailBidx: sellerBidx,
        passwordHash,
        role: 'SELLER',
        status: 'ACTIVE',
        preferredLanguage: 'EN',
      },
    }));

  await prisma.sellerProfile.upsert({
    where: { userId: sellerUser.userId },
    update: { onboardingCompletedAt: new Date() },
    create: {
      userId: sellerUser.userId,
      storeName: 'Test Return Store',
      storeDescription: 'Seeded for Feature 10 manual testing.',
      onboardingCompletedAt: new Date(),
    },
  });

  const buyerBidx = blindIndex(buyerEmail);
  const buyerUser =
    (await prisma.user.findFirst({ where: { emailBidx: buyerBidx, deletedAt: null } })) ??
    (await prisma.user.create({
      data: {
        email: encryptField(buyerEmail),
        emailBidx: buyerBidx,
        passwordHash,
        role: 'BUYER',
        status: 'ACTIVE',
        preferredLanguage: 'EN',
      },
    }));

  await prisma.buyerProfile.upsert({
    where: { userId: buyerUser.userId },
    update: {},
    create: { userId: buyerUser.userId },
  });

  const product = await prisma.product.create({
    data: {
      sellerId: sellerUser.userId,
      categoryId: category.categoryId,
      titleEn: 'Test Return Product',
      descriptionEn: 'Seeded for Feature 10 manual testing.',
      price: 1500,
      stock: 10,
      condition: 'NEW',
      status: 'LIVE',
    },
  });

  const now = Date.now();
  const placedAt = new Date(now - 3 * 24 * 60 * 60 * 1000); // 3 days ago
  const deliveredAt = new Date(now - 2 * 24 * 60 * 60 * 1000); // 2 days ago — well inside the 14-day window

  const order = await prisma.order.create({
    data: {
      buyerId: buyerUser.userId,
      sellerId: sellerUser.userId,
      status: 'DELIVERED',
      paymentMethod: 'COD',
      subtotal: 1500,
      shippingFee: 200,
      totalAmount: 1700,
      commissionRateSnapshot: 0.05,
      shipName: 'Test Buyer',
      shipLine1: encryptField('123 Test Street'),
      shipCity: 'Lahore',
      shipProvince: 'Punjab',
      shipPostal: '54000',
      shipPhone: encryptField('+923001234567'),
      placedAt,
      deliveredAt,
      items: {
        create: [
          {
            productId: product.productId,
            titleSnapshot: product.titleEn,
            unitPrice: product.price,
            quantity: 1,
          },
        ],
      },
      payment: {
        create: {
          method: 'COD',
          status: 'CONFIRMED',
          amount: 1700,
          idempotencyKey: `seed-return-test-${now}`,
          confirmedAt: deliveredAt,
        },
      },
    },
  });

  console.log('--- Feature 10 test fixture ready ---');
  console.log('Seller login: test-seller@karobarai.test / Test1234!');
  console.log('Buyer login:  test-buyer@karobarai.test / Test1234!');
  console.log('Order public ID:', order.publicId);
  console.log('Order status:', order.status, '| deliveredAt:', deliveredAt.toISOString());
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
