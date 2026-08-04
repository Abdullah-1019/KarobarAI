import { Prisma } from '@prisma/client';
import type { Worker } from 'bullmq';

import { createQueue, createWorker } from '../../core/queue';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';
import * as repo from './settlement.repository';
import type { SettlementEligibleOrder } from './settlement.repository';

// Duplicated ~3-line predicate, same conscious choice Feature 10's returns.service.ts and
// Feature 7's order.service.ts already made independently rather than sharing one helper across
// modules — see returns.service.ts's own comment on this.
async function getReturnWindowDays(): Promise<number> {
  const row = await prisma.platformConfig.findUnique({ where: { configKey: 'return_window_days' } });
  return row ? Number(row.value) : 14;
}

async function createSettlementForOrder(order: SettlementEligibleOrder): Promise<void> {
  const gross = order.subtotal; // gross = orders.subtotal per Schema §14.2, never shipping_fee
  const commission = gross.times(order.commissionRateSnapshot).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const net = gross.minus(commission);
  await prisma.settlement.create({
    data: {
      orderId: order.orderId,
      sellerId: order.sellerId,
      gross,
      commission,
      net,
      status: 'SETTLED', // no real payout/banking gateway exists to gate a PENDING stage on (mock-only, matches every other adapter)
      settledAt: new Date(),
    },
  });
}

// Task-equivalent of tracking.service.ts's runPollCycle: one order's failure (e.g. a race where
// two poll cycles overlap and both see the same eligible order — Settlement.orderId's unique
// constraint rejects the second) must not fail the whole cycle for every other order.
export async function runSettlementCycle(): Promise<void> {
  const windowDays = await getReturnWindowDays();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  const eligible = await repo.findSettlementEligibleOrders(cutoff);
  await Promise.all(
    eligible.map((order) =>
      createSettlementForOrder(order).catch((err) => {
        logger.error({ orderId: order.orderId.toString(), error: (err as Error).message }, '[settlement] cycle error for order');
      }),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Process-startup wiring — mirrors tracking.service.ts's startTrackingPollJob exactly (BullMQ
// repeatable job, only ever called from server.ts's require.main guard, never during tests;
// tests call runSettlementCycle directly). A daily interval is enough — settlement eligibility
// only changes once return-window boundaries are crossed, unlike courier tracking's near-real-
// time need for a 5-minute poll.
// ─────────────────────────────────────────────────────────────────────────────

let settlementWorker: Worker | undefined;
let settlementQueue: ReturnType<typeof createQueue> | undefined;

const POLL_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function startSettlementPollJob(): Promise<void> {
  settlementQueue ??= createQueue('settlement-poll');
  await settlementQueue.add('poll', {}, { repeat: { every: POLL_INTERVAL_MS }, jobId: 'settlement-poll-recurring' });
  settlementWorker ??= createWorker('settlement-poll', async () => {
    await runSettlementCycle();
  });
}
