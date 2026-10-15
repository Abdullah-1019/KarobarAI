import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
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

describe('GET /api/v1/orders (Task 2/4 — buyer list)', () => {
  it("returns only the authenticated buyer's own orders, newest first", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyerA = await createTestUser('BUYER');
    const buyerB = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { titleEn: 'Widget' });
    await createTestOrder(buyerA.userId, seller.userId, product);
    await createTestOrder(buyerB.userId, seller.userId, product);

    const res = await request(app).get('/api/v1/orders').set('Authorization', `Bearer ${buyerA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });

  it('tab filter maps canonical statuses to the friendly tab (Task 2.2)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    await createTestOrder(buyer.userId, seller.userId, product, { status: 'PAYMENT_PENDING' });
    await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING' });
    await createTestOrder(buyer.userId, seller.userId, product, { status: 'CANCELLED' });

    const res = await request(app)
      .get('/api/v1/orders')
      .query({ tab: 'ConfirmedProcessing' })
      .set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].status).toBe('PROCESSING');
  });

  it('cursor-paginates with nextCursor, consistent with Feature 4/5 list endpoints', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- fixture setup, order matters for orderId ordering
      await createTestOrder(buyer.userId, seller.userId, product);
    }

    const page1 = await request(app)
      .get('/api/v1/orders')
      .query({ limit: 2 })
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(page1.body.data.items).toHaveLength(2);
    expect(page1.body.data.nextCursor).not.toBeNull();

    const page2 = await request(app)
      .get('/api/v1/orders')
      .query({ limit: 2, cursor: page1.body.data.nextCursor })
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(page2.body.data.items).toHaveLength(1);
    expect(page2.body.data.nextCursor).toBeNull();
  });

  it("shows the seller's storeName as counterpartyName", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    await createTestOrder(buyer.userId, seller.userId, product);
    const sellerRow = await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } });

    const res = await request(app).get('/api/v1/orders').set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res.body.data.items[0].counterpartyName).toBe(sellerRow.storeName);
  });

  it('rejects a Seller hitting the buyer list with 403', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app).get('/api/v1/orders').set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/orders');
    expect(res.status).toBe(401);
  });

  describe('Task 3.4 — return-eligibility gate', () => {
    it('a buyer-confirmed order within 24 hours with no existing return is eligible', async () => {
      const seller = await createTestUser('SELLER', { onboarded: true });
      const buyer = await createTestUser('BUYER');
      const product = await createTestProduct(seller.userId);
      await createTestOrder(buyer.userId, seller.userId, product, {
        status: 'COMPLETED',
        deliveredAt: new Date(),
        buyerConfirmedAt: new Date(),
      });

      const res = await request(app).get('/api/v1/orders').set('Authorization', `Bearer ${buyer.accessToken}`);
      expect(res.body.data.items[0].returnEligible).toBe(true);
    });

    it('courier delivery alone does not open the return window', async () => {
      const seller = await createTestUser('SELLER', { onboarded: true });
      const buyer = await createTestUser('BUYER');
      const product = await createTestProduct(seller.userId);
      await createTestOrder(buyer.userId, seller.userId, product, {
        status: 'DELIVERED', deliveredAt: new Date(),
      });
      const res = await request(app).get('/api/v1/orders')
        .set('Authorization', `Bearer ${buyer.accessToken}`);
      expect(res.body.data.items[0].returnEligible).toBe(false);
    });

    it('a buyer-confirmed order past 24 hours is not eligible', async () => {
      const seller = await createTestUser('SELLER', { onboarded: true });
      const buyer = await createTestUser('BUYER');
      const product = await createTestProduct(seller.userId);
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      await createTestOrder(buyer.userId, seller.userId, product, {
        status: 'COMPLETED',
        deliveredAt: twentyDaysAgo,
        buyerConfirmedAt: twentyDaysAgo,
      });

      const res = await request(app).get('/api/v1/orders').set('Authorization', `Bearer ${buyer.accessToken}`);
      expect(res.body.data.items[0].returnEligible).toBe(false);
    });

    it('a buyer-confirmed order that already has a Return row is not eligible', async () => {
      const seller = await createTestUser('SELLER', { onboarded: true });
      const buyer = await createTestUser('BUYER');
      const product = await createTestProduct(seller.userId);
      const order = await createTestOrder(buyer.userId, seller.userId, product, {
        status: 'COMPLETED',
        deliveredAt: new Date(),
        buyerConfirmedAt: new Date(),
      });
      await prisma.return.create({
        data: { orderId: order.orderId, sellerId: seller.userId, reason: 'Not as described' },
      });

      const res = await request(app).get('/api/v1/orders').set('Authorization', `Bearer ${buyer.accessToken}`);
      expect(res.body.data.items[0].returnEligible).toBe(false);
    });

    it('a non-delivered order is never eligible', async () => {
      const seller = await createTestUser('SELLER', { onboarded: true });
      const buyer = await createTestUser('BUYER');
      const product = await createTestProduct(seller.userId);
      await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING' });

      const res = await request(app).get('/api/v1/orders').set('Authorization', `Bearer ${buyer.accessToken}`);
      expect(res.body.data.items[0].returnEligible).toBe(false);
    });
  });
});

describe('GET /api/v1/seller/orders (Task 2/4 — seller list)', () => {
  it("returns only the authenticated seller's own orders", async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const productA = await createTestProduct(sellerA.userId);
    const productB = await createTestProduct(sellerB.userId);
    await createTestOrder(buyer.userId, sellerA.userId, productA);
    await createTestOrder(buyer.userId, sellerB.userId, productB);

    const res = await request(app).get('/api/v1/seller/orders').set('Authorization', `Bearer ${sellerA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });

  it("shows the order's snapshotted recipient name as counterpartyName, never full buyer PII (Task 4.3)", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    await createTestOrder(buyer.userId, seller.userId, product);

    const res = await request(app).get('/api/v1/seller/orders').set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.body.data.items[0].counterpartyName).toBe('Test Recipient');
    expect(res.body.data.items[0]).not.toHaveProperty('shipPhone');
    expect(res.body.data.items[0].returnEligible).toBeUndefined();
  });

  it('rejects a Buyer hitting the seller list with 403', async () => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app).get('/api/v1/seller/orders').set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/orders/:id (Task 2.3 — tri-mode ownership + detail shape)', () => {
  it('links an appealed return to the owning seller order without exposing it to another seller', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const otherSeller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { titleEn: 'Appealed shirt' });
    const order = await createTestOrder(buyer.userId, seller.userId, product,
      { status: 'DELIVERED', deliveredAt: new Date() });
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.orderId } });
    const ret = await prisma.return.create({ data: { orderId: order.orderId,
      orderItemId: item.orderItemId, sellerId: seller.userId, reason: 'Other', status: 'UNDER_DISPUTE' } });
    await prisma.dispute.create({ data: { returnId: ret.returnId, buyerReason: 'Please reconsider' } });

    const path = `/api/v1/orders/${order.publicId}`;
    const own = await request(app).get(path).set('Authorization', `Bearer ${seller.accessToken}`);
    expect(own.status).toBe(200);
    expect(own.body.data.returnCases).toEqual([{
      id: ret.returnId.toString(), status: 'UNDER_DISPUTE', productName: 'Appealed shirt',
    }]);
    const unrelated = await request(app).get(path)
      .set('Authorization', `Bearer ${otherSeller.accessToken}`);
    expect(unrelated.status).toBe(403);
  });

  it('marks only the previously returned item in a multi-item order ineligible', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const returnedProduct = await createTestProduct(seller.userId);
    const availableProduct = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, returnedProduct, {
      status: 'COMPLETED', deliveredAt: new Date(), buyerConfirmedAt: new Date(),
    });
    const returnedItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.orderId } });
    await prisma.orderItem.create({ data: {
      orderId: order.orderId, productId: availableProduct.productId,
      titleSnapshot: availableProduct.titleEn, unitPrice: availableProduct.price, quantity: 1,
    } });
    await prisma.return.create({ data: {
      orderId: order.orderId, orderItemId: returnedItem.orderItemId,
      sellerId: seller.userId, reason: 'Previous return',
    } });

    const res = await request(app).get(`/api/v1/orders/${order.publicId}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{ productId: string; returnEligible: boolean }>;
    expect(items.find((item) => item.productId === returnedProduct.publicId)?.returnEligible).toBe(false);
    expect(items.find((item) => item.productId === availableProduct.publicId)?.returnEligible).toBe(true);
  });

  it('the owning buyer can view the order; commission is absent', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { titleEn: 'Widget', price: 200 });
    const order = await createTestOrder(buyer.userId, seller.userId, product, { quantity: 2 });

    const res = await request(app)
      .get(`/api/v1/orders/${order.publicId}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.commission).toBeNull();
    expect(res.body.data.items[0].titleSnapshot).toBe('Widget');
    expect(res.body.data.items[0].quantity).toBe(2);
    expect(res.body.data.courierStatus).toBe('not_booked');
  });

  it('the owning seller can view the order; commission is present (Task 5.1)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { price: 200 });
    const order = await createTestOrder(buyer.userId, seller.userId, product, { quantity: 2 });

    const res = await request(app)
      .get(`/api/v1/orders/${order.publicId}`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.commission).not.toBeNull();
    expect(res.body.data.commission.rate).toBe('0.0500');
    expect(res.body.data.commission.amount).toBe('20.00'); // 400 subtotal * 0.05
  });

  it('decrypts shipping line/phone for an authorized viewer', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product);

    const res = await request(app)
      .get(`/api/v1/orders/${order.publicId}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res.body.data.shipping.line1).toBe('123 Test Street');
    expect(res.body.data.shipping.phone).toBe('03001234567');
  });

  it('an unrelated buyer gets 403 ORDER_NOT_OWNED', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const stranger = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product);

    const res = await request(app)
      .get(`/api/v1/orders/${order.publicId}`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORDER_NOT_OWNED');
  });

  it('an unrelated seller gets 403 ORDER_NOT_OWNED', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const otherSeller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product);

    const res = await request(app)
      .get(`/api/v1/orders/${order.publicId}`)
      .set('Authorization', `Bearer ${otherSeller.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORDER_NOT_OWNED');
  });

  it('Admin/Support can view any order, and never sees commission', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const admin = await createTestUser('ADMIN');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product);

    const res = await request(app)
      .get(`/api/v1/orders/${order.publicId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.commission).toBeNull();
  });

  it('returns 404 for a nonexistent order id', async () => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app)
      .get('/api/v1/orders/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
  });

  it('cancellable reflects the state machine (Gap #3)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const preShipment = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING' });
    const postShipment = await createTestOrder(buyer.userId, seller.userId, product, { status: 'IN_TRANSIT' });

    const res1 = await request(app)
      .get(`/api/v1/orders/${preShipment.publicId}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    const res2 = await request(app)
      .get(`/api/v1/orders/${postShipment.publicId}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res1.body.data.cancellable).toBe(true);
    expect(res2.body.data.cancellable).toBe(false);
  });
});
