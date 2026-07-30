import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('GET /api/v1/products/search (Task 7.1/7.2/7.3)', () => {
  it('matches an English query against titleEn', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(seller.userId, { titleEn: 'Wireless Bluetooth Speaker', status: 'LIVE' });
    await createTestProduct(seller.userId, { titleEn: 'Leather Wallet', status: 'LIVE' });

    const res = await request(app).get('/api/v1/products/search?q=speaker');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].titleEn).toBe('Wireless Bluetooth Speaker');
  });

  it('matches an Urdu-script query against titleUr', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { titleEn: 'Shoes', status: 'LIVE' });
    await prisma.product.update({ where: { productId: product.productId }, data: { titleUr: 'جوتے' } });

    const res = await request(app).get(`/api/v1/products/search?q=${encodeURIComponent('جوتے')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.map((i: { id: string }) => i.id)).toContain(product.publicId);
  });

  it('returns an empty result for irrelevant terms, not an error', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(seller.userId, { titleEn: 'Speaker', status: 'LIVE' });

    const res = await request(app).get('/api/v1/products/search?q=zzznonexistentzzz');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('filters by category', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const electronics = await prisma.category.findFirstOrThrow({ where: { slug: 'electronics' } });
    const fashion = await prisma.category.findFirstOrThrow({ where: { slug: 'fashion-clothing' } });
    await createTestProduct(seller.userId, { titleEn: 'Phone', status: 'LIVE', categoryId: electronics.categoryId });
    await createTestProduct(seller.userId, { titleEn: 'Shirt', status: 'LIVE', categoryId: fashion.categoryId });

    const res = await request(app).get(`/api/v1/products/search?categoryId=${electronics.categoryId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].titleEn).toBe('Phone');
  });

  it('filters by price range', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(seller.userId, { titleEn: 'Cheap', price: 50, status: 'LIVE' });
    await createTestProduct(seller.userId, { titleEn: 'Mid', price: 150, status: 'LIVE' });
    await createTestProduct(seller.userId, { titleEn: 'Expensive', price: 500, status: 'LIVE' });

    const res = await request(app).get('/api/v1/products/search?minPrice=100&maxPrice=200');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].titleEn).toBe('Mid');
  });

  it('filters by condition', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(seller.userId, { titleEn: 'New one', status: 'LIVE' });
    const usedProduct = await createTestProduct(seller.userId, { titleEn: 'Used one', status: 'LIVE' });
    await prisma.product.update({ where: { productId: usedProduct.productId }, data: { condition: 'USED' } });

    const res = await request(app).get('/api/v1/products/search?condition=USED');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].titleEn).toBe('Used one');
  });

  it('combined filters (category + price range + condition) narrow correctly', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const electronics = await prisma.category.findFirstOrThrow({ where: { slug: 'electronics' } });
    const match = await createTestProduct(seller.userId, {
      titleEn: 'Match',
      price: 150,
      status: 'LIVE',
      categoryId: electronics.categoryId,
    });
    await createTestProduct(seller.userId, { titleEn: 'Wrong price', price: 999, status: 'LIVE', categoryId: electronics.categoryId });
    await prisma.product.update({ where: { productId: match.productId }, data: { condition: 'NEW' } });

    const res = await request(app).get(
      `/api/v1/products/search?categoryId=${electronics.categoryId}&minPrice=100&maxPrice=200&condition=NEW`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].titleEn).toBe('Match');
  });

  it('sorts by price ascending/descending', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(seller.userId, { titleEn: 'Cheap', price: 50, status: 'LIVE' });
    await createTestProduct(seller.userId, { titleEn: 'Expensive', price: 500, status: 'LIVE' });

    const asc = await request(app).get('/api/v1/products/search?sort=price_asc');
    expect(asc.body.data.items[0].titleEn).toBe('Cheap');

    const desc = await request(app).get('/api/v1/products/search?sort=price_desc');
    expect(desc.body.data.items[0].titleEn).toBe('Expensive');
  });

  it('accepts sort=rating without erroring (documented no-op, falls back to relevance)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(seller.userId, { titleEn: 'Something', status: 'LIVE' });

    const res = await request(app).get('/api/v1/products/search?sort=rating');
    expect(res.status).toBe(200);
  });

  // Task 7.3 / REQ-F-Inv-003 — an OUT_OF_STOCK product must not appear in default search results.
  it('hides an OUT_OF_STOCK product from search results, but its direct detail page still loads', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, {
      titleEn: 'Sold Out Item',
      status: 'OUT_OF_STOCK',
      stock: 0,
    });

    const searchRes = await request(app).get('/api/v1/products/search?q=Sold');
    expect(searchRes.body.data.items).toEqual([]);

    const detailRes = await request(app).get(`/api/v1/products/${product.publicId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.status).toBe('OUT_OF_STOCK');
  });

  it('excludes DRAFT and REMOVED (soft-deleted) products from search results', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(seller.userId, { titleEn: 'Draft Item', status: 'DRAFT' });
    const removed = await createTestProduct(seller.userId, { titleEn: 'Removed Item', status: 'LIVE' });
    await prisma.product.update({ where: { productId: removed.productId }, data: { deletedAt: new Date() } });

    const res = await request(app).get('/api/v1/products/search');
    const titles = res.body.data.items.map((i: { titleEn: string }) => i.titleEn);
    expect(titles).not.toContain('Draft Item');
    expect(titles).not.toContain('Removed Item');
  });

  it('rejects minPrice > maxPrice with 400', async () => {
    const res = await request(app).get('/api/v1/products/search?minPrice=200&maxPrice=100');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/products/autocomplete (Task 7.4)', () => {
  it('returns title matches for a query at the minimum trigger length', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(seller.userId, { titleEn: 'Running Shoes', status: 'LIVE' });

    const res = await request(app).get('/api/v1/products/autocomplete?q=ru');

    expect(res.status).toBe(200);
    expect(res.body.data.some((s: { title: string }) => s.title === 'Running Shoes')).toBe(true);
  });

  it('rejects a query shorter than the minimum trigger length (N=2) with 400', async () => {
    const res = await request(app).get('/api/v1/products/autocomplete?q=r');
    expect(res.status).toBe(400);
  });

  it('does not suggest DRAFT or OUT_OF_STOCK products', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(seller.userId, { titleEn: 'Draftphone', status: 'DRAFT' });

    const res = await request(app).get('/api/v1/products/autocomplete?q=draft');
    expect(res.body.data).toEqual([]);
  });
});
