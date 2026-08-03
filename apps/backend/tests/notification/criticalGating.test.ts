import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { processNotificationEvent } from '../../src/modules/notification/notification.service';
import { createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';
import { setNotificationPreferences } from './helpers';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('Critical-event allowlist (Task 3.1/8.2 — REQ-F-Notif004, non-disableable)', () => {
  it('a critical event (ORDER_DELIVERED) dispatches on all four channels even with every preference turned off', async () => {
    const buyer = await createTestUser('BUYER', { phone: '03001234567' });
    await setNotificationPreferences(buyer.userId, {
      smsEnabled: false,
      whatsappEnabled: false,
      emailEnabled: false,
      inappEnabled: false,
    });

    await processNotificationEvent({ userId: buyer.userId.toString(), type: 'ORDER_DELIVERED', vars: { orderId: '1' } });

    const rows = await prisma.notification.findMany({ where: { userId: buyer.userId } });
    expect(new Set(rows.map((r) => r.channel))).toEqual(new Set(['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP']));
  });

  it('OTP_REQUESTED (critical) also dispatches regardless of preferences', async () => {
    const buyer = await createTestUser('BUYER', { phone: '03001234567' });
    await setNotificationPreferences(buyer.userId, { smsEnabled: false, inappEnabled: false });

    await processNotificationEvent({
      userId: buyer.userId.toString(),
      type: 'OTP_REQUESTED',
      vars: { code: '123456', ttlMinutes: 10 },
    });

    const rows = await prisma.notification.findMany({ where: { userId: buyer.userId, channel: { in: ['IN_APP', 'SMS'] } } });
    expect(rows).toHaveLength(2);
  });

  it('a non-critical event respects disabled preferences and is correctly gated (distinguishes "critical always sends" from "everything always sends")', async () => {
    const buyer = await createTestUser('BUYER', { phone: '03001234567' });
    await setNotificationPreferences(buyer.userId, {
      smsEnabled: false,
      whatsappEnabled: false,
      emailEnabled: false,
      inappEnabled: false,
    });

    // ORDER_PICKED_UP is a real registered event type but NOT in the critical allowlist.
    await processNotificationEvent({ userId: buyer.userId.toString(), type: 'ORDER_PICKED_UP', vars: { orderId: '1' } });

    const rows = await prisma.notification.findMany({ where: { userId: buyer.userId } });
    expect(rows).toHaveLength(0);
  });

  it('a non-critical event dispatches normally when preferences are on', async () => {
    const buyer = await createTestUser('BUYER', { phone: '03001234567' });
    await processNotificationEvent({ userId: buyer.userId.toString(), type: 'ORDER_PICKED_UP', vars: { orderId: '1' } });

    const rows = await prisma.notification.findMany({ where: { userId: buyer.userId } });
    expect(rows.length).toBeGreaterThan(0);
  });
});
