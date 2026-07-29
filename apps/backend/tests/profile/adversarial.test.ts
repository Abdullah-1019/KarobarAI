import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { app } from '../../src/server';
import { createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Task 7 — Profile Validation & Testing: adversarial sweep. Individual files (retrieval.test.ts,
// update.test.ts) already assert their own ownership/role checks in context; this file is the
// single place proving the *whole* profile surface is covered, not just its happy paths.
describe('Feature 2 adversarial checks', () => {
  const protectedRoutes: Array<{ method: 'get' | 'patch' | 'post' | 'delete'; path: string }> = [
    { method: 'get', path: '/api/v1/profile/me' },
    { method: 'patch', path: '/api/v1/profile/me' },
    { method: 'patch', path: '/api/v1/profile/me/default-address' },
    { method: 'post', path: '/api/v1/profile/me/avatar' },
    { method: 'delete', path: '/api/v1/profile/me/avatar' },
    { method: 'post', path: '/api/v1/profile/me/password' },
    { method: 'get', path: '/api/v1/profile/me/settings' },
    { method: 'patch', path: '/api/v1/profile/me/settings' },
  ];

  it.each(protectedRoutes)('rejects unauthenticated $method $path with 401', async ({ method, path }) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });

  it('a garbage bearer token is rejected with 401, not a 500', async () => {
    const res = await request(app)
      .get('/api/v1/profile/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('a Seller cannot set a default address (buyer-only)', async () => {
    const seller = await createTestUser('SELLER');
    const res = await request(app)
      .patch('/api/v1/profile/me/default-address')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ addressId: '1' });
    expect(res.status).toBe(403);
  });

  it('a Buyer cannot update the seller store profile (seller-only)', async () => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app)
      .patch('/api/v1/profile/me')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ storeName: 'nope' });
    expect(res.status).toBe(403);
  });

  it('an Admin cannot update the seller store profile or set a default address either', async () => {
    const admin = await createTestUser('ADMIN');

    const storeRes = await request(app)
      .patch('/api/v1/profile/me')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ storeName: 'nope' });
    expect(storeRes.status).toBe(403);

    const addressRes = await request(app)
      .patch('/api/v1/profile/me/default-address')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ addressId: '1' });
    expect(addressRes.status).toBe(403);
  });
});
