import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('GET /api/v1/cart (Task 2 — initialization)', () => {
  it('returns an empty-groups shape for a brand-new buyer, without creating a cart row', async () => {
    const buyer = await createTestUser('BUYER');

    const res = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.sellerGroups).toEqual([]);
    expect(res.body.data.grandSubtotal).toBe('0.00');

    const cart = await prisma.cart.findUnique({ where: { buyerId: buyer.userId } });
    expect(cart).toBeNull();
  });
});

describe('POST /api/v1/cart/items (Task 3 — add)', () => {
  it('adds a product to the cart, creating the cart row lazily', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { titleEn: 'Widget', price: 50, status: 'LIVE' });

    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ productId: product.publicId, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data.sellerGroups).toHaveLength(1);
    expect(res.body.data.sellerGroups[0].items[0].quantity).toBe(2);
    expect(res.body.data.sellerGroups[0].items[0].lineSubtotal).toBe('100.00');
    expect(res.body.data.grandSubtotal).toBe('100.00');

    const cart = await prisma.cart.findUnique({ where: { buyerId: buyer.userId } });
    expect(cart).not.toBeNull();
  });

  it('adding the same product twice sums quantity into one row, never a duplicate', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ productId: product.publicId, quantity: 2 });
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ productId: product.publicId, quantity: 3 });

    expect(res.status).toBe(201);
    expect(res.body.data.sellerGroups[0].items).toHaveLength(1);
    expect(res.body.data.sellerGroups[0].items[0].quantity).toBe(5);

    const rows = await prisma.cartItem.findMany({ where: { product: { publicId: product.publicId } } });
    expect(rows).toHaveLength(1);
  });

  it('groups items by seller — a 2-seller cart returns exactly 2 sellerGroups', async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const productA = await createTestProduct(sellerA.userId, { status: 'LIVE' });
    const productB = await createTestProduct(sellerB.userId, { status: 'LIVE' });

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ productId: productA.publicId, quantity: 1 });
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ productId: productB.publicId, quantity: 1 });

    expect(res.status).toBe(201);
    expect(res.body.data.sellerGroups).toHaveLength(2);
  });

  it('rejects adding a DRAFT (non-LIVE) product with 404', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { status: 'DRAFT' });

    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ productId: product.publicId, quantity: 1 });

    expect(res.status).toBe(404);
  });

  it('rejects a Seller attempting to use the cart (buyer-only)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 });
    expect(res.status).toBe(403);
  });
});

describe('PATCH/DELETE /api/v1/cart/items/:itemId (Task 3 — update/remove)', () => {
  it('sets quantity directly via PATCH', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });
    const addRes = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ productId: product.publicId, quantity: 1 });
    const itemId = addRes.body.data.sellerGroups[0].items[0].id;

    const res = await request(app)
      .patch(`/api/v1/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ quantity: 7 });

    expect(res.status).toBe(200);
    expect(res.body.data.sellerGroups[0].items[0].quantity).toBe(7);
  });

  it('removes a line item, which disappears from the cart immediately', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });
    const addRes = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ productId: product.publicId, quantity: 1 });
    const itemId = addRes.body.data.sellerGroups[0].items[0].id;

    const res = await request(app)
      .delete(`/api/v1/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.sellerGroups).toEqual([]);
  });

  it("rejects a Buyer B mutating Buyer A's cart item with 403", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyerA = await createTestUser('BUYER');
    const buyerB = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });
    const addRes = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${buyerA.accessToken}`)
      .send({ productId: product.publicId, quantity: 1 });
    const itemId = addRes.body.data.sellerGroups[0].items[0].id;

    const patchRes = await request(app)
      .patch(`/api/v1/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${buyerB.accessToken}`)
      .send({ quantity: 9 });
    expect(patchRes.status).toBe(403);
    expect(patchRes.body.error.code).toBe('CART_ITEM_NOT_OWNED');

    const deleteRes = await request(app)
      .delete(`/api/v1/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${buyerB.accessToken}`);
    expect(deleteRes.status).toBe(403);

    const row = await prisma.cartItem.findUniqueOrThrow({ where: { cartItemId: BigInt(itemId) } });
    expect(row.quantity).toBe(1);
  });

  it('returns 404 for a garbage (non-numeric) itemId, not a 500', async () => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app)
      .patch('/api/v1/cart/items/not-a-number')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ quantity: 1 });
    expect(res.status).toBe(404);
  });
});

describe('Task 4 — Cart Validation (stock conflicts + min-order eligibility)', () => {
  it('flags an item whose stock dropped below cart quantity, excluded from checkout eligibility but still visible', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { status: 'LIVE', stock: 5, price: 200 });
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ productId: product.publicId, quantity: 3 });

    // Stock drops below the cart quantity (simulated direct DB update, as the module doc specifies).
    await prisma.product.update({ where: { productId: product.productId }, data: { stock: 1 } });

    const res = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res.status).toBe(200);
    const item = res.body.data.sellerGroups[0].items[0];
    expect(item.stockConflict).toEqual({ available: 1 });
    expect(res.body.data.sellerGroups[0].eligibleForCheckout).toBe(false);
  });

  it("flags a seller group below platform_config.min_order_value_pkr as ineligible, others unaffected", async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const cheapProduct = await createTestProduct(sellerA.userId, { status: 'LIVE', price: 10 }); // below the 100 PKR default minimum
    const expensiveProduct = await createTestProduct(sellerB.userId, { status: 'LIVE', price: 500 });

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ productId: cheapProduct.publicId, quantity: 1 });
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ productId: expensiveProduct.publicId, quantity: 1 });

    const res = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${buyer.accessToken}`);

    const cheapGroup = res.body.data.sellerGroups.find((g: { subtotal: string }) => g.subtotal === '10.00');
    const expensiveGroup = res.body.data.sellerGroups.find((g: { subtotal: string }) => g.subtotal === '500.00');
    expect(cheapGroup.eligibleForCheckout).toBe(false);
    expect(expensiveGroup.eligibleForCheckout).toBe(true);
  });

  it('reads min_order_value_pkr from platform_config, not a hardcoded value', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { status: 'LIVE', price: 60 });
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ productId: product.publicId, quantity: 1 });

    // Lower the config value below the cart's subtotal — simulated direct DB update, since
    // Admin's Config Panel UI is out of this feature's scope.
    await prisma.platformConfig.update({ where: { configKey: 'min_order_value_pkr' }, data: { value: 50 } });

    const res = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.body.data.sellerGroups[0].eligibleForCheckout).toBe(true);
    expect(res.body.data.sellerGroups[0].minOrderValuePkr).toBe('50.00');
  });
});
