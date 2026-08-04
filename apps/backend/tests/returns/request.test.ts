import { Queue } from 'bullmq';
import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { closeNotificationQueue } from '../../src/modules/notification';
import { createTestOrder, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const queueAddSpy = jest.spyOn(Queue.prototype, 'add').mockResolvedValue({} as never);

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  queueAddSpy.mockClear();
});

afterAll(async () => {
  await closeNotificationQueue();
  await prisma.$disconnect();
  await redis.quit();
  queueAddSpy.mockRestore();
});

describe('POST /api/v1/returns (Task 2 — eligibility + creation)', () => {
  it('creates a return on an eligible delivered order and notifies the seller', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'DELIVERED',
      deliveredAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ orderId: order.publicId, reason: 'Item not as described' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('INITIATED');
    expect(res.body.data.orderId).toBe(order.publicId);
    expect(res.body.data.images).toEqual([]);

    const initiatedCalls = queueAddSpy.mock.calls.filter(
      (call) => call[1] && (call[1] as { type?: string }).type === 'RETURN_INITIATED',
    );
    expect(initiatedCalls).toHaveLength(1);
    expect(initiatedCalls[0]?.[1]).toMatchObject({ userId: seller.userId.toString() });
  });

  it('rejects a return on an order not yet delivered with 422 RETURN_WINDOW_CLOSED', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING' });

    const res = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ orderId: order.publicId, reason: 'Changed my mind' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RETURN_WINDOW_CLOSED');
  });

  it('rejects a return past the configured return window with 422 RETURN_WINDOW_CLOSED', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'DELIVERED',
      deliveredAt: twentyDaysAgo,
    });

    const res = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ orderId: order.publicId, reason: 'Too late but trying anyway' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RETURN_WINDOW_CLOSED');
  });

  it('rejects a second return on the same order with 409 RETURN_ALREADY_EXISTS', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'DELIVERED',
      deliveredAt: new Date(),
    });
    await prisma.return.create({ data: { orderId: order.orderId, sellerId: seller.userId, reason: 'First return' } });

    const res = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ orderId: order.publicId, reason: 'Second attempt' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RETURN_ALREADY_EXISTS');
  });

  it("rejects an attempt to return another buyer's order with 403", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyerA = await createTestUser('BUYER');
    const buyerB = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyerA.userId, seller.userId, product, {
      status: 'DELIVERED',
      deliveredAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${buyerB.accessToken}`)
      .send({ orderId: order.publicId, reason: 'Not mine' });

    expect(res.status).toBe(403);
  });

  it('rejects a Seller attempting to create a return with 403 (Buyer-only route)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ orderId: '00000000-0000-0000-0000-000000000000', reason: 'x' });
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).post('/api/v1/returns').send({ orderId: 'x', reason: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/returns/:id (Task 2.4 — tri-mode ownership)', () => {
  async function createReturnFixture() {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'DELIVERED',
      deliveredAt: new Date(),
    });
    const ret = await prisma.return.create({ data: { orderId: order.orderId, sellerId: seller.userId, reason: 'x' } });
    return { seller, buyer, order, ret };
  }

  it('the owning buyer, owning seller, and Admin/Support can all read it', async () => {
    const { seller, buyer, ret } = await createReturnFixture();
    const admin = await createTestUser('ADMIN');

    for (const user of [buyer, seller, admin]) {
      // eslint-disable-next-line no-await-in-loop -- three sequential ownership checks
      const res = await request(app)
        .get(`/api/v1/returns/${ret.returnId}`)
        .set('Authorization', `Bearer ${user.accessToken}`);
      expect(res.status).toBe(200);
    }
  });

  it('rejects an unrelated buyer/seller with 403 RETURN_NOT_OWNED', async () => {
    const { ret } = await createReturnFixture();
    const stranger = await createTestUser('BUYER');

    const res = await request(app).get(`/api/v1/returns/${ret.returnId}`).set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('RETURN_NOT_OWNED');
  });

  it('returns 404 for a nonexistent return id', async () => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app).get('/api/v1/returns/999999999').set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RETURN_NOT_FOUND');
  });
});
