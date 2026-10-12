import request from 'supertest';

import { MockCourierAdapter } from '../../src/adapters/courier/mock';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { pollOneOrder } from '../../src/modules/tracking/tracking.service';
import { createTestOrder, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const bookSpy = jest.spyOn(MockCourierAdapter.prototype, 'book');
const originalGetQuote = MockCourierAdapter.prototype.getQuote;
const quoteSpy = jest.spyOn(MockCourierAdapter.prototype, 'getQuote');

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  bookSpy.mockClear();
  quoteSpy.mockReset();
  quoteSpy.mockImplementation(originalGetQuote);
});

afterAll(async () => {
  bookSpy.mockRestore();
  quoteSpy.mockRestore();
  await prisma.$disconnect();
  await redis.quit();
});

async function scenario(status: 'PAYMENT_CONFIRMED' | 'PAYMENT_PENDING' = 'PAYMENT_CONFIRMED') {
  const seller = await createTestUser('SELLER', { onboarded: true });
  const buyer = await createTestUser('BUYER');
  const product = await createTestProduct(seller.userId);
  const order = await createTestOrder(buyer.userId, seller.userId, product, { status });
  const url = `/api/v1/orders/${order.publicId}/auto-select-courier`;
  return { seller, buyer, order, url };
}

describe('seller-triggered simulated auto selection', () => {
  it('evaluates four providers, books only the computed winner, and persists score and source', async () => {
    const { seller, order, url } = await scenario();
    const response = await request(app).post(url).set('Authorization', `Bearer ${seller.accessToken}`);
    expect(response.status).toBe(200);
    const shipment = await prisma.courierShipment.findUniqueOrThrow({ where: { orderId: order.orderId } });
    const quotes = await prisma.courierQuote.findMany({ where: { orderId: order.orderId, evaluationId: shipment.evaluationId! } });
    expect(quotes).toHaveLength(4);
    expect(new Set(quotes.map(({ courier }) => courier))).toEqual(new Set(['TCS', 'LEOPARDS', 'TRAX', 'POSTEX']));
    expect(quotes.filter(({ selected }) => selected)).toHaveLength(1);
    expect(bookSpy).toHaveBeenCalledTimes(1);
    expect(bookSpy.mock.calls[0]![0].courier).toBe(quotes.find(({ selected }) => selected)!.courier);
    expect(shipment.status).toBe('BOOKED');
    expect(shipment.source).toBe('SIMULATED');
    expect(shipment.bookingReference).toMatch(/^SIM-/);
    expect(response.body.data.shipment.simulated).toBe(true);
    expect((await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } })).status).toBe('PROCESSING');
  });

  it('returns the stored shipment on repeat requests without another booking', async () => {
    const { seller, order, url } = await scenario();
    const auth = `Bearer ${seller.accessToken}`;
    const first = await request(app).post(url).set('Authorization', auth);
    const repeated = await request(app).post(url).set('Authorization', auth);
    expect(first.status).toBe(200);
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.shipment.trackingId).toBe(first.body.data.shipment.trackingId);
    expect(bookSpy).toHaveBeenCalledTimes(1);
    expect(await prisma.courierShipment.count({ where: { orderId: order.orderId } })).toBe(1);
  });

  it('serializes concurrent clicks through the unique shipment claim', async () => {
    const { seller, order, url } = await scenario();
    const auth = `Bearer ${seller.accessToken}`;
    const responses = await Promise.all([
      request(app).post(url).set('Authorization', auth),
      request(app).post(url).set('Authorization', auth),
    ]);
    expect(responses.some((response) => response.status === 200)).toBe(true);
    expect(responses.every((response) => response.status === 200 || response.status === 409)).toBe(true);
    expect(bookSpy).toHaveBeenCalledTimes(1);
    expect(await prisma.courierShipment.count({ where: { orderId: order.orderId } })).toBe(1);
  });

  it('blocks another seller and a buyer before creating quotes or a shipment', async () => {
    const { order, buyer, url } = await scenario();
    const otherSeller = await createTestUser('SELLER', { onboarded: true });
    expect((await request(app).post(url).set('Authorization', `Bearer ${otherSeller.accessToken}`)).status).toBe(403);
    expect((await request(app).post(url).set('Authorization', `Bearer ${buyer.accessToken}`)).status).toBe(403);
    expect(await prisma.courierShipment.count({ where: { orderId: order.orderId } })).toBe(0);
    expect(bookSpy).not.toHaveBeenCalled();
  });

  it('does not intercept the buyer order-detail route mounted at the same prefix', async () => {
    const { buyer, order } = await scenario();
    const response = await request(app).get(`/api/v1/orders/${order.publicId}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(order.publicId);
  });

  it('does not book an order awaiting payment', async () => {
    const { seller, order, url } = await scenario('PAYMENT_PENDING');
    const response = await request(app).post(url).set('Authorization', `Bearer ${seller.accessToken}`);
    expect(response.status).toBe(422);
    expect(await prisma.courierShipment.count({ where: { orderId: order.orderId } })).toBe(0);
    expect(bookSpy).not.toHaveBeenCalled();
  });

  it('does not book a Stripe order with an unconfirmed payment row', async () => {
    const { seller, order, url } = await scenario();
    await prisma.order.update({ where: { orderId: order.orderId }, data: { paymentMethod: 'STRIPE' } });
    await prisma.payment.update({ where: { orderId: order.orderId }, data: { method: 'STRIPE', status: 'PENDING' } });
    const response = await request(app).post(url).set('Authorization', `Bearer ${seller.accessToken}`);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('ORDER_PAYMENT_NOT_CONFIRMED');
    expect(bookSpy).not.toHaveBeenCalled();
  });

  it('uses remaining valid providers when one quote call fails', async () => {
    const { seller, url } = await scenario();
    quoteSpy.mockImplementation(async function (this: MockCourierAdapter, params) {
      if (params.courier === 'TCS') throw new Error('synthetic quote outage');
      return originalGetQuote.call(this, params);
    });
    const response = await request(app).post(url).set('Authorization', `Bearer ${seller.accessToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.quotes).toHaveLength(3);
    expect(response.body.data.quotes.some((quote: { courier: string }) => quote.courier === 'TCS')).toBe(false);
    expect(bookSpy).toHaveBeenCalledTimes(1);
  });

  it('records no-valid-quote failure and never calls booking', async () => {
    const { seller, order, url } = await scenario();
    quoteSpy.mockRejectedValue(new Error('synthetic quote outage'));
    const response = await request(app).post(url).set('Authorization', `Bearer ${seller.accessToken}`);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('NO_VALID_COURIER_QUOTES');
    expect(bookSpy).not.toHaveBeenCalled();
    expect((await prisma.courierShipment.findUniqueOrThrow({ where: { orderId: order.orderId } })).status).toBe('FAILED');
  });

  it('keeps a provider-confirmed booking uncertain when its database write fails', async () => {
    const { seller, order, url } = await scenario();
    bookSpy.mockResolvedValueOnce({ trackingNo: 'X'.repeat(150), bookingReference: 'SIM-oversize' });
    const auth = `Bearer ${seller.accessToken}`;
    const response = await request(app).post(url).set('Authorization', auth);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('COURIER_OUTCOME_UNCERTAIN');
    expect((await prisma.courierShipment.findUniqueOrThrow({ where: { orderId: order.orderId } })).status).toBe('UNCERTAIN');
    expect((await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } })).courier).toBeNull();
    expect((await request(app).post(url).set('Authorization', auth)).status).toBe(409);
    expect(bookSpy).toHaveBeenCalledTimes(1);
  });

  it('blocks cancellation while a booking outcome requires reconciliation', async () => {
    const { seller, order, url } = await scenario();
    bookSpy.mockRejectedValueOnce(new Error('provider reply lost'));
    const auth = `Bearer ${seller.accessToken}`;
    expect((await request(app).post(url).set('Authorization', auth)).status).toBe(409);
    const canceled = await request(app).post(`/api/v1/orders/${order.publicId}/cancel`)
      .set('Authorization', auth);
    expect(canceled.status).toBe(409);
    expect(canceled.body.error.code).toBe('COURIER_OUTCOME_UNCERTAIN');
    expect((await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } })).status).toBe('PAYMENT_CONFIRMED');
  });

  it('repairs a persisted local status transition without booking again', async () => {
    const { seller, order, url } = await scenario();
    const auth = `Bearer ${seller.accessToken}`;
    expect((await request(app).post(url).set('Authorization', auth)).status).toBe(200);
    // Simulate the state left when the booking commit succeeds but the later status transition fails.
    await prisma.order.update({ where: { orderId: order.orderId }, data: { status: 'PAYMENT_CONFIRMED' } });
    const resumed = await request(app).post(url).set('Authorization', auth);
    expect(resumed.status).toBe(200);
    expect(bookSpy).toHaveBeenCalledTimes(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } })).status).toBe('PROCESSING');
  });

  it('keeps simulated history separate from real-world performance claims', async () => {
    const { seller, url } = await scenario();
    await request(app).post(url).set('Authorization', `Bearer ${seller.accessToken}`);
    const result = await request(app).get('/api/v1/orders/courier-performance')
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(result.status).toBe(200);
    expect(result.body.data.groups).toHaveLength(1);
    expect(result.body.data.groups[0].source).toBe('SIMULATED');
    expect(result.body.data.groups[0].sampleCount).toBe(1);
    expect(result.body.data.groups[0].delivered).toBe(0);
    expect(result.body.data.groups[0].sufficientSample).toBe(false);
    expect(result.body.data.groups[0].onTimeRate).toBeNull();
  });

  it('persists simulated tracking milestones and terminal delivery outcome', async () => {
    const { seller, order, url } = await scenario();
    expect((await request(app).post(url).set('Authorization', `Bearer ${seller.accessToken}`)).status).toBe(200);
    for (let step = 0; step < 4; step++) {
      const row = await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } });
      await pollOneOrder(row);
    }
    const shipment = await prisma.courierShipment.findUniqueOrThrow({ where: { orderId: order.orderId } });
    expect(shipment.status).toBe('DELIVERED');
    expect(shipment.source).toBe('SIMULATED');
    expect(shipment.pickedUpAt).not.toBeNull();
    expect(shipment.inTransitAt).not.toBeNull();
    expect(shipment.deliveredAt).not.toBeNull();
    const events = await prisma.trackingEvent.findMany({ where: { orderId: order.orderId }, orderBy: { eventTime: 'asc' } });
    expect(events.map(({ status }) => status)).toEqual([
      'PROCESSING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED',
    ]);
    const repeated = await request(app).post(url).set('Authorization', `Bearer ${seller.accessToken}`);
    expect(repeated.status).toBe(200);
    expect(bookSpy).toHaveBeenCalledTimes(1);
  });

  it('demonstrates three synthetic orders with route and weight dependent winners', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const cases = [
      { shipCity: 'Karachi', shipProvince: 'Sindh', quantity: 2 },
      { shipCity: 'Lahore', shipProvince: 'Punjab', quantity: 2 },
      { shipCity: 'Peshawar', shipProvince: 'Khyber Pakhtunkhwa', quantity: 10 },
    ];
    const winners: string[] = [];
    for (const details of cases) {
      const order = await createTestOrder(buyer.userId, seller.userId, product,
        { status: 'PAYMENT_CONFIRMED', shipCity: details.shipCity, quantity: details.quantity });
      await prisma.order.update({ where: { orderId: order.orderId }, data: { shipProvince: details.shipProvince } });
      const response = await request(app).post(`/api/v1/orders/${order.publicId}/auto-select-courier`)
        .set('Authorization', `Bearer ${seller.accessToken}`);
      expect(response.status).toBe(200);
      const shipment = await prisma.courierShipment.findUniqueOrThrow({ where: { orderId: order.orderId } });
      const ranked = await prisma.courierQuote.findMany({
        where: { orderId: order.orderId, evaluationId: shipment.evaluationId! },
        orderBy: [{ score: 'desc' }, { courier: 'asc' }],
      });
      expect(ranked).toHaveLength(details.shipCity === 'Peshawar' ? 3 : 4);
      expect(shipment.courier).toBe(ranked[0]!.courier);
      expect(ranked.filter(({ selected }) => selected)).toHaveLength(1);
      expect(shipment.source).toBe('SIMULATED');
      winners.push(shipment.courier!);
    }
    expect(new Set(winners).size).toBeGreaterThanOrEqual(2);
    expect(bookSpy).toHaveBeenCalledTimes(3);
  });
});
