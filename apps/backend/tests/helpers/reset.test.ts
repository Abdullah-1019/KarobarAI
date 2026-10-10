import { prisma } from '../../src/core/prisma';
import { createTestOrder, createTestProduct, createTestUser } from './factories';
import { resetDb } from './reset';

describe('test database reset helper', () => {
  beforeEach(async () => resetDb());
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('removes reviews and restricted order children before their parent orders', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const customSlugSeller = await createTestUser('SELLER', { storeSlug: 'reset-helper-custom-slug' });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'COMPLETED' });
    await prisma.review.create({
      data: { buyerId: buyer.userId, productId: product.productId, orderId: order.orderId, rating: 4, comment: 'fixture review' },
    });
    await prisma.codRemittance.create({
      data: { orderId: order.orderId, courier: 'TCS', expectedAmount: order.totalAmount, status: 'EXPECTED' },
    });
    const [defaultSlug, customSlug] = await Promise.all([
      prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId }, select: { storeSlug: true } }),
      prisma.sellerProfile.findUniqueOrThrow({ where: { userId: customSlugSeller.userId }, select: { storeSlug: true } }),
    ]);
    expect(defaultSlug.storeSlug).toBe(`test-store-${seller.userId}`);
    expect(customSlug.storeSlug).toBe('reset-helper-custom-slug');

    await expect(resetDb()).resolves.toBeUndefined();
    await expect(prisma.order.count()).resolves.toBe(0);
    await expect(prisma.review.count()).resolves.toBe(0);
    await expect(prisma.codRemittance.count()).resolves.toBe(0);
  });
});
