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

describe('GET /api/v1/marketplace/home (Task 2 — Homepage aggregation)', () => {
  it('returns featured, newArrivals, and the cached category tree', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(seller.userId, { titleEn: 'Live Item', status: 'LIVE' });

    const res = await request(app).get('/api/v1/marketplace/home');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.featured)).toBe(true);
    expect(Array.isArray(res.body.data.newArrivals)).toBe(true);
    expect(Array.isArray(res.body.data.categories)).toBe(true);
    expect(res.body.data.featured.some((p: { titleEn: string }) => p.titleEn === 'Live Item')).toBe(true);
  });

  // Task 7.1's explicit requirement: correctly excludes DRAFT/OUT_OF_STOCK/REMOVED — reuses
  // Feature 4's exact visibility rule, not a second independently-written filter.
  it('excludes DRAFT, OUT_OF_STOCK, and REMOVED products', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(seller.userId, { titleEn: 'Draft Item', status: 'DRAFT' });
    await createTestProduct(seller.userId, { titleEn: 'Sold Out', status: 'OUT_OF_STOCK' });
    const removed = await createTestProduct(seller.userId, { titleEn: 'Removed Item', status: 'LIVE' });
    await prisma.product.update({
      where: { productId: removed.productId },
      data: { status: 'REMOVED', deletedAt: new Date() },
    });
    await createTestProduct(seller.userId, { titleEn: 'Visible Item', status: 'LIVE' });

    const res = await request(app).get('/api/v1/marketplace/home');

    const allTitles = [...res.body.data.featured, ...res.body.data.newArrivals].map(
      (p: { titleEn: string }) => p.titleEn,
    );
    expect(allTitles).not.toContain('Draft Item');
    expect(allTitles).not.toContain('Sold Out');
    expect(allTitles).not.toContain('Removed Item');
    expect(allTitles).toContain('Visible Item');
  });

  it('matches the exact same cached category tree Feature 4\'s GET /categories returns', async () => {
    const homeRes = await request(app).get('/api/v1/marketplace/home');
    const categoriesRes = await request(app).get('/api/v1/categories');

    expect(homeRes.body.data.categories).toEqual(categoriesRes.body.data);
  });

  it('returns empty arrays (not an error) when the platform has zero live products', async () => {
    const res = await request(app).get('/api/v1/marketplace/home');

    expect(res.status).toBe(200);
    expect(res.body.data.featured).toEqual([]);
    expect(res.body.data.newArrivals).toEqual([]);
  });

  it('requires no authentication', async () => {
    const res = await request(app).get('/api/v1/marketplace/home');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/categories/:slug (Task 3.2 — slug resolution)', () => {
  it('resolves a valid slug to its category summary', async () => {
    const res = await request(app).get('/api/v1/categories/electronics');

    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe('electronics');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('nameEn');
    expect(res.body.data).toHaveProperty('nameUr');
  });

  it('returns a clear 404 for an unknown slug, not a crash', async () => {
    const res = await request(app).get('/api/v1/categories/not-a-real-slug');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
  });

  it('requires no authentication', async () => {
    const res = await request(app).get('/api/v1/categories/electronics');
    expect(res.status).toBe(200);
  });

  // Task 3.4 — explicit negative check, mirroring Feature 4 Task 2.1's own discipline: this
  // feature inherits, never relaxes, the "categories are read-only reference data" boundary.
  it.each(['post', 'patch', 'delete'] as const)('no %s route exists on /categories/:slug (404)', async (method) => {
    const res = await request(app)[method]('/api/v1/categories/electronics');
    expect(res.status).toBe(404);
  });
});

// Task 7.3 — every screen/endpoint this feature touches (new + consumed-from-Feature-4) must
// succeed with NO auth token at all, per PRD §11's Guest permission matrix. This is this
// feature's primary security-relevant guarantee, since it's the platform's first fully
// public-facing read surface.
describe('Feature 5 — Guest-access adversarial sweep (Task 7.3)', () => {
  const GUEST_ROUTES: Array<{ method: 'get'; path: string }> = [
    { method: 'get', path: '/api/v1/marketplace/home' },
    { method: 'get', path: '/api/v1/categories' },
    { method: 'get', path: '/api/v1/categories/electronics' },
    { method: 'get', path: '/api/v1/products/search' },
    { method: 'get', path: '/api/v1/products/search?q=phone' },
    { method: 'get', path: '/api/v1/products/search?categoryId=1' },
    { method: 'get', path: '/api/v1/products/autocomplete?q=ph' },
  ];

  it.each(GUEST_ROUTES)('$method $path succeeds (200) with no Authorization header at all', async ({ method, path }) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(200);
  });

  it('GET /products/:publicId succeeds (200) for a LIVE product with no auth token', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });

    const res = await request(app).get(`/api/v1/products/${product.publicId}`);
    expect(res.status).toBe(200);
  });
});
