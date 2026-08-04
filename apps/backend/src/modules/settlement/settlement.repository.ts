import type { Prisma } from '@prisma/client';

import { prisma } from '../../core/prisma';

// Settlement-creation gap closure (see docs/handoffs/F-settlement-engine-gap-closure.md) —
// unblocks Feature 11 Task 2 and Feature 12 Task 2's GMV, both of which read
// settlements.net WHERE status=SETTLED and had nothing populating that table until now.

export interface SettlementEligibleOrder {
  orderId: bigint;
  sellerId: bigint;
  subtotal: Prisma.Decimal;
  commissionRateSnapshot: Prisma.Decimal;
}

// An order is settlement-eligible once its return window has closed with nothing left to
// refund: delivered, no Settlement row yet (Settlement.orderId is unique — this is also the
// idempotency guard against double-creating on the next poll cycle), and either no return was
// ever filed or the one that was ended in CLOSED (rejected/abandoned, no refund paid) rather
// than REFUND_ISSUED (already refunded — must never be settled) or any still-active return
// status (settlement waits for the return to resolve one way or the other).
export async function findSettlementEligibleOrders(cutoff: Date): Promise<SettlementEligibleOrder[]> {
  return prisma.order.findMany({
    where: {
      status: { in: ['DELIVERED', 'COMPLETED'] },
      deliveredAt: { lte: cutoff },
      settlement: null,
      OR: [{ return: null }, { return: { status: 'CLOSED' } }],
    },
    select: { orderId: true, sellerId: true, subtotal: true, commissionRateSnapshot: true },
  });
}
