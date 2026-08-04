import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestOrder, createTestProduct, createTestSettlement, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

// Task 2 — Revenue Aggregation. Sourced from settlements.net WHERE status=SETTLED; no production
// code path creates Settlement rows yet (known limitation, documented in the handoff doc), so
// these tests seed rows directly via createTestSettlement to prove the aggregation logic itself.

describe('GET /api/v1/seller/analytics/revenue', () => {
  it('returns "0.00" for every field when the seller has no settlements at all (documents the known limitation, does not hide it)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app).get('/api/v1/seller/analytics/revenue').set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ current: '0.00', previous: '0.00', ytd: '0.00', pctChangeVsPrevious: null });
  });

  it('sums only SETTLED settlements within the current range into `current`, ignoring PENDING/FAILED', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const orderA = await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: new Date() });
    const orderB = await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: new Date() });
    const orderC = await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: new Date() });
    await createTestSettlement(orderA.orderId, seller.userId, { gross: 1000, commission: 50, status: 'SETTLED' });
    await createTestSettlement(orderB.orderId, seller.userId, { gross: 500, commission: 25, status: 'SETTLED' });
    await createTestSettlement(orderC.orderId, seller.userId, { gross: 2000, commission: 100, status: 'PENDING' });

    const res = await request(app).get('/api/v1/seller/analytics/revenue').set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.current).toBe('1425.00');
  });

  it('computes pctChangeVsPrevious correctly, and returns null (not a divide-by-zero crash) when the previous period had zero revenue', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: new Date() });
    await createTestSettlement(order.orderId, seller.userId, { gross: 1000, commission: 50, settledAt: new Date() });

    const res = await request(app)
      .get('/api/v1/seller/analytics/revenue')
      .query({ range: '7d' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.body.data.current).toBe('950.00');
    expect(res.body.data.previous).toBe('0.00');
    expect(res.body.data.pctChangeVsPrevious).toBeNull();
  });

  it('never includes another seller\'s settlements', async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const productA = await createTestProduct(sellerA.userId);
    const productB = await createTestProduct(sellerB.userId);
    const orderA = await createTestOrder(buyer.userId, sellerA.userId, productA, { status: 'DELIVERED', deliveredAt: new Date() });
    const orderB = await createTestOrder(buyer.userId, sellerB.userId, productB, { status: 'DELIVERED', deliveredAt: new Date() });
    await createTestSettlement(orderA.orderId, sellerA.userId, { gross: 100, commission: 0 });
    await createTestSettlement(orderB.orderId, sellerB.userId, { gross: 99999, commission: 0 });

    const res = await request(app).get('/api/v1/seller/analytics/revenue').set('Authorization', `Bearer ${sellerA.accessToken}`);
    expect(res.body.data.current).toBe('100.00');
  });

  it('rejects range=custom with startDate after endDate as 400 VALIDATION_ERROR', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app)
      .get('/api/v1/seller/analytics/revenue')
      .query({ range: 'custom', startDate: '2026-06-10', endDate: '2026-06-01' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(400);
  });

  it('rejects range=custom missing startDate/endDate as 400', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app)
      .get('/api/v1/seller/analytics/revenue')
      .query({ range: 'custom' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(400);
  });
});
