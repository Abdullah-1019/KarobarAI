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

async function createReturnFixture(status: 'MANUAL_REVIEW' | 'REJECTED' | 'UNDER_DISPUTE' = 'MANUAL_REVIEW') {
  const seller = await createTestUser('SELLER', { onboarded: true });
  const buyer = await createTestUser('BUYER');
  const product = await createTestProduct(seller.userId);
  const order = await createTestOrder(buyer.userId, seller.userId, product, {
    status: 'DELIVERED',
    deliveredAt: new Date(),
    courier: 'TCS',
    trackingNo: 'MOCK-TCS-1',
  });
  const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.orderId } });
  const ret = await prisma.return.create({ data: { orderId: order.orderId,
    orderItemId: orderItem.orderItemId, sellerId: seller.userId, reason: 'x', status } });
  if (status === 'UNDER_DISPUTE') {
    // Mirrors what appealReturn() always does in real usage — creates the Dispute row in the
    // same transaction as the status transition, a pairing decideReturn() now checks directly
    // (row.dispute !== null) rather than inferring from status alone.
    await prisma.dispute.create({ data: { returnId: ret.returnId } });
  }
  return { seller, buyer, order, ret };
}

describe('POST /api/v1/returns/:id/appeal (buyer appeal — gap found and closed, see handoff doc)', () => {
  it('a REJECTED return can be appealed: creates a dispute, advances to UNDER_DISPUTE', async () => {
    const { buyer, ret } = await createReturnFixture('REJECTED');

    const res = await request(app)
      .post(`/api/v1/returns/${ret.returnId}/appeal`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ reason: 'I believe this decision overlooked the photos' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('UNDER_DISPUTE');
    expect(res.body.data.dispute).toMatchObject({ status: 'OPEN',
      buyerReason: 'I believe this decision overlooked the photos' });

    const dispute = await prisma.dispute.findUniqueOrThrow({ where: { returnId: ret.returnId } });
    expect(dispute.status).toBe('OPEN');
  });

  it('rejects appealing a return that is not REJECTED with 422', async () => {
    const { buyer, ret } = await createReturnFixture('MANUAL_REVIEW');
    const res = await request(app)
      .post(`/api/v1/returns/${ret.returnId}/appeal`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ reason: 'Please review' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RETURN_INVALID_STATE');
  });

  it("rejects a non-owning buyer's appeal with 403", async () => {
    const { ret } = await createReturnFixture('REJECTED');
    const stranger = await createTestUser('BUYER');
    const res = await request(app)
      .post(`/api/v1/returns/${ret.returnId}/appeal`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .send({ reason: 'Please review' });
    expect(res.status).toBe(403);
  });
});

describe('seller resolution of buyer appeals', () => {
  it('routes an appeal to the owning seller, who can accept it without admin action', async () => {
    const { seller, buyer, ret } = await createReturnFixture('REJECTED');
    const appeal = await request(app).post(`/api/v1/returns/${ret.returnId}/appeal`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ reason: 'The listing photos show this is the purchased item' });
    expect(appeal.status).toBe(200);
    const queue = await request(app).get('/api/v1/seller/returns')
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(queue.body.data.items.some((item: { id: string }) => item.id === ret.returnId.toString())).toBe(true);
    const resolved = await request(app).post(`/api/v1/seller/returns/${ret.returnId}/decision`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ decision: 'APPROVED', reason: 'Photos match the listing' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.status).toBe('APPROVED');
    expect(resolved.body.data.dispute.status).toBe('RESOLVED_APPROVED');
    expect(resolved.body.data.decisionSource).toBe('SELLER');
    expect(await prisma.returnFulfillment.count({ where: { returnId: ret.returnId } })).toBe(1);
    const awaitingCourier = await request(app).get('/api/v1/seller/returns')
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(awaitingCourier.body.data.items.some((item: { id: string }) =>
      item.id === ret.returnId.toString())).toBe(true);
    const booked = await request(app).post(`/api/v1/seller/returns/${ret.returnId}/book-return-courier`)
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(booked.status).toBe(200);
    expect(booked.body.data.shipments[0]).toMatchObject({ leg: 'RETURN', simulated: true });
  });

  it('rejects a cross-store appeal decision and an empty resolution reason', async () => {
    const { seller, buyer, ret } = await createReturnFixture('REJECTED');
    await request(app).post(`/api/v1/returns/${ret.returnId}/appeal`)
      .set('Authorization', `Bearer ${buyer.accessToken}`).send({ reason: 'Please review' });
    const otherSeller = await createTestUser('SELLER', { onboarded: true });
    const path = `/api/v1/seller/returns/${ret.returnId}/decision`;
    expect((await request(app).post(path).set('Authorization', `Bearer ${otherSeller.accessToken}`)
      .send({ decision: 'APPROVED', reason: 'Looks fine' })).status).toBe(403);
    expect((await request(app).post(path).set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ decision: 'REJECTED', reason: '  ' })).status).toBe(400);
    expect((await prisma.return.findUniqueOrThrow({ where: { returnId: ret.returnId } })).status)
      .toBe('UNDER_DISPUTE');
  });

  it('accepts only one concurrent seller decision on an appeal', async () => {
    const { seller, buyer, ret } = await createReturnFixture('REJECTED');
    await request(app).post(`/api/v1/returns/${ret.returnId}/appeal`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ reason: 'Please reconsider the listed photos' });
    const path = `/api/v1/seller/returns/${ret.returnId}/decision`;
    const decide = (decision: 'APPROVED' | 'REJECTED') => request(app).post(path)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ decision, reason: `Seller decision: ${decision}` });
    const responses = await Promise.all([decide('APPROVED'), decide('REJECTED')]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 422]);
    const saved = await prisma.return.findUniqueOrThrow({ where: { returnId: ret.returnId },
      include: { dispute: true } });
    expect(saved.dispute?.status).toMatch(/^RESOLVED_/);
    expect(await prisma.auditLog.count({ where: { entity: 'returns', entityId: ret.returnId,
      action: 'DISPUTE_RESOLVE' } })).toBe(1);
  });
});

describe('GET /api/v1/admin/returns (Task 5.1)', () => {
  it('lists MANUAL_REVIEW and UNDER_DISPUTE cases; Support gets read access', async () => {
    await createReturnFixture('MANUAL_REVIEW');
    await createReturnFixture('UNDER_DISPUTE');
    const support = await createTestUser('SUPPORT');

    const res = await request(app).get('/api/v1/admin/returns').set('Authorization', `Bearer ${support.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
  });

  it('rejects a Buyer/Seller with 403', async () => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app).get('/api/v1/admin/returns').set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/admin/returns/:id/decision (Task 5.3/5.4/5.5/5.6)', () => {
  it('reason is always mandatory — missing reason is 400 even for APPROVED', async () => {
    const { ret } = await createReturnFixture('UNDER_DISPUTE');
    const admin = await createTestUser('ADMIN');
    const res = await request(app)
      .post(`/api/v1/admin/returns/${ret.returnId}/decision`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ decision: 'APPROVED' });
    expect(res.status).toBe(400);
  });

  it('Support cannot write a decision (read-only) — 403', async () => {
    const { ret } = await createReturnFixture('UNDER_DISPUTE');
    const support = await createTestUser('SUPPORT');
    const res = await request(app)
      .post(`/api/v1/admin/returns/${ret.returnId}/decision`)
      .set('Authorization', `Bearer ${support.accessToken}`)
      .send({ decision: 'APPROVED', reason: 'Evidence supports buyer' });
    expect(res.status).toBe(403);
  });

  it('approving a disputed COD return resolves the dispute but does not claim an unsupported refund was issued', async () => {
    const { seller, buyer, ret } = await createReturnFixture('UNDER_DISPUTE');
    const admin = await createTestUser('ADMIN');

    const res = await request(app)
      .post(`/api/v1/admin/returns/${ret.returnId}/decision`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ decision: 'APPROVED', reason: 'Buyer evidence is convincing' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.decisionSource).toBe('ADMIN');

    const dispute = await prisma.dispute.findUniqueOrThrow({ where: { returnId: ret.returnId } });
    expect(dispute.status).toBe('RESOLVED_APPROVED');
    expect(dispute.resolvedBy).toBe(admin.userId);
    expect(dispute.resolvedAt).not.toBeNull();

    const decisionCalls = queueAddSpy.mock.calls.filter(
      (call) => call[1] && (call[1] as { type?: string }).type === 'RETURN_DECISION',
    );
    const recipients = decisionCalls.map((call) => (call[1] as { userId?: string }).userId);
    expect(recipients).toEqual(expect.arrayContaining([buyer.userId.toString(), seller.userId.toString()]));
    expect(queueAddSpy.mock.calls.some((call) => call[1] && (call[1] as { type?: string }).type === 'REFUND_ISSUED')).toBe(false);
  });

  it('rejecting a disputed case resolves the dispute RESOLVED_REJECTED and closes the return (dispute + return consistent in one transaction)', async () => {
    const { ret } = await createReturnFixture('UNDER_DISPUTE');
    const admin = await createTestUser('ADMIN');

    const res = await request(app)
      .post(`/api/v1/admin/returns/${ret.returnId}/decision`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ decision: 'REJECTED', reason: 'Insufficient evidence' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CLOSED');
    expect(res.body.data.decisionReason).toBe('Insufficient evidence');

    const dispute = await prisma.dispute.findUniqueOrThrow({ where: { returnId: ret.returnId } });
    expect(dispute.status).toBe('RESOLVED_REJECTED');
  });

  it('rejecting a plain MANUAL_REVIEW case (no dispute) is still final — admin decision always closes on reject (BR-008)', async () => {
    const { ret } = await createReturnFixture('MANUAL_REVIEW');
    const admin = await createTestUser('ADMIN');

    const res = await request(app)
      .post(`/api/v1/admin/returns/${ret.returnId}/decision`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ decision: 'REJECTED', reason: 'Not eligible per policy' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CLOSED');
    expect(res.body.data.decisionReason).toBe('Not eligible per policy');
  });

  it('every admin decision writes exactly one audit_logs row (action=DISPUTE_RESOLVE)', async () => {
    const { ret } = await createReturnFixture('UNDER_DISPUTE');
    const admin = await createTestUser('ADMIN');

    await request(app)
      .post(`/api/v1/admin/returns/${ret.returnId}/decision`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ decision: 'REJECTED', reason: 'Final call' });

    const auditRows = await prisma.auditLog.findMany({ where: { entity: 'returns', entityId: ret.returnId } });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.action).toBe('DISPUTE_RESOLVE');
    expect(auditRows[0]?.actorId).toBe(admin.userId);
    expect(auditRows[0]?.reason).toBe('Final call');
  });

  it('rejects a decision on a return already CLOSED with 422', async () => {
    const { ret } = await createReturnFixture('MANUAL_REVIEW');
    await prisma.return.update({ where: { returnId: ret.returnId }, data: { status: 'CLOSED' } });
    const admin = await createTestUser('ADMIN');

    const res = await request(app)
      .post(`/api/v1/admin/returns/${ret.returnId}/decision`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ decision: 'APPROVED', reason: 'x' });
    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/admin/returns/:id (Task 5.2 — includes audit trail)', () => {
  it("includes the case's audit trail entries", async () => {
    const { ret } = await createReturnFixture('UNDER_DISPUTE');
    const admin = await createTestUser('ADMIN');
    await request(app)
      .post(`/api/v1/admin/returns/${ret.returnId}/decision`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ decision: 'REJECTED', reason: 'Documented reason' });

    const res = await request(app).get(`/api/v1/admin/returns/${ret.returnId}`).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.auditTrail).toHaveLength(1);
    expect(res.body.data.auditTrail[0].reason).toBe('Documented reason');
  });
});
