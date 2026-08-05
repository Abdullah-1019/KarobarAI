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

afterEach(async () => {
  // Several tests below write config values — restore seeded defaults so other test files'
  // return-window/commission/min-order-value assumptions aren't affected (same precedent as
  // tests/settlement/settlementCycle.test.ts's own afterEach for this same table).
  await prisma.platformConfig.update({ where: { configKey: 'return_window_days' }, data: { value: 14 } });
  await prisma.platformConfig.update({
    where: { configKey: 'courier_weights' },
    data: { value: { cost: 0.4, time: 0.3, reliability: 0.2, coverage: 0.1 } },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('GET /api/v1/admin/config (Task 6.1)', () => {
  it('returns all five seeded config keys with correct writable flags', async () => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app).get('/api/v1/admin/config').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(5);
    const byKey = (key: string) => res.body.data.items.find((i: { key: string }) => i.key === key);
    expect(byKey('commission_rate_default').value).toBe(0.05);
    expect(byKey('return_window_days').writable).toBe(true);
    expect(byKey('returns_confidence_threshold').writable).toBe(false); // Task 6.5
  });
});

describe('PATCH /api/v1/admin/config/:key (Task 6.3)', () => {
  it('a valid update succeeds, is audited, and reflects immediately in GET', async () => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app)
      .patch('/api/v1/admin/config/return_window_days')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ value: 21, reason: 'seasonal policy change' });
    expect(res.status).toBe(200);

    const getRes = await request(app).get('/api/v1/admin/config').set('Authorization', `Bearer ${admin.accessToken}`);
    const entry = getRes.body.data.items.find((i: { key: string }) => i.key === 'return_window_days');
    expect(entry.value).toBe(21);

    // platform_config's PK is a string (config_key), not the bigint audit_logs.entity_id expects
    // (entityId is always null for this entity — see config.service.ts), and audit_logs is
    // never truncated by resetDb() (append-only across the whole suite run), so this scopes by
    // the test's own unique `reason` text rather than entity/action alone.
    const auditRows = await prisma.auditLog.findMany({ where: { entity: 'platform_config', action: 'CONFIG_CHANGE', reason: 'seasonal policy change' } });
    expect(auditRows).toHaveLength(1);
  });

  it('a config change is visible to an existing consumer (Feature 10\'s return-eligibility check) without a deploy (Task 6.4)', async () => {
    const admin = await createTestUser('ADMIN');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: tenDaysAgo });

    // Default window (14 days) still covers a 10-day-old delivery — eligible.
    const before = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ orderId: order.publicId, reason: 'test' });
    expect(before.status).toBe(201);

    await request(app)
      .patch('/api/v1/admin/config/return_window_days')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ value: 5, reason: 'shrink window' });

    const order2 = await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED', deliveredAt: tenDaysAgo });
    const after = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ orderId: order2.publicId, reason: 'test' });
    expect(after.status).toBe(422); // now outside the shrunk 5-day window — no redeploy needed
    expect(after.body.error.code).toBe('RETURN_WINDOW_CLOSED');
  });

  it('courier weights summing to 0.9 (not 1.0) is rejected 422 INVALID_CONFIG_VALUE', async () => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app)
      .patch('/api/v1/admin/config/courier_weights')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ value: { cost: 0.3, time: 0.3, reliability: 0.2, coverage: 0.1 }, reason: 'x' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_CONFIG_VALUE');
  });

  it('courier weights summing to exactly 1.0 is accepted', async () => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app)
      .patch('/api/v1/admin/config/courier_weights')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ value: { cost: 0.25, time: 0.25, reliability: 0.25, coverage: 0.25 }, reason: 'rebalance' });
    expect(res.status).toBe(200);
  });

  it('returns_confidence_threshold is read-only — PATCH is rejected even with a valid-looking value (Task 6.5)', async () => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app)
      .patch('/api/v1/admin/config/returns_confidence_threshold')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ value: 0.9, reason: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CONFIG_KEY_NOT_WRITABLE');
  });

  it('an unknown config key is 404', async () => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app)
      .patch('/api/v1/admin/config/not_a_real_key')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ value: 1, reason: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CONFIG_KEY_NOT_FOUND');
  });

  it('a missing reason is 400', async () => {
    const admin = await createTestUser('ADMIN');
    const res = await request(app)
      .patch('/api/v1/admin/config/return_window_days')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ value: 10 });
    expect(res.status).toBe(400);
  });

  it('Support is blocked from PATCH (403 ADMIN_WRITE_REQUIRED), can still GET', async () => {
    const support = await createTestUser('SUPPORT');
    const patchRes = await request(app)
      .patch('/api/v1/admin/config/return_window_days')
      .set('Authorization', `Bearer ${support.accessToken}`)
      .send({ value: 10, reason: 'x' });
    expect(patchRes.status).toBe(403);
    expect(patchRes.body.error.code).toBe('ADMIN_WRITE_REQUIRED');

    const getRes = await request(app).get('/api/v1/admin/config').set('Authorization', `Bearer ${support.accessToken}`);
    expect(getRes.status).toBe(200);
  });
});
