import request from 'supertest';

import { prisma } from '../src/core/prisma';
import { redis } from '../src/core/redis';
import { app } from '../src/server';
import { createTestProduct, createTestUser } from './helpers/factories';

jest.setTimeout(700_000);

const liveDescribe = process.env.RUN_LIVE_LISTING_TEST === '1' ? describe : describe.skip;

liveDescribe('live local Ollama listing integration', () => {
  let sellerUserId: bigint | undefined;
  let productId: bigint | undefined;

  afterAll(async () => {
    if (productId !== undefined) await prisma.product.deleteMany({ where: { productId } });
    if (sellerUserId !== undefined) {
      await prisma.refreshToken.deleteMany({ where: { userId: sellerUserId } });
      await prisma.sellerProfile.deleteMany({ where: { userId: sellerUserId } });
      await prisma.user.deleteMany({ where: { userId: sellerUserId } });
    }
    await prisma.$disconnect();
    await redis.quit();
  });

  it('sends a development image through the backend and validates the Ollama listing response', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    sellerUserId = seller.userId;
    const product = await createTestProduct(seller.userId, { titleEn: 'Temporary live verification' });
    productId = product.productId;
    await prisma.productImage.create({
      data: {
        productId: product.productId,
        cdnUrl: 'http://host.docker.internal:8765/ollama-listing-product.png',
        position: 0,
      },
    });

    const result = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/generate-listing`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ hint: 'A blue cotton t-shirt on a plain background.' });

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
});
