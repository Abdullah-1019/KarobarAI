import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import * as repo from '../../src/modules/analytics/analytics.repository';
import { createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const sumSettledRevenueSpy = jest.spyOn(repo, 'sumSettledRevenue');

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  sumSettledRevenueSpy.mockClear();
});

afterAll(async () => {
  sumSettledRevenueSpy.mockRestore();
  await prisma.$disconnect();
  await redis.quit();
});

// Task 2.4/3.5/4.5/5.7/6.5 — TTL-based cache (analytics.cache.ts's Engineering Decision). A
// repeated call for the same seller+metric+range within the 60s TTL must be served from Redis,
// not recompute against Postgres.

describe('Analytics response caching', () => {
  it('a second identical request within the TTL does not re-hit the repository', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });

    const first = await request(app)
      .get('/api/v1/seller/analytics/revenue')
      .query({ range: '7d' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(first.status).toBe(200);
    expect(sumSettledRevenueSpy).toHaveBeenCalledTimes(3); // current + previous + ytd

    sumSettledRevenueSpy.mockClear();

    const second = await request(app)
      .get('/api/v1/seller/analytics/revenue')
      .query({ range: '7d' })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(second.status).toBe(200);
    expect(second.body.data).toEqual(first.body.data);
    expect(sumSettledRevenueSpy).not.toHaveBeenCalled();
  });

  it('a different range for the same seller is a cache miss (distinct cache key, not stale-shared)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });

    await request(app).get('/api/v1/seller/analytics/revenue').query({ range: '7d' }).set('Authorization', `Bearer ${seller.accessToken}`);
    sumSettledRevenueSpy.mockClear();

    await request(app).get('/api/v1/seller/analytics/revenue').query({ range: '30d' }).set('Authorization', `Bearer ${seller.accessToken}`);
    expect(sumSettledRevenueSpy).toHaveBeenCalled();
  });

  it('a different seller is a cache miss, never serves another seller\'s cached figures', async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });

    await request(app).get('/api/v1/seller/analytics/revenue').query({ range: '7d' }).set('Authorization', `Bearer ${sellerA.accessToken}`);
    sumSettledRevenueSpy.mockClear();

    await request(app).get('/api/v1/seller/analytics/revenue').query({ range: '7d' }).set('Authorization', `Bearer ${sellerB.accessToken}`);
    expect(sumSettledRevenueSpy).toHaveBeenCalled();
  });
});
