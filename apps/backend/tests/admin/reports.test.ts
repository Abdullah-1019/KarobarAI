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

describe('GET /api/v1/admin/reports/gmv-trend (Task 5.1)', () => {
  it('groupBy=seller sums to the same total as the default (date-grouped) series', async () => {
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

    const byDate = await request(app).get('/api/v1/admin/reports/gmv-trend').set('Authorization', `Bearer ${admin.accessToken}`);
    const bySeller = await request(app).get('/api/v1/admin/reports/gmv-trend').query({ groupBy: 'seller' }).set('Authorization', `Bearer ${admin.accessToken}`);

    const dateTotal = byDate.body.data.points.reduce((sum: number, p: { gmv: string }) => sum + Number(p.gmv), 0);
    const sellerTotal = bySeller.body.data.points.reduce((sum: number, p: { gmv: string }) => sum + Number(p.gmv), 0);
    expect(dateTotal).toBe(1425);
    expect(sellerTotal).toBe(1425);
    expect(bySeller.body.data.points).toHaveLength(2);
  });

  it('groupBy=category includes a basisNote flagging the different revenue basis (known limitation)', async () => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app).get('/api/v1/admin/reports/gmv-trend').query({ groupBy: 'category' }).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.basisNote).toBe('string');
  });

  it('the default (date-grouped) response has no basisNote', async () => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app).get('/api/v1/admin/reports/gmv-trend').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.body.data.basisNote).toBeUndefined();
  });
});

describe('GET /api/v1/admin/reports/order-return-trend (Task 5.2)', () => {
  it('returnRate is zero-guarded per bucket and computed correctly', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const orders = await Promise.all([
      createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: new Date() }),
      createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: new Date() }),
    ]);
    await prisma.return.create({ data: { orderId: orders[0]!.orderId, sellerId: seller.userId, reason: 'x' } });

    const res = await request(app).get('/api/v1/admin/reports/order-return-trend').set('Authorization', `Bearer ${admin.accessToken}`);
    const todayPoint = res.body.data.points[res.body.data.points.length - 1];
    expect(todayPoint.orderCount).toBe(2);
    expect(todayPoint.returnCount).toBe(1);
    expect(todayPoint.returnRate).toBe(50);
  });

  it('a day with zero orders has returnRate 0, not NaN/Infinity', async () => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app).get('/api/v1/admin/reports/order-return-trend').set('Authorization', `Bearer ${admin.accessToken}`);
    for (const point of res.body.data.points) {
      expect(Number.isFinite(point.returnRate)).toBe(true);
    }
  });
});

describe('GET /api/v1/admin/reports/seller-performance (Task 5.3)', () => {
  it('flags a seller at/above the BR-006 20% threshold as WARNING and at/above 40% as AUTO_SUSPEND', async () => {
    const admin = await createTestUser('ADMIN');
    const buyer = await createTestUser('BUYER');

    const warningSeller = await createTestUser('SELLER', { onboarded: true });
    await prisma.sellerProfile.update({ where: { userId: warningSeller.userId }, data: { fraudRate30d: 0.25 } });
    const warningProduct = await createTestProduct(warningSeller.userId);
    const warningOrder = await createTestOrder(buyer.userId, warningSeller.userId, warningProduct, { status: 'DELIVERED', deliveredAt: new Date() });
    await createTestSettlement(warningOrder.orderId, warningSeller.userId, { gross: 100, commission: 5 });

    const suspendSeller = await createTestUser('SELLER', { onboarded: true });
    await prisma.sellerProfile.update({ where: { userId: suspendSeller.userId }, data: { fraudRate30d: 0.45 } });
    const suspendProduct = await createTestProduct(suspendSeller.userId);
    const suspendOrder = await createTestOrder(buyer.userId, suspendSeller.userId, suspendProduct, { status: 'DELIVERED', deliveredAt: new Date() });
    await createTestSettlement(suspendOrder.orderId, suspendSeller.userId, { gross: 100, commission: 5 });

    const cleanSeller = await createTestUser('SELLER', { onboarded: true });
    const cleanProduct = await createTestProduct(cleanSeller.userId);
    const cleanOrder = await createTestOrder(buyer.userId, cleanSeller.userId, cleanProduct, { status: 'DELIVERED', deliveredAt: new Date() });
    await createTestSettlement(cleanOrder.orderId, cleanSeller.userId, { gross: 100, commission: 5 });

    const res = await request(app).get('/api/v1/admin/reports/seller-performance').set('Authorization', `Bearer ${admin.accessToken}`);
    const byId = (id: string) => res.body.data.items.find((i: { sellerId: string }) => i.sellerId === id);
    expect(byId(warningSeller.publicId).fraudFlag).toBe('WARNING');
    expect(byId(suspendSeller.publicId).fraudFlag).toBe('AUTO_SUSPEND');
    expect(byId(cleanSeller.publicId).fraudFlag).toBe('NONE');
  });

  it('fulfilmentRate is zero-guarded when a seller has neither delivered nor cancelled orders in range', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: new Date() });
    await createTestSettlement(order.orderId, seller.userId);
    await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING' }); // in-flight, not counted either way

    const res = await request(app).get('/api/v1/admin/reports/seller-performance').set('Authorization', `Bearer ${admin.accessToken}`);
    const item = res.body.data.items.find((i: { sellerId: string }) => i.sellerId === seller.publicId);
    expect(item.fulfilmentRate).toBe(100); // 1 delivered / (1 delivered + 0 cancelled)
  });
});
