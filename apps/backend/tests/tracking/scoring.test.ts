import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import * as trackingService from '../../src/modules/tracking/tracking.service';
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

describe('initializeShipment / scoreCouriers (Task 2/3 — courier scoring)', () => {
  it('a COD order to a city where only 2/3 couriers support COD scores exactly those 2', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'PAYMENT_CONFIRMED',
      paymentMethod: 'COD',
      shipCity: 'Peshawar', // TRAX excludes COD here (mock), LEOPARDS/TCS don't
    });

    await trackingService.initializeShipment(order.orderId);

    const quotes = await prisma.courierQuote.findMany({ where: { orderId: order.orderId } });
    expect(quotes).toHaveLength(2);
    expect(new Set(quotes.map((q) => q.courier))).toEqual(new Set(['TCS', 'LEOPARDS']));
  });

  it('a courier with a general (non-COD-specific) coverage gap is excluded regardless of payment method', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'PAYMENT_CONFIRMED',
      paymentMethod: 'JAZZCASH',
      shipCity: 'Gilgit', // LEOPARDS doesn't serve Gilgit at all (mock)
    });

    await trackingService.initializeShipment(order.orderId);

    const quotes = await prisma.courierQuote.findMany({ where: { orderId: order.orderId } });
    expect(quotes).toHaveLength(2);
    expect(new Set(quotes.map((q) => q.courier))).toEqual(new Set(['TCS', 'TRAX']));
  });

  it('scoring is config-driven: changing platform_config.courier_weights changes the top-scored courier without a code deploy', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'PAYMENT_CONFIRMED',
      paymentMethod: 'JAZZCASH',
    });

    await prisma.platformConfig.update({
      where: { configKey: 'courier_weights' },
      data: { value: { cost: 1, time: 0, reliability: 0, coverage: 0 } },
    });

    await trackingService.initializeShipment(order.orderId);

    const quotes = await prisma.courierQuote.findMany({ where: { orderId: order.orderId }, orderBy: { score: 'desc' } });
    // TRAX is cheapest (100 PKR mock) — with cost weighted at 100%, it must rank first.
    expect(quotes[0]?.courier).toBe('TRAX');
  });

  it('is idempotent: re-processing an already-scored order does not create duplicate courier_quotes rows (Gap #2)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'PAYMENT_CONFIRMED',
      paymentMethod: 'JAZZCASH',
    });

    await trackingService.initializeShipment(order.orderId);
    await trackingService.initializeShipment(order.orderId); // simulated BullMQ redelivery

    const quotes = await prisma.courierQuote.findMany({ where: { orderId: order.orderId } });
    expect(quotes).toHaveLength(3); // TCS + LEOPARDS + TRAX, not 6
  });

  it('is a no-op for an order not yet PAYMENT_CONFIRMED', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PAYMENT_PENDING' });

    await trackingService.initializeShipment(order.orderId);

    const quotes = await prisma.courierQuote.findMany({ where: { orderId: order.orderId } });
    expect(quotes).toHaveLength(0);
  });

  it('is a no-op for an order that already has a booked courier', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'PAYMENT_CONFIRMED',
      courier: 'TCS',
      trackingNo: 'ALREADY-BOOKED-123',
    });

    await trackingService.initializeShipment(order.orderId);

    const quotes = await prisma.courierQuote.findMany({ where: { orderId: order.orderId } });
    expect(quotes).toHaveLength(0);
  });
});

describe('GET /api/v1/orders/:id/courier-quotes (Task 3.5)', () => {
  it("returns the seller's scored, ranked list", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PAYMENT_CONFIRMED' });
    await trackingService.initializeShipment(order.orderId);

    const res = await request(app)
      .get(`/api/v1/orders/${order.publicId}/courier-quotes`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.quotes).toHaveLength(3);
    const scores = res.body.data.quotes.map((q: { score: string }) => Number(q.score));
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('returns 422 COURIER_QUOTES_NOT_READY before scoring has happened', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PAYMENT_CONFIRMED' });

    const res = await request(app)
      .get(`/api/v1/orders/${order.publicId}/courier-quotes`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('COURIER_QUOTES_NOT_READY');
  });

  it("rejects a non-owning seller's request with 403", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const otherSeller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PAYMENT_CONFIRMED' });
    await trackingService.initializeShipment(order.orderId);

    const res = await request(app)
      .get(`/api/v1/orders/${order.publicId}/courier-quotes`)
      .set('Authorization', `Bearer ${otherSeller.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('rejects a Buyer with 403 (Seller-only route)', async () => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app)
      .get('/api/v1/orders/00000000-0000-0000-0000-000000000000/courier-quotes')
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/orders/00000000-0000-0000-0000-000000000000/courier-quotes');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/orders/:id/refresh-rates (Task 3.7)', () => {
  it('re-scores and replaces the existing courier_quotes rows, not appends', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PAYMENT_CONFIRMED' });
    await trackingService.initializeShipment(order.orderId);

    const res = await request(app)
      .post(`/api/v1/orders/${order.publicId}/refresh-rates`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.quotes).toHaveLength(3);
    const quotes = await prisma.courierQuote.findMany({ where: { orderId: order.orderId } });
    expect(quotes).toHaveLength(3); // replaced, not doubled to 6
  });

  it('rejects refreshing an already-booked order with 422', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'PROCESSING',
      courier: 'TCS',
      trackingNo: 'TRK-1',
    });

    const res = await request(app)
      .post(`/api/v1/orders/${order.publicId}/refresh-rates`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ORDER_NOT_COURIER_ELIGIBLE');
  });
});
