import type { CourierCode, Order } from '@prisma/client';

import { prisma } from '../../core/prisma';

// Feature 8 Task 1.1 — Prisma-backed methods for courier_quotes/tracking_events only. This
// module never writes orders.status directly (that's exclusively Feature 7's
// transitionOrderStatus) — the two order-column updates it does own (courier/tracking_no/
// courier_overridden, on successful booking) are plain non-status columns Schema §4.10 already
// reserved for this feature.

export interface NewQuote {
  courier: CourierCode;
  cost: number;
  etaHours: number;
  score: number;
}

export async function findOrderRowById(orderId: bigint): Promise<Order | null> {
  return prisma.order.findUnique({ where: { orderId } });
}

export async function findQuotesByOrder(orderId: bigint) {
  return prisma.courierQuote.findMany({ where: { orderId }, orderBy: { score: 'desc' } });
}

export async function replaceCourierQuotes(orderId: bigint, quotes: NewQuote[]): Promise<void> {
  await prisma.$transaction([
    prisma.courierQuote.deleteMany({ where: { orderId } }),
    prisma.courierQuote.createMany({
      data: quotes.map((q) => ({
        orderId,
        courier: q.courier,
        cost: q.cost,
        etaHours: q.etaHours,
        score: q.score,
      })),
    }),
  ]);
}

export async function markQuoteSelected(orderId: bigint, courier: CourierCode): Promise<void> {
  await prisma.courierQuote.updateMany({ where: { orderId, courier }, data: { selected: true } });
}

export async function updateOrderCourierBooking(
  orderId: bigint,
  data: { courier: CourierCode; trackingNo: string; courierOverridden: boolean },
): Promise<void> {
  await prisma.order.update({ where: { orderId }, data });
}

// No standalone appendTrackingEvent method — every genuine milestone this feature tracks (the
// mock CourierAdapter.track() maps 1:1 onto OrderStatus values) also doubles as a canonical
// status transition, so the tracking_events insert lives exclusively inside Feature 7's
// transitionOrderStatus (extended with an optional location param for this feature's benefit) —
// a second, standalone insert path here would just duplicate that same row.

export async function findTrackingEventsByOrder(orderId: bigint) {
  return prisma.trackingEvent.findMany({ where: { orderId }, orderBy: { eventTime: 'asc' } });
}

export async function findLatestTrackingEvent(orderId: bigint) {
  return prisma.trackingEvent.findFirst({ where: { orderId }, orderBy: { eventTime: 'desc' } });
}

export async function findOrderByTrackingToken(token: string): Promise<Order | null> {
  return prisma.order.findUnique({ where: { trackingToken: token } });
}

// Task 6.1's poll-job candidate set. The module doc's own literal wording only lists PICKED_UP/
// IN_TRANSIT/OUT_FOR_DELIVERY — but Feature 7's state machine's only edge out of PROCESSING is
// PROCESSING -> PICKED_UP, and nothing else in either feature ever fires that transition. Taking
// the doc's list literally would leave every booked order stranded in PROCESSING forever, with
// no path to PICKED_UP at all. Including PROCESSING here is this feature's own correction —
// flagged as a real gap found and resolved, not a literal reading of Task 6.1's wording — since
// the alternative (a permanently stuck pipeline) can't be what was intended.
export async function findActiveShipmentOrders(): Promise<Order[]> {
  return prisma.order.findMany({
    where: { status: { in: ['PROCESSING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] } },
  });
}
