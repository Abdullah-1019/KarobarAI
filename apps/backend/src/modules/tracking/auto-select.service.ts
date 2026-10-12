import { randomUUID } from 'node:crypto';
import type { CourierShipment, Prisma } from '@prisma/client';

import { getCourierAdapter, type CourierCode } from '../../adapters/courier';
import { config } from '../../core/config';
import { BusinessRuleError, ConflictError } from '../../core/errors/AppError';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';
import { getOwnedOrderRow, transitionOrderStatus } from '../order/order.service';
import { evaluateCourierQuotes } from './tracking.service';

// The mock adapter has no merchant account. A typed definitive failure means the adapter
// confirms no booking exists; every other thrown outcome remains uncertain until reconciled.
export class DefinitiveCourierBookingError extends Error {}

const ORIGIN_CITY = 'Karachi';
const KG_PER_ITEM = 0.5;

async function bookWithDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Courier booking confirmation timed out')), 15_000);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function shipmentView(shipment: CourierShipment, quotes: Array<{
  courier: string; cost: { toString(): string } | null; etaHours: number | null;
  slaScore: { toNumber(): number } | null; ratingScore: { toNumber(): number } | null;
  score: { toNumber(): number } | null; scoreBreakdown: unknown; selected: boolean;
}>) {
  return {
    shipment: {
      status: shipment.status, source: shipment.source, simulated: shipment.source === 'SIMULATED',
      courier: shipment.courier, bookingReference: shipment.bookingReference,
      trackingId: shipment.trackingId, originCity: shipment.originCity,
      destCity: shipment.destCity, weightKg: shipment.weightKg.toString(),
      failureCode: shipment.failureCode, failureMessage: shipment.failureMessage,
    },
    quotes: quotes.map((quote) => ({
      courier: quote.courier, cost: quote.cost?.toString() ?? null, etaHours: quote.etaHours,
      slaScore: quote.slaScore?.toNumber() ?? null, ratingScore: quote.ratingScore?.toNumber() ?? null,
      score: quote.score?.toNumber() ?? null, breakdown: quote.scoreBreakdown,
      selected: quote.selected, simulated: true,
    })),
  };
}

export async function getAutoSelection(orderPublicId: string, sellerId: bigint) {
  const order = await getOwnedOrderRow(orderPublicId, { userId: sellerId, role: 'SELLER' });
  const shipment = await prisma.courierShipment.findUnique({ where: { orderId: order.orderId } });
  if (!shipment) return null;
  const quotes = shipment.evaluationId ? await prisma.courierQuote.findMany({
    where: { orderId: order.orderId, evaluationId: shipment.evaluationId },
    orderBy: [{ score: 'desc' }, { courier: 'asc' }],
  }) : [];
  return shipmentView(shipment, quotes);
}

async function recordOutcome(orderId: bigint, status: 'FAILED' | 'UNCERTAIN', code: string, message: string) {
  await prisma.courierShipment.updateMany({
    where: { orderId, status: { in: ['EVALUATING', 'BOOKING'] } },
    data: { status, failureCode: code, failureMessage: message.slice(0, 200),
      ...(status === 'FAILED' ? { failedAt: new Date() } : {}) },
  });
}

function assertEligible(status: string, courier: string | null) {
  if (status !== 'PAYMENT_CONFIRMED') {
    throw new BusinessRuleError('Order is not ready for courier booking', { status }, 'ORDER_NOT_COURIER_ELIGIBLE');
  }
  if (courier) throw new ConflictError('Order already has a booked courier', undefined, 'COURIER_ALREADY_BOOKED');
}

export async function autoSelectCourier(orderPublicId: string, sellerId: bigint, requestedCourier?: CourierCode) {
  if (config.adapterMode !== 'mock') {
    throw new BusinessRuleError('Auto selection is available only for simulated couriers', undefined, 'COURIER_SIMULATION_ONLY');
  }
  const order = await getOwnedOrderRow(orderPublicId, { userId: sellerId, role: 'SELLER' });
  const existing = await prisma.courierShipment.findUnique({ where: { orderId: order.orderId } });
  if (existing?.status === 'BOOKED' && order.status === 'PAYMENT_CONFIRMED'
    && existing.courier === order.courier && existing.trackingId === order.trackingNo) {
    // The durable booking committed, but a previous PROCESSING transition failed. Resume only
    // this local status step; never send a second booking request to the provider.
    await transitionOrderStatus(order.orderId, 'PROCESSING', 'system',
      `Simulated courier booked: ${existing.courier}`);
  }
  if (existing && ['BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(existing.status)) {
    return getAutoSelection(orderPublicId, sellerId);
  }
  assertEligible(order.status, order.courier);
  if (!order.shipCity.trim() || !order.shipProvince.trim()) {
    throw new BusinessRuleError('Destination city and province are required', undefined, 'COURIER_PARCEL_INCOMPLETE');
  }
  const items = await prisma.orderItem.findMany({ where: { orderId: order.orderId }, select: { quantity: true } });
  if (!items.length || items.some(({ quantity }) => !Number.isInteger(quantity) || quantity <= 0)) {
    throw new BusinessRuleError('Order has no valid parcel items', undefined, 'COURIER_PARCEL_INCOMPLETE');
  }
  // Product weight is not stored yet. This is an explicitly synthetic, deterministic demo
  // estimate, not a claim about actual parcel mass; the snapshot is persisted for auditability.
  const weightKg = Math.max(0.5, items.reduce((sum, item) => sum + item.quantity * KG_PER_ITEM, 0));
  if (weightKg > 99999) throw new BusinessRuleError('Parcel estimate is too large', undefined, 'COURIER_PARCEL_INCOMPLETE');

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT order_id FROM orders WHERE order_id = ${order.orderId} FOR UPDATE`;
    const current = await tx.order.findUniqueOrThrow({ where: { orderId: order.orderId } });
    assertEligible(current.status, current.courier);
    if (current.paymentMethod !== 'COD') {
      const currentPayment = await tx.payment.findUnique({ where: { orderId: order.orderId }, select: { status: true } });
      if (currentPayment?.status !== 'CONFIRMED') {
        throw new BusinessRuleError('Online payment must be confirmed before courier booking', undefined,
          'ORDER_PAYMENT_NOT_CONFIRMED');
      }
    }
    const claim = await tx.courierShipment.findUnique({ where: { orderId: order.orderId } });
    if (claim) {
      if (claim.status !== 'FAILED') {
        throw new ConflictError('Courier booking requires reconciliation before another attempt', undefined, 'COURIER_OUTCOME_UNCERTAIN');
      }
      await tx.courierShipment.update({ where: { orderId: order.orderId },
        data: { status: 'EVALUATING', failureCode: null, failureMessage: null, failedAt: null,
          courier: null, evaluationId: null, scoreBreakdown: undefined } });
    } else {
      await tx.courierShipment.create({ data: {
        orderId: order.orderId, sellerId, originCity: ORIGIN_CITY,
        destCity: order.shipCity, destProvince: order.shipProvince, weightKg,
      } });
    }
  });

  let winner: Awaited<ReturnType<typeof evaluateCourierQuotes>>[number];
  let wasOverride = false;
  const evaluationId = randomUUID();
  try {
    const scored = await evaluateCourierQuotes({ city: order.shipCity, province: order.shipProvince },
      order.paymentMethod === 'COD', ORIGIN_CITY, weightKg);
    if (!scored.length) {
      await recordOutcome(order.orderId, 'FAILED', 'NO_VALID_COURIER_QUOTES', 'No eligible simulated courier returned a valid quote');
      throw new BusinessRuleError('No valid courier quotes are available', undefined, 'NO_VALID_COURIER_QUOTES');
    }
    winner = requestedCourier ? scored.find((candidate) => candidate.courier === requestedCourier)! : scored[0]!;
    if (!winner) throw new BusinessRuleError('Requested courier has no eligible valid quote', undefined, 'INVALID_COURIER_SELECTION');
    wasOverride = Boolean(requestedCourier && requestedCourier !== scored[0]?.courier);
    await prisma.$transaction(async (tx) => {
      await tx.courierQuote.createMany({ data: scored.map(({ courier, quote, score, breakdown }) => ({
        orderId: order.orderId, evaluationId, courier, cost: quote.cost, etaHours: quote.etaHours,
        slaScore: quote.slaScore, ratingScore: quote.ratingScore, score,
        scoreBreakdown: breakdown as unknown as Prisma.InputJsonValue,
        originCity: ORIGIN_CITY, destCity: order.shipCity, weightKg, source: 'SIMULATED',
      })) });
      const claimed = await tx.courierShipment.updateMany({
        where: { orderId: order.orderId, status: 'EVALUATING' },
        data: { status: 'BOOKING', courier: winner.courier, evaluationId,
          scoreBreakdown: winner.breakdown as unknown as Prisma.InputJsonValue },
      });
      if (claimed.count !== 1) throw new Error('Courier claim changed during evaluation');
    });
  } catch (error) {
    if ((error as { code?: string }).code !== 'NO_VALID_COURIER_QUOTES') {
      await recordOutcome(order.orderId, 'FAILED', 'COURIER_EVALUATION_FAILED', 'Courier evaluation failed').catch(
        (cause) => logger.error({ cause, orderId: order.orderId.toString() }, 'Failed to record courier evaluation failure'));
    }
    throw error;
  }

  let booked: Awaited<ReturnType<ReturnType<typeof getCourierAdapter>['book']>>;
  try {
    // One selected provider, one call. Never retry or fall back after an uncertain outcome.
    booked = await bookWithDeadline(getCourierAdapter().book({ courier: winner.courier,
      orderId: order.publicId, destinationCity: order.shipCity }));
  } catch (error) {
    const definitive = error instanceof DefinitiveCourierBookingError;
    await recordOutcome(order.orderId, definitive ? 'FAILED' : 'UNCERTAIN',
      definitive ? 'COURIER_BOOKING_FAILED' : 'COURIER_OUTCOME_UNCERTAIN',
      definitive ? 'Simulated provider confirmed no booking' : 'Booking outcome requires reconciliation')
      .catch((cause) => logger.error({ cause, orderId: order.orderId.toString() },
        'Failed to persist courier booking outcome; booking claim remains locked'));
    throw definitive
      ? new BusinessRuleError('Simulated courier booking failed; no shipment was created', undefined, 'COURIER_BOOKING_FAILED')
      : new ConflictError('Courier booking outcome is uncertain; reconcile before retrying', undefined, 'COURIER_OUTCOME_UNCERTAIN');
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.courierShipment.updateMany({
        where: { orderId: order.orderId, status: 'BOOKING', evaluationId },
        data: { status: 'BOOKED', bookingReference: booked.bookingReference,
          trackingId: booked.trackingNo, bookedAt: new Date() },
      });
      if (updated.count !== 1) throw new Error('Courier claim changed after booking');
      const orderUpdated = await tx.order.updateMany({
        where: { orderId: order.orderId, status: 'PAYMENT_CONFIRMED', courier: null },
        data: { courier: winner.courier, trackingNo: booked.trackingNo,
          courierOverridden: wasOverride },
      });
      if (orderUpdated.count !== 1) throw new Error('Order changed after courier booking');
      await tx.courierQuote.updateMany({ where: { orderId: order.orderId, evaluationId, courier: winner.courier },
        data: { selected: true } });
    });
  } catch (error) {
    await recordOutcome(order.orderId, 'UNCERTAIN', 'COURIER_PERSISTENCE_UNCERTAIN',
      'Provider returned a booking but its persistence requires reconciliation').catch(() => undefined);
    logger.error({ error, orderId: order.orderId.toString() }, 'Courier booking persistence uncertain');
    throw new ConflictError('Courier booking must be reconciled before retrying', undefined, 'COURIER_OUTCOME_UNCERTAIN');
  }

  try {
    await transitionOrderStatus(order.orderId, 'PROCESSING', 'system', `Simulated courier booked: ${winner.courier}`);
  } catch (error) {
    logger.error({ error, orderId: order.orderId.toString() }, 'Booked courier status transition needs reconciliation');
    throw new ConflictError('Shipment is recorded, but order status needs reconciliation', undefined, 'COURIER_STATUS_SYNC_PENDING');
  }
  return getAutoSelection(orderPublicId, sellerId);
}

export async function getCourierPerformance(sellerId: bigint) {
  const shipments = await prisma.courierShipment.findMany({
    where: { sellerId }, select: { courier: true, source: true, originCity: true, destCity: true, weightKg: true,
      status: true, onTime: true, bookedAt: true, deliveredAt: true }, take: 1000,
    orderBy: { createdAt: 'desc' },
  });
  const groups = new Map<string, { courier: string; originCity: string; destinationCity: string; weightBand: string;
    source: string; sampleCount: number; delivered: number; onTime: number; failed: number;
    onTimeSamples: number; deliveryHoursTotal: number; deliveryHoursSamples: number }>();
  for (const row of shipments) {
    if (!row.courier) continue;
    const weightBand = row.weightKg.toNumber() < 2 ? 'under-2kg' : '2kg-plus';
    const key = [row.courier, row.originCity.toLowerCase(), row.destCity.toLowerCase(), weightBand, row.source].join('|');
    const group = groups.get(key) ?? { courier: row.courier, originCity: row.originCity,
      destinationCity: row.destCity, weightBand, source: row.source, sampleCount: 0,
      delivered: 0, onTime: 0, failed: 0, onTimeSamples: 0,
      deliveryHoursTotal: 0, deliveryHoursSamples: 0 };
    group.sampleCount++;
    if (row.status === 'DELIVERED') group.delivered++;
    if (row.status === 'DELIVERED' && row.onTime !== null) group.onTimeSamples++;
    if (row.status === 'DELIVERED' && row.onTime === true) group.onTime++;
    if (row.status === 'FAILED') group.failed++;
    if (row.deliveredAt && row.bookedAt) {
      group.deliveryHoursTotal += (row.deliveredAt.getTime() - row.bookedAt.getTime()) / 3_600_000;
      group.deliveryHoursSamples++;
    }
    groups.set(key, group);
  }
  return { groups: [...groups.values()].map(({ deliveryHoursTotal, deliveryHoursSamples, ...group }) => ({
    ...group, averageDeliveryHours: deliveryHoursSamples >= 5
      ? Math.round(deliveryHoursTotal / deliveryHoursSamples * 100) / 100 : null,
    onTimeRate: group.onTimeSamples >= 5 ? Math.round(group.onTime / group.onTimeSamples * 1000) / 1000 : null,
    sufficientSample: group.onTimeSamples >= 5,
  })), sampledShipments: shipments.length, limit: 1000,
  note: 'Synthetic and real records are separate. Rates require at least five measured deliveries per route and weight band. No model is trained.' };
}
