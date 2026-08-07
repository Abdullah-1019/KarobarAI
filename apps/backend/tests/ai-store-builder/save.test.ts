jest.mock('axios');
jest.mock('../../src/adapters/storage', () => ({ getStorageAdapter: jest.fn() }));

import axios from 'axios';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { getStorageAdapter } from '../../src/adapters/storage';
import { config } from '../../src/core/config';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { saveStagingImages } from '../../src/modules/ai-store-builder/ai-store-builder.repository';
import { createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const mockedAxiosPost = axios.post as jest.Mock;
const mockUpload = jest.fn();
const JPEG_BUFFER = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 0)]);

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  mockedAxiosPost.mockReset();
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

async function stageImages(count = 1): Promise<string> {
  const stagingId = randomUUID();
  const images = Array.from({ length: count }, (_, i) => ({ cdnUrl: `https://cdn.example/staged/${i}.jpg`, position: i }));
  await saveStagingImages(stagingId, images);
  return stagingId;
}

describe('POST /api/v1/products/ai-generate/save (Task 6)', () => {
  it('saves as Draft with only the minimum fields, ai_generated=true', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const stagingId = await stageImages();

    const res = await request(app)
      .post('/api/v1/products/ai-generate/save')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ stagingId, titleEn: 'A Product', price: 500, status: 'DRAFT', aiGenerated: true });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.aiGenerated).toBe(true);
    expect(res.body.data.images).toHaveLength(1);
  });

  it('saves and publishes when status=LIVE and all REQ-F-Store003 fields are present', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const category = await prisma.category.findFirstOrThrow({ where: { slug: 'electronics' } });
    const stagingId = await stageImages();

    const res = await request(app)
      .post('/api/v1/products/ai-generate/save')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ stagingId, titleEn: 'A Product', price: 500, categoryId: category.categoryId.toString(), status: 'LIVE', aiGenerated: true });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('LIVE');
  });

  it('publish attempt without category is 422 PUBLISH_REQUIREMENTS_NOT_MET — identical to Feature 4\'s manual-entry rule, no AI-path exception', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const stagingId = await stageImages();

    const res = await request(app)
      .post('/api/v1/products/ai-generate/save')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ stagingId, titleEn: 'A Product', price: 500, status: 'LIVE', aiGenerated: true });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PUBLISH_REQUIREMENTS_NOT_MET');
  });

  it('promotes staged images to real product_images rows, preserving position order (0 = primary)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const stagingId = await stageImages(2);

    const res = await request(app)
      .post('/api/v1/products/ai-generate/save')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ stagingId, titleEn: 'A Product', price: 500, status: 'DRAFT', aiGenerated: true });

    expect(res.body.data.images).toHaveLength(2);
    const images = [...res.body.data.images].sort((a: { position: number }, b: { position: number }) => a.position - b.position);
    expect(images[0].url).toBe('https://cdn.example/staged/0.jpg');
    expect(images[1].url).toBe('https://cdn.example/staged/1.jpg');
  });

  it('persists ai_generated=false when the request explicitly says so (manual-entry fallback through the same endpoint, REQ-F-Store005)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const stagingId = await stageImages();

    const res = await request(app)
      .post('/api/v1/products/ai-generate/save')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ stagingId, titleEn: 'Manually Entered', price: 300, status: 'DRAFT', aiGenerated: false });

    expect(res.status).toBe(201);
    expect(res.body.data.aiGenerated).toBe(false);
  });

  it('unknown/expired stagingId is 404 AI_STAGING_NOT_FOUND', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app)
      .post('/api/v1/products/ai-generate/save')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ stagingId: randomUUID(), titleEn: 'X', price: 100, status: 'DRAFT', aiGenerated: false });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('AI_STAGING_NOT_FOUND');
  });

  it('the staging session is consumed on save — a second save attempt with the same stagingId 404s', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const stagingId = await stageImages();

    const first = await request(app)
      .post('/api/v1/products/ai-generate/save')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ stagingId, titleEn: 'First', price: 100, status: 'DRAFT', aiGenerated: false });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/products/ai-generate/save')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ stagingId, titleEn: 'Second', price: 200, status: 'DRAFT', aiGenerated: false });
    expect(second.status).toBe(404);
  });

  it('rejects a Buyer (403)', async () => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app)
      .post('/api/v1/products/ai-generate/save')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ stagingId: randomUUID(), titleEn: 'X', price: 100, status: 'DRAFT', aiGenerated: false });
    expect(res.status).toBe(403);
  });

  it('end-to-end: upload -> generate -> save(LIVE) -> product appears in storefront search with the correct ai_generated flag (Task 6\'s DoD)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const category = await prisma.category.findFirstOrThrow({ where: { slug: 'electronics' } });

    const uploadRes = await request(app)
      .post('/api/v1/products/ai-generate/upload')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('images', JPEG_BUFFER, 'speaker.jpg');
    expect(uploadRes.status).toBe(201);
    const { stagingId } = uploadRes.body.data;

    mockedAxiosPost.mockResolvedValueOnce({
      data: {
        title_en: 'Wireless Speaker',
        title_ur: 'وائرلیس اسپیکر',
        description_en: 'A great wireless speaker.',
        description_ur: 'ایک بہترین اسپیکر۔',
        category: category.nameEn,
        tags: ['speaker', 'wireless', 'bluetooth', 'audio', 'portable'],
      },
    });
    const generateRes = await request(app).post('/api/v1/products/ai-generate').set('Authorization', `Bearer ${seller.accessToken}`).send({ stagingId });
    expect(generateRes.status).toBe(200);
    const { draft } = generateRes.body.data;

    const saveRes = await request(app)
      .post('/api/v1/products/ai-generate/save')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({
        stagingId,
        titleEn: draft.titleEn,
        titleUr: draft.titleUr,
        descriptionEn: draft.descriptionEn,
        descriptionUr: draft.descriptionUr,
        price: 4999,
        stock: 10,
        categoryId: draft.categoryId,
        tags: draft.tags,
        status: 'LIVE',
        aiGenerated: draft.aiGenerated,
      });
    expect(saveRes.status).toBe(201);
    expect(saveRes.body.data.status).toBe('LIVE');
    expect(saveRes.body.data.aiGenerated).toBe(true);

    const searchRes = await request(app).get('/api/v1/products/search').query({ q: 'Wireless Speaker' });
    expect(searchRes.body.data.items.map((i: { id: string }) => i.id)).toContain(saveRes.body.data.id);
  });
});
