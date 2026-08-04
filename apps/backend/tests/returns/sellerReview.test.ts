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

async function createReturnFixture(status: 'MANUAL_REVIEW' | 'INITIATED' = 'MANUAL_REVIEW') {
  const seller = await createTestUser('SELLER', { onboarded: true });
  const buyer = await createTestUser('BUYER');
  const product = await createTestProduct(seller.userId);
  const order = await createTestOrder(buyer.userId, seller.userId, product, {
    status: 'DELIVERED',
    deliveredAt: new Date(),
    courier: 'TCS',
    trackingNo: 'MOCK-TCS-1',
  });
  const ret = await prisma.return.create({ data: { orderId: order.orderId, sellerId: seller.userId, reason: 'x', status } });
  return { seller, buyer, order, ret };
}

describe('POST /api/v1/seller/returns/:id/decision (Task 4.3/4.4/4.5)', () => {
  it('approving books the return pickup, then triggers the refund, reaching REFUND_ISSUED end to end (mock is synchronous)', async () => {
    const { seller, ret } = await createReturnFixture();

    const res = await request(app)
      .post(`/api/v1/seller/returns/${ret.returnId}/decision`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ decision: 'APPROVED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REFUND_ISSUED');
    expect(res.body.data.refundStatus).toBe('ISSUED');
    expect(res.body.data.refundedAt).not.toBeNull();

    const auditRows = await prisma.auditLog.findMany({ where: { entity: 'returns', entityId: ret.returnId } });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.action).toBe('MODERATION');
    expect(auditRows[0]?.actorId).toBe(seller.userId);
  });

  it('rejecting without a reason is a 400 validation error (Zod refinement)', async () => {
    const { seller, ret } = await createReturnFixture();
    const res = await request(app)
      .post(`/api/v1/seller/returns/${ret.returnId}/decision`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ decision: 'REJECTED' });
    expect(res.status).toBe(400);
  });

  it('rejecting with a reason succeeds, notifies the buyer, and does not auto-close (buyer can still appeal)', async () => {
    const { seller, buyer, ret } = await createReturnFixture();

    const res = await request(app)
      .post(`/api/v1/seller/returns/${ret.returnId}/decision`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ decision: 'REJECTED', reason: 'Item shows signs of use' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');

    const decisionCalls = queueAddSpy.mock.calls.filter(
      (call) => call[1] && (call[1] as { type?: string }).type === 'RETURN_DECISION',
    );
    expect(decisionCalls).toHaveLength(1);
    expect(decisionCalls[0]?.[1]).toMatchObject({ userId: buyer.userId.toString() });
  });

  it('rejects a decision on a return not in MANUAL_REVIEW with 422 RETURN_INVALID_STATE', async () => {
    const { seller, ret } = await createReturnFixture('INITIATED');
    const res = await request(app)
      .post(`/api/v1/seller/returns/${ret.returnId}/decision`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ decision: 'APPROVED' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RETURN_INVALID_STATE');
  });

  it("rejects a non-owning seller's decision with 403", async () => {
    const { ret } = await createReturnFixture();
    const otherSeller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app)
      .post(`/api/v1/seller/returns/${ret.returnId}/decision`)
      .set('Authorization', `Bearer ${otherSeller.accessToken}`)
      .send({ decision: 'APPROVED' });
    expect(res.status).toBe(403);
  });

  it('rejects a Buyer calling this Seller-only route with 403', async () => {
    const { buyer, ret } = await createReturnFixture();
    const res = await request(app)
      .post(`/api/v1/seller/returns/${ret.returnId}/decision`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ decision: 'APPROVED' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/seller/returns/:id/escalate (Task 4.6)', () => {
  it('writes an audit trail entry without changing the return status', async () => {
    const { seller, ret } = await createReturnFixture();

    const res = await request(app)
      .post(`/api/v1/seller/returns/${ret.returnId}/escalate`)
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(200);

    const row = await prisma.return.findUniqueOrThrow({ where: { returnId: ret.returnId } });
    expect(row.status).toBe('MANUAL_REVIEW'); // unchanged — Task 4.6's Engineering Decision

    const auditRows = await prisma.auditLog.findMany({ where: { entity: 'returns', entityId: ret.returnId } });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.action).toBe('MODERATION');
  });

  it('rejects escalating a return not in MANUAL_REVIEW with 422', async () => {
    const { seller, ret } = await createReturnFixture('INITIATED');
    const res = await request(app)
      .post(`/api/v1/seller/returns/${ret.returnId}/escalate`)
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/seller/returns (Task 4.1)', () => {
  it("returns only the seller's own active-queue (MANUAL_REVIEW) cases by default", async () => {
    const { seller, ret } = await createReturnFixture();
    const otherSeller = await createTestUser('SELLER', { onboarded: true });
    const buyer2 = await createTestUser('BUYER');
    const product2 = await createTestProduct(otherSeller.userId);
    const order2 = await createTestOrder(buyer2.userId, otherSeller.userId, product2, { status: 'DELIVERED', deliveredAt: new Date() });
    await prisma.return.create({ data: { orderId: order2.orderId, sellerId: otherSeller.userId, reason: 'y', status: 'MANUAL_REVIEW' } });

    const res = await request(app).get('/api/v1/seller/returns').set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].id).toBe(ret.returnId.toString());
  });
});
