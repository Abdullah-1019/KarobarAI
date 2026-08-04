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

describe('GET /api/v1/seller/analytics/orders (Task 4)', () => {
  it('returns zero counts for every status and cancelledRate=0 (not NaN/crash) when the seller has no orders at all', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app).get('/api/v1/seller/analytics/orders').set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalOrders).toBe(0);
    expect(res.body.data.cancelledRate).toBe(0);
    expect(res.body.data.avgOrderValue).toBe('0.00');
    expect(res.body.data.byStatus.CANCELLED).toBe(0);
  });

  it('counts orders by status (placed_at-anchored, includes in-flight/cancelled) and computes cancelledRate', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { price: 100 });

    await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: new Date() });
    await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING' });
    await createTestOrder(buyer.userId, seller.userId, product, { status: 'CANCELLED' });
    await createTestOrder(buyer.userId, seller.userId, product, { status: 'CANCELLED' });

    const res = await request(app).get('/api/v1/seller/analytics/orders').set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.body.data.totalOrders).toBe(4);
    expect(res.body.data.byStatus.DELIVERED).toBe(1);
    expect(res.body.data.byStatus.PROCESSING).toBe(1);
    expect(res.body.data.byStatus.CANCELLED).toBe(2);
    expect(res.body.data.cancelledRate).toBe(50);
  });

  it('avgOrderValue excludes CANCELLED orders from the average', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const cheap = await createTestProduct(seller.userId, { price: 100 });
    const expensive = await createTestProduct(seller.userId, { price: 10000 });

    // totalAmount = price*qty + 150 shipping. cheap -> 250, expensive not counted (cancelled).
    await createTestOrder(buyer.userId, seller.userId, cheap, { status: 'DELIVERED', deliveredAt: new Date() });
    await createTestOrder(buyer.userId, seller.userId, expensive, { status: 'CANCELLED' });

    const res = await request(app).get('/api/v1/seller/analytics/orders').set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.body.data.avgOrderValue).toBe('250.00');
  });

  it("never counts another seller's orders", async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const productA = await createTestProduct(sellerA.userId);
    const productB = await createTestProduct(sellerB.userId);
    await createTestOrder(buyer.userId, sellerA.userId, productA, { status: 'DELIVERED', deliveredAt: new Date() });
    await createTestOrder(buyer.userId, sellerB.userId, productB, { status: 'DELIVERED', deliveredAt: new Date() });

    const res = await request(app).get('/api/v1/seller/analytics/orders').set('Authorization', `Bearer ${sellerA.accessToken}`);
    expect(res.body.data.totalOrders).toBe(1);
  });
});
