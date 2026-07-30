jest.mock('../../src/adapters/storage', () => ({ getStorageAdapter: jest.fn() }));

import request from 'supertest';

import { getStorageAdapter } from '../../src/adapters/storage';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  (getStorageAdapter as jest.Mock).mockReturnValue({
    upload: jest.fn().mockResolvedValue({ key: 'x', url: 'mock://x' }),
    delete: jest.fn().mockResolvedValue(undefined),
    getUrl: (k: string) => k,
  });
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

const SELLER_ROUTES: Array<{ method: 'get' | 'post' | 'patch' | 'delete'; path: (productId: string, imageId: string) => string }> = [
  { method: 'get', path: () => '/api/v1/seller/products' },
  { method: 'post', path: () => '/api/v1/seller/products' },
  { method: 'post', path: (id) => `/api/v1/seller/products/${id}/generate-listing` },
  { method: 'post', path: (id) => `/api/v1/seller/products/${id}/publish` },
  { method: 'post', path: (id) => `/api/v1/seller/products/${id}/unpublish` },
  { method: 'patch', path: (id) => `/api/v1/seller/products/${id}` },
  { method: 'delete', path: (id) => `/api/v1/seller/products/${id}` },
  { method: 'post', path: (id) => `/api/v1/seller/products/${id}/images` },
  { method: 'delete', path: (id, imageId) => `/api/v1/seller/products/${id}/images/${imageId}` },
  { method: 'patch', path: (id) => `/api/v1/seller/products/${id}/images/reorder` },
];

describe('Feature 4 adversarial checks — unauthenticated sweep', () => {
  it.each(SELLER_ROUTES)('rejects unauthenticated $method $path() with 401', async ({ method, path }) => {
    const res = await request(app)[method](path('00000000-0000-0000-0000-000000000000', '1'));
    expect(res.status).toBe(401);
  });
});

describe('Feature 4 adversarial checks — role gating (Buyer/Admin on seller-only routes)', () => {
  it.each(SELLER_ROUTES)('rejects a Buyer on $method $path() with 403', async ({ method, path }) => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app)
      [method](path('00000000-0000-0000-0000-000000000000', '1'))
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(403);
  });

  it.each(SELLER_ROUTES)('rejects an Admin on $method $path() with 403', async ({ method, path }) => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app)
      [method](path('00000000-0000-0000-0000-000000000000', '1'))
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('Feature 4 adversarial checks — reuses Feature 3\'s onboarding/status guards (Task 1.4)', () => {
  it.each(SELLER_ROUTES)('rejects a non-onboarded seller on $method $path() with 422 STORE_NOT_ONBOARDED', async ({ method, path }) => {
    const seller = await createTestUser('SELLER'); // onboarded defaults to false
    const res = await request(app)
      [method](path('00000000-0000-0000-0000-000000000000', '1'))
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('STORE_NOT_ONBOARDED');
  });
});

// Task 8.2 — Seller A creates a product; Seller B's token attempts every seller-write route
// against it. Every single one must be 403 PRODUCT_NOT_OWNED, none silently succeed or 404
// (which would incorrectly suggest the product doesn't exist rather than access being denied).
describe('Feature 4 adversarial checks — cross-seller ownership matrix (Task 8.2)', () => {
  it("Seller B is rejected 403 on every write route against Seller A's product", async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const category = await prisma.category.findFirstOrThrow({ where: { slug: 'electronics' } });
    const product = await createTestProduct(sellerA.userId, { status: 'LIVE', categoryId: category.categoryId });
    const image = await prisma.productImage.create({
      data: { productId: product.productId, cdnUrl: 'mock://x', position: 0 },
    });

    const attempts: Array<{ label: string; run: () => Promise<request.Response> }> = [
      {
        label: 'PATCH edit',
        run: () =>
          request(app)
            .patch(`/api/v1/seller/products/${product.publicId}`)
            .set('Authorization', `Bearer ${sellerB.accessToken}`)
            .send({ titleEn: 'Hijacked' }),
      },
      {
        label: 'DELETE',
        run: () =>
          request(app)
            .delete(`/api/v1/seller/products/${product.publicId}`)
            .set('Authorization', `Bearer ${sellerB.accessToken}`),
      },
      {
        label: 'image upload',
        run: () =>
          request(app)
            .post(`/api/v1/seller/products/${product.publicId}/images`)
            .set('Authorization', `Bearer ${sellerB.accessToken}`)
            .attach('images', Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 0)]), 'a.jpg'),
      },
      {
        label: 'image remove',
        run: () =>
          request(app)
            .delete(`/api/v1/seller/products/${product.publicId}/images/${image.imageId}`)
            .set('Authorization', `Bearer ${sellerB.accessToken}`),
      },
      {
        label: 'image reorder',
        run: () =>
          request(app)
            .patch(`/api/v1/seller/products/${product.publicId}/images/reorder`)
            .set('Authorization', `Bearer ${sellerB.accessToken}`)
            .send({ imageIds: [image.imageId.toString()] }),
      },
      {
        label: 'unpublish',
        run: () =>
          request(app)
            .post(`/api/v1/seller/products/${product.publicId}/unpublish`)
            .set('Authorization', `Bearer ${sellerB.accessToken}`),
      },
      {
        label: 'generate-listing',
        run: () =>
          request(app)
            .post(`/api/v1/seller/products/${product.publicId}/generate-listing`)
            .set('Authorization', `Bearer ${sellerB.accessToken}`)
            .send({}),
      },
    ];

    for (const attempt of attempts) {
      // eslint-disable-next-line no-await-in-loop -- intentionally sequential per named case
      const res = await attempt.run();
      expect([attempt.label, res.status]).toEqual([attempt.label, 403]);
      expect(res.body.error.code).toBe('PRODUCT_NOT_OWNED');
    }

    // Confirm the product itself was completely untouched by every rejected attempt.
    const row = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(row.status).toBe('LIVE');
    expect(row.titleEn).not.toBe('Hijacked');
    expect(row.deletedAt).toBeNull();
  });
});
