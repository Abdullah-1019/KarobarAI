import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createAddress, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('PATCH /api/v1/profile/me (Seller store update)', () => {
  it('updates storeName/storeDescription for an onboarded seller', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });

    const res = await request(app)
      .patch('/api/v1/profile/me')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({
        storeName: 'New Store Name',
        storeDescription: 'A great store',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.storeName).toBe('New Store Name');

    const row = await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } });
    expect(row.storeName).toBe('New Store Name');
    expect(row.storeDescription).toBe('A great store');
  });

  // Feature 3 Task 3.2's guard — a seller_profiles row always exists (placeholder, from account
  // activation), but editing business info before onboarding (POST /profile/me/store) has
  // actually completed must be rejected, not silently no-op or crash.
  it('rejects a non-onboarded seller with 422 STORE_NOT_ONBOARDED', async () => {
    const seller = await createTestUser('SELLER'); // onboarded defaults to false

    const res = await request(app)
      .patch('/api/v1/profile/me')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ storeName: 'New Store Name' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('STORE_NOT_ONBOARDED');
  });

  it('rejects logoUrl/bannerUrl as direct fields (must go through the upload endpoints) with 400', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });

    const res = await request(app)
      .patch('/api/v1/profile/me')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ storeName: 'X', logoUrl: 'https://cdn.example.com/logo.png' });

    expect(res.status).toBe(400);
  });

  it('rejects a Buyer attempting the seller-only endpoint with 403', async () => {
    const buyer = await createTestUser('BUYER');

    const res = await request(app)
      .patch('/api/v1/profile/me')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ storeName: 'Nope' });

    expect(res.status).toBe(403);
  });

  it('rejects an unknown field (zod .strict()) with 400', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });

    const res = await request(app)
      .patch('/api/v1/profile/me')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ storeName: 'X', commissionRate: 0.99 });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/v1/profile/me/default-address', () => {
  it('transactionally swaps the default address', async () => {
    const buyer = await createTestUser('BUYER');
    const addr1 = await createAddress(buyer.userId, { isDefault: true });
    const addr2 = await createAddress(buyer.userId, { isDefault: false });

    const res = await request(app)
      .patch('/api/v1/profile/me/default-address')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ addressId: addr2.addressId.toString() });

    expect(res.status).toBe(200);
    expect(res.body.data.defaultAddressId).toBe(addr2.addressId.toString());

    const rows = await prisma.address.findMany({ where: { buyerId: buyer.userId } });
    const defaults = rows.filter((r) => r.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.addressId).toBe(addr2.addressId);

    const buyerProfile = await prisma.buyerProfile.findUniqueOrThrow({ where: { userId: buyer.userId } });
    expect(buyerProfile.defaultAddressId).toBe(addr2.addressId);

    const oldDefault = await prisma.address.findUniqueOrThrow({ where: { addressId: addr1.addressId } });
    expect(oldDefault.isDefault).toBe(false);
  });

  it('rejects setting another buyer\'s address as default with 403 (ownership violation)', async () => {
    const buyerA = await createTestUser('BUYER');
    const buyerB = await createTestUser('BUYER');
    const addrB = await createAddress(buyerB.userId);

    const res = await request(app)
      .patch('/api/v1/profile/me/default-address')
      .set('Authorization', `Bearer ${buyerA.accessToken}`)
      .send({ addressId: addrB.addressId.toString() });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ADDRESS_NOT_OWNED');

    // The other buyer's address/profile must be completely unaffected by the rejected attempt.
    const untouched = await prisma.address.findUniqueOrThrow({ where: { addressId: addrB.addressId } });
    expect(untouched.isDefault).toBe(false);
  });

  it('returns 404 for a nonexistent addressId', async () => {
    const buyer = await createTestUser('BUYER');

    const res = await request(app)
      .patch('/api/v1/profile/me/default-address')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ addressId: '999999999' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADDRESS_NOT_FOUND');
  });

  it('rejects a Seller attempting the buyer-only endpoint with 403', async () => {
    const seller = await createTestUser('SELLER');

    const res = await request(app)
      .patch('/api/v1/profile/me/default-address')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ addressId: '1' });

    expect(res.status).toBe(403);
  });
});
