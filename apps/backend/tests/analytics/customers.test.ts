import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestOrder, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('GET /api/v1/seller/analytics/customers (Task 5)', () => {
  it('returns zeros (repeatRate=0, not a divide-by-zero crash) when the seller has no orders', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app).get('/api/v1/seller/analytics/customers').set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ uniqueBuyers: 0, newBuyers: 0, repeatBuyers: 0, repeatRate: 0 });
  });

  it('classifies a buyer whose FIRST-EVER order was placed within the range as new', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    await createTestOrder(buyer.userId, seller.userId, product);

    const res = await request(app)
      .get('/api/v1/seller/analytics/customers')
      .query({ range: '7d' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.body.data.uniqueBuyers).toBe(1);
    expect(res.body.data.newBuyers).toBe(1);
    expect(res.body.data.repeatBuyers).toBe(0);
  });

  it("classifies a buyer whose first-ever order PREDATES the range start as repeat, not new, even though their in-range order looks like a first touch to a range-only query (the module doc's own flagged miscalculation risk)", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);

    const firstOrder = await createTestOrder(buyer.userId, seller.userId, product);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await prisma.order.update({ where: { orderId: firstOrder.orderId }, data: { placedAt: thirtyDaysAgo } });

    await createTestOrder(buyer.userId, seller.userId, product); // second order, placed "now" — within the default 7d range

    const res = await request(app)
      .get('/api/v1/seller/analytics/customers')
      .query({ range: '7d' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.body.data.uniqueBuyers).toBe(1);
    expect(res.body.data.newBuyers).toBe(0);
    expect(res.body.data.repeatBuyers).toBe(1);
    expect(res.body.data.repeatRate).toBe(100);
  });

  it("never counts another seller's buyers", async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const productA = await createTestProduct(sellerA.userId);
    const productB = await createTestProduct(sellerB.userId);
    await createTestOrder(buyer.userId, sellerA.userId, productA);
    await createTestOrder(buyer.userId, sellerB.userId, productB);

    const res = await request(app).get('/api/v1/seller/analytics/customers').set('Authorization', `Bearer ${sellerA.accessToken}`);
    expect(res.body.data.uniqueBuyers).toBe(1);
  });
});
