import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestOrder, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

const PII_FIELD_NAMES = ['shipName', 'shipPhone', 'shipLine1', 'shipLine2', 'recipientName', 'phone', 'address', 'buyerName'];

describe('GET /api/v1/t/:publicToken (Task 5.2 — public, login-free tracking)', () => {
  it('resolves via tracking_token and returns a minimal, PII-free DTO, no auth required', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'PROCESSING',
      courier: 'TCS',
      trackingNo: 'MOCK-TCS-ABC12345',
    });

    const res = await request(app).get(`/api/v1/t/${order.trackingToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PROCESSING');
    expect(res.body.data.courier).toBe('TCS');
    expect(res.body.data.trackingNo).toBe('MOCK-TCS-ABC12345');

    const bodyText = JSON.stringify(res.body.data);
    for (const field of PII_FIELD_NAMES) {
      expect(bodyText).not.toContain(field);
    }
    expect(bodyText).not.toContain('Test Recipient');
    expect(bodyText).not.toContain('03001234567');
  });

  it('returns 404 TRACKING_TOKEN_INVALID for an unknown token', async () => {
    const res = await request(app).get('/api/v1/t/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRACKING_TOKEN_INVALID');
  });
});

describe('GET /api/v1/tracking/:orderId (Task 5.3 — authenticated, tri-mode ownership)', () => {
  it('the owning buyer, owning seller, and Admin/Support can all read it', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const admin = await createTestUser('ADMIN');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING' });

    for (const user of [buyer, seller, admin]) {
      // eslint-disable-next-line no-await-in-loop -- three sequential ownership checks
      const res = await request(app)
        .get(`/api/v1/tracking/${order.publicId}`)
        .set('Authorization', `Bearer ${user.accessToken}`);
      expect(res.status).toBe(200);
    }
  });

  it("rejects an unrelated buyer/seller with 403", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const stranger = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING' });

    const res = await request(app)
      .get(`/api/v1/tracking/${order.publicId}`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/tracking/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });
});
