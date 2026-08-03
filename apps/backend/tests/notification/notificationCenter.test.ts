import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { processNotificationEvent } from '../../src/modules/notification/notification.service';
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

describe('GET /api/v1/notifications (Task 4.1 — ownership + pagination)', () => {
  it("returns only the authenticated user's own notifications", async () => {
    const buyerA = await createTestUser('BUYER');
    const buyerB = await createTestUser('BUYER');
    await processNotificationEvent({ userId: buyerA.userId.toString(), type: 'ORDER_DELIVERED', vars: { orderId: '1' } });
    await processNotificationEvent({ userId: buyerB.userId.toString(), type: 'ORDER_DELIVERED', vars: { orderId: '2' } });

    const res = await request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${buyerA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });

  it('cursor-paginates chronologically', async () => {
    const buyer = await createTestUser('BUYER');
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- fixture setup, order matters
      await processNotificationEvent({ userId: buyer.userId.toString(), type: 'ORDER_PICKED_UP', vars: { orderId: String(i) } });
    }

    const page1 = await request(app)
      .get('/api/v1/notifications')
      .query({ limit: 2 })
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(page1.body.data.items).toHaveLength(2);
    expect(page1.body.data.nextCursor).not.toBeNull();

    const page2 = await request(app)
      .get('/api/v1/notifications')
      .query({ limit: 2, cursor: page1.body.data.nextCursor })
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(page2.body.data.items).toHaveLength(1);
    expect(page2.body.data.nextCursor).toBeNull();
  });

  it('includes the related order\'s publicId for click-through navigation (Task 4.5 — reuses existing order routes)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED' });
    await processNotificationEvent({
      userId: buyer.userId.toString(),
      type: 'ORDER_DELIVERED',
      orderId: order.publicId,
      vars: { orderId: order.publicId },
    });

    const res = await request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.body.data.items[0].orderId).toBe(order.publicId);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/notifications/unread-count (Task 4.2)', () => {
  it('matches the actual unread count and decrements after marking one read', async () => {
    const buyer = await createTestUser('BUYER');
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- fixture setup
      await processNotificationEvent({ userId: buyer.userId.toString(), type: 'ORDER_PICKED_UP', vars: { orderId: String(i) } });
    }

    const before = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(before.body.data.count).toBe(5);

    const list = await request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${buyer.accessToken}`);
    const firstId = list.body.data.items[0].id;
    await request(app).patch(`/api/v1/notifications/${firstId}/read`).set('Authorization', `Bearer ${buyer.accessToken}`);

    const after = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(after.body.data.count).toBe(4);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/notifications/unread-count');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/notifications/:id/read (Task 3.4/4.3 — ownership)', () => {
  it('the owning user can mark their own notification as read', async () => {
    const buyer = await createTestUser('BUYER');
    await processNotificationEvent({ userId: buyer.userId.toString(), type: 'ORDER_PICKED_UP', vars: { orderId: '1' } });
    const list = await request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${buyer.accessToken}`);
    const id = list.body.data.items[0].id;

    const res = await request(app).patch(`/api/v1/notifications/${id}/read`).set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(200);

    const row = await prisma.notification.findUniqueOrThrow({ where: { notificationId: BigInt(id) } });
    expect(row.status).toBe('READ');
    expect(row.readAt).not.toBeNull();
  });

  it("rejects a different user's attempt to mark it as read with 403", async () => {
    const buyerA = await createTestUser('BUYER');
    const buyerB = await createTestUser('BUYER');
    await processNotificationEvent({ userId: buyerA.userId.toString(), type: 'ORDER_PICKED_UP', vars: { orderId: '1' } });
    const list = await request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${buyerA.accessToken}`);
    const id = list.body.data.items[0].id;

    const res = await request(app).patch(`/api/v1/notifications/${id}/read`).set('Authorization', `Bearer ${buyerB.accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOTIFICATION_NOT_OWNED');
  });

  it('returns 404 for a nonexistent notification id', async () => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app).patch('/api/v1/notifications/999999999/read').set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).patch('/api/v1/notifications/1/read');
    expect(res.status).toBe(401);
  });
});
