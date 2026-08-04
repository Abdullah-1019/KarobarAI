import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

// Task 1.3 — AnalyticsOwnershipGuard: seller-only, per-seller data isolation is proven per-metric
// in each dedicated test file (revenue/orders/customers/topProducts). This file pins the
// structural 401/403 contract uniformly across all six endpoints.

const ENDPOINTS = ['/revenue', '/sales-trend', '/category-breakdown', '/orders', '/customers', '/top-products'];

describe('Seller-analytics RBAC (Task 1.3)', () => {
  it.each(ENDPOINTS)('GET /api/v1/seller/analytics%s with no token is 401', async (path) => {
    const res = await request(app).get(`/api/v1/seller/analytics${path}`);
    expect(res.status).toBe(401);
  });

  it.each(ENDPOINTS)('GET /api/v1/seller/analytics%s as a Buyer is 403', async (path) => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app).get(`/api/v1/seller/analytics${path}`).set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(403);
  });

  it.each(ENDPOINTS)('GET /api/v1/seller/analytics%s as an Admin is 403 (platform-wide KPIs live at the separate SCR-AD01, not here)', async (path) => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app).get(`/api/v1/seller/analytics${path}`).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(403);
  });

  it.each(ENDPOINTS)('GET /api/v1/seller/analytics%s as an onboarded Seller is 200', async (path) => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app).get(`/api/v1/seller/analytics${path}`).set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(200);
  });
});
