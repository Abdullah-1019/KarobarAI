import { Queue } from 'bullmq';

import { MockCourierAdapter } from '../../src/adapters/courier/mock';
import { MockPaymentAdapter } from '../../src/adapters/payment/mock';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { closeNotificationQueue } from '../../src/modules/notification';
import { bookReturnPickupAndTriggerRefund, triggerRefund } from '../../src/modules/returns/decision.service';
import { createTestOrder, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const refundSpy = jest.spyOn(MockPaymentAdapter.prototype, 'refund');
const bookSpy = jest.spyOn(MockCourierAdapter.prototype, 'book');
const queueAddSpy = jest.spyOn(Queue.prototype, 'add').mockResolvedValue({} as never);

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  refundSpy.mockClear();
  bookSpy.mockClear();
  queueAddSpy.mockClear();
});

afterAll(async () => {
  await closeNotificationQueue();
  await prisma.$disconnect();
  await redis.quit();
  refundSpy.mockRestore();
  bookSpy.mockRestore();
  queueAddSpy.mockRestore();
});

async function createReturnFixture(paymentMethod: 'COD' | 'JAZZCASH' = 'JAZZCASH') {
  const seller = await createTestUser('SELLER', { onboarded: true });
  const buyer = await createTestUser('BUYER');
  const product = await createTestProduct(seller.userId, { price: 500 });
  const order = await createTestOrder(buyer.userId, seller.userId, product, {
    status: 'DELIVERED',
    deliveredAt: new Date(),
    paymentMethod,
    courier: 'TCS',
    trackingNo: 'MOCK-TCS-1',
  });
  const ret = await prisma.return.create({
    data: { orderId: order.orderId, sellerId: seller.userId, reason: 'x', status: 'PICKUP_BOOKED' },
  });
  return { seller, buyer, order, ret };
}

describe('triggerRefund (Task 6 — idempotent, integration-point-only)', () => {
  it('confirms the refund, transitions PICKUP_BOOKED -> REFUND_ISSUED, stamps refunded_at, notifies the buyer', async () => {
    const { buyer, ret } = await createReturnFixture();

    await triggerRefund(ret.returnId);

    const row = await prisma.return.findUniqueOrThrow({ where: { returnId: ret.returnId } });
    expect(row.status).toBe('REFUND_ISSUED');
    expect(row.refundedAt).not.toBeNull();

    const refundCalls = queueAddSpy.mock.calls.filter((call) => call[1] && (call[1] as { type?: string }).type === 'REFUND_ISSUED');
    expect(refundCalls).toHaveLength(1);
    expect(refundCalls[0]?.[1]).toMatchObject({ userId: buyer.userId.toString() });
  });

  it('is idempotent — a second call after REFUND_ISSUED does not re-trigger the payment adapter', async () => {
    const { ret } = await createReturnFixture();

    await triggerRefund(ret.returnId);
    await triggerRefund(ret.returnId);

    expect(refundSpy).toHaveBeenCalledTimes(1);
  });

  it('COD orders refund with method=COD; prepaid orders refund with their own method', async () => {
    const cod = await createReturnFixture('COD');
    await triggerRefund(cod.ret.returnId);
    expect(refundSpy).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'COD' }));

    const prepaid = await createReturnFixture('JAZZCASH');
    await triggerRefund(prepaid.ret.returnId);
    expect(refundSpy).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'JAZZCASH' }));
  });

  it('on adapter failure, the return stays PICKUP_BOOKED (visible to admin as stuck) rather than crashing', async () => {
    const { ret } = await createReturnFixture();
    refundSpy.mockRejectedValueOnce(new Error('gateway down'));

    await expect(triggerRefund(ret.returnId)).resolves.toBeUndefined();

    const row = await prisma.return.findUniqueOrThrow({ where: { returnId: ret.returnId } });
    expect(row.status).toBe('PICKUP_BOOKED');
  });

  it('is a no-op for a return not in PICKUP_BOOKED', async () => {
    const { ret } = await createReturnFixture();
    await prisma.return.update({ where: { returnId: ret.returnId }, data: { status: 'APPROVED' } });

    await triggerRefund(ret.returnId);

    expect(refundSpy).not.toHaveBeenCalled();
  });
});

describe('bookReturnPickupAndTriggerRefund (Task 4.4/5.4 — pickup then refund)', () => {
  it('on courier booking failure, the return stays APPROVED and the refund is never attempted', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'DELIVERED',
      deliveredAt: new Date(),
      courier: 'TCS',
      trackingNo: 'MOCK-TCS-1',
    });
    const ret = await prisma.return.create({
      data: { orderId: order.orderId, sellerId: seller.userId, reason: 'x', status: 'APPROVED' },
    });
    bookSpy.mockRejectedValueOnce(new Error('courier down'));

    await bookReturnPickupAndTriggerRefund(ret.returnId);

    const row = await prisma.return.findUniqueOrThrow({ where: { returnId: ret.returnId } });
    expect(row.status).toBe('APPROVED');
    expect(refundSpy).not.toHaveBeenCalled();
  });
});
