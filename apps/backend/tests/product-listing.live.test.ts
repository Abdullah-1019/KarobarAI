import request from 'supertest';
import { randomUUID } from 'node:crypto';

import { prisma } from '../src/core/prisma';
import { redis } from '../src/core/redis';
import { config } from '../src/core/config';
import { app } from '../src/server';
import { saveStagingImages } from '../src/modules/ai-store-builder/ai-store-builder.repository';
import { createTestProduct, createTestUser } from './helpers/factories';

jest.setTimeout(150_000);

const liveDescribe = process.env.RUN_LIVE_LISTING_TEST === '1' ? describe : describe.skip;

liveDescribe('live hosted listing integration against an isolated test database', () => {
  const sellerUserIds: bigint[] = [];
  const productIds: bigint[] = [];

  function syntheticImageUrl(): string {
    const imageUrl = process.env.LIVE_LISTING_IMAGE_URL;
    const syntheticPrefix = `${config.storage.publicBaseUrl}/${config.storage.bucket}/benchmarks/`;
    if (process.env.TEST_ISOLATED_DATABASE !== '1' || !imageUrl?.startsWith(syntheticPrefix)) {
      throw new Error('Live listing requires an isolated database and a synthetic benchmark image');
    }
    return imageUrl;
  }

  afterAll(async () => {
    if (productIds.length > 0) await prisma.product.deleteMany({ where: { productId: { in: productIds } } });
    if (sellerUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: sellerUserIds } } });
      await prisma.sellerProfile.deleteMany({ where: { userId: { in: sellerUserIds } } });
      await prisma.user.deleteMany({ where: { userId: { in: sellerUserIds } } });
    }
    await prisma.$disconnect();
    await redis.quit();
  });

  it('sends a synthetic image through the backend and persists a validated Gemini listing', async () => {
    const imageUrl = syntheticImageUrl();
    const seller = await createTestUser('SELLER', { onboarded: true });
    sellerUserIds.push(seller.userId);
    const product = await createTestProduct(seller.userId, { titleEn: 'Temporary live verification' });
    productIds.push(product.productId);
    await prisma.productImage.create({
      data: {
        productId: product.productId,
        cdnUrl: imageUrl,
        position: 0,
      },
    });

    const result = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/generate-listing`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ hint: 'A blue T-shirt graphic on a plain background.' });

    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({
      aiGenerated: true,
      titleEn: expect.any(String),
      titleUr: expect.any(String),
      descriptionEn: expect.any(String),
      descriptionUr: expect.any(String),
    });
    expect(result.body.data.titleEn.length).toBeGreaterThan(0);
    const persisted = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(persisted.aiGenerated).toBe(true);
    expect(persisted.titleEn).toBe(result.body.data.titleEn);
  });

  it('returns a review draft without automatically creating a product', async () => {
    const imageUrl = syntheticImageUrl();
    const seller = await createTestUser('SELLER', { onboarded: true });
    sellerUserIds.push(seller.userId);
    const stagingId = randomUUID();
    await saveStagingImages(stagingId, [{ cdnUrl: imageUrl, position: 0 }]);

    const result = await request(app)
      .post('/api/v1/products/ai-generate')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ stagingId, categoryHint: 'A blue T-shirt graphic on a plain background.' });

    expect(result.status).toBe(200);
    expect(result.body.data.stagingId).toBe(stagingId);
    expect(result.body.data.draft).toMatchObject({
      aiGenerated: true,
      titleEn: expect.any(String),
      titleUr: expect.any(String),
      descriptionEn: expect.any(String),
      descriptionUr: expect.any(String),
    });
    expect(result.body.data.draft.titleEn.length).toBeGreaterThan(0);
    expect(await prisma.product.count({ where: { sellerId: seller.userId } })).toBe(0);
  });
});
