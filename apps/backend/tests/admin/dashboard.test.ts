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

describe('GET /api/v1/admin/dashboard/kpis (Task 2)', () => {
  it('platform GMV sums settlements across every seller, not scoped to any one seller (unlike Feature 11)', async () => {
    const admin = await createTestUser('ADMIN');
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const productA = await createTestProduct(sellerA.userId);
    const productB = await createTestProduct(sellerB.userId);
    const orderA = await createTestOrder(buyer.userId, sellerA.userId, productA, { status: 'DELIVERED', deliveredAt: new Date() });
    const orderB = await createTestOrder(buyer.userId, sellerB.userId, productB, { status: 'DELIVERED', deliveredAt: new Date() });
    await createTestSettlement(orderA.orderId, sellerA.userId, { gross: 1000, commission: 50 });
    await createTestSettlement(orderB.orderId, sellerB.userId, { gross: 500, commission: 25 });

    const res = await request(app).get('/api/v1/admin/dashboard/kpis').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.gmv).toBe('1425.00'); // 950 + 475, both sellers combined
  });

  it('pctChangeVsPrevious is null (not a divide-by-zero crash) when the previous period has zero GMV', async () => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app).get('/api/v1/admin/dashboard/kpis').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.body.data.pctChangeVsPrevious).toBeNull();
  });

  it('activeUsers counts distinct Buyer/Seller accounts with last_login_at in range (Task 2.2/Assumption #1)', async () => {
    const admin = await createTestUser('ADMIN');
    const activeBuyer = await createTestUser('BUYER');
    const inactiveBuyer = await createTestUser('BUYER');
    await prisma.user.update({ where: { userId: activeBuyer.userId }, data: { lastLoginAt: new Date() } });
    // inactiveBuyer never logs in — lastLoginAt stays null, excluded

    const res = await request(app).get('/api/v1/admin/dashboard/kpis').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.body.data.activeUsers).toBe(1);
  });

  it('adapterUptime reflects live Postgres+Redis reachability (100 when both are up, the normal test-env case)', async () => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app).get('/api/v1/admin/dashboard/kpis').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.body.data.adapterUptime).toBe(100);
  });
});

describe('GET /api/v1/admin/dashboard/alerts (Task 2.4)', () => {
  it('counts PENDING_MANUAL_LOGISTICS orders, stuck (>24h PENDING) payments, open disputes, and fraud-flagged sellers', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);

    await createTestOrder(buyer.userId, seller.userId, product, { status: 'PENDING_MANUAL_LOGISTICS' });

    const stuckOrder = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PAYMENT_PENDING' });
    await prisma.payment.update({
      where: { orderId: stuckOrder.orderId },
      data: { status: 'PENDING', createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    const returnedOrder = await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: new Date() });
    await prisma.return.create({ data: { orderId: returnedOrder.orderId, sellerId: seller.userId, reason: 'x', status: 'MANUAL_REVIEW' } });

    await prisma.sellerProfile.update({ where: { userId: seller.userId }, data: { fraudRate30d: 0.25 } });

    const res = await request(app).get('/api/v1/admin/dashboard/alerts').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ manualLogisticsOrders: 1, stuckPayments: 1, openDisputes: 1, fraudFlaggedSellers: 1 });
  });

  it('a PENDING payment younger than 24h is not counted as stuck', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    await createTestOrder(buyer.userId, seller.userId, product, { status: 'PAYMENT_PENDING' }); // payment created "now", still PENDING

    const res = await request(app).get('/api/v1/admin/dashboard/alerts').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.body.data.stuckPayments).toBe(0);
  });
});
