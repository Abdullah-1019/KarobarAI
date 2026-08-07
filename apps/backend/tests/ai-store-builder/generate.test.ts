jest.mock('axios');

import axios from 'axios';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { saveStagingImages } from '../../src/modules/ai-store-builder/ai-store-builder.repository';
import { createTestUser } from '../helpers/factories';
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

const VALID_AI_RESPONSE = {
  title_en: 'Wireless Speaker',
  title_ur: 'وائرلیس اسپیکر',
  description_en: 'A great wireless speaker with excellent sound quality and long battery life.',
  description_ur: 'ایک بہترین وائرلیس اسپیکر۔',
  category: 'Electronics',
  tags: ['speaker', 'wireless', 'bluetooth', 'audio', 'portable'],
};

async function stageImages(): Promise<string> {
  const stagingId = randomUUID();
  await saveStagingImages(stagingId, [{ cdnUrl: 'https://cdn.example/staged/0.jpg', position: 0 }]);
  return stagingId;
}

describe('POST /api/v1/products/ai-generate (Task 3/4/5)', () => {
  it('maps a successful AI Service response into a draft + seoPreview', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const stagingId = await stageImages();
    mockedAxiosPost.mockResolvedValueOnce({ data: VALID_AI_RESPONSE });

    const res = await request(app)
      .post('/api/v1/products/ai-generate')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ stagingId });

    expect(res.status).toBe(200);
    expect(res.body.data.stagingId).toBe(stagingId);
    expect(res.body.data.draft.titleEn).toBe('Wireless Speaker');
    expect(res.body.data.draft.aiGenerated).toBe(true);
    expect(res.body.data.seoPreview.metaTitle).toBe('Wireless Speaker');
  });

  it('sends the primary (position 0) staged image URL to the AI Service', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const stagingId = randomUUID();
    await saveStagingImages(stagingId, [
      { cdnUrl: 'https://cdn.example/staged/primary.jpg', position: 0 },
      { cdnUrl: 'https://cdn.example/staged/second.jpg', position: 1 },
    ]);
    mockedAxiosPost.mockResolvedValueOnce({ data: VALID_AI_RESPONSE });

    await request(app).post('/api/v1/products/ai-generate').set('Authorization', `Bearer ${seller.accessToken}`).send({ stagingId });

    expect(mockedAxiosPost.mock.calls[0]?.[1]).toMatchObject({ image_url: 'https://cdn.example/staged/primary.jpg' });
  });

  it('resolves an exact category name match to a real category_id', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const category = await prisma.category.findFirstOrThrow({ where: { slug: 'electronics' } });
    const stagingId = await stageImages();
    mockedAxiosPost.mockResolvedValueOnce({ data: { ...VALID_AI_RESPONSE, category: category.nameEn } });

    const res = await request(app).post('/api/v1/products/ai-generate').set('Authorization', `Bearer ${seller.accessToken}`).send({ stagingId });

    expect(res.body.data.draft.categoryId).toBe(category.categoryId.toString());
  });

  it('an unmatched category guess resolves to null, not an error, preserving the raw guess', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const stagingId = await stageImages();
    mockedAxiosPost.mockResolvedValueOnce({ data: { ...VALID_AI_RESPONSE, category: 'Completely Nonsense Category Zzz' } });

    const res = await request(app).post('/api/v1/products/ai-generate').set('Authorization', `Bearer ${seller.accessToken}`).send({ stagingId });

    expect(res.status).toBe(200);
    expect(res.body.data.draft.categoryId).toBeNull();
    expect(res.body.data.draft.categoryGuess).toBe('Completely Nonsense Category Zzz');
  });

  it('truncates a 12-tag AI response to the top 10', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const stagingId = await stageImages();
    const twelveTags = Array.from({ length: 12 }, (_, i) => `tag${i}`);
    mockedAxiosPost.mockResolvedValueOnce({ data: { ...VALID_AI_RESPONSE, tags: twelveTags } });

    const res = await request(app).post('/api/v1/products/ai-generate').set('Authorization', `Bearer ${seller.accessToken}`).send({ stagingId });

    expect(res.body.data.draft.tags).toHaveLength(10);
    expect(res.body.data.draft.tags).toEqual(twelveTags.slice(0, 10));
  });

  it('passes a 3-tag AI response through unmodified (soft pass-through, not an error)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const stagingId = await stageImages();
    mockedAxiosPost.mockResolvedValueOnce({ data: { ...VALID_AI_RESPONSE, tags: ['a', 'b', 'c'] } });

    const res = await request(app).post('/api/v1/products/ai-generate').set('Authorization', `Bearer ${seller.accessToken}`).send({ stagingId });

    expect(res.status).toBe(200);
    expect(res.body.data.draft.tags).toEqual(['a', 'b', 'c']);
  });

  it('unknown/expired stagingId is 404 AI_STAGING_NOT_FOUND', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const res = await request(app)
      .post('/api/v1/products/ai-generate')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ stagingId: randomUUID() });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('AI_STAGING_NOT_FOUND');
    expect(mockedAxiosPost).not.toHaveBeenCalled();
  });

  it('an AI Service timeout (ECONNABORTED) maps to 503 AI_GENERATION_TIMEOUT', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const stagingId = await stageImages();
    mockedAxiosPost.mockRejectedValueOnce({ code: 'ECONNABORTED' });

    const res = await request(app).post('/api/v1/products/ai-generate').set('Authorization', `Bearer ${seller.accessToken}`).send({ stagingId });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_GENERATION_TIMEOUT');
  });

  it("the AI Service's own structured 502 failure maps to AI_GENERATION_FAILED", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const stagingId = await stageImages();
    mockedAxiosPost.mockRejectedValueOnce({ response: { status: 502, data: { error: 'GENERATION_FAILED' } } });

    const res = await request(app).post('/api/v1/products/ai-generate').set('Authorization', `Bearer ${seller.accessToken}`).send({ stagingId });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_GENERATION_FAILED');
  });

  it('an unreachable AI Service (connection refused) maps to AI_SERVICE_UNAVAILABLE', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const stagingId = await stageImages();
    mockedAxiosPost.mockRejectedValueOnce({ code: 'ECONNREFUSED' });

    const res = await request(app).post('/api/v1/products/ai-generate').set('Authorization', `Bearer ${seller.accessToken}`).send({ stagingId });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_SERVICE_UNAVAILABLE');
  });

  it('a malformed/partial AI Service response (missing a required field) is a full failure, never a partial draft (Task 3.6)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const stagingId = await stageImages();
    const { title_ur: _titleUr, ...incomplete } = VALID_AI_RESPONSE;
    mockedAxiosPost.mockResolvedValueOnce({ data: incomplete });

    const res = await request(app).post('/api/v1/products/ai-generate').set('Authorization', `Bearer ${seller.accessToken}`).send({ stagingId });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_GENERATION_FAILED');
    expect(res.body.data).toBeNull(); // the envelope's fail() always sets data: null, never a partial draft
  });

  it('Retry: a second call with the same stagingId re-invokes generation without requiring re-upload', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const stagingId = await stageImages();

    mockedAxiosPost.mockRejectedValueOnce({ code: 'ECONNREFUSED' });
    const first = await request(app).post('/api/v1/products/ai-generate').set('Authorization', `Bearer ${seller.accessToken}`).send({ stagingId });
    expect(first.status).toBe(503);

    mockedAxiosPost.mockResolvedValueOnce({ data: VALID_AI_RESPONSE });
    const second = await request(app).post('/api/v1/products/ai-generate').set('Authorization', `Bearer ${seller.accessToken}`).send({ stagingId });
    expect(second.status).toBe(200);
    expect(second.body.data.draft.titleEn).toBe('Wireless Speaker');
  });

  it('rejects a Buyer (403)', async () => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app).post('/api/v1/products/ai-generate').set('Authorization', `Bearer ${buyer.accessToken}`).send({ stagingId: randomUUID() });
    expect(res.status).toBe(403);
    expect(mockedAxiosPost).not.toHaveBeenCalled();
  });
});
