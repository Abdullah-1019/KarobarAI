import request from 'supertest';

import { MockCourierAdapter } from '../../src/adapters/courier/mock';
import { app } from '../../src/server';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { closeNotificationQueue } from '../../src/modules/notification';
import { pollSimulatedReturnShipments } from '../../src/modules/returns/return-fulfillment.service';
import { createTestOrder, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});
afterAll(async () => {
  await closeNotificationQueue();
  await prisma.$disconnect();
  await redis.quit();
});

async function fixture() {
  const seller = await createTestUser('SELLER', { onboarded: true });
  const otherSeller = await createTestUser('SELLER', { onboarded: true });
  const buyer = await createTestUser('BUYER');
  const otherBuyer = await createTestUser('BUYER');
  const admin = await createTestUser('ADMIN');
  const product = await createTestProduct(seller.userId, { stock: 6, status: 'LIVE' });
  const order = await createTestOrder(buyer.userId, seller.userId, product, {
    status: 'DELIVERED',
    deliveredAt: new Date(),
    courier: 'TCS',
    trackingNo: 'OUTBOUND-ONLY',
  });
  const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.orderId } });
  const ret = await prisma.return.create({
    data: {
      orderId: order.orderId,
      orderItemId: orderItem.orderItemId,
      sellerId: seller.userId,
      reason: 'DAMAGED',
      status: 'APPROVED',
      decision: 'APPROVED',
      fulfillment: { create: {} },
    },
  });
  return { seller, otherSeller, buyer, otherBuyer, admin, product, order, orderItem, ret };
}

async function advanceToDelivery(id: bigint, leg: 'RETURN' | 'REPLACEMENT') {
  for (const status of ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
    await pollSimulatedReturnShipments();
    const shipment = await prisma.returnShipment.findUniqueOrThrow({ where: {
      returnId_leg: { returnId: id, leg },
    } });
    expect(shipment.status).toBe(status);
  }
}

it('seller can book a distinct simulated return leg; replacement completes only after buyer receipt', async () => {
  const { seller, otherSeller, buyer, otherBuyer, admin, product, order, orderItem, ret } = await fixture();
  const path = `/api/v1/seller/returns/${ret.returnId}/book-return-courier`;
  const denied = await request(app).post(path).set('Authorization', `Bearer ${otherSeller.accessToken}`);
  expect(denied.status).toBe(403);
  const booked = await request(app).post(path).set('Authorization', `Bearer ${seller.accessToken}`);
  expect(booked.status).toBe(200);
  expect(booked.body.data.status).toBe('PICKUP_BOOKED');
  expect(booked.body.data.shipments[0]).toMatchObject({
    leg: 'RETURN',
    simulated: true,
    courier: 'TCS',
    status: 'BOOKED',
  });
  expect(booked.body.data.returnShipping.estimatedDeliveryAt).toBeTruthy();
  expect(booked.body.data.shipments[0].estimatedDeliveryAt).toBeTruthy();
  expect(booked.body.data.shipments[0].trackingNumber).not.toBe(order.trackingNo);
  expect(
    (await request(app).post(path).set('Authorization', `Bearer ${seller.accessToken}`)).status,
  ).toBe(200);
  expect(
    await prisma.returnShipment.count({ where: { returnId: ret.returnId, leg: 'RETURN' } }),
  ).toBe(1);
  expect(
    (
      await request(app)
        .post(`/api/v1/seller/returns/${ret.returnId}/confirm-receipt`)
        .set('Authorization', `Bearer ${seller.accessToken}`)
        .send({ condition: 'RESELLABLE' })
    ).status,
  ).toBe(422);
  await advanceToDelivery(ret.returnId, 'RETURN');
  expect(
    (
      await request(app)
        .post(`/api/v1/seller/returns/${ret.returnId}/confirm-receipt`)
        .set('Authorization', `Bearer ${otherSeller.accessToken}`)
        .send({ condition: 'RESELLABLE' })
    ).status,
  ).toBe(403);
  const stockBefore = (
    await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } })
  ).stock;
  const received = await request(app)
    .post(`/api/v1/seller/returns/${ret.returnId}/confirm-receipt`)
    .set('Authorization', `Bearer ${seller.accessToken}`)
    .send({ condition: 'RESELLABLE' });
  expect(received.status).toBe(200);
  expect(received.body.data.fulfillment.status).toBe('REPLACEMENT_PENDING');
  expect(
    (await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } })).stock,
  ).toBe(stockBefore + orderItem.quantity);
  expect(
    (
      await request(app)
        .post(`/api/v1/seller/returns/${ret.returnId}/confirm-receipt`)
        .set('Authorization', `Bearer ${seller.accessToken}`)
        .send({ condition: 'RESELLABLE' })
    ).status,
  ).toBe(422);
  expect(
    (await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } })).stock,
  ).toBe(stockBefore + orderItem.quantity);
  const reserved = await request(app)
    .post(`/api/v1/seller/returns/${ret.returnId}/replacement`)
    .set('Authorization', `Bearer ${seller.accessToken}`)
    .send({ productId: product.publicId });
  expect(reserved.status).toBe(200);
  expect((await request(app).post(`/api/v1/returns/${ret.returnId}/exchange-feedback`)
    .set('Authorization', `Bearer ${buyer.accessToken}`).send({ rating: 5 })).status).toBe(422);
  expect(
    (await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } })).stock,
  ).toBe(stockBefore);
  expect((await request(app).post(`/api/v1/seller/returns/${ret.returnId}/book-replacement`)
    .set('Authorization', `Bearer ${seller.accessToken}`)).status).toBe(422);
  expect((await request(app).post(`/api/v1/seller/returns/${ret.returnId}/replacement/pack`)
    .set('Authorization', `Bearer ${otherSeller.accessToken}`)).status).toBe(403);
  const packed = await request(app)
    .post(`/api/v1/seller/returns/${ret.returnId}/replacement/pack`)
    .set('Authorization', `Bearer ${seller.accessToken}`);
  expect(packed.status).toBe(200);
  expect(packed.body.data.fulfillment.status).toBe('REPLACEMENT_PACKED');
  expect(packed.body.data.fulfillment.replacementPackedAt).toBeTruthy();
  expect((await request(app).post(`/api/v1/seller/returns/${ret.returnId}/replacement/pack`)
    .set('Authorization', `Bearer ${seller.accessToken}`)).status).toBe(409);
  const replacement = await request(app)
    .post(`/api/v1/seller/returns/${ret.returnId}/book-replacement`)
    .set('Authorization', `Bearer ${seller.accessToken}`);
  expect(replacement.status).toBe(200);
  expect(replacement.body.data.shipments).toHaveLength(2);
  await advanceToDelivery(ret.returnId, 'REPLACEMENT');
  expect(
    (await prisma.returnFulfillment.findUniqueOrThrow({ where: { returnId: ret.returnId } }))
      .status,
  ).toBe('REPLACEMENT_DELIVERED');
  expect(
    (await prisma.orderItem.findUniqueOrThrow({ where: { orderItemId: orderItem.orderItemId } }))
      .resolution,
  ).toBe('RETURNED');
  const confirmed = await request(app)
    .post(`/api/v1/returns/${ret.returnId}/replacement/confirm-receipt`)
    .set('Authorization', `Bearer ${buyer.accessToken}`);
  expect(confirmed.status).toBe(200);
  expect(confirmed.body.data.fulfillment.status).toBe('EXCHANGE_COMPLETED');
  expect((await prisma.orderItem.findUniqueOrThrow({ where: { orderItemId: orderItem.orderItemId } })).resolution)
    .toBe('EXCHANGED');
  expect(
    (await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } })).trackingNo,
  ).toBe('OUTBOUND-ONLY');
  const buyerDetail = await request(app)
    .get(`/api/v1/returns/${ret.returnId}`)
    .set('Authorization', `Bearer ${buyer.accessToken}`);
  expect(buyerDetail.body.data.fulfillment.status).toBe('EXCHANGE_COMPLETED');
  const feedbackPath = `/api/v1/returns/${ret.returnId}/exchange-feedback`;
  expect((await request(app).post(feedbackPath).set('Authorization', `Bearer ${otherBuyer.accessToken}`)
    .send({ rating: 5 })).status).toBe(403);
  expect((await request(app).post(feedbackPath).set('Authorization', `Bearer ${buyer.accessToken}`)
    .send({ rating: 6 })).status).toBe(400);
  const feedback = await request(app).post(feedbackPath)
    .set('Authorization', `Bearer ${buyer.accessToken}`)
    .send({ rating: 5, comment: 'Replacement arrived as described' });
  expect(feedback.status).toBe(200);
  expect(feedback.body.data.exchangeFeedback).toEqual({ rating: 5,
    comment: 'Replacement arrived as described' });
  const refreshed = await request(app).get(`/api/v1/returns/${ret.returnId}`)
    .set('Authorization', `Bearer ${buyer.accessToken}`);
  expect(refreshed.body.data.exchangeFeedback).toEqual(feedback.body.data.exchangeFeedback);
  expect((await request(app).post(feedbackPath).set('Authorization', `Bearer ${buyer.accessToken}`)
    .send({ rating: 5 })).status).toBe(409);
  expect(await prisma.review.count({ where: { buyerId: buyer.userId, productId: product.productId } })).toBe(1);
});

it('damaged receipt never increases sellable stock; refund requires buyer consent and never calls a gateway', async () => {
  const { seller, buyer, otherBuyer, admin, product, ret } = await fixture();
  await request(app)
    .post(`/api/v1/admin/returns/${ret.returnId}/book-return-courier`)
    .set('Authorization', `Bearer ${admin.accessToken}`);
  await advanceToDelivery(ret.returnId, 'RETURN');
  const stockBefore = (
    await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } })
  ).stock;
  const received = await request(app)
    .post(`/api/v1/seller/returns/${ret.returnId}/confirm-receipt`)
    .set('Authorization', `Bearer ${seller.accessToken}`)
    .send({ condition: 'DAMAGED' });
  expect(received.status).toBe(200);
  expect(
    (await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } })).stock,
  ).toBe(stockBefore);
  const proposalPath = `/api/v1/seller/returns/${ret.returnId}/refund-proposal`;
  expect(
    (
      await request(app)
        .post(proposalPath)
        .set('Authorization', `Bearer ${seller.accessToken}`)
        .send({ reason: '  ' })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .post(proposalPath)
        .set('Authorization', `Bearer ${seller.accessToken}`)
        .send({ reason: 'Replacement unavailable' })
    ).status,
  ).toBe(200);
  const responsePath = `/api/v1/returns/${ret.returnId}/refund-proposal/respond`;
  expect(
    (
      await request(app)
        .post(responsePath)
        .set('Authorization', `Bearer ${otherBuyer.accessToken}`)
        .send({ accept: true })
    ).status,
  ).toBe(403);
  const consented = await request(app)
    .post(responsePath)
    .set('Authorization', `Bearer ${buyer.accessToken}`)
    .send({ accept: true });
  expect(consented.status).toBe(200);
  expect(consented.body.data.fulfillment.refundProposalStatus).toBe('ACCEPTED');
  expect(consented.body.data.refundStatus).toBe('NOT_ISSUED');
  expect(
    (
      await request(app)
        .post(responsePath)
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .send({ accept: true })
    ).status,
  ).toBe(409);
  expect(await prisma.payment.count({ where: { status: 'REFUNDED' } })).toBe(0);
});

it('a declined refund proposal resumes the exchange path without a payment reversal', async () => {
  const { seller, buyer, admin, product, ret } = await fixture();
  await request(app)
    .post(`/api/v1/admin/returns/${ret.returnId}/book-return-courier`)
    .set('Authorization', `Bearer ${admin.accessToken}`);
  await advanceToDelivery(ret.returnId, 'RETURN');
  await request(app)
    .post(`/api/v1/seller/returns/${ret.returnId}/confirm-receipt`)
    .set('Authorization', `Bearer ${seller.accessToken}`)
    .send({ condition: 'DAMAGED' });
  await request(app)
    .post(`/api/v1/seller/returns/${ret.returnId}/refund-proposal`)
    .set('Authorization', `Bearer ${seller.accessToken}`)
    .send({ reason: 'Proposed alternative' });
  const declined = await request(app)
    .post(`/api/v1/returns/${ret.returnId}/refund-proposal/respond`)
    .set('Authorization', `Bearer ${buyer.accessToken}`)
    .send({ accept: false });
  expect(declined.status).toBe(200);
  expect(declined.body.data.fulfillment.status).toBe('REFUND_DECLINED');
  const replacement = await request(app)
    .post(`/api/v1/seller/returns/${ret.returnId}/replacement`)
    .set('Authorization', `Bearer ${seller.accessToken}`)
    .send({ productId: product.publicId });
  expect(replacement.status).toBe(200);
  expect(replacement.body.data.fulfillment.status).toBe('REPLACEMENT_PENDING');
  expect(replacement.body.data.fulfillment.refundProposalStatus).toBe('DECLINED');
  expect(await prisma.payment.count({ where: { status: 'REFUNDED' } })).toBe(0);
});

it('concurrent booking clicks create only one return shipment and one mock booking', async () => {
  const { admin, ret } = await fixture();
  const book = jest.spyOn(MockCourierAdapter.prototype, 'book');
  try {
    const path = `/api/v1/admin/returns/${ret.returnId}/book-return-courier`;
    const results = await Promise.all([
      request(app).post(path).set('Authorization', `Bearer ${admin.accessToken}`),
      request(app).post(path).set('Authorization', `Bearer ${admin.accessToken}`),
    ]);
    expect(results.some((result) => result.status === 200)).toBe(true);
    expect(results.every((result) => [200, 409].includes(result.status))).toBe(true);
    expect(book).toHaveBeenCalledTimes(1);
    expect(
      await prisma.returnShipment.count({ where: { returnId: ret.returnId, leg: 'RETURN' } }),
    ).toBe(1);
  } finally {
    book.mockRestore();
  }
});

it('an ineligible original courier is skipped and only the scored eligible winner is booked', async () => {
  const { admin, ret } = await fixture();
  const coverage = jest.spyOn(MockCourierAdapter.prototype, 'checkCoverage');
  const original = coverage.getMockImplementation();
  const book = jest.spyOn(MockCourierAdapter.prototype, 'book');
  coverage.mockImplementation(async (params) =>
    params.courier === 'TCS'
      ? { covered: false }
      : original!.call(new MockCourierAdapter(), params),
  );
  try {
    const result = await request(app)
      .post(`/api/v1/admin/returns/${ret.returnId}/book-return-courier`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(result.status).toBe(200);
    expect(result.body.data.shipments[0].courier).not.toBe('TCS');
    expect(book).toHaveBeenCalledTimes(1);
    expect(book.mock.calls[0]?.[0].courier).toBe(result.body.data.shipments[0].courier);
  } finally {
    coverage.mockRestore();
    book.mockRestore();
  }
});

it('no eligible mock quote leaves the return accepted with no booking', async () => {
  const { admin, ret } = await fixture();
  const coverage = jest
    .spyOn(MockCourierAdapter.prototype, 'checkCoverage')
    .mockResolvedValue({ covered: false });
  const book = jest.spyOn(MockCourierAdapter.prototype, 'book');
  try {
    const result = await request(app)
      .post(`/api/v1/admin/returns/${ret.returnId}/book-return-courier`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(result.status).toBe(422);
    expect(result.body.error.code).toBe('NO_VALID_COURIER_QUOTES');
    expect(book).not.toHaveBeenCalled();
    expect(
      (await prisma.return.findUniqueOrThrow({ where: { returnId: ret.returnId } })).status,
    ).toBe('APPROVED');
    expect(
      (
        await prisma.returnShipment.findUniqueOrThrow({
          where: {
            returnId_leg: {
              returnId: ret.returnId,
              leg: 'RETURN',
            },
          },
        })
      ).status,
    ).toBe('FAILED');
  } finally {
    coverage.mockRestore();
    book.mockRestore();
  }
});

it('an uncertain booking outcome is preserved and cannot be retried', async () => {
  const { admin, ret } = await fixture();
  const book = jest
    .spyOn(MockCourierAdapter.prototype, 'book')
    .mockRejectedValue(new Error('confirmation lost'));
  try {
    const path = `/api/v1/admin/returns/${ret.returnId}/book-return-courier`;
    const first = await request(app).post(path).set('Authorization', `Bearer ${admin.accessToken}`);
    const repeat = await request(app)
      .post(path)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(first.status).toBe(409);
    expect(repeat.status).toBe(409);
    expect(book).toHaveBeenCalledTimes(1);
    expect(
      (
        await prisma.returnShipment.findUniqueOrThrow({
          where: {
            returnId_leg: {
              returnId: ret.returnId,
              leg: 'RETURN',
            },
          },
        })
      ).status,
    ).toBe('UNCERTAIN');
  } finally {
    book.mockRestore();
  }
});
