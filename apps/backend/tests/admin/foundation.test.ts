import request from 'supertest';

import * as coreAudit from '../../src/core/audit';
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

// Task 1's Definition of Done, verified structurally across every admin sub-router — one gate,
// reused everywhere, rather than tested once per endpoint.
const READ_ENDPOINTS = [
  '/api/v1/admin/dashboard/kpis',
  '/api/v1/admin/dashboard/alerts',
  '/api/v1/admin/users',
  '/api/v1/admin/moderation/products',
  '/api/v1/admin/reports/gmv-trend',
  '/api/v1/admin/reports/order-return-trend',
  '/api/v1/admin/reports/seller-performance',
  '/api/v1/admin/config',
];

describe('AdminRbacGuard — read routes (Task 1.2)', () => {
  it.each(READ_ENDPOINTS)('GET %s with no token is 401', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });

  it.each(READ_ENDPOINTS)('GET %s as a Buyer is 403', async (path) => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app).get(path).set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(403);
  });

  it.each(READ_ENDPOINTS)('GET %s as a Seller is 403', async (path) => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app).get(path).set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(403);
  });

  it.each(READ_ENDPOINTS)('GET %s as Support is 200 (read-only access granted)', async (path) => {
    const support = await createTestUser('SUPPORT');
    const res = await request(app).get(path).set('Authorization', `Bearer ${support.accessToken}`);
    expect(res.status).toBe(200);
  });

  it.each(READ_ENDPOINTS)('GET %s as Admin is 200', async (path) => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app).get(path).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
  });
});

describe('writeGuard — Support blocked from every mutating route with a distinct code (Task 1.3)', () => {
  it("Support hitting a write endpoint gets 403 ADMIN_WRITE_REQUIRED, not the generic FORBIDDEN a Buyer/Seller gets", async () => {
    const support = await createTestUser('SUPPORT');
    const seller = await createTestUser('SELLER', { onboarded: true });
    await prisma.user.update({ where: { userId: seller.userId }, data: { status: 'ACTIVE' } });

    const res = await request(app)
      .post(`/api/v1/admin/users/${seller.publicId}/suspend`)
      .set('Authorization', `Bearer ${support.accessToken}`)
      .send({ reason: 'test' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ADMIN_WRITE_REQUIRED');
  });

  it('Support hitting the same route with no reason still gets ADMIN_WRITE_REQUIRED before any body validation runs', async () => {
    const support = await createTestUser('SUPPORT');
    const seller = await createTestUser('SELLER', { onboarded: true });

    const res = await request(app)
      .post(`/api/v1/admin/users/${seller.publicId}/suspend`)
      .set('Authorization', `Bearer ${support.accessToken}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ADMIN_WRITE_REQUIRED');
  });
});

describe('AuditedMutation helper — atomic mutation + audit write (Task 1.4)', () => {
  it('a simulated audit-write failure rolls back the paired mutation (same test pattern as Feature 10 Task 5.6)', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    await prisma.user.update({ where: { userId: seller.userId }, data: { status: 'ACTIVE' } });

    const auditSpy = jest.spyOn(coreAudit, 'createAuditLog').mockRejectedValueOnce(new Error('simulated audit failure'));

    const res = await request(app)
      .post(`/api/v1/admin/users/${seller.publicId}/suspend`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ reason: 'test rollback' });

    expect(res.status).toBeGreaterThanOrEqual(500);
    auditSpy.mockRestore();

    const row = await prisma.user.findUnique({ where: { userId: seller.userId } });
    expect(row?.status).toBe('ACTIVE'); // never actually reached SUSPENDED — the transaction rolled back
    const auditRows = await prisma.auditLog.findMany({ where: { entity: 'users', entityId: seller.userId } });
    expect(auditRows).toHaveLength(0);
  });
});
