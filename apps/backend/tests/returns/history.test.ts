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

describe('Task 7 — Return History (buyer/seller/admin, permission-scoped, all statuses)', () => {
  it("buyer's GET /returns includes terminal-state cases, not just active ones", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const productA = await createTestProduct(seller.userId);
    const productB = await createTestProduct(seller.userId);
    const orderA = await createTestOrder(buyer.userId, seller.userId, productA, { status: 'DELIVERED', deliveredAt: new Date() });
    const orderB = await createTestOrder(buyer.userId, seller.userId, productB, { status: 'DELIVERED', deliveredAt: new Date() });
    await prisma.return.create({ data: { orderId: orderA.orderId, sellerId: seller.userId, reason: 'a', status: 'MANUAL_REVIEW' } });
    await prisma.return.create({ data: { orderId: orderB.orderId, sellerId: seller.userId, reason: 'b', status: 'CLOSED' } });

    const res = await request(app).get('/api/v1/returns').set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(new Set(res.body.data.items.map((i: { status: string }) => i.status))).toEqual(new Set(['MANUAL_REVIEW', 'CLOSED']));
  });

  it("buyer's history never includes another buyer's returns", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyerA = await createTestUser('BUYER');
    const buyerB = await createTestUser('BUYER');
    const productA = await createTestProduct(seller.userId);
    const productB = await createTestProduct(seller.userId);
    const orderA = await createTestOrder(buyerA.userId, seller.userId, productA, { status: 'DELIVERED', deliveredAt: new Date() });
    const orderB = await createTestOrder(buyerB.userId, seller.userId, productB, { status: 'DELIVERED', deliveredAt: new Date() });
    await prisma.return.create({ data: { orderId: orderA.orderId, sellerId: seller.userId, reason: 'a' } });
    await prisma.return.create({ data: { orderId: orderB.orderId, sellerId: seller.userId, reason: 'b' } });

    const res = await request(app).get('/api/v1/returns').set('Authorization', `Bearer ${buyerA.accessToken}`);
    expect(res.body.data.items).toHaveLength(1);
  });

  it('seller history (?history=true) includes CLOSED/REFUND_ISSUED cases beyond the active MANUAL_REVIEW queue', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const productA = await createTestProduct(seller.userId);
    const productB = await createTestProduct(seller.userId);
    const orderA = await createTestOrder(buyer.userId, seller.userId, productA, { status: 'DELIVERED', deliveredAt: new Date() });
    const orderB = await createTestOrder(buyer.userId, seller.userId, productB, { status: 'DELIVERED', deliveredAt: new Date() });
    await prisma.return.create({ data: { orderId: orderA.orderId, sellerId: seller.userId, reason: 'a', status: 'MANUAL_REVIEW' } });
    await prisma.return.create({ data: { orderId: orderB.orderId, sellerId: seller.userId, reason: 'b', status: 'REFUND_ISSUED' } });

    const activeOnly = await request(app).get('/api/v1/seller/returns').set('Authorization', `Bearer ${seller.accessToken}`);
    expect(activeOnly.body.data.items).toHaveLength(1);

    const history = await request(app)
      .get('/api/v1/seller/returns')
      .query({ history: 'true' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(history.body.data.items).toHaveLength(2);
  });

  it('admin history (?history=true) sees all statuses across all sellers, no ownership filter', async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const productA = await createTestProduct(sellerA.userId);
    const productB = await createTestProduct(sellerB.userId);
    const orderA = await createTestOrder(buyer.userId, sellerA.userId, productA, { status: 'DELIVERED', deliveredAt: new Date() });
    const orderB = await createTestOrder(buyer.userId, sellerB.userId, productB, { status: 'DELIVERED', deliveredAt: new Date() });
    await prisma.return.create({ data: { orderId: orderA.orderId, sellerId: sellerA.userId, reason: 'a', status: 'CLOSED' } });
    await prisma.return.create({ data: { orderId: orderB.orderId, sellerId: sellerB.userId, reason: 'b', status: 'REFUND_ISSUED' } });
    const admin = await createTestUser('ADMIN');

    const res = await request(app)
      .get('/api/v1/admin/returns')
      .query({ history: 'true' })
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.body.data.items).toHaveLength(2);
  });

  it('status filter works consistently across all three endpoints', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const productA = await createTestProduct(seller.userId);
    const productB = await createTestProduct(seller.userId);
    const orderA = await createTestOrder(buyer.userId, seller.userId, productA, { status: 'DELIVERED', deliveredAt: new Date() });
    const orderB = await createTestOrder(buyer.userId, seller.userId, productB, { status: 'DELIVERED', deliveredAt: new Date() });
    await prisma.return.create({ data: { orderId: orderA.orderId, sellerId: seller.userId, reason: 'a', status: 'CLOSED' } });
    await prisma.return.create({ data: { orderId: orderB.orderId, sellerId: seller.userId, reason: 'b', status: 'MANUAL_REVIEW' } });
    const admin = await createTestUser('ADMIN');

    const buyerRes = await request(app).get('/api/v1/returns').query({ status: 'CLOSED' }).set('Authorization', `Bearer ${buyer.accessToken}`);
    const sellerRes = await request(app)
      .get('/api/v1/seller/returns')
      .query({ status: 'CLOSED' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    const adminRes = await request(app).get('/api/v1/admin/returns').query({ status: 'CLOSED' }).set('Authorization', `Bearer ${admin.accessToken}`);

    for (const res of [buyerRes, sellerRes, adminRes]) {
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].status).toBe('CLOSED');
    }
  });
});
