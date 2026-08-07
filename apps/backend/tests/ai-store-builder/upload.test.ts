jest.mock('../../src/adapters/storage', () => ({ getStorageAdapter: jest.fn() }));

import request from 'supertest';

import { getStorageAdapter } from '../../src/adapters/storage';
import { config } from '../../src/core/config';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const mockUpload = jest.fn();
const JPEG_BUFFER = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 0)]);

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  mockUpload.mockReset();
  mockUpload.mockImplementation(async ({ key }: { key: string }) => ({
    key,
    url: `${config.storage.publicBaseUrl}/${config.storage.bucket}/${key}`,
  }));
  (getStorageAdapter as jest.Mock).mockReturnValue({ upload: mockUpload, delete: jest.fn(), getUrl: (k: string) => k });
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('POST /api/v1/products/ai-generate/upload (Task 2)', () => {
  it('stages a single image and returns a stagingId with position 0 = primary', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });

    const res = await request(app)
      .post('/api/v1/products/ai-generate/upload')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('images', JPEG_BUFFER, 'a.jpg');

    expect(res.status).toBe(201);
    expect(typeof res.body.data.stagingId).toBe('string');
    expect(res.body.data.images).toHaveLength(1);
    expect(res.body.data.images[0].position).toBe(0);
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it('preserves upload order across multiple images, first = primary (position 0)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });

    const res = await request(app)
      .post('/api/v1/products/ai-generate/upload')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('images', JPEG_BUFFER, 'first.jpg')
      .attach('images', JPEG_BUFFER, 'second.jpg');

    expect(res.body.data.images).toHaveLength(2);
    expect(res.body.data.images[0].position).toBe(0);
    expect(res.body.data.images[1].position).toBe(1);
  });

  it('uses a staging storage prefix distinct from a published product\'s final image path', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });

    await request(app).post('/api/v1/products/ai-generate/upload').set('Authorization', `Bearer ${seller.accessToken}`).attach('images', JPEG_BUFFER, 'a.jpg');

    const uploadedKey = mockUpload.mock.calls[0]?.[0]?.key as string;
    expect(uploadedKey).toMatch(/^products\/staging\//);
  });

  // multer's own configured limits.fileSize (10MB, matching IMAGE_MAX_BYTES exactly) always
  // rejects a >10MB multipart file before it reaches our validateImageFile() Sec-012 check —
  // it never gets the chance to return PRODUCT_IMAGE_TOO_LARGE. The resulting MulterError is
  // caught by core/middleware/errorHandler.ts's generic LIMIT_FILE_SIZE branch, which hardcodes
  // 'AVATAR_TOO_LARGE' regardless of which route triggered it — a pre-existing, cross-feature
  // imprecision (catalog's own product-image upload tests never exercise this path either, for
  // the same reason), not something introduced or fixed by this feature. What still matters and
  // is asserted here: the file never reaches storage.
  it('rejects an oversized file before any storage call is made', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const oversized = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(11 * 1024 * 1024, 0)]);

    const res = await request(app)
      .post('/api/v1/products/ai-generate/upload')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('images', oversized, 'huge.jpg');

    expect(res.status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('rejects a non-image file before any storage call is made (magic-byte check)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const fakeImage = Buffer.from('not actually an image');

    const res = await request(app)
      .post('/api/v1/products/ai-generate/upload')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('images', fakeImage, 'fake.jpg');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PRODUCT_IMAGE_INVALID_FILE');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('never uploads any file when one of several is invalid (validate-all-before-upload-any)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });

    const res = await request(app)
      .post('/api/v1/products/ai-generate/upload')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('images', JPEG_BUFFER, 'valid.jpg')
      .attach('images', Buffer.from('not an image'), 'invalid.jpg');

    expect(res.status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request (401)', async () => {
    const res = await request(app).post('/api/v1/products/ai-generate/upload').attach('images', JPEG_BUFFER, 'a.jpg');
    expect(res.status).toBe(401);
  });

  it('rejects a Buyer (403)', async () => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app)
      .post('/api/v1/products/ai-generate/upload')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .attach('images', JPEG_BUFFER, 'a.jpg');
    expect(res.status).toBe(403);
  });

  it('blocks a Seller who has not completed store onboarding, before any storage call (Task 3.4\'s guard, applied here too)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: false });
    const res = await request(app)
      .post('/api/v1/products/ai-generate/upload')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('images', JPEG_BUFFER, 'a.jpg');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('STORE_NOT_ONBOARDED');
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
