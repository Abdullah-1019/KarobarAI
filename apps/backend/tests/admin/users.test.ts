import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestOrder, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('GET /api/v1/admin/users (Task 3.1)', () => {
  it('filters by role and status', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');

    const res = await request(app).get('/api/v1/admin/users').query({ role: 'SELLER' }).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.body.data.items.map((i: { id: string }) => i.id)).toEqual([seller.publicId]);
    expect(res.body.data.items.map((i: { id: string }) => i.id)).not.toContain(buyer.publicId);
  });

  it('finds a user by phone via the blind index, never by scanning ciphertext (Task 3.1)', async () => {
    const admin = await createTestUser('ADMIN');
    const target = await createTestUser('BUYER', { phone: '03001234567' });
    await createTestUser('BUYER'); // decoy, no matching phone

    const res = await request(app).get('/api/v1/admin/users').query({ search: '03001234567' }).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].id).toBe(target.publicId);
    expect(res.body.data.items[0].phone).toBe('+923001234567'); // decrypted for the admin view, normalized form
  });

  it('finds a user by email via the blind index', async () => {
    const admin = await createTestUser('ADMIN');
    const target = await createTestUser('BUYER', { email: 'findme@example.com' });

    const res = await request(app).get('/api/v1/admin/users').query({ search: 'findme@example.com' }).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].id).toBe(target.publicId);
  });

  it('includes fraud_rate_30d and storeName for SELLER rows, null for BUYER rows', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    await prisma.sellerProfile.update({ where: { userId: seller.userId }, data: { fraudRate30d: 0.1 } });
    const buyer = await createTestUser('BUYER');

    const res = await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${admin.accessToken}`);
    const sellerItem = res.body.data.items.find((i: { id: string }) => i.id === seller.publicId);
    const buyerItem = res.body.data.items.find((i: { id: string }) => i.id === buyer.publicId);
    expect(sellerItem.fraudRate30d).toBe(0.1);
    expect(sellerItem.storeName).not.toBeNull();
    expect(buyerItem.fraudRate30d).toBeNull();
    expect(buyerItem.storeName).toBeNull();
  });
});

describe('GET /api/v1/admin/users/:id (Task 3.2)', () => {
  it("a buyer's detail includes their address count", async () => {
    const admin = await createTestUser('ADMIN');
    const buyer = await createTestUser('BUYER');
    await prisma.address.createMany({
      data: [
        { buyerId: buyer.userId, recipientName: 'A', line1: 'x', city: 'Lahore', province: 'Punjab', contactPhone: 'x' },
        { buyerId: buyer.userId, recipientName: 'B', line1: 'y', city: 'Lahore', province: 'Punjab', contactPhone: 'y' },
      ],
    });

    const res = await request(app).get(`/api/v1/admin/users/${buyer.publicId}`).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.addressCount).toBe(2);
  });

  it("a seller's detail includes store_name, fraud_rate_30d, and onboarding status", async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });

    const res = await request(app).get(`/api/v1/admin/users/${seller.publicId}`).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.body.data.storeName).not.toBeNull();
    expect(res.body.data.onboardingCompletedAt).not.toBeNull();
  });

  it('unknown publicId is 404 USER_NOT_FOUND', async () => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app).get('/api/v1/admin/users/00000000-0000-0000-0000-000000000000').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });
});

describe('POST /api/v1/admin/users/:id/suspend|ban|reactivate (Task 3.3–3.6)', () => {
  it('suspend without a reason is 400', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app).post(`/api/v1/admin/users/${seller.publicId}/suspend`).set('Authorization', `Bearer ${admin.accessToken}`).send({});
    expect(res.status).toBe(400);
  });

  it('a full suspend -> reactivate -> ban lifecycle produces 3 audit rows and the correct final status', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });

    const suspendRes = await request(app)
      .post(`/api/v1/admin/users/${seller.publicId}/suspend`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ reason: 'policy violation' });
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.data.status).toBe('SUSPENDED');

    const reactivateRes = await request(app)
      .post(`/api/v1/admin/users/${seller.publicId}/reactivate`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({});
    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data.status).toBe('ACTIVE');

    const banRes = await request(app)
      .post(`/api/v1/admin/users/${seller.publicId}/ban`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ reason: 'repeat violation' });
    expect(banRes.status).toBe(200);
    expect(banRes.body.data.status).toBe('BANNED');

    const auditRows = await prisma.auditLog.findMany({ where: { entity: 'users', entityId: seller.userId }, orderBy: { createdAt: 'asc' } });
    expect(auditRows).toHaveLength(3);
    expect(auditRows.map((r) => r.action)).toEqual(['SUSPEND', 'UPDATE', 'BAN']);

    const finalRow = await prisma.user.findUnique({ where: { userId: seller.userId } });
    expect(finalRow?.status).toBe('BANNED');
  });

  it("suspending a user immediately revokes their active session (Task 3.4) — their next authenticated request 401s", async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });

    const before = await request(app).get('/api/v1/profile/me').set('Authorization', `Bearer ${seller.accessToken}`);
    expect(before.status).toBe(200);

    await request(app).post(`/api/v1/admin/users/${seller.publicId}/suspend`).set('Authorization', `Bearer ${admin.accessToken}`).send({ reason: 'x' });

    const after = await request(app).get('/api/v1/profile/me').set('Authorization', `Bearer ${seller.accessToken}`);
    expect(after.status).toBe(401);
  });

  it('banning a seller with open (non-terminal) orders surfaces openOrdersCount, ban still proceeds', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING' });
    await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: new Date() });
    await createTestOrder(buyer.userId, seller.userId, product, { status: 'CANCELLED' }); // terminal, not counted

    const res = await request(app).post(`/api/v1/admin/users/${seller.publicId}/ban`).set('Authorization', `Bearer ${admin.accessToken}`).send({ reason: 'x' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('BANNED');
    expect(res.body.data.openOrdersCount).toBe(2);
  });

  it('banning a seller with zero open orders omits openOrdersCount', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app).post(`/api/v1/admin/users/${seller.publicId}/ban`).set('Authorization', `Bearer ${admin.accessToken}`).send({ reason: 'x' });
    expect(res.body.data.openOrdersCount).toBeUndefined();
  });

  it('banning a buyer never checks/returns openOrdersCount (seller-only concern)', async () => {
    const admin = await createTestUser('ADMIN');
    const buyer = await createTestUser('BUYER');
    const res = await request(app).post(`/api/v1/admin/users/${buyer.publicId}/ban`).set('Authorization', `Bearer ${admin.accessToken}`).send({ reason: 'x' });
    expect(res.status).toBe(200);
    expect(res.body.data.openOrdersCount).toBeUndefined();
  });
});
