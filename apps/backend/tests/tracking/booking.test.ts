process.env.COURIER_RETRY_DELAY_MS = '5'; // real 30s default would make retry/fallback tests take 90s+; shrunk for this file only

import { Queue } from 'bullmq';
import request from 'supertest';

import { MockCourierAdapter } from '../../src/adapters/courier/mock';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import * as trackingService from '../../src/modules/tracking/tracking.service';
import { createTestOrder, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const bookSpy = jest.spyOn(MockCourierAdapter.prototype, 'book');
const notificationQueueAddSpy = jest.spyOn(Queue.prototype, 'add');

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  bookSpy.mockClear();
  notificationQueueAddSpy.mockClear();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
  bookSpy.mockRestore();
  notificationQueueAddSpy.mockRestore();
});

async function setUpScoredOrder(overrides: Parameters<typeof createTestOrder>[3] = {}) {
  const seller = await createTestUser('SELLER', { onboarded: true });
  const buyer = await createTestUser('BUYER');
  const product = await createTestProduct(seller.userId);
  const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PAYMENT_CONFIRMED', ...overrides });
  await trackingService.initializeShipment(order.orderId);
  const quotes = await prisma.courierQuote.findMany({ where: { orderId: order.orderId }, orderBy: { score: 'desc' } });
  return { seller, buyer, product, order, quotes };
}

describe('POST /api/v1/orders/:id/book-courier (Task 4 — happy path + override)', () => {
  it('booking the top-scored courier succeeds: status -> PROCESSING, courier/tracking_no set, not flagged as override', async () => {
    const { seller, order, quotes } = await setUpScoredOrder();
    const topScored = quotes[0]!.courier;

    const res = await request(app)
      .post(`/api/v1/orders/${order.publicId}/book-courier`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ courierCode: topScored });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PROCESSING');

    const row = await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } });
    expect(row.courier).toBe(topScored);
    expect(row.trackingNo).toMatch(new RegExp(`^MOCK-${topScored}-`));
    expect(row.courierOverridden).toBe(false);

    const selectedQuote = await prisma.courierQuote.findFirst({ where: { orderId: order.orderId, courier: topScored } });
    expect(selectedQuote?.selected).toBe(true);
  });

  it('booking a non-top-scored courier succeeds and sets courier_overridden=true (Task 4.6)', async () => {
    const { seller, order, quotes } = await setUpScoredOrder();
    const overrideChoice = quotes[quotes.length - 1]!.courier; // the lowest-ranked candidate

    const res = await request(app)
      .post(`/api/v1/orders/${order.publicId}/book-courier`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ courierCode: overrideChoice });

    expect(res.status).toBe(200);
    const row = await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } });
    expect(row.courier).toBe(overrideChoice);
    expect(row.courierOverridden).toBe(true);
  });

  it('rejects an unscored courier selection with 422 INVALID_COURIER_SELECTION', async () => {
    const { seller, order } = await setUpScoredOrder({ shipCity: 'Peshawar', paymentMethod: 'COD' }); // TRAX excluded here
    const res = await request(app)
      .post(`/api/v1/orders/${order.publicId}/book-courier`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ courierCode: 'TRAX' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_COURIER_SELECTION');
  });
});

describe('POST /api/v1/orders/:id/book-courier (Task 4.2/4.3 — retry then fallback)', () => {
  it('a courier failing all 3 attempts falls back to the next-best-scored courier, and booking still succeeds', async () => {
    const { seller, order, quotes } = await setUpScoredOrder();
    const topScored = quotes[0]!.courier;
    const secondBest = quotes[1]!.courier;

    bookSpy
      .mockRejectedValueOnce(new Error('courier down'))
      .mockRejectedValueOnce(new Error('courier down'))
      .mockRejectedValueOnce(new Error('courier down'));

    const res = await request(app)
      .post(`/api/v1/orders/${order.publicId}/book-courier`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ courierCode: topScored });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PROCESSING');
    expect(bookSpy).toHaveBeenCalledTimes(4); // 3 failed attempts against topScored + 1 succeeding against secondBest

    const row = await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } });
    expect(row.courier).toBe(secondBest);
  }, 15000);

  it('every courier exhausting retries lands the order in PENDING_MANUAL_LOGISTICS and enqueues a seller notification', async () => {
    const { seller, order } = await setUpScoredOrder();
    bookSpy.mockRejectedValue(new Error('all couriers down'));

    const res = await request(app)
      .post(`/api/v1/orders/${order.publicId}/book-courier`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ courierCode: 'TCS' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PENDING_MANUAL_LOGISTICS');
    expect(bookSpy).toHaveBeenCalledTimes(9); // 3 couriers x 3 attempts each

    const row = await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } });
    expect(row.courier).toBeNull();

    const notifyCalls = notificationQueueAddSpy.mock.calls.filter((call) => call[1] && (call[1] as { type?: string }).type === 'COURIER_MANUAL_LOGISTICS');
    expect(notifyCalls).toHaveLength(1);
  }, 15000);
});

describe('POST /api/v1/orders/:id/book-courier (Task 4.1 — guards + ownership)', () => {
  it('rejects booking an already-booked order with 409', async () => {
    const { seller, order } = await setUpScoredOrder();
    await prisma.order.update({ where: { orderId: order.orderId }, data: { courier: 'TCS', trackingNo: 'TRK-1' } });

    const res = await request(app)
      .post(`/api/v1/orders/${order.publicId}/book-courier`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ courierCode: 'TCS' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COURIER_ALREADY_BOOKED');
  });

  it('rejects booking an order that is not PAYMENT_CONFIRMED with 422', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PAYMENT_PENDING' });

    const res = await request(app)
      .post(`/api/v1/orders/${order.publicId}/book-courier`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ courierCode: 'TCS' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ORDER_NOT_COURIER_ELIGIBLE');
  });

  it("rejects a non-owning seller's booking attempt with 403", async () => {
    const { order, quotes } = await setUpScoredOrder();
    const otherSeller = await createTestUser('SELLER', { onboarded: true });

    const res = await request(app)
      .post(`/api/v1/orders/${order.publicId}/book-courier`)
      .set('Authorization', `Bearer ${otherSeller.accessToken}`)
      .send({ courierCode: quotes[0]!.courier });

    expect(res.status).toBe(403);
  });

  it('rejects a Buyer attempting to book (Seller-only route) with 403', async () => {
    const { buyer, order } = await setUpScoredOrder();
    const res = await request(app)
      .post(`/api/v1/orders/${order.publicId}/book-courier`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ courierCode: 'TCS' });
    expect(res.status).toBe(403);
  });
});
