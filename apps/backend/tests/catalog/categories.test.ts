import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('GET /api/v1/categories', () => {
  it('returns the seeded categories as a flat root list (no create/edit route exists)', async () => {
    const res = await request(app).get('/api/v1/categories');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const slugs = res.body.data.map((c: { slug: string }) => c.slug);
    expect(slugs).toContain('electronics');
    // Every node carries a children[] array (tree-shaped), even though current seed data is flat.
    for (const category of res.body.data) {
      expect(Array.isArray(category.children)).toBe(true);
    }
  });

  it('requires no authentication (public, per PRD §11 Guest browse)', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(200);
  });

  // Task 2.1's explicit negative check, mirroring Feature 3 Task 6.2's pattern for status.
  it.each(['post', 'patch', 'delete'] as const)('no %s route exists on /categories (404)', async (method) => {
    const res = await request(app)[method]('/api/v1/categories');
    expect(res.status).toBe(404);
  });

  it('serves the second call from cache (no additional DB query needed)', async () => {
    const first = await request(app).get('/api/v1/categories');
    expect(first.status).toBe(200);

    const cached = await redis.get('cache:categories:tree');
    expect(cached).not.toBeNull();

    const second = await request(app).get('/api/v1/categories');
    expect(second.status).toBe(200);
    expect(second.body.data).toEqual(first.body.data);
  });
});
