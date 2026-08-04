import request from 'supertest';
import { randomUUID } from 'node:crypto';

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

describe('GET /api/v1/seller/analytics/sales-trend (Task 3)', () => {
  it('zero-fills every day in range when there are no realized orders', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app)
      .get('/api/v1/seller/analytics/sales-trend')
      .query({ range: '7d' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.points).toHaveLength(7);
    for (const point of res.body.data.points) {
      expect(point.revenue).toBe('0.00');
      expect(point.orderCount).toBe(0);
    }
  });

  it('aggregates realized (DELIVERED/COMPLETED) orders by their local delivered-at calendar day, ignoring in-flight/cancelled orders', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { price: 200 });
    const today = new Date();

    await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: today, quantity: 2 }); // 400
    await createTestOrder(buyer.userId, seller.userId, product, { status: 'COMPLETED', deliveredAt: today, quantity: 1 }); // 200
    await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING' }); // not realized, deliveredAt null, excluded
    await createTestOrder(buyer.userId, seller.userId, product, { status: 'CANCELLED' }); // excluded

    const res = await request(app)
      .get('/api/v1/seller/analytics/sales-trend')
      .query({ range: '7d' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    const todayPoint = res.body.data.points[res.body.data.points.length - 1];
    expect(todayPoint.revenue).toBe('600.00');
    expect(todayPoint.orderCount).toBe(2);
  });

  it('chart.labels/chart.series line up positionally with points', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app)
      .get('/api/v1/seller/analytics/sales-trend')
      .query({ range: '7d' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    const { points, chart } = res.body.data;
    expect(chart.labels).toEqual(points.map((p: { date: string }) => p.date));
    expect(chart.series).toEqual(points.map((p: { revenue: string }) => Number(p.revenue)));
  });
});

describe('GET /api/v1/seller/analytics/category-breakdown (Task 3)', () => {
  it('groups realized revenue by category, uses a synthetic "Uncategorized" bucket for null category_id (not silent exclusion)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const category = await prisma.category.create({ data: { nameEn: 'Electronics', nameUr: 'الیکٹرانکس', slug: `electronics-${randomUUID()}` } });
    const categorized = await createTestProduct(seller.userId, { price: 300, categoryId: category.categoryId });
    const uncategorized = await createTestProduct(seller.userId, { price: 100, categoryId: null });
    const today = new Date();

    await createTestOrder(buyer.userId, seller.userId, categorized, { status: 'DELIVERED', deliveredAt: today, quantity: 1 }); // 300
    await createTestOrder(buyer.userId, seller.userId, uncategorized, { status: 'DELIVERED', deliveredAt: today, quantity: 1 }); // 100

    const res = await request(app)
      .get('/api/v1/seller/analytics/category-breakdown')
      .query({ range: '7d' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);

    const total = res.body.data.items.reduce((sum: number, i: { revenue: string }) => sum + Number(i.revenue), 0);
    expect(total).toBe(400);

    const uncategorizedItem = res.body.data.items.find((i: { categoryId: string | null }) => i.categoryId === null);
    expect(uncategorizedItem).toBeDefined();
    expect(uncategorizedItem.categoryNameEn).toBe('Uncategorized');
    expect(uncategorizedItem.revenue).toBe('100.00');
    expect(uncategorizedItem.pctOfTotal).toBe(25);

    const categorizedItem = res.body.data.items.find((i: { categoryId: string | null }) => i.categoryId !== null);
    expect(categorizedItem.categoryNameEn).toBe('Electronics');
    expect(categorizedItem.pctOfTotal).toBe(75);
  });

  it('returns an empty item list (not an error) when there is no realized revenue in range', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app)
      .get('/api/v1/seller/analytics/category-breakdown')
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });
});
