import { Queue } from 'bullmq';

import { MockCourierAdapter } from '../../src/adapters/courier/mock';
import * as socketModule from '../../src/core/socket';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server'; // eslint-disable-line @typescript-eslint/no-unused-vars -- ensures initSocketServer() has run before any emitTrackingUpdate call
import * as trackingService from '../../src/modules/tracking/tracking.service';
import { createTestOrder, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const trackSpy = jest.spyOn(MockCourierAdapter.prototype, 'track');
const emitSpy = jest.spyOn(socketModule, 'emitTrackingUpdate').mockImplementation(() => undefined);
const notificationQueueAddSpy = jest.spyOn(Queue.prototype, 'add');

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  trackSpy.mockClear();
  emitSpy.mockClear();
  notificationQueueAddSpy.mockClear();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
  trackSpy.mockRestore();
  emitSpy.mockRestore();
  notificationQueueAddSpy.mockRestore();
});

// Mirrors what bookCourier's transitionOrderStatus(orderId, 'PROCESSING') call always leaves
// behind in real usage — a PROCESSING tracking_events row — so pollOneOrder's "previous status"
// resolution behaves exactly as it would against a genuinely booked order.
async function setUpBookedOrder(paymentMethod: 'COD' | 'JAZZCASH' = 'JAZZCASH') {
  const seller = await createTestUser('SELLER', { onboarded: true });
  const buyer = await createTestUser('BUYER');
  const product = await createTestProduct(seller.userId);
  const order = await createTestOrder(buyer.userId, seller.userId, product, {
    status: 'PROCESSING',
    paymentMethod,
    courier: 'TCS',
    trackingNo: 'MOCK-TCS-BOOKED01',
  });
  await prisma.trackingEvent.create({
    data: { orderId: order.orderId, status: 'PROCESSING', description: 'Courier booked: TCS', eventTime: new Date() },
  });
  return { seller, buyer, order };
}

describe('runPollCycle / pollOneOrder (Task 6 — 5-min poll)', () => {
  it('advances PROCESSING -> PICKED_UP: appends a tracking_events row, transitions status, emits Socket.IO updates', async () => {
    const { order } = await setUpBookedOrder();

    await trackingService.runPollCycle();

    const row = await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } });
    expect(row.status).toBe('PICKED_UP');

    const events = await prisma.trackingEvent.findMany({ where: { orderId: order.orderId }, orderBy: { eventTime: 'asc' } });
    expect(events.map((e) => e.status)).toEqual(['PROCESSING', 'PICKED_UP']);

    expect(emitSpy).toHaveBeenCalledWith(order.publicId, 'order_status_update', expect.objectContaining({ status: 'PICKED_UP' }));
    expect(emitSpy).toHaveBeenCalledWith(order.publicId, 'tracking_location_update', expect.anything());
  });

  it('a full lifecycle of poll cycles reaches DELIVERED, fires the COD payment-confirmation side effect (Feature 7 hand-off), and enqueues the delivery notification', async () => {
    const { order } = await setUpBookedOrder('COD');

    // PROCESSING -> PICKED_UP -> IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED
    for (let i = 0; i < 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- sequential poll cycles simulating 4 real 5-min ticks
      await trackingService.runPollCycle();
    }

    const row = await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } });
    expect(row.status).toBe('DELIVERED');
    expect(row.deliveredAt).not.toBeNull();

    // Feature 7 Task 6.3's entry action — verified as integration, not re-implemented here.
    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: order.orderId } });
    expect(payment.status).toBe('CONFIRMED');

    const deliveredNotifications = notificationQueueAddSpy.mock.calls.filter(
      (call) => call[1] && (call[1] as { type?: string }).type === 'ORDER_DELIVERED',
    );
    expect(deliveredNotifications).toHaveLength(1);
  });

  it('a DELIVERED order is excluded from the next poll cycle (Task 7.1 — self-terminating)', async () => {
    const { order } = await setUpBookedOrder();
    for (let i = 0; i < 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- sequential poll cycles
      await trackingService.runPollCycle();
    }
    trackSpy.mockClear();

    await trackingService.runPollCycle();

    expect(trackSpy).not.toHaveBeenCalled();
  });

  it('does not append a duplicate tracking_events row or re-transition when the milestone has not genuinely changed (Task 6.2)', async () => {
    const { order } = await setUpBookedOrder();
    trackSpy.mockResolvedValueOnce({ status: 'PICKED_UP', description: 'stalled', locationLat: 24.9, locationLng: 67.1 });
    trackSpy.mockResolvedValueOnce({ status: 'PICKED_UP', description: 'stalled', locationLat: 24.9, locationLng: 67.1 });

    await trackingService.runPollCycle();
    await trackingService.runPollCycle();

    const events = await prisma.trackingEvent.findMany({ where: { orderId: order.orderId } });
    // PROCESSING (seed) + exactly one PICKED_UP — the second identical poll result is a no-op.
    expect(events).toHaveLength(2);
    const row = await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } });
    expect(row.status).toBe('PICKED_UP');
  });

  it('3 consecutive poll failures enqueue a Seller alert; a subsequent success resets the counter so a later 3-failure streak alerts again (REQ-F-Track006)', async () => {
    await setUpBookedOrder();
    trackSpy.mockRejectedValueOnce(new Error('down'));
    trackSpy.mockRejectedValueOnce(new Error('down'));
    trackSpy.mockRejectedValueOnce(new Error('down'));

    await trackingService.runPollCycle();
    await trackingService.runPollCycle();
    await trackingService.runPollCycle();

    let failureAlerts = notificationQueueAddSpy.mock.calls.filter(
      (call) => call[1] && (call[1] as { type?: string; orderId?: string }).type === 'COURIER_TRACKING_FAILURE',
    );
    expect(failureAlerts).toHaveLength(1);

    // 4th call succeeds (falls through to the real mock implementation) — resets the counter.
    await trackingService.runPollCycle();

    trackSpy.mockRejectedValueOnce(new Error('down'));
    trackSpy.mockRejectedValueOnce(new Error('down'));
    trackSpy.mockRejectedValueOnce(new Error('down'));
    await trackingService.runPollCycle();
    await trackingService.runPollCycle();
    await trackingService.runPollCycle();

    failureAlerts = notificationQueueAddSpy.mock.calls.filter(
      (call) => call[1] && (call[1] as { type?: string; orderId?: string }).type === 'COURIER_TRACKING_FAILURE',
    );
    expect(failureAlerts).toHaveLength(2); // proves the counter actually reset, not just capped
  });
});
