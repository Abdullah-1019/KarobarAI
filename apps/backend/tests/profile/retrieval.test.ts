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

describe('GET /api/v1/profile/me', () => {
  it('returns a Buyer profile shape', async () => {
    const buyer = await createTestUser('BUYER');

    const res = await request(app)
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ role: 'BUYER', id: buyer.publicId, defaultAddressId: null });
    expect(res.body.data).not.toHaveProperty('storeName');
  });

  it('returns a Seller profile shape, never including wallet/commission/fraud fields', async () => {
    const seller = await createTestUser('SELLER');

    const res = await request(app)
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('SELLER');
    expect(res.body.data).toHaveProperty('storeName');
    expect(res.body.data).not.toHaveProperty('jazzcashWallet');
    expect(res.body.data).not.toHaveProperty('easypaisaWallet');
    expect(res.body.data).not.toHaveProperty('commissionRate');
    expect(res.body.data).not.toHaveProperty('fraudRate30d');
  });

  it('returns a minimal Admin profile shape (identity fields only, confirmed Task 0 assumption)', async () => {
    const admin = await createTestUser('ADMIN');

    const res = await request(app)
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('ADMIN');
    expect(res.body.data).not.toHaveProperty('storeName');
    expect(res.body.data).not.toHaveProperty('defaultAddressId');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/profile/me');
    expect(res.status).toBe(401);
  });
});
