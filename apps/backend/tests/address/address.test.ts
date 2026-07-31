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

const VALID_ADDRESS = {
  recipientName: 'Ali Khan',
  line1: 'House 12, Street 5',
  city: 'Lahore',
  province: 'Punjab',
  contactPhone: '03001234567',
};

describe('POST /api/v1/addresses (Task 5 — create)', () => {
  it("creates an address and encrypts line1/contactPhone at rest", async () => {
    const buyer = await createTestUser('BUYER');

    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send(VALID_ADDRESS);

    expect(res.status).toBe(201);
    expect(res.body.data.line1).toBe(VALID_ADDRESS.line1);
    expect(res.body.data.contactPhone).toBe(VALID_ADDRESS.contactPhone);

    const row = await prisma.address.findUniqueOrThrow({ where: { addressId: BigInt(res.body.data.id) } });
    expect(row.line1).not.toBe(VALID_ADDRESS.line1);
    expect(row.line1.startsWith('v1:')).toBe(true);
    expect(row.contactPhone).not.toBe(VALID_ADDRESS.contactPhone);
  });

  it("a buyer's first address auto-becomes their default", async () => {
    const buyer = await createTestUser('BUYER');

    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send(VALID_ADDRESS);

    expect(res.body.data.isDefault).toBe(true);
    const buyerProfile = await prisma.buyerProfile.findUniqueOrThrow({ where: { userId: buyer.userId } });
    expect(buyerProfile.defaultAddressId).toBe(BigInt(res.body.data.id));
  });

  it('a second address does not auto-become default', async () => {
    const buyer = await createTestUser('BUYER');
    await request(app).post('/api/v1/addresses').set('Authorization', `Bearer ${buyer.accessToken}`).send(VALID_ADDRESS);

    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ ...VALID_ADDRESS, line1: 'House 99' });

    expect(res.body.data.isDefault).toBe(false);
  });

  it('rejects a missing contactPhone (required — orders.ship_phone is NOT NULL)', async () => {
    const buyer = await createTestUser('BUYER');
    const { contactPhone: _contactPhone, ...withoutPhone } = VALID_ADDRESS;

    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send(withoutPhone);

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/addresses (Task 5 — list)', () => {
  it('lists only the authenticated buyer\'s own addresses, default first', async () => {
    const buyerA = await createTestUser('BUYER');
    const buyerB = await createTestUser('BUYER');
    await request(app).post('/api/v1/addresses').set('Authorization', `Bearer ${buyerA.accessToken}`).send(VALID_ADDRESS);
    await request(app).post('/api/v1/addresses').set('Authorization', `Bearer ${buyerB.accessToken}`).send(VALID_ADDRESS);

    const res = await request(app).get('/api/v1/addresses').set('Authorization', `Bearer ${buyerA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('PATCH /api/v1/addresses/:addressId (Task 5 — update)', () => {
  it('edits fields and re-encrypts changed encrypted fields', async () => {
    const buyer = await createTestUser('BUYER');
    const createRes = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send(VALID_ADDRESS);

    const res = await request(app)
      .patch(`/api/v1/addresses/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ line1: 'New Street 9' });

    expect(res.status).toBe(200);
    expect(res.body.data.line1).toBe('New Street 9');
    expect(res.body.data.city).toBe(VALID_ADDRESS.city); // untouched fields survive a partial update
  });

  it("rejects a Buyer B editing Buyer A's address with 403", async () => {
    const buyerA = await createTestUser('BUYER');
    const buyerB = await createTestUser('BUYER');
    const createRes = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${buyerA.accessToken}`)
      .send(VALID_ADDRESS);

    const res = await request(app)
      .patch(`/api/v1/addresses/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${buyerB.accessToken}`)
      .send({ line1: 'Hijacked' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ADDRESS_NOT_OWNED');
  });

  it('rejects toggling isDefault through this endpoint (unknown field, 400)', async () => {
    const buyer = await createTestUser('BUYER');
    const createRes = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send(VALID_ADDRESS);

    const res = await request(app)
      .patch(`/api/v1/addresses/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ isDefault: true });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v1/addresses/:addressId (Task 5.4 — soft-delete + last-address guard)', () => {
  it('soft-deletes an address when the buyer has others remaining', async () => {
    const buyer = await createTestUser('BUYER');
    await request(app).post('/api/v1/addresses').set('Authorization', `Bearer ${buyer.accessToken}`).send(VALID_ADDRESS);
    const secondRes = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ ...VALID_ADDRESS, line1: 'House 2' });

    const res = await request(app)
      .delete(`/api/v1/addresses/${secondRes.body.data.id}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res.status).toBe(200);
    const listRes = await request(app).get('/api/v1/addresses').set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(listRes.body.data).toHaveLength(1);
  });

  it('blocks deleting the only remaining address, with a clear message', async () => {
    const buyer = await createTestUser('BUYER');
    const createRes = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send(VALID_ADDRESS);

    const res = await request(app)
      .delete(`/api/v1/addresses/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('LAST_ADDRESS_CANNOT_BE_DELETED');

    const row = await prisma.address.findUniqueOrThrow({ where: { addressId: BigInt(createRes.body.data.id) } });
    expect(row.deletedAt).toBeNull();
  });

  it('clears buyerProfile.defaultAddressId when the deleted address was the default (no auto-promotion)', async () => {
    const buyer = await createTestUser('BUYER');
    const firstRes = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send(VALID_ADDRESS); // auto-default (first address)
    await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ ...VALID_ADDRESS, line1: 'House 2' });

    await request(app)
      .delete(`/api/v1/addresses/${firstRes.body.data.id}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);

    const buyerProfile = await prisma.buyerProfile.findUniqueOrThrow({ where: { userId: buyer.userId } });
    expect(buyerProfile.defaultAddressId).toBeNull();
  });
});
