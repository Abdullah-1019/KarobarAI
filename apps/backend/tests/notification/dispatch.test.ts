import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server'; // eslint-disable-line @typescript-eslint/no-unused-vars -- ensures the app + its module graph loads the same way it does in production
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

describe('processNotificationEvent (Task 3/5/6/7 — the consumer, happy path)', () => {
  it('a critical event dispatches all four channels independently for a user with phone+email on file', async () => {
    const buyer = await createTestUser('BUYER', { phone: '03001234567' });
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'DELIVERED' });

    await processNotificationEvent({
      userId: buyer.userId.toString(),
      type: 'ORDER_DELIVERED',
      orderId: order.publicId,
      vars: { orderId: order.publicId },
    });

    const rows = await prisma.notification.findMany({ where: { userId: buyer.userId } });
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((r) => r.channel))).toEqual(new Set(['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP']));

    const inApp = rows.find((r) => r.channel === 'IN_APP')!;
    expect(inApp.status).toBe('SENT'); // Gap #4 — in-app never reaches DELIVERED
    expect(inApp.readAt).toBeNull();
    expect(inApp.orderId).toBe(order.orderId);

    for (const channel of ['EMAIL', 'SMS', 'WHATSAPP'] as const) {
      const row = rows.find((r) => r.channel === channel)!;
      expect(row.status).toBe('DELIVERED'); // full lifecycle for external channels
    }
  });

  it("renders the recipient's own preferred language (UR default)", async () => {
    const buyer = await createTestUser('BUYER');
    await processNotificationEvent({
      userId: buyer.userId.toString(),
      type: 'ORDER_DELIVERED',
      vars: { orderId: 'abc12345' },
    });

    const row = await prisma.notification.findFirst({ where: { userId: buyer.userId, channel: 'IN_APP' } });
    expect(row?.language).toBe('UR');
    expect(row?.message).toContain('abc12345');
    expect(row?.message).not.toContain('has been delivered'); // the English wording
  });

  it('renders English for a user with preferredLanguage=EN', async () => {
    const buyer = await createTestUser('BUYER');
    await prisma.user.update({ where: { userId: buyer.userId }, data: { preferredLanguage: 'EN' } });

    await processNotificationEvent({
      userId: buyer.userId.toString(),
      type: 'ORDER_DELIVERED',
      vars: { orderId: 'abc12345' },
    });

    const row = await prisma.notification.findFirst({ where: { userId: buyer.userId, channel: 'IN_APP' } });
    expect(row?.language).toBe('EN');
    expect(row?.message).toBe('Your order #abc12345 has been delivered.');
  });

  it('a user registered without a phone number (email-only) gets in-app + email, no SMS/WhatsApp, no crash from the missing channel', async () => {
    // createTestUser always sets an email (mirrors the real "at least one of phone/email" CHECK
    // constraint — a user with genuinely neither cannot exist in this schema). An email-only
    // registrant is the realistic scenario for exercising the "channel unavailable" path.
    const buyer = await createTestUser('BUYER');
    await processNotificationEvent({
      userId: buyer.userId.toString(),
      type: 'ORDER_DELIVERED',
      vars: { orderId: 'xyz' },
    });

    const rows = await prisma.notification.findMany({ where: { userId: buyer.userId } });
    expect(new Set(rows.map((r) => r.channel))).toEqual(new Set(['IN_APP', 'EMAIL']));
  });

  it('an unknown recipient user is dropped without throwing', async () => {
    await expect(
      processNotificationEvent({ userId: '999999999', type: 'ORDER_DELIVERED', vars: {} }),
    ).resolves.toBeUndefined();
  });

  it('a malformed job payload (missing required fields) is rejected with a clear validation error, not a silent crash', async () => {
    await expect(processNotificationEvent({ type: 'ORDER_DELIVERED' })).rejects.toThrow();
  });
});
