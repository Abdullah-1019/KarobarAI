jest.mock('../../src/adapters/storage', () => ({ getStorageAdapter: jest.fn() }));

import request from 'supertest';

import { getStorageAdapter } from '../../src/adapters/storage';
import { config } from '../../src/core/config';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const mockUpload = jest.fn();
const mockDelete = jest.fn().mockResolvedValue(undefined);

const JPEG_BUFFER = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 0)]);

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  mockUpload.mockReset();
  mockDelete.mockClear();
  mockUpload.mockImplementation(async ({ key }: { key: string }) => ({
    key,
    // Real prefix so extractStorageKey() (profile.service.ts/catalog.service.ts) can parse it
    // back out — an arbitrary mock:// URL would silently no-op on delete, same gotcha
    // avatar.test.ts/store.test.ts already learned from.
    url: `${config.storage.publicBaseUrl}/${config.storage.bucket}/${key}`,
  }));
  (getStorageAdapter as jest.Mock).mockReturnValue({ upload: mockUpload, delete: mockDelete, getUrl: (k: string) => k });
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('POST /api/v1/seller/products/:id/images (Task 4.2)', () => {
  it('uploads a single image, assigned position 0', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId);

    const res = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/images`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('images', JPEG_BUFFER, 'a.jpg');

    expect(res.status).toBe(200);
    expect(res.body.data.images).toHaveLength(1);
    expect(res.body.data.images[0].position).toBe(0);
  });

  it('assigns incrementing positions across multiple uploads', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId);

    await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/images`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('images', JPEG_BUFFER, 'a.jpg');

    const res = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/images`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('images', JPEG_BUFFER, 'b.jpg');

    expect(res.status).toBe(200);
    const positions = res.body.data.images.map((img: { position: number }) => img.position).sort();
    expect(positions).toEqual([0, 1]);
  });

  it('rejects a non-image file with 400 PRODUCT_IMAGE_INVALID_FILE', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId);

    const res = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/images`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('images', Buffer.from('not an image'), { filename: 'x.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PRODUCT_IMAGE_INVALID_FILE');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("rejects a Seller B uploading to Seller A's product (403)", async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(sellerA.userId);

    const res = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/images`)
      .set('Authorization', `Bearer ${sellerB.accessToken}`)
      .attach('images', JPEG_BUFFER, 'a.jpg');

    expect(res.status).toBe(403);
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/v1/seller/products/:id/images/:imageId (Task 4.3 — re-sequencing)', () => {
  it('removing the primary image promotes the next image to position 0, contiguous', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId);
    const urlPrefix = `${config.storage.publicBaseUrl}/${config.storage.bucket}`;
    const img0 = await prisma.productImage.create({ data: { productId: product.productId, cdnUrl: `${urlPrefix}/0`, position: 0 } });
    await prisma.productImage.create({ data: { productId: product.productId, cdnUrl: `${urlPrefix}/1`, position: 1 } });
    await prisma.productImage.create({ data: { productId: product.productId, cdnUrl: `${urlPrefix}/2`, position: 2 } });

    const res = await request(app)
      .delete(`/api/v1/seller/products/${product.publicId}/images/${img0.imageId}`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    const remaining = await prisma.productImage.findMany({
      where: { productId: product.productId },
      orderBy: { position: 'asc' },
    });
    expect(remaining).toHaveLength(2);
    expect(remaining.map((r) => r.position)).toEqual([0, 1]);
    expect(remaining[0]?.cdnUrl).toBe(`${urlPrefix}/1`); // previously-second image is now primary

    await new Promise((resolve) => setImmediate(resolve));
    expect(mockDelete).toHaveBeenCalled();
  });

  it('returns 404 for an imageId that belongs to a different product', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const productA = await createTestProduct(seller.userId);
    const productB = await createTestProduct(seller.userId);
    const imageOnB = await prisma.productImage.create({ data: { productId: productB.productId, cdnUrl: 'mock://x', position: 0 } });

    const res = await request(app)
      .delete(`/api/v1/seller/products/${productA.publicId}/images/${imageOnB.imageId}`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_IMAGE_NOT_FOUND');
  });
});

describe('PATCH /api/v1/seller/products/:id/images/reorder (Task 4.4)', () => {
  it('reorders images per the provided permutation, new first image becomes primary', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId);
    const imgA = await prisma.productImage.create({ data: { productId: product.productId, cdnUrl: 'mock://a', position: 0 } });
    const imgB = await prisma.productImage.create({ data: { productId: product.productId, cdnUrl: 'mock://b', position: 1 } });
    const imgC = await prisma.productImage.create({ data: { productId: product.productId, cdnUrl: 'mock://c', position: 2 } });

    const res = await request(app)
      .patch(`/api/v1/seller/products/${product.publicId}/images/reorder`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ imageIds: [imgC.imageId.toString(), imgA.imageId.toString(), imgB.imageId.toString()] });

    expect(res.status).toBe(200);
    const rows = await prisma.productImage.findMany({ where: { productId: product.productId }, orderBy: { position: 'asc' } });
    expect(rows[0]?.imageId).toBe(imgC.imageId);
    expect(rows[1]?.imageId).toBe(imgA.imageId);
    expect(rows[2]?.imageId).toBe(imgB.imageId);
  });

  it('rejects a partial permutation with 400 REORDER_INVALID', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId);
    const imgA = await prisma.productImage.create({ data: { productId: product.productId, cdnUrl: 'mock://a', position: 0 } });
    await prisma.productImage.create({ data: { productId: product.productId, cdnUrl: 'mock://b', position: 1 } });

    const res = await request(app)
      .patch(`/api/v1/seller/products/${product.publicId}/images/reorder`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ imageIds: [imgA.imageId.toString()] }); // missing the second image

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REORDER_INVALID');
  });

  it('rejects an imageId that does not belong to the product with 400 REORDER_INVALID', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId);
    const otherProduct = await createTestProduct(seller.userId);
    const imgA = await prisma.productImage.create({ data: { productId: product.productId, cdnUrl: 'mock://a', position: 0 } });
    const foreignImg = await prisma.productImage.create({ data: { productId: otherProduct.productId, cdnUrl: 'mock://x', position: 0 } });

    const res = await request(app)
      .patch(`/api/v1/seller/products/${product.publicId}/images/reorder`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ imageIds: [foreignImg.imageId.toString(), imgA.imageId.toString()] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REORDER_INVALID');
  });
});
