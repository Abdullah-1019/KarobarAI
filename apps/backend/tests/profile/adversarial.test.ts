import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const VALID_JPEG_MAGIC_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0]);

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
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
    { method: 'post', path: '/api/v1/profile/me/store' },
    { method: 'post', path: '/api/v1/profile/me/store/logo' },
    { method: 'delete', path: '/api/v1/profile/me/store/logo' },
    { method: 'post', path: '/api/v1/profile/me/store/banner' },
    { method: 'delete', path: '/api/v1/profile/me/store/banner' },
    { method: 'get', path: '/api/v1/profile/me/store/status' },
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

// Feature 3 (Store Management) — its own adversarial checks: role gating on every /store
// sub-route, and the two security-relevant absences the module doc calls out explicitly
// (Task 6.2/7.4): no store-status mutation path exists anywhere, in any form.
describe('Feature 3 store sub-routes — role gating and status immutability', () => {
  const storeRoutes: Array<{ method: 'get' | 'post' | 'delete'; path: string }> = [
    { method: 'post', path: '/api/v1/profile/me/store' },
    { method: 'post', path: '/api/v1/profile/me/store/logo' },
    { method: 'delete', path: '/api/v1/profile/me/store/logo' },
    { method: 'post', path: '/api/v1/profile/me/store/banner' },
    { method: 'delete', path: '/api/v1/profile/me/store/banner' },
    { method: 'get', path: '/api/v1/profile/me/store/status' },
  ];

  it.each(storeRoutes)('rejects a Buyer on $method $path with 403 (seller-only)', async ({ method, path }) => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app)[method](path).set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(403);
  });

  it.each(storeRoutes)('rejects an Admin on $method $path with 403 (seller-only)', async ({ method, path }) => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app)[method](path).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('a non-onboarded seller uploading a logo/banner gets 422 STORE_NOT_ONBOARDED, not a 500', async () => {
    const seller = await createTestUser('SELLER'); // onboarded defaults to false

    const logoRes = await request(app)
      .post('/api/v1/profile/me/store/logo')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('logo', VALID_JPEG_MAGIC_BYTES, 'logo.jpg');
    expect(logoRes.status).toBe(422);
    expect(logoRes.body.error.code).toBe('STORE_NOT_ONBOARDED');

    const bannerRes = await request(app)
      .post('/api/v1/profile/me/store/banner')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('banner', VALID_JPEG_MAGIC_BYTES, 'banner.jpg');
    expect(bannerRes.status).toBe(422);
    expect(bannerRes.body.error.code).toBe('STORE_NOT_ONBOARDED');
  });

  // Task 6.2's negative verification, folded into the permanent regression suite per Task 7.4:
  // no PATCH/POST/PUT variant of /store/status exists anywhere — status mutation is Admin-only,
  // out of scope for this feature entirely.
  it('no mutation route exists for /store/status (404, not just unauthorized)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });

    const res = await request(app)
      .patch('/api/v1/profile/me/store/status')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(404);
  });

  // The generic PATCH /profile/me must strip an injected "status" field rather than silently
  // accepting it — zod's .strict() should already guarantee this; verified, not assumed.
  it('the generic PATCH /profile/me silently rejects (400) an injected status field', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });

    const res = await request(app)
      .patch('/api/v1/profile/me')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ storeName: 'X', status: 'BANNED' });

    expect(res.status).toBe(400);
  });
});
