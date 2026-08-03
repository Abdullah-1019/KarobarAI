import { MockEmailAdapter } from '../../src/adapters/email/mock';
import { MockSmsAdapter } from '../../src/adapters/sms/mock';
import { MockWhatsAppAdapter } from '../../src/adapters/whatsapp/mock';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { processNotificationEvent } from '../../src/modules/notification/notification.service';
import { createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const emailSpy = jest.spyOn(MockEmailAdapter.prototype, 'sendEmail');
const smsSpy = jest.spyOn(MockSmsAdapter.prototype, 'sendSms');
const whatsappSpy = jest.spyOn(MockWhatsAppAdapter.prototype, 'sendTemplate');

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  emailSpy.mockClear();
  smsSpy.mockClear();
  whatsappSpy.mockClear();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
  emailSpy.mockRestore();
  smsSpy.mockRestore();
  whatsappSpy.mockRestore();
});

describe('Cross-channel failure isolation (Task 5.4/6/7.3, adversarial per Task 8.4)', () => {
  it("Email failing does not block SMS/WhatsApp/in-app from succeeding, and the Email row is FAILED", async () => {
    const buyer = await createTestUser('BUYER', { phone: '03001234567' });
    emailSpy.mockRejectedValueOnce(new Error('smtp down'));

    await processNotificationEvent({ userId: buyer.userId.toString(), type: 'ORDER_DELIVERED', vars: { orderId: '1' } });

    const rows = await prisma.notification.findMany({ where: { userId: buyer.userId } });
    expect(rows.find((r) => r.channel === 'EMAIL')?.status).toBe('FAILED');
    expect(rows.find((r) => r.channel === 'SMS')?.status).toBe('DELIVERED');
    expect(rows.find((r) => r.channel === 'WHATSAPP')?.status).toBe('DELIVERED');
    expect(rows.find((r) => r.channel === 'IN_APP')?.status).toBe('SENT');
  });

  it('SMS failing does not block Email/WhatsApp/in-app', async () => {
    const buyer = await createTestUser('BUYER', { phone: '03001234567' });
    smsSpy.mockRejectedValueOnce(new Error('provider down'));

    await processNotificationEvent({ userId: buyer.userId.toString(), type: 'ORDER_DELIVERED', vars: { orderId: '1' } });

    const rows = await prisma.notification.findMany({ where: { userId: buyer.userId } });
    expect(rows.find((r) => r.channel === 'SMS')?.status).toBe('FAILED');
    expect(rows.find((r) => r.channel === 'EMAIL')?.status).toBe('DELIVERED');
    expect(rows.find((r) => r.channel === 'WHATSAPP')?.status).toBe('DELIVERED');
    expect(rows.find((r) => r.channel === 'IN_APP')?.status).toBe('SENT');
  });

  it('WhatsApp failing does not block Email/SMS/in-app', async () => {
    const buyer = await createTestUser('BUYER', { phone: '03001234567' });
    whatsappSpy.mockRejectedValueOnce(new Error('meta api down'));

    await processNotificationEvent({ userId: buyer.userId.toString(), type: 'ORDER_DELIVERED', vars: { orderId: '1' } });

    const rows = await prisma.notification.findMany({ where: { userId: buyer.userId } });
    expect(rows.find((r) => r.channel === 'WHATSAPP')?.status).toBe('FAILED');
    expect(rows.find((r) => r.channel === 'EMAIL')?.status).toBe('DELIVERED');
    expect(rows.find((r) => r.channel === 'SMS')?.status).toBe('DELIVERED');
    expect(rows.find((r) => r.channel === 'IN_APP')?.status).toBe('SENT');
  });

  it('all three external channels failing simultaneously still leaves the in-app row correctly created', async () => {
    const buyer = await createTestUser('BUYER', { phone: '03001234567' });
    emailSpy.mockRejectedValueOnce(new Error('down'));
    smsSpy.mockRejectedValueOnce(new Error('down'));
    whatsappSpy.mockRejectedValueOnce(new Error('down'));

    await processNotificationEvent({ userId: buyer.userId.toString(), type: 'ORDER_DELIVERED', vars: { orderId: '1' } });

    const rows = await prisma.notification.findMany({ where: { userId: buyer.userId } });
    expect(rows.find((r) => r.channel === 'IN_APP')?.status).toBe('SENT');
    expect(rows.filter((r) => r.status === 'FAILED')).toHaveLength(3);
  });
});
