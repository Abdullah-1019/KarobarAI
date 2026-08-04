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

describe('GET /api/v1/seller/analytics/top-products (Task 6)', () => {
  it('ranks products by realized revenue, descending', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const cheap = await createTestProduct(seller.userId, { price: 50, titleEn: 'Cheap' });
    const expensive = await createTestProduct(seller.userId, { price: 500, titleEn: 'Expensive' });
    const today = new Date();

    await createTestOrder(buyer.userId, seller.userId, cheap, { status: 'DELIVERED', deliveredAt: today, quantity: 1 });
    await createTestOrder(buyer.userId, seller.userId, expensive, { status: 'DELIVERED', deliveredAt: today, quantity: 1 });

    const res = await request(app)
      .get('/api/v1/seller/analytics/top-products')
      .query({ range: '7d' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items[0].titleEn).toBe('Expensive');
    expect(res.body.data.items[0].revenue).toBe('500.00');
    expect(res.body.data.items[1].titleEn).toBe('Cheap');
  });

  it('excludes soft-deleted products even if they had realized sales in range', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { price: 100 });
    await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: new Date() });
    await prisma.product.update({ where: { productId: product.productId }, data: { deletedAt: new Date() } });

    const res = await request(app)
      .get('/api/v1/seller/analytics/top-products')
      .query({ range: '7d' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.body.data.items).toEqual([]);
  });

  it('resolves thumbnailUrl from the position-0 product image, null when none exists', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const withImage = await createTestProduct(seller.userId, { price: 100, titleEn: 'Has Image' });
    const withoutImage = await createTestProduct(seller.userId, { price: 100, titleEn: 'No Image' });
    await prisma.productImage.create({ data: { productId: withImage.productId, cdnUrl: 'https://cdn.example/img.jpg', position: 0 } });
    const today = new Date();
    await createTestOrder(buyer.userId, seller.userId, withImage, { status: 'DELIVERED', deliveredAt: today });
    await createTestOrder(buyer.userId, seller.userId, withoutImage, { status: 'DELIVERED', deliveredAt: today });

    const res = await request(app)
      .get('/api/v1/seller/analytics/top-products')
      .query({ range: '7d' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    const hasImageItem = res.body.data.items.find((i: { titleEn: string }) => i.titleEn === 'Has Image');
    const noImageItem = res.body.data.items.find((i: { titleEn: string }) => i.titleEn === 'No Image');
    expect(hasImageItem.thumbnailUrl).toBe('https://cdn.example/img.jpg');
    expect(noImageItem.thumbnailUrl).toBeNull();
  });

  it('respects the ?limit= query param', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const today = new Date();
    for (let i = 0; i < 5; i += 1) {
      const product = await createTestProduct(seller.userId, { price: 10 * (i + 1) });
      await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: today });
    }

    const res = await request(app)
      .get('/api/v1/seller/analytics/top-products')
      .query({ range: '7d', limit: 2 })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.body.data.items).toHaveLength(2);
  });

  it("never includes another seller's products", async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const productA = await createTestProduct(sellerA.userId, { titleEn: 'A' });
    const productB = await createTestProduct(sellerB.userId, { titleEn: 'B' });
    const today = new Date();
    await createTestOrder(buyer.userId, sellerA.userId, productA, { status: 'DELIVERED', deliveredAt: today });
    await createTestOrder(buyer.userId, sellerB.userId, productB, { status: 'DELIVERED', deliveredAt: today });

    const res = await request(app)
      .get('/api/v1/seller/analytics/top-products')
      .query({ range: '7d' })
      .set('Authorization', `Bearer ${sellerA.accessToken}`);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].titleEn).toBe('A');
  });
});
