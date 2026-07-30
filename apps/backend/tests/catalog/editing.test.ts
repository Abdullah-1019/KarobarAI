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

describe('GET /api/v1/seller/products (Task 6.1 — list)', () => {
  it("never returns another seller's products, even without an explicit seller_id param", async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(sellerA.userId, { titleEn: 'A1' });
    await createTestProduct(sellerB.userId, { titleEn: 'B1' });

    const res = await request(app)
      .get('/api/v1/seller/products')
      .set('Authorization', `Bearer ${sellerA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].titleEn).toBe('A1');
  });

  it('filters by status', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(seller.userId, { titleEn: 'Draft one', status: 'DRAFT' });
    await createTestProduct(seller.userId, { titleEn: 'Live one', status: 'LIVE' });

    const res = await request(app)
      .get('/api/v1/seller/products?status=LIVE')
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].titleEn).toBe('Live one');
  });

  it('returns an empty list for a seller with zero products', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app)
      .get('/api/v1/seller/products')
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.nextCursor).toBeNull();
  });
});

describe('PATCH /api/v1/seller/products/:id (Task 6.2 — edit)', () => {
  it('updates title/price/stock successfully', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { titleEn: 'Old', price: 100, stock: 5 });

    const res = await request(app)
      .patch(`/api/v1/seller/products/${product.publicId}`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ titleEn: 'New Title', price: 200, stock: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data.titleEn).toBe('New Title');

    const row = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(row.stock).toBe(10);
    expect(Number(row.price)).toBe(200);
  });

  // Task 6.2's core guarantee, same rigor as Feature 3 Task 6.2's status-mutation lockdown.
  it('silently strips a raw status field — a direct PATCH { status } is a no-op, never a live write', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { status: 'DRAFT' });

    const res = await request(app)
      .patch(`/api/v1/seller/products/${product.publicId}`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ titleEn: 'X', status: 'LIVE' });

    expect(res.status).toBe(400); // zod .strict() rejects the unknown field outright

    const row = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(row.status).toBe('DRAFT');
  });

  it('editing stock to 0 on a LIVE product auto-transitions it to OUT_OF_STOCK (Task 5.3 reuse)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { status: 'LIVE', stock: 3 });

    const res = await request(app)
      .patch(`/api/v1/seller/products/${product.publicId}`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ stock: 0 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('OUT_OF_STOCK');
  });

  it("rejects a Seller B editing Seller A's product with 403", async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(sellerA.userId);

    const res = await request(app)
      .patch(`/api/v1/seller/products/${product.publicId}`)
      .set('Authorization', `Bearer ${sellerB.accessToken}`)
      .send({ titleEn: 'Hijacked' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PRODUCT_NOT_OWNED');

    const row = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(row.titleEn).not.toBe('Hijacked');
  });
});

describe('POST /api/v1/seller/products/:id/unpublish (Task 6.3)', () => {
  it('transitions LIVE -> DRAFT', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });

    const res = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/unpublish`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DRAFT');
  });

  it('rejects unpublishing an already-Draft product with 422, not a silent no-op', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { status: 'DRAFT' });

    const res = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/unpublish`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ALREADY_UNPUBLISHED');
  });
});

describe('DELETE /api/v1/seller/products/:id (Task 6.4 — soft-delete)', () => {
  it('soft-deletes the product: excluded from the seller list and public search/detail afterward', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });

    const res = await request(app)
      .delete(`/api/v1/seller/products/${product.publicId}`)
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(200);

    const row = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(row.deletedAt).not.toBeNull();

    const listRes = await request(app)
      .get('/api/v1/seller/products')
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(listRes.body.data.items).toHaveLength(0);

    const detailRes = await request(app).get(`/api/v1/products/${product.publicId}`);
    expect(detailRes.status).toBe(404);
  });

  it("rejects a Seller B deleting Seller A's product with 403", async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(sellerA.userId);

    const res = await request(app)
      .delete(`/api/v1/seller/products/${product.publicId}`)
      .set('Authorization', `Bearer ${sellerB.accessToken}`);

    expect(res.status).toBe(403);

    const row = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(row.deletedAt).toBeNull();
  });
});
