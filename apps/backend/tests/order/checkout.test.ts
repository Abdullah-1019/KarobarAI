import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { MockPaymentAdapter } from '../../src/adapters/payment/mock';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { closeNotificationQueue } from '../../src/modules/notification';
import { createAddress, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const chargeSpy = jest.spyOn(MockPaymentAdapter.prototype, 'charge');
// Checkout now enqueues ORDER_PLACED (Feature 9 gap closure) — mocked exactly like every other
// BullMQ producer in this test suite, so these tests never depend on a live queue being drained.
const queueAddSpy = jest.spyOn(Queue.prototype, 'add').mockResolvedValue({} as never);

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  chargeSpy.mockClear();
  queueAddSpy.mockClear();
});

afterAll(async () => {
  await closeNotificationQueue();
  await prisma.$disconnect();
  await redis.quit();
  chargeSpy.mockRestore();
  queueAddSpy.mockRestore();
});

async function addToCart(accessToken: string, productPublicId: string, quantity: number) {
  return request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ productId: productPublicId, quantity });
}

function checkoutRequest(accessToken: string, body: object, idempotencyKey = randomUUID()) {
  return request(app)
    .post('/api/v1/checkout')
    .set('Authorization', `Bearer ${accessToken}`)
    .set('Idempotency-Key', idempotencyKey)
    .send(body);
}

describe('POST /api/v1/checkout (Task 7 — happy path)', () => {
  it('single-seller checkout: creates one order, one order_item, a JazzCash payment row, decrements stock', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { titleEn: 'Widget', price: 200, stock: 10, status: 'LIVE' });
    const address = await createAddress(buyer.userId);
    await addToCart(buyer.accessToken, product.publicId, 2);

    const res = await checkoutRequest(buyer.accessToken, {
      addressId: address.addressId.toString(),
      paymentMethod: 'JAZZCASH',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.orders).toHaveLength(1);
    const order = res.body.data.orders[0];
    expect(order.subtotal).toBe('400.00');
    expect(order.items).toHaveLength(1);
    expect(order.items[0].titleSnapshot).toBe('Widget');
    expect(order.items[0].quantity).toBe(2);
    expect(order.paymentStatus).toBe('PENDING');
    expect(chargeSpy).toHaveBeenCalledTimes(1);

    const productRow = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(productRow.stock).toBe(8);

    const orderRow = await prisma.order.findUniqueOrThrow({ where: { publicId: order.id } });
    expect(orderRow.buyerId).toBe(buyer.userId);
    expect(orderRow.sellerId).toBe(seller.userId);
    expect(orderRow.status).toBe('PAYMENT_PENDING');
    expect(Number(orderRow.commissionRateSnapshot)).toBeCloseTo(0.05);

    // Cart is cleared of purchased items.
    const cartRes = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(cartRes.body.data.sellerGroups).toEqual([]);

    // Feature 9 gap closure — checkout enqueues ORDER_PLACED for the buyer.
    const placedCalls = queueAddSpy.mock.calls.filter(
      (call) => call[1] && (call[1] as { type?: string }).type === 'ORDER_PLACED',
    );
    expect(placedCalls).toHaveLength(1);
    expect(placedCalls[0]?.[1]).toMatchObject({ userId: buyer.userId.toString(), orderId: order.id });
  });

  it('multi-seller checkout: a 2-seller cart splits into exactly 2 orders, each with its own shipping line', async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const productA = await createTestProduct(sellerA.userId, { price: 300, stock: 5, status: 'LIVE' });
    const productB = await createTestProduct(sellerB.userId, { price: 400, stock: 5, status: 'LIVE' });
    const address = await createAddress(buyer.userId);
    await addToCart(buyer.accessToken, productA.publicId, 1);
    await addToCart(buyer.accessToken, productB.publicId, 1);

    const res = await checkoutRequest(buyer.accessToken, {
      addressId: address.addressId.toString(),
      paymentMethod: 'JAZZCASH',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.orders).toHaveLength(2);
    for (const order of res.body.data.orders) {
      expect(Number(order.shippingFee)).toBeGreaterThan(0);
    }
    expect(chargeSpy).toHaveBeenCalledTimes(2);

    const orderRows = await prisma.order.findMany({ where: { buyerId: buyer.userId } });
    expect(orderRows).toHaveLength(2);
    expect(new Set(orderRows.map((o) => o.sellerId))).toEqual(new Set([sellerA.userId, sellerB.userId]));

    // One ORDER_PLACED per created order, not one per checkout call.
    const placedCalls = queueAddSpy.mock.calls.filter(
      (call) => call[1] && (call[1] as { type?: string }).type === 'ORDER_PLACED',
    );
    expect(placedCalls).toHaveLength(2);
  });

  it('COD checkout: payment row has method=COD, no gateway call made', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { price: 150, status: 'LIVE' });
    const address = await createAddress(buyer.userId);
    await addToCart(buyer.accessToken, product.publicId, 1);

    const res = await checkoutRequest(buyer.accessToken, {
      addressId: address.addressId.toString(),
      paymentMethod: 'COD',
    });

    expect(res.status).toBe(201);
    expect(chargeSpy).not.toHaveBeenCalled();

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { orderId: (await prisma.order.findFirstOrThrow({ where: { buyerId: buyer.userId } })).orderId },
    });
    expect(payment.method).toBe('COD');
    expect(payment.gateway).toBeNull();
    expect(payment.transactionRef).toBeNull();
    expect(payment.status).toBe('PENDING');
  });

  it('only eligible seller groups become orders — a below-minimum group is excluded, others proceed', async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const cheapProduct = await createTestProduct(sellerA.userId, { price: 10, status: 'LIVE' }); // below 100 PKR minimum
    const expensiveProduct = await createTestProduct(sellerB.userId, { price: 500, status: 'LIVE' });
    const address = await createAddress(buyer.userId);
    await addToCart(buyer.accessToken, cheapProduct.publicId, 1);
    await addToCart(buyer.accessToken, expensiveProduct.publicId, 1);

    const res = await checkoutRequest(buyer.accessToken, {
      addressId: address.addressId.toString(),
      paymentMethod: 'COD',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.orders).toHaveLength(1);
    expect(res.body.data.orders[0].sellerId).toBe(sellerB.publicId);

    // The ineligible group's item remains in the cart, untouched.
    const cartRes = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(cartRes.body.data.sellerGroups).toHaveLength(1);
    expect(cartRes.body.data.sellerGroups[0].subtotal).toBe('10.00');
  });

  it('rejects checkout with 422 CHECKOUT_NOT_ELIGIBLE when no seller group is eligible', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { price: 10, status: 'LIVE' }); // below minimum
    const address = await createAddress(buyer.userId);
    await addToCart(buyer.accessToken, product.publicId, 1);

    const res = await checkoutRequest(buyer.accessToken, {
      addressId: address.addressId.toString(),
      paymentMethod: 'COD',
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CHECKOUT_NOT_ELIGIBLE');
  });

  it('rejects checkout against an empty cart with 422 CHECKOUT_NOT_ELIGIBLE', async () => {
    const buyer = await createTestUser('BUYER');
    const address = await createAddress(buyer.userId);

    const res = await checkoutRequest(buyer.accessToken, {
      addressId: address.addressId.toString(),
      paymentMethod: 'COD',
    });

    expect(res.status).toBe(422);
  });
});

describe('POST /api/v1/checkout — Idempotency (Task 7.2/8.2)', () => {
  it('resubmitting the identical Idempotency-Key returns the original result, no duplicate orders', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { price: 150, stock: 10, status: 'LIVE' });
    const address = await createAddress(buyer.userId);
    await addToCart(buyer.accessToken, product.publicId, 1);
    const key = randomUUID();

    const first = await checkoutRequest(
      buyer.accessToken,
      { addressId: address.addressId.toString(), paymentMethod: 'COD' },
      key,
    );
    expect(first.status).toBe(201);

    const second = await checkoutRequest(
      buyer.accessToken,
      { addressId: address.addressId.toString(), paymentMethod: 'COD' },
      key,
    );
    expect(second.status).toBe(201);
    expect(second.body.data).toEqual(first.body.data);

    const orderCount = await prisma.order.count({ where: { buyerId: buyer.userId } });
    expect(orderCount).toBe(1);

    const productRow = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(productRow.stock).toBe(9); // decremented exactly once, not twice

    // The idempotent replay returns the cached response before ever reaching the enqueue call —
    // ORDER_PLACED fires exactly once, not once per request.
    const placedCalls = queueAddSpy.mock.calls.filter(
      (call) => call[1] && (call[1] as { type?: string }).type === 'ORDER_PLACED',
    );
    expect(placedCalls).toHaveLength(1);
  });

  it('rejects a checkout request with no Idempotency-Key header (400)', async () => {
    const buyer = await createTestUser('BUYER');
    const address = await createAddress(buyer.userId);

    const res = await request(app)
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ addressId: address.addressId.toString(), paymentMethod: 'COD' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });
});

describe('POST /api/v1/checkout — concurrent oversell (Task 7.4/8.3)', () => {
  it('two simultaneous checkouts for the last unit: exactly one succeeds, the other gets a stock-conflict error', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyerA = await createTestUser('BUYER');
    const buyerB = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { price: 150, stock: 1, status: 'LIVE' });
    const addressA = await createAddress(buyerA.userId);
    const addressB = await createAddress(buyerB.userId);
    await addToCart(buyerA.accessToken, product.publicId, 1);
    await addToCart(buyerB.accessToken, product.publicId, 1);

    const [resA, resB] = await Promise.all([
      checkoutRequest(buyerA.accessToken, { addressId: addressA.addressId.toString(), paymentMethod: 'COD' }),
      checkoutRequest(buyerB.accessToken, { addressId: addressB.addressId.toString(), paymentMethod: 'COD' }),
    ]);

    // Exactly one request must succeed (201). The loser's exact status depends on legitimate
    // timing: if it reaches the transaction, Feature 4's atomic decrementStock rejects it with
    // 409 INSUFFICIENT_STOCK; if the winner's transaction fully commits first, the loser's own
    // pre-transaction cart-eligibility read already sees the depleted stock and rejects earlier
    // with 422 CHECKOUT_NOT_ELIGIBLE. Both are correct, clean outcomes — never a 500, never a
    // second order.
    const statuses = [resA.status, resB.status].sort();
    expect(statuses[0]).toBe(201);
    expect([409, 422]).toContain(statuses[1]);

    const productRow = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(productRow.stock).toBe(0);
    expect(productRow.stock).toBeGreaterThanOrEqual(0);

    const orderCount = await prisma.order.count({ where: { sellerId: seller.userId } });
    expect(orderCount).toBe(1);
  });
});

describe('POST /api/v1/checkout — cross-buyer ownership (Task 8.4)', () => {
  it("rejects checkout using another buyer's addressId with 403, no orders created", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyerA = await createTestUser('BUYER');
    const buyerB = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { price: 150, status: 'LIVE' });
    const addressA = await createAddress(buyerA.userId);
    await addToCart(buyerB.accessToken, product.publicId, 1);

    const res = await checkoutRequest(buyerB.accessToken, {
      addressId: addressA.addressId.toString(),
      paymentMethod: 'COD',
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ADDRESS_NOT_OWNED');

    const orderCount = await prisma.order.count({ where: { buyerId: buyerB.userId } });
    expect(orderCount).toBe(0);
  });

  it('rejects a Seller attempting to check out (buyer-only) with 403', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await checkoutRequest(seller.accessToken, { addressId: '1', paymentMethod: 'COD' });
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated checkout attempt with 401', async () => {
    const res = await request(app)
      .post('/api/v1/checkout')
      .set('Idempotency-Key', randomUUID())
      .send({ addressId: '1', paymentMethod: 'COD' });
    expect(res.status).toBe(401);
  });
});
