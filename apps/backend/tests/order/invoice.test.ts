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

describe('GET /api/v1/orders/:id/invoice (Task 8 — on-demand HTML invoice)', () => {
  it('the owning buyer can download the invoice; commission is excluded regardless of role (Task 8.2)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { titleEn: 'Widget', price: 200 });
    const order = await createTestOrder(buyer.userId, seller.userId, product, { quantity: 2 });

    const res = await request(app)
      .get(`/api/v1/orders/${order.publicId}/invoice`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Widget');
    expect(res.text).toContain('400.00'); // subtotal: 200 * 2
    expect(res.text.toLowerCase()).not.toContain('commission');
  });

  it("the owning seller can also download it, still with no commission figures", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { price: 200 });
    const order = await createTestOrder(buyer.userId, seller.userId, product, { quantity: 2 });

    const res = await request(app)
      .get(`/api/v1/orders/${order.publicId}/invoice`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.text.toLowerCase()).not.toContain('commission');
  });

  it('Admin/Support can also download it', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const admin = await createTestUser('SUPPORT');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product);

    const res = await request(app)
      .get(`/api/v1/orders/${order.publicId}/invoice`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
  });

  it('an unrelated buyer gets 403', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const stranger = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product);

    const res = await request(app)
      .get(`/api/v1/orders/${order.publicId}/invoice`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('escapes HTML in snapshotted fields to prevent injection via a malicious title', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { titleEn: '<script>alert(1)</script>' });
    const order = await createTestOrder(buyer.userId, seller.userId, product);

    const res = await request(app)
      .get(`/api/v1/orders/${order.publicId}/invoice`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('<script>alert(1)</script>');
    expect(res.text).toContain('&lt;script&gt;');
  });
});
