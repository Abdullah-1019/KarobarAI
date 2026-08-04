jest.mock('../../src/adapters/storage', () => ({ getStorageAdapter: jest.fn() }));

import { Queue } from 'bullmq';
import request from 'supertest';

import { getStorageAdapter } from '../../src/adapters/storage';
import { config } from '../../src/core/config';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { closeNotificationQueue } from '../../src/modules/notification';
import { createTestOrder, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const JPEG_BUFFER = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 0)]);
const mockUpload = jest.fn();
const queueAddSpy = jest.spyOn(Queue.prototype, 'add').mockResolvedValue({} as never);

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  queueAddSpy.mockClear();
  mockUpload.mockReset();
  mockUpload.mockImplementation(async ({ key }: { key: string }) => ({
    key,
    url: `${config.storage.publicBaseUrl}/${config.storage.bucket}/${key}`,
  }));
  (getStorageAdapter as jest.Mock).mockReturnValue({ upload: mockUpload, delete: jest.fn(), getUrl: (k: string) => k });
});

afterAll(async () => {
  await closeNotificationQueue();
  await prisma.$disconnect();
  await redis.quit();
  queueAddSpy.mockRestore();
});

async function createReturnFixture() {
  const seller = await createTestUser('SELLER', { onboarded: true });
  const buyer = await createTestUser('BUYER');
  const product = await createTestProduct(seller.userId);
  const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: new Date() });
  const ret = await prisma.return.create({ data: { orderId: order.orderId, sellerId: seller.userId, reason: 'x' } });
  return { seller, buyer, order, ret };
}

describe('POST /api/v1/returns/:id/images (Task 3.1/3.2)', () => {
  it('uploads valid images and persists cdn_url via the storage adapter', async () => {
    const { buyer, ret } = await createReturnFixture();

    const res = await request(app)
      .post(`/api/v1/returns/${ret.returnId}/images`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .attach('images', JPEG_BUFFER, 'a.jpg');

    expect(res.status).toBe(200);
    expect(res.body.data.images).toHaveLength(1);
    expect(res.body.data.images[0].cdnUrl).toBeTruthy();
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-image file with 400 RETURN_IMAGE_INVALID_FILE', async () => {
    const { buyer, ret } = await createReturnFixture();
    const res = await request(app)
      .post(`/api/v1/returns/${ret.returnId}/images`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .attach('images', Buffer.from('not an image'), 'a.txt');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('RETURN_IMAGE_INVALID_FILE');
  });

  it('rejects uploads once the return is no longer INITIATED with 422 RETURN_INVALID_STATE', async () => {
    const { buyer, ret } = await createReturnFixture();
    await prisma.return.update({ where: { returnId: ret.returnId }, data: { status: 'MANUAL_REVIEW' } });

    const res = await request(app)
      .post(`/api/v1/returns/${ret.returnId}/images`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .attach('images', JPEG_BUFFER, 'a.jpg');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RETURN_INVALID_STATE');
  });

  it("rejects a non-owning buyer's upload with 403", async () => {
    const { ret } = await createReturnFixture();
    const stranger = await createTestUser('BUYER');
    const res = await request(app)
      .post(`/api/v1/returns/${ret.returnId}/images`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .attach('images', JPEG_BUFFER, 'a.jpg');
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/returns/:id/images/:imageId (Task 3.4)', () => {
  it('removes an image while INITIATED', async () => {
    const { buyer, ret } = await createReturnFixture();
    const image = await prisma.returnImage.create({ data: { returnId: ret.returnId, cdnUrl: 'http://x/1.jpg' } });

    const res = await request(app)
      .delete(`/api/v1/returns/${ret.returnId}/images/${image.returnImageId}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.images).toHaveLength(0);
  });

  it('returns 404 for an unknown image id', async () => {
    const { buyer, ret } = await createReturnFixture();
    const res = await request(app)
      .delete(`/api/v1/returns/${ret.returnId}/images/999999999`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RETURN_IMAGE_NOT_FOUND');
  });
});

describe('POST /api/v1/returns/:id/submit (Task 3.5)', () => {
  it('rejects submission with fewer than 3 images', async () => {
    const { buyer, ret } = await createReturnFixture();
    await prisma.returnImage.create({ data: { returnId: ret.returnId, cdnUrl: 'http://x/1.jpg' } });

    const res = await request(app)
      .post(`/api/v1/returns/${ret.returnId}/submit`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RETURN_IMAGES_INSUFFICIENT');
  });

  it('with 3+ images, transitions straight to MANUAL_REVIEW (never UNDER_AI_REVIEW) and notifies the seller', async () => {
    const { seller, buyer, ret } = await createReturnFixture();
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- fixture setup
      await prisma.returnImage.create({ data: { returnId: ret.returnId, cdnUrl: `http://x/${i}.jpg` } });
    }

    const res = await request(app)
      .post(`/api/v1/returns/${ret.returnId}/submit`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('MANUAL_REVIEW');

    const row = await prisma.return.findUniqueOrThrow({ where: { returnId: ret.returnId } });
    expect(row.status).toBe('MANUAL_REVIEW');

    const underReviewCalls = queueAddSpy.mock.calls.filter(
      (call) => call[1] && (call[1] as { type?: string }).type === 'RETURN_UNDER_REVIEW',
    );
    expect(underReviewCalls).toHaveLength(1);
    expect(underReviewCalls[0]?.[1]).toMatchObject({ userId: seller.userId.toString() });
  });

  it('rejects re-submitting an already-submitted return with 422', async () => {
    const { buyer, ret } = await createReturnFixture();
    await prisma.return.update({ where: { returnId: ret.returnId }, data: { status: 'MANUAL_REVIEW' } });

    const res = await request(app)
      .post(`/api/v1/returns/${ret.returnId}/submit`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RETURN_INVALID_STATE');
  });
});
