import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const featuredCacheKey = 'cache:f21:featured-stores:v3';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  await redis.del(featuredCacheKey);
});

afterAll(async () => {
  await redis.del(featuredCacheKey);
  await prisma.$disconnect();
  await redis.quit();
});

describe('public store directory API on isolated services', () => {
  it('filters ineligible stores and ranks only matching live products', async () => {
    const category = await prisma.category.create({
      data: { slug: `f21-clothing-${randomUUID()}`, nameEn: 'Clothing', nameUr: 'Clothing' },
    });
    const otherCategory = await prisma.category.create({
      data: { slug: `f21-other-${randomUUID()}`, nameEn: 'Other', nameUr: 'Other' },
    });
    const alpha = await createTestUser('SELLER', { onboarded: true });
    const beta = await createTestUser('SELLER', { onboarded: true });
    const draftOnly = await createTestUser('SELLER', { onboarded: true });
    const notOnboarded = await createTestUser('SELLER');
    const suspended = await createTestUser('SELLER', { onboarded: true });

    await prisma.sellerProfile.update({ where: { userId: alpha.userId }, data: {
      storeName: 'Alpha Fabrics', storeDescription: 'Handmade shirts', city: 'Lahore', storeCategoryId: category.categoryId,
    } });
    await prisma.sellerProfile.update({ where: { userId: beta.userId }, data: { storeName: 'Beta Shop' } });
    await prisma.user.update({ where: { userId: suspended.userId }, data: { status: 'SUSPENDED' } });
    await createTestProduct(alpha.userId, { status: 'LIVE', categoryId: category.categoryId });
    await createTestProduct(alpha.userId, { status: 'LIVE', categoryId: category.categoryId });
    await createTestProduct(alpha.userId, { status: 'LIVE', categoryId: otherCategory.categoryId });
    await createTestProduct(alpha.userId, { status: 'DRAFT', categoryId: category.categoryId });
    await createTestProduct(beta.userId, { status: 'LIVE', categoryId: category.categoryId });
    await createTestProduct(draftOnly.userId, { status: 'DRAFT', categoryId: category.categoryId });
    await createTestProduct(notOnboarded.userId, { status: 'LIVE', categoryId: category.categoryId });
    await createTestProduct(suspended.userId, { status: 'LIVE', categoryId: category.categoryId });

    const first = await request(app).get('/api/v1/stores').query({ categorySlug: category.slug, sort: 'most_products', limit: 1, page: 1 });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ total: 2, page: 1, hasMore: true });
    expect(first.body.data.items[0]).toMatchObject({ name: 'Alpha Fabrics', productCount: 2, city: 'Lahore',
      description: 'Handmade shirts', category: { id: category.categoryId.toString() } });
    expect(Object.keys(first.body.data.items[0]).sort()).toEqual([
      'category', 'city', 'description', 'descriptionUr', 'logoUrl', 'memberSince', 'name', 'productCount', 'slug',
    ].sort());

    const second = await request(app).get('/api/v1/stores').query({ categorySlug: category.slug, sort: 'most_products', limit: 1, page: 2 });
    expect(second.status).toBe(200);
    expect(second.body.data).toMatchObject({ total: 2, page: 2, hasMore: false });
    expect(second.body.data.items[0]).toMatchObject({ name: 'Beta Shop', productCount: 1 });

    const searched = await request(app).get('/api/v1/stores').query({ q: 'HANDMADE', sort: 'name' });
    expect(searched.body.data.items.map((item: { name: string }) => item.name)).toEqual(['Alpha Fabrics']);
    const alphabetical = await request(app).get('/api/v1/stores').query({ sort: 'name' });
    expect(alphabetical.body.data.items.map((item: { name: string }) => item.name)).toEqual(['Alpha Fabrics', 'Beta Shop']);
    const newest = await request(app).get('/api/v1/stores').query({ sort: 'newest' });
    expect(newest.body.data.items.map((item: { name: string }) => item.name)).toEqual(['Beta Shop', 'Alpha Fabrics']);
  });

  it('rejects invalid pagination, search, category syntax, and sort queries', async () => {
    for (const query of [
      { page: '0' }, { page: '1.5' }, { limit: '31' }, { sort: 'unsupported' },
      { q: 'x'.repeat(121) }, { categorySlug: '../private' },
    ]) {
      const response = await request(app).get('/api/v1/stores').query(query);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
    const unknownCategory = await request(app).get('/api/v1/stores').query({ categorySlug: `unknown-${randomUUID()}` });
    expect(unknownCategory.status).toBe(404);
    expect(unknownCategory.body.error.code).toBe('CATEGORY_NOT_FOUND');
  });

  it('returns eligible featured stores and caches the public payload briefly', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(seller.userId, { status: 'LIVE' });
    const response = await request(app).get('/api/v1/stores/featured');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].productCount).toBe(1);
    expect(await redis.get(featuredCacheKey)).toBeTruthy();
    const cached = await request(app).get('/api/v1/stores/featured');
    expect(cached.body.data).toEqual(response.body.data);
  });
});
