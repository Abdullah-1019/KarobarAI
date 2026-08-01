import { Queue } from 'bullmq';
import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import * as orderService from '../../src/modules/order/order.service';
import { createTestOrder, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

// Task 7's courier hand-off is a generic enqueue with no consumer this feature — mocked exactly
// like MockPaymentAdapter.prototype.charge is mocked for checkout, so confirmPayment tests never
// depend on a live queue being drained by anything.
const queueAddSpy = jest.spyOn(Queue.prototype, 'add').mockResolvedValue({} as never);

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  queueAddSpy.mockClear();
});

afterAll(async () => {
  await orderService.closeCourierHandoffQueue();
  await prisma.$disconnect();
  await redis.quit();
  queueAddSpy.mockRestore();
});

describe('transitionOrderStatus (Task 6 — the single write-path, adversarial)', () => {
  it('rejects an invalid transition with 422 INVALID_STATUS_TRANSITION, leaves status untouched', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PAYMENT_PENDING' });

    await expect(
      orderService.transitionOrderStatus(order.orderId, 'DELIVERED', 'system'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'INVALID_STATUS_TRANSITION' });

    const row = await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } });
    expect(row.status).toBe('PAYMENT_PENDING');
  });

  it('rejects transitioning out of a terminal status', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'CANCELLED' });

    await expect(
      orderService.transitionOrderStatus(order.orderId, 'PROCESSING', 'system'),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
  });

  it('a valid transition writes the new status and appends a tracking_events row', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING' });

    await orderService.transitionOrderStatus(order.orderId, 'PICKED_UP', 'system', 'Courier picked up');

    const row = await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } });
    expect(row.status).toBe('PICKED_UP');
    const events = await prisma.trackingEvent.findMany({ where: { orderId: order.orderId } });
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe('PICKED_UP');
    expect(events[0]?.description).toBe('Courier picked up');
  });

  it('CANCELLED restores stock for every item (Gap #3, reuses restoreStock)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { stock: 5 });
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING', quantity: 3 });

    await orderService.transitionOrderStatus(order.orderId, 'CANCELLED', 'system');

    const productRow = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(productRow.stock).toBe(8); // 5 + 3 restored
  });

  it('DELIVERED on a COD order confirms the payment as a side effect (Gap #4)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'OUT_FOR_DELIVERY',
      paymentMethod: 'COD',
    });

    await orderService.transitionOrderStatus(order.orderId, 'DELIVERED', 'system');

    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: order.orderId } });
    expect(payment.status).toBe('CONFIRMED');
    expect(payment.confirmedAt).not.toBeNull();
    const row = await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } });
    expect(row.deliveredAt).not.toBeNull();
  });

  it('DELIVERED on a non-COD order does not touch the payment row', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'OUT_FOR_DELIVERY',
      paymentMethod: 'JAZZCASH',
    });

    await orderService.transitionOrderStatus(order.orderId, 'DELIVERED', 'system');

    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: order.orderId } });
    expect(payment.status).toBe('PENDING');
  });
});

describe('confirmPayment (Gap #1 — this feature owns the transition, not the trigger)', () => {
  it('transitions to PAYMENT_CONFIRMED and enqueues the generic courier hand-off job', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PAYMENT_PENDING' });

    await orderService.confirmPayment(order.orderId);

    const row = await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } });
    expect(row.status).toBe('PAYMENT_CONFIRMED');
    expect(queueAddSpy).toHaveBeenCalledTimes(1);
    expect(queueAddSpy).toHaveBeenCalledWith('assign', { orderId: order.orderId.toString() });
  });
});

describe('POST /api/v1/orders/:id/cancel (Gap #3 — seller-only manual cancellation)', () => {
  it('the owning seller can cancel from a pre-shipment status; stock is restored', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { stock: 5 });
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING', quantity: 2 });

    const res = await request(app)
      .post(`/api/v1/orders/${order.publicId}/cancel`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
    const productRow = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(productRow.stock).toBe(7);
  });

  it('rejects cancelling a post-shipment order with 422 ORDER_NOT_CANCELLABLE', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'IN_TRANSIT' });

    const res = await request(app)
      .post(`/api/v1/orders/${order.publicId}/cancel`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ORDER_NOT_CANCELLABLE');
  });

  it("rejects a non-owning seller's cancel attempt with 403 ORDER_NOT_OWNED", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const otherSeller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING' });

    const res = await request(app)
      .post(`/api/v1/orders/${order.publicId}/cancel`)
      .set('Authorization', `Bearer ${otherSeller.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORDER_NOT_OWNED');
  });

  it('rejects a Buyer attempting to cancel (seller-only action) with 403', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING' });

    const res = await request(app)
      .post(`/api/v1/orders/${order.publicId}/cancel`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a nonexistent order id', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app)
      .post('/api/v1/orders/00000000-0000-0000-0000-000000000000/cancel')
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(404);
  });
});
