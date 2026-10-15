import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { closeNotificationQueue } from '../../src/modules/notification';
import { createTestOrder, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => { await resetDb(); await resetRedis(); });
afterAll(async () => { await closeNotificationQueue(); await prisma.$disconnect(); await redis.quit(); });

it('approval records a return decision without booking a courier or issuing a refund', async () => {
  const seller = await createTestUser('SELLER', { onboarded: true });
  const buyer = await createTestUser('BUYER');
  const product = await createTestProduct(seller.userId);
  const order = await createTestOrder(buyer.userId, seller.userId, product,
    { status: 'DELIVERED', deliveredAt: new Date(), paymentMethod: 'COD' });
  const ret = await prisma.return.create({ data: { orderId: order.orderId, sellerId: seller.userId,
    reason: 'DAMAGED', status: 'MANUAL_REVIEW' } });
  const response = await request(app).post(`/api/v1/seller/returns/${ret.returnId}/decision`)
    .set('Authorization', `Bearer ${seller.accessToken}`).send({ decision: 'APPROVED' });
  expect(response.status).toBe(200);
  expect(response.body.data.status).toBe('APPROVED');
  expect(response.body.data.refundStatus).toBe('NOT_ISSUED');
  expect(await prisma.returnShipment.count({ where: { returnId: ret.returnId } })).toBe(0);
  expect(await prisma.payment.count({ where: { status: 'REFUNDED' } })).toBe(0);
});
