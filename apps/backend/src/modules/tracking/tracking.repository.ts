import { randomUUID } from 'node:crypto';
import type { CourierCode, Order, Prisma } from '@prisma/client';

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
  slaScore?: number;
  ratingScore?: number;
  scoreBreakdown?: unknown;
}

export async function findOrderRowById(orderId: bigint): Promise<Order | null> {
  return prisma.order.findUnique({ where: { orderId } });
}

export async function findQuotesByOrder(orderId: bigint) {
  const latest = await prisma.courierQuote.findFirst({ where: { orderId }, orderBy: { quoteId: 'desc' } });
  if (!latest) return [];
  return prisma.courierQuote.findMany({
    where: { orderId, evaluationId: latest.evaluationId },
    orderBy: [{ score: 'desc' }, { courier: 'asc' }],
  });
}

export async function replaceCourierQuotes(orderId: bigint, quotes: NewQuote[],
  context?: { originCity: string; destCity: string; weightKg: number }): Promise<void> {
  if (!quotes.length) return;
  const evaluationId = randomUUID();
  await prisma.courierQuote.createMany({
      data: quotes.map((q) => ({
        orderId,
        evaluationId,
        courier: q.courier,
        cost: q.cost,
        etaHours: q.etaHours,
        score: q.score,
        slaScore: q.slaScore,
        ratingScore: q.ratingScore,
        scoreBreakdown: q.scoreBreakdown as Prisma.InputJsonValue | undefined,
        originCity: context?.originCity, destCity: context?.destCity, weightKg: context?.weightKg,
      })),
    });
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
