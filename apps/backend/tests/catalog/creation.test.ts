jest.mock('axios');

import axios from 'axios';
import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const mockedAxiosPost = axios.post as jest.Mock;

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  mockedAxiosPost.mockReset();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('POST /api/v1/seller/products (Task 3.3 — create Draft)', () => {
  it('creates a Draft product owned by the caller', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });

    const res = await request(app)
      .post('/api/v1/seller/products')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ titleEn: 'Wireless Mouse', price: 1500 });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.titleEn).toBe('Wireless Mouse');

    const row = await prisma.product.findUniqueOrThrow({ where: { publicId: res.body.data.id } });
    expect(row.sellerId).toBe(seller.userId);
    expect(row.stock).toBe(0);
  });

  it('rejects a non-onboarded seller (STORE_NOT_ONBOARDED)', async () => {
    const seller = await createTestUser('SELLER'); // onboarded defaults to false

    const res = await request(app)
      .post('/api/v1/seller/products')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ titleEn: 'X', price: 100 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('STORE_NOT_ONBOARDED');
  });

  it('rejects a Buyer with 403 (seller-only)', async () => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app)
      .post('/api/v1/seller/products')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ titleEn: 'X', price: 100 });
    expect(res.status).toBe(403);
  });

  it('rejects a nonexistent categoryId with 404', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app)
      .post('/api/v1/seller/products')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ titleEn: 'X', price: 100, categoryId: '999999' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
  });
});

describe('POST /api/v1/seller/products/:id/generate-listing (Task 3.4 — mock AI orchestration)', () => {
  it('populates AI fields on success and matches a real category slug', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const category = await prisma.category.findFirstOrThrow({ where: { slug: 'electronics' } });
    const product = await createTestProduct(seller.userId, { titleEn: 'placeholder', price: 10 });
    await prisma.productImage.create({
      data: { productId: product.productId, cdnUrl: 'mock://storage/products/1/0-x.jpg', position: 0 },
    });

    mockedAxiosPost.mockResolvedValue({
      data: {
        title_en: 'Bluetooth Speaker',
        title_ur: 'بلوٹوتھ اسپیکر',
        description_en: 'Great sound.',
        description_ur: 'زبردست آواز۔',
        category: 'electronics',
        tags: ['audio', 'bluetooth'],
      },
    });

    const res = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/generate-listing`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.titleEn).toBe('Bluetooth Speaker');
    expect(res.body.data.aiGenerated).toBe(true);
    expect(res.body.data.category?.id).toBe(category.categoryId.toString());
  });

  it("keeps the existing categoryId when AI's guessed slug matches no real category", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const category = await prisma.category.findFirstOrThrow({ where: { slug: 'electronics' } });
    const product = await createTestProduct(seller.userId, { categoryId: category.categoryId });
    await prisma.productImage.create({
      data: { productId: product.productId, cdnUrl: 'mock://x.jpg', position: 0 },
    });

    mockedAxiosPost.mockResolvedValue({
      data: {
        title_en: 'Something',
        title_ur: 'کچھ',
        description_en: 'd',
        description_ur: 'د',
        category: 'not-a-real-slug',
        tags: [],
      },
    });

    const res = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/generate-listing`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.category?.id).toBe(category.categoryId.toString());
  });

  it('rejects generation with no image uploaded yet (PRODUCT_IMAGE_REQUIRED)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId);

    const res = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/generate-listing`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PRODUCT_IMAGE_REQUIRED');
    expect(mockedAxiosPost).not.toHaveBeenCalled();
  });

  it('rejects generation for a non-Draft product (PRODUCT_NOT_DRAFT)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const category = await prisma.category.findFirstOrThrow({ where: { slug: 'electronics' } });
    const product = await createTestProduct(seller.userId, { status: 'LIVE', categoryId: category.categoryId });
    await prisma.productImage.create({ data: { productId: product.productId, cdnUrl: 'mock://x.jpg', position: 0 } });

    const res = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/generate-listing`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PRODUCT_NOT_DRAFT');
  });

  // REQ-F-Store005: failure must never touch the row (fields stay as-is for manual entry).
  it('returns 503 without modifying the product when ai-service fails', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { titleEn: 'Original Title' });
    await prisma.productImage.create({ data: { productId: product.productId, cdnUrl: 'mock://x.jpg', position: 0 } });

    mockedAxiosPost.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/generate-listing`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({});

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_GENERATION_FAILED');

    const row = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(row.titleEn).toBe('Original Title');
    expect(row.aiGenerated).toBe(false);
  });

  it("rejects a Seller B calling generate-listing on Seller A's product (403)", async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(sellerA.userId);

    const res = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/generate-listing`)
      .set('Authorization', `Bearer ${sellerB.accessToken}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PRODUCT_NOT_OWNED');
    expect(mockedAxiosPost).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/seller/products/:id/publish (Task 3.5 — publish gating)', () => {
  it('publishes successfully when title + image + category are all present', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const category = await prisma.category.findFirstOrThrow({ where: { slug: 'electronics' } });
    const product = await createTestProduct(seller.userId, { categoryId: category.categoryId });
    await prisma.productImage.create({ data: { productId: product.productId, cdnUrl: 'mock://x.jpg', position: 0 } });

    const res = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/publish`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('LIVE');
  });

  it('blocks publish when the image requirement is not met, naming it specifically', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const category = await prisma.category.findFirstOrThrow({ where: { slug: 'electronics' } });
    const product = await createTestProduct(seller.userId, { categoryId: category.categoryId });
    // No image uploaded.

    const res = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/publish`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PUBLISH_REQUIREMENTS_NOT_MET');
    expect(res.body.error.details.missing).toContain('image');
  });

  it('blocks publish when the category requirement is not met, naming it specifically', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId); // no categoryId
    await prisma.productImage.create({ data: { productId: product.productId, cdnUrl: 'mock://x.jpg', position: 0 } });

    const res = await request(app)
      .post(`/api/v1/seller/products/${product.publicId}/publish`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.details.missing).toContain('category');
  });
});

describe('GET /api/v1/products/:publicId (Task 3.6 — public detail with owner preview)', () => {
  it('returns a LIVE product to an anonymous caller', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const category = await prisma.category.findFirstOrThrow({ where: { slug: 'electronics' } });
    const product = await createTestProduct(seller.userId, { status: 'LIVE', categoryId: category.categoryId });

    const res = await request(app).get(`/api/v1/products/${product.publicId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(product.publicId);
  });

  it('returns 404 (not 403) for an anonymous caller viewing a Draft product', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId); // DRAFT by default

    const res = await request(app).get(`/api/v1/products/${product.publicId}`);
    expect(res.status).toBe(404);
  });

  it('allows the owning Seller to preview their own Draft product', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId);

    const res = await request(app)
      .get(`/api/v1/products/${product.publicId}`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DRAFT');
  });

  it("returns 404 for a different Seller viewing another seller's Draft product", async () => {
    const sellerA = await createTestUser('SELLER', { onboarded: true });
    const sellerB = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(sellerA.userId);

    const res = await request(app)
      .get(`/api/v1/products/${product.publicId}`)
      .set('Authorization', `Bearer ${sellerB.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for a nonexistent publicId', async () => {
    const res = await request(app).get('/api/v1/products/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('proceeds as anonymous for a garbage bearer token on a public route (no 500)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });

    const res = await request(app)
      .get(`/api/v1/products/${product.publicId}`)
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(200);
  });
});
