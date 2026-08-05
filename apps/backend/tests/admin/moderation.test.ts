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

describe('GET /api/v1/admin/moderation/products (Task 4.1)', () => {
  it('lists products across every seller, filterable by status', async () => {
    const admin = await createTestUser('ADMIN');
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(sellerA.userId, { status: 'LIVE' });
    await createTestProduct(sellerB.userId, { status: 'DRAFT' });

    const all = await request(app).get('/api/v1/admin/moderation/products').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(all.body.data.items).toHaveLength(2);

    const liveOnly = await request(app)
      .get('/api/v1/admin/moderation/products')
      .query({ status: 'LIVE' })
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(liveOnly.body.data.items).toHaveLength(1);
  });
});

describe('POST /api/v1/admin/moderation/products/:id/takedown|restore (Task 4.3–4.5)', () => {
  it('takedown without a reason is 400', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });
    const res = await request(app).post(`/api/v1/admin/moderation/products/${product.publicId}/takedown`).set('Authorization', `Bearer ${admin.accessToken}`).send({});
    expect(res.status).toBe(400);
  });

  it('takedown sets status=REMOVED and leaves every other field byte-identical', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const before = await createTestProduct(seller.userId, { status: 'LIVE', titleEn: 'Original Title', price: 250 });

    const res = await request(app)
      .post(`/api/v1/admin/moderation/products/${before.publicId}/takedown`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ reason: 'BR-001 prohibited item' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REMOVED');

    const after = await prisma.product.findUnique({ where: { productId: before.productId } });
    expect(after?.status).toBe('REMOVED');
    expect(after?.titleEn).toBe('Original Title');
    expect(after?.price.toString()).toBe(before.price.toString());
    expect(after?.sellerId).toBe(before.sellerId);

    const auditRows = await prisma.auditLog.findMany({ where: { entity: 'products', entityId: before.productId } });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.action).toBe('MODERATION');
  });

  it('a taken-down product is excluded from the storefront (idx_products_live no longer matches)', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });

    await request(app)
      .post(`/api/v1/admin/moderation/products/${product.publicId}/takedown`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ reason: 'x' });

    const storefront = await request(app).get('/api/v1/products/search');
    expect(storefront.body.data.items.map((i: { id: string }) => i.id)).not.toContain(product.publicId);
  });

  it('restore returns a taken-down LIVE product to LIVE (not unconditionally, sourced from the audit snapshot)', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });
    await request(app).post(`/api/v1/admin/moderation/products/${product.publicId}/takedown`).set('Authorization', `Bearer ${admin.accessToken}`).send({ reason: 'x' });

    const res = await request(app)
      .post(`/api/v1/admin/moderation/products/${product.publicId}/restore`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ reason: 'appeal upheld' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('LIVE');
  });

  it('restore returns a taken-down DRAFT product to DRAFT, not LIVE (the edge case Task 4.4 explicitly names)', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { status: 'DRAFT' });
    await request(app).post(`/api/v1/admin/moderation/products/${product.publicId}/takedown`).set('Authorization', `Bearer ${admin.accessToken}`).send({ reason: 'x' });

    const res = await request(app)
      .post(`/api/v1/admin/moderation/products/${product.publicId}/restore`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ reason: 'reviewed' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DRAFT');
  });

  it('restoring a product that was never removed is 422', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });
    const res = await request(app)
      .post(`/api/v1/admin/moderation/products/${product.publicId}/restore`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ reason: 'x' });
    expect(res.status).toBe(422);
  });

  it('taking down an already-removed product is 422', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { status: 'REMOVED' });
    const res = await request(app)
      .post(`/api/v1/admin/moderation/products/${product.publicId}/takedown`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ reason: 'x' });
    expect(res.status).toBe(422);
  });

  it('Support is blocked from takedown/restore (403 ADMIN_WRITE_REQUIRED)', async () => {
    const support = await createTestUser('SUPPORT');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });
    const res = await request(app)
      .post(`/api/v1/admin/moderation/products/${product.publicId}/takedown`)
      .set('Authorization', `Bearer ${support.accessToken}`)
      .send({ reason: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ADMIN_WRITE_REQUIRED');
  });
});
