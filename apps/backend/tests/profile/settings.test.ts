import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('GET /api/v1/profile/me/settings', () => {
  it('returns schema defaults when no notification_preferences row exists yet', async () => {
    const user = await createTestUser('BUYER');

    const res = await request(app)
      .get('/api/v1/profile/me/settings')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      smsEnabled: true,
      whatsappEnabled: true,
      emailEnabled: true,
      inappEnabled: true,
    });
  });
});

describe('PATCH /api/v1/profile/me/settings', () => {
  it('persists a non-critical toggle and a language change', async () => {
    const user = await createTestUser('BUYER');

    const res = await request(app)
      .patch('/api/v1/profile/me/settings')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ whatsappEnabled: false, preferredLanguage: 'EN' });

    expect(res.status).toBe(200);
    expect(res.body.data.whatsappEnabled).toBe(false);
    expect(res.body.data.preferredLanguage).toBe('EN');

    const getRes = await request(app)
      .get('/api/v1/profile/me/settings')
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect(getRes.body.data.whatsappEnabled).toBe(false);
    expect(getRes.body.data.preferredLanguage).toBe('EN');
  });

  it('silently forces critical channels (in-app, SMS) back to true, even on a direct API attempt', async () => {
    const user = await createTestUser('BUYER');

    const res = await request(app)
      .patch('/api/v1/profile/me/settings')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ inappEnabled: false, smsEnabled: false });

    expect(res.status).toBe(200);
    expect(res.body.data.inappEnabled).toBe(true);
    expect(res.body.data.smsEnabled).toBe(true);

    const row = await prisma.notificationPreference.findUniqueOrThrow({
      where: { userId: user.userId },
    });
    expect(row.inappEnabled).toBe(true);
    expect(row.smsEnabled).toBe(true);
  });

  it('rejects an unknown field (zod .strict()) with 400', async () => {
    const user = await createTestUser('BUYER');

    const res = await request(app)
      .patch('/api/v1/profile/me/settings')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ pushEnabled: true });

    expect(res.status).toBe(400);
  });
});
