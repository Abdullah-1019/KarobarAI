import { Prisma } from '@prisma/client';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { runSettlementCycle } from '../../src/modules/settlement';
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

async function daysAgo(n: number): Promise<Date> {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

describe('runSettlementCycle (gap closure — the first writer of settlements anywhere in this codebase)', () => {
  it('creates a SETTLED settlement for a delivered order whose return window has closed, gross/commission/net computed from the order snapshot', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { price: 1000 });
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'COMPLETED',
      deliveredAt: await daysAgo(20), buyerConfirmedAt: await daysAgo(20),
    });
    await prisma.order.update({ where: { orderId: order.orderId }, data: { commissionRateSnapshot: new Prisma.Decimal(0.05) } });

    await runSettlementCycle();

    const settlement = await prisma.settlement.findUnique({ where: { orderId: order.orderId } });
    expect(settlement).not.toBeNull();
    expect(settlement?.status).toBe('SETTLED');
    expect(settlement?.gross.toFixed(2)).toBe('1000.00');
    expect(settlement?.commission.toFixed(2)).toBe('50.00');
    expect(settlement?.net.toFixed(2)).toBe('950.00');
    expect(settlement?.settledAt).not.toBeNull();
    expect(settlement?.sellerId).toBe(seller.userId);
  });

  it('does not settle a buyer-confirmed order whose 24-hour return window remains open', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'COMPLETED',
      deliveredAt: await daysAgo(20), buyerConfirmedAt: new Date(),
    });

    await runSettlementCycle();

    const settlement = await prisma.settlement.findUnique({ where: { orderId: order.orderId } });
    expect(settlement).toBeNull();
  });

  it('does not settle a courier-delivered order before buyer receipt confirmation', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, {
      status: 'DELIVERED',
      deliveredAt: await daysAgo(2),
    });

    await runSettlementCycle();

    const settlement = await prisma.settlement.findUnique({ where: { orderId: order.orderId } });
    expect(settlement).toBeNull();
  });

  it('never settles an order with an open/active return, even if the window has closed', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'COMPLETED', deliveredAt: await daysAgo(20), buyerConfirmedAt: await daysAgo(20) });
    await prisma.return.create({ data: { orderId: order.orderId, sellerId: seller.userId, reason: 'x', status: 'MANUAL_REVIEW' } });

    await runSettlementCycle();

    const settlement = await prisma.settlement.findUnique({ where: { orderId: order.orderId } });
    expect(settlement).toBeNull();
  });

  it('waits for every item-scoped return on a multi-item order to close', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const first = await createTestProduct(seller.userId);
    const second = await createTestProduct(seller.userId);
    const confirmedAt = await daysAgo(2);
    const order = await createTestOrder(buyer.userId, seller.userId, first, {
      status: 'COMPLETED', deliveredAt: confirmedAt, buyerConfirmedAt: confirmedAt,
    });
    const firstItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.orderId } });
    const secondItem = await prisma.orderItem.create({ data: { orderId: order.orderId,
      productId: second.productId, titleSnapshot: second.titleEn,
      unitPrice: second.price, quantity: 1 } });
    await prisma.return.create({ data: { orderId: order.orderId, orderItemId: firstItem.orderItemId,
      sellerId: seller.userId, reason: 'first', status: 'CLOSED' } });
    const active = await prisma.return.create({ data: { orderId: order.orderId,
      orderItemId: secondItem.orderItemId, sellerId: seller.userId,
      reason: 'second', status: 'MANUAL_REVIEW' } });
    await runSettlementCycle();
    expect(await prisma.settlement.count({ where: { orderId: order.orderId } })).toBe(0);
    await prisma.return.update({ where: { returnId: active.returnId }, data: { status: 'CLOSED' } });
    await runSettlementCycle();
    expect(await prisma.settlement.count({ where: { orderId: order.orderId } })).toBe(1);
  });

  it('never settles an order whose return already resulted in a refund (REFUND_ISSUED)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'COMPLETED', deliveredAt: await daysAgo(20), buyerConfirmedAt: await daysAgo(20) });
    await prisma.return.create({ data: { orderId: order.orderId, sellerId: seller.userId, reason: 'x', status: 'REFUND_ISSUED' } });

    await runSettlementCycle();

    const settlement = await prisma.settlement.findUnique({ where: { orderId: order.orderId } });
    expect(settlement).toBeNull();
  });

  it('does settle an order whose return was filed but ended CLOSED (rejected, no refund paid)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId, { price: 500 });
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'COMPLETED', deliveredAt: await daysAgo(20), buyerConfirmedAt: await daysAgo(20) });
    await prisma.return.create({ data: { orderId: order.orderId, sellerId: seller.userId, reason: 'x', status: 'CLOSED' } });

    await runSettlementCycle();

    const settlement = await prisma.settlement.findUnique({ where: { orderId: order.orderId } });
    expect(settlement).not.toBeNull();
    expect(settlement?.gross.toFixed(2)).toBe('500.00');
  });

  it('is idempotent — never double-creates a settlement for an order that already has one', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const order = await createTestOrder(buyer.userId, seller.userId, product, { status: 'COMPLETED', deliveredAt: await daysAgo(20), buyerConfirmedAt: await daysAgo(20) });

    await runSettlementCycle();
    await runSettlementCycle(); // second cycle — must not attempt to re-create or throw

    const settlements = await prisma.settlement.findMany({ where: { orderId: order.orderId } });
    expect(settlements).toHaveLength(1);
  });

  it('never settles an order that is not DELIVERED/COMPLETED (still in-flight or cancelled)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const processing = await createTestOrder(buyer.userId, seller.userId, product, { status: 'PROCESSING' });
    const cancelled = await createTestOrder(buyer.userId, seller.userId, product, { status: 'CANCELLED' });

    await runSettlementCycle();

    const settlements = await prisma.settlement.findMany({ where: { orderId: { in: [processing.orderId, cancelled.orderId] } } });
    expect(settlements).toHaveLength(0);
  });

  it("one order's settlement creation failing (e.g. an overlapping-cycle unique-constraint race) does not prevent other eligible orders from settling in the same cycle", async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const buyer = await createTestUser('BUYER');
    const product = await createTestProduct(seller.userId);
    const orderA = await createTestOrder(buyer.userId, seller.userId, product, { status: 'COMPLETED', deliveredAt: await daysAgo(20), buyerConfirmedAt: await daysAgo(20) });
    const orderB = await createTestOrder(buyer.userId, seller.userId, product, { status: 'COMPLETED', deliveredAt: await daysAgo(20), buyerConfirmedAt: await daysAgo(20) });

    const createSpy = jest.spyOn(prisma.settlement, 'create').mockImplementationOnce(() => {
      throw new Error('simulated race: unique constraint violation');
    });

    await expect(runSettlementCycle()).resolves.toBeUndefined(); // must not throw/reject the whole cycle
    createSpy.mockRestore();

    // Concurrent creation order (Promise.all over the eligible batch) isn't guaranteed, so the
    // mocked-once throw could land on either order — what matters is exactly one of the two
    // eligible orders ends up settled, proving the failure was isolated, not silently faked.
    const settlements = await prisma.settlement.findMany({ where: { orderId: { in: [orderA.orderId, orderB.orderId] } } });
    expect(settlements).toHaveLength(1);
  });
});
