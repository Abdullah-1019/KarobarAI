import { createHash } from 'node:crypto';
import type {
  CourierCode,
  CourierShipmentStatus,
  ReturnShipmentLeg,
  ReturnReceiptCondition,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { Worker } from 'bullmq';

import { getCourierAdapter } from '../../adapters/courier';
import { createAuditLog } from '../../core/audit';
import { config } from '../../core/config';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../core/errors/AppError';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';
import { createQueue, createWorker } from '../../core/queue';
import { decrementStock, restoreStock } from '../catalog/catalog.service';
import { enqueueNotification } from '../notification';
import { evaluateCourierQuotes } from '../tracking/tracking.service';

async function notifyReturn(
  returnId: bigint,
  userId: bigint,
  type: string,
  vars: Record<string, unknown> = {},
) {
  const ret = await prisma.return.findUniqueOrThrow({
    where: { returnId },
    select: { order: { select: { publicId: true } } },
  });
  await enqueueNotification(
    {
      userId: userId.toString(),
      type,
      orderId: ret.order.publicId,
      vars: { orderId: ret.order.publicId, ...vars },
    },
    `return-${returnId}-${type}-${String(vars.leg ?? '')}-${String(vars.status ?? '')}-${userId}`,
  );
}

// Every external booking is claimed in the database first. An unknown provider outcome stays
// UNCERTAIN and is never sent to a second courier automatically.
async function ownedReturn(returnId: bigint, actorId: bigint, role: 'BUYER' | 'SELLER' | 'ADMIN') {
  const row = await prisma.return.findUnique({
    where: { returnId },
    include: { order: true, orderItem: true, fulfillment: true, shipments: true },
  });
  if (!row) throw new NotFoundError('Return not found', undefined, 'RETURN_NOT_FOUND');
  if (
    (role === 'BUYER' && row.order.buyerId !== actorId) ||
    (role === 'SELLER' && row.sellerId !== actorId)
  ) {
    throw new ForbiddenError('This return does not belong to you', undefined, 'RETURN_NOT_OWNED');
  }
  return row;
}

function requireSimulation() {
  if (config.adapterMode !== 'mock')
    throw new BusinessRuleError(
      'Return booking is available only with simulated couriers',
      undefined,
      'RETURN_SIMULATION_ONLY',
    );
}

async function bookWithDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Courier booking confirmation timed out')),
          15_000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function bookReturnShipment(
  returnId: bigint,
  actorId: bigint,
  leg: ReturnShipmentLeg,
  actorRole: 'SELLER' | 'ADMIN' = 'SELLER',
) {
  requireSimulation();
  const row = await ownedReturn(returnId, actorId, actorRole);
  if (!row.orderItem || !row.fulfillment || !['APPROVED', 'PICKUP_BOOKED'].includes(row.status)) {
    throw new BusinessRuleError(
      'Return is not ready for shipment',
      undefined,
      'RETURN_INVALID_STATE',
    );
  }
  if (leg === 'RETURN' && row.status !== 'APPROVED') {
    const existing = row.shipments.find((item) => item.leg === 'RETURN');
    if (
      existing &&
      ['BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(
        existing.status,
      )
    )
      return existing;
    throw new ConflictError(
      'Return booking requires reconciliation',
      undefined,
      'RETURN_BOOKING_UNCERTAIN',
    );
  }
  if (
    leg === 'REPLACEMENT' &&
    (!row.fulfillment.replacementReservedAt || row.fulfillment.status !== 'REPLACEMENT_PACKED')
  ) {
    throw new BusinessRuleError(
      'Replacement stock must be reserved before booking',
      undefined,
      'RETURN_INVALID_STATE',
    );
  }
  const existing = row.shipments.find((item) => item.leg === leg);
  if (existing) {
    if (
      ['BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(
        existing.status,
      )
    )
      return existing;
    throw new ConflictError(
      'Shipment booking requires reconciliation',
      undefined,
      'RETURN_BOOKING_UNCERTAIN',
    );
  }

  const originCity = leg === 'RETURN' ? row.order.shipCity : 'Karachi';
  const destCity = leg === 'RETURN' ? 'Karachi' : row.order.shipCity;
  const destProvince = leg === 'RETURN' ? 'Sindh' : row.order.shipProvince;
  const weightKg = Math.max(0.5, row.orderItem.quantity * 0.5);
  const claim = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT return_id FROM returns WHERE return_id = ${returnId} FOR UPDATE`;
    const current = await tx.return.findUniqueOrThrow({
      where: { returnId },
      include: { fulfillment: true },
    });
    if (leg === 'RETURN' && current.status !== 'APPROVED')
      throw new ConflictError(
        'Return decision changed; refresh before booking',
        undefined,
        'RETURN_INVALID_STATE',
      );
    if (
      leg === 'REPLACEMENT' &&
      (current.fulfillment?.status !== 'REPLACEMENT_PACKED' ||
        !current.fulfillment.replacementReservedAt)
    )
      throw new ConflictError(
        'Replacement state changed; refresh before booking',
        undefined,
        'RETURN_INVALID_STATE',
      );
    const prior = await tx.returnShipment.findUnique({
      where: { returnId_leg: { returnId, leg } },
    });
    if (prior)
      throw new ConflictError(
        'Shipment booking already claimed',
        undefined,
        'RETURN_BOOKING_UNCERTAIN',
      );
    return tx.returnShipment.create({
      data: {
        returnId,
        leg,
        status: 'EVALUATING',
        originCity,
        destCity,
        destProvince,
        weightKg,
        source: 'SIMULATED',
      },
    });
  });

  let booked: { trackingNo: string; bookingReference: string };
  let bookingAttempted = false;
  try {
    const scored = await evaluateCourierQuotes(
      { city: destCity, province: destProvince },
      false,
      originCity,
      weightKg,
    );
    if (!scored.length)
      throw new BusinessRuleError(
        'No simulated carrier serves this route',
        undefined,
        'NO_VALID_COURIER_QUOTES',
      );
    const preferred = leg === 'RETURN' ? row.order.courier : null;
    const winner = scored.find((candidate) => candidate.courier === preferred) ?? scored[0]!;
    await prisma.returnShipment.update({
      where: { shipmentId: claim.shipmentId },
      data: {
        status: 'BOOKING',
        courier: winner.courier,
        quoteCost: winner.quote.cost,
        quoteEtaHours: winner.quote.etaHours,
        scoreBreakdown: winner.breakdown as unknown as Prisma.InputJsonValue,
      },
    });
    // Distinct leg reference; never reuse the outbound order's tracking number.
    bookingAttempted = true;
    const mockReference = createHash('sha256')
      .update(`${returnId}:${leg}`)
      .digest('hex')
      .slice(0, 8);
    booked = await bookWithDeadline(
      getCourierAdapter().book({
        courier: winner.courier,
        orderId: mockReference,
        destinationCity: destCity,
      }),
    );
  } catch (error) {
    const definitive = !bookingAttempted;
    await prisma.returnShipment.updateMany({
      where: { shipmentId: claim.shipmentId, status: { in: ['EVALUATING', 'BOOKING'] } },
      data: {
        status: definitive ? 'FAILED' : 'UNCERTAIN',
        failureCode: definitive ? 'BOOKING_NOT_ATTEMPTED' : 'BOOKING_OUTCOME_UNCERTAIN',
      },
    });
    if (definitive) throw error;
    logger.error(
      { returnId: returnId.toString(), leg, error },
      'Return shipment booking outcome uncertain',
    );
    throw new ConflictError(
      'Shipment booking must be reconciled before retry',
      undefined,
      'RETURN_BOOKING_UNCERTAIN',
    );
  }

  try {
    const savedShipment = await prisma.$transaction(async (tx) => {
      const saved = await tx.returnShipment.updateMany({
        where: { shipmentId: claim.shipmentId, status: 'BOOKING' },
        data: {
          status: 'BOOKED',
          trackingId: booked.trackingNo,
          bookingReference: booked.bookingReference,
          bookedAt: new Date(),
        },
      });
      if (saved.count !== 1)
        throw new ConflictError('Shipment claim changed', undefined, 'RETURN_BOOKING_UNCERTAIN');
      if (leg === 'RETURN') {
        const changed = await tx.return.updateMany({
          where: { returnId, status: 'APPROVED' },
          data: { status: 'PICKUP_BOOKED' },
        });
        if (changed.count !== 1)
          throw new ConflictError(
            'Return changed while booking',
            undefined,
            'RETURN_BOOKING_UNCERTAIN',
          );
      }
      await tx.returnFulfillment.update({
        where: { returnId },
        data: { status: leg === 'RETURN' ? 'RETURN_IN_TRANSIT' : 'REPLACEMENT_IN_TRANSIT' },
      });
      await tx.returnShipmentEvent.create({
        data: {
          shipmentId: claim.shipmentId,
          status: 'BOOKED',
          description: `Simulated ${leg.toLowerCase()} shipment booked`,
        },
      });
      await createAuditLog(
        {
          actorId,
          action: 'MODERATION',
          entity: 'returns',
          entityId: returnId,
          reason: `Simulated ${leg.toLowerCase()} courier booking`,
          after: {
            courier: (
              await tx.returnShipment.findUniqueOrThrow({ where: { shipmentId: claim.shipmentId } })
            ).courier,
            shipmentId: claim.shipmentId.toString(),
          },
        },
        tx,
      );
      return tx.returnShipment.findUniqueOrThrow({ where: { shipmentId: claim.shipmentId } });
    });
    await notifyReturn(
      returnId,
      row.order.buyerId,
      leg === 'RETURN' ? 'RETURN_COURIER_BOOKED' : 'RETURN_REPLACEMENT_BOOKED',
    ).catch(() => undefined);
    await notifyReturn(returnId, row.sellerId,
      leg === 'RETURN' ? 'RETURN_COURIER_BOOKED' : 'RETURN_REPLACEMENT_BOOKED')
      .catch(() => undefined);
    return savedShipment;
  } catch (error) {
    await prisma.returnShipment
      .updateMany({
        where: { shipmentId: claim.shipmentId, status: 'BOOKING' },
        data: { status: 'UNCERTAIN', failureCode: 'PERSISTENCE_UNCERTAIN' },
      })
      .catch(() => undefined);
    logger.error(
      { returnId: returnId.toString(), leg, error },
      'Booked return shipment needs reconciliation',
    );
    throw new ConflictError(
      'Shipment booking needs reconciliation',
      undefined,
      'RETURN_BOOKING_UNCERTAIN',
    );
  }
}

export async function advanceSimulatedReturnShipment(
  returnId: bigint,
  actorId: bigint,
  leg: ReturnShipmentLeg,
  systemPoll = false,
) {
  requireSimulation();
  const row = systemPoll
    ? await prisma.return.findUnique({ where: { returnId }, include: { order: true } })
    : await ownedReturn(returnId, actorId, 'ADMIN');
  if (!row) throw new NotFoundError('Return not found', undefined, 'RETURN_NOT_FOUND');
  const shipment = await prisma.returnShipment.findUnique({
    where: { returnId_leg: { returnId, leg } },
  });
  if (
    !shipment ||
    !shipment.courier ||
    !shipment.trackingId ||
    !['BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(shipment.status)
  ) {
    throw new BusinessRuleError(
      'Shipment cannot advance',
      undefined,
      'RETURN_SHIPMENT_INVALID_STATE',
    );
  }
  const next = await getCourierAdapter().track({
    courier: shipment.courier as CourierCode,
    trackingNo: shipment.trackingId,
    previousStatus:
      shipment.status === 'BOOKED'
        ? null
        : (shipment.status as 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY'),
  });
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.returnShipment.updateMany({
      where: { shipmentId: shipment.shipmentId, status: shipment.status },
      data: {
        status: next.status as CourierShipmentStatus,
        ...(next.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      },
    });
    if (changed.count !== 1)
      throw new ConflictError('Tracking changed; refresh', undefined, 'RETURN_SHIPMENT_CONFLICT');
    await tx.returnShipmentEvent.create({
      data: {
        shipmentId: shipment.shipmentId,
        status: next.status as CourierShipmentStatus,
        description: `Simulated ${leg.toLowerCase()} shipment ${next.status.toLowerCase()}`,
      },
    });
    if (next.status === 'DELIVERED') {
      const status = leg === 'RETURN' ? 'AWAITING_SELLER_RECEIPT' : 'REPLACEMENT_DELIVERED';
      await tx.returnFulfillment.update({ where: { returnId }, data: { status } });
    }
    return tx.returnShipment.findUniqueOrThrow({ where: { shipmentId: shipment.shipmentId } });
  });
  if (updated.status === 'DELIVERED')
    await notifyReturn(
      returnId,
      leg === 'RETURN' ? row.sellerId : row.order.buyerId,
      leg === 'RETURN' ? 'RETURN_DELIVERED_TO_SELLER' : 'RETURN_REPLACEMENT_DELIVERED',
    ).catch(() => undefined);
  else {
    const vars = { leg: leg.toLowerCase(), status: updated.status.toLowerCase().replace(/_/g, ' ') };
    await Promise.all([row.order.buyerId, row.sellerId].map((userId) =>
      notifyReturn(returnId, userId, 'RETURN_TRACKING_UPDATED', vars).catch(() => undefined)));
  }
  return updated;
}

export async function pollSimulatedReturnShipments(): Promise<void> {
  if (config.adapterMode !== 'mock') return;
  const shipments = await prisma.returnShipment.findMany({
    where: { source: 'SIMULATED', status: { in: ['BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] } },
    orderBy: { shipmentId: 'asc' }, take: 50,
  });
  for (const shipment of shipments) {
    try {
      // Each poll advances at most one step; a concurrent worker uses the status CAS to prevent duplicates.
      // eslint-disable-next-line no-await-in-loop
      await advanceSimulatedReturnShipment(shipment.returnId, 0n, shipment.leg, true);
    } catch (error) {
      logger.warn({ returnId: shipment.returnId.toString(), leg: shipment.leg, error },
        'Simulated return tracking poll could not advance');
    }
  }
}

let returnTrackingQueue: ReturnType<typeof createQueue> | undefined;
let returnTrackingWorker: Worker | undefined;
export async function startReturnShipmentPollJob(): Promise<void> {
  if (config.adapterMode !== 'mock') return;
  returnTrackingQueue ??= createQueue('return-tracking-poll');
  await returnTrackingQueue.add('poll', {}, { repeat: { every: 5 * 60 * 1000 },
    jobId: 'return-tracking-poll-recurring' });
  returnTrackingWorker ??= createWorker('return-tracking-poll', async () => {
    await pollSimulatedReturnShipments();
  });
}

export async function confirmReplacementReceipt(returnId: bigint, buyerId: bigint) {
  const row = await ownedReturn(returnId, buyerId, 'BUYER');
  const completed = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT return_id FROM returns WHERE return_id = ${returnId} FOR UPDATE`;
    const fulfillment = await tx.returnFulfillment.findUnique({ where: { returnId } });
    const shipment = await tx.returnShipment.findUnique({
      where: { returnId_leg: { returnId, leg: 'REPLACEMENT' } },
    });
    if (fulfillment?.status !== 'REPLACEMENT_DELIVERED' || shipment?.status !== 'DELIVERED') {
      throw new BusinessRuleError('Replacement has not been delivered', undefined,
        'RETURN_REPLACEMENT_NOT_DELIVERED');
    }
    const changed = await tx.returnFulfillment.updateMany({
      where: { returnId, status: 'REPLACEMENT_DELIVERED', replacementBuyerConfirmedAt: null },
      data: { status: 'EXCHANGE_COMPLETED', replacementBuyerConfirmedAt: new Date() },
    });
    if (changed.count !== 1) throw new ConflictError('Exchange already confirmed', undefined,
      'RETURN_EXCHANGE_CONFLICT');
    if (row.orderItemId) await tx.orderItem.update({ where: { orderItemId: row.orderItemId },
      data: { resolution: 'EXCHANGED' } });
    await createAuditLog({ actorId: buyerId, action: 'MODERATION', entity: 'returns', entityId: returnId,
      reason: 'Buyer confirmed replacement receipt',
      after: { fulfillmentStatus: 'EXCHANGE_COMPLETED' } }, tx);
    return tx.returnFulfillment.findUniqueOrThrow({ where: { returnId } });
  });
  await notifyReturn(returnId, row.sellerId, 'RETURN_EXCHANGE_COMPLETED').catch(() => undefined);
  return completed;
}

export async function submitExchangeFeedback(returnId: bigint, buyerId: bigint,
  input: { rating: number; comment?: string }) {
  const row = await ownedReturn(returnId, buyerId, 'BUYER');
  const productId = row.fulfillment?.replacementProductId;
  if (row.fulfillment?.status !== 'EXCHANGE_COMPLETED' || !productId) {
    throw new BusinessRuleError('Feedback is available after the exchange is complete', undefined,
      'RETURN_FEEDBACK_NOT_READY');
  }
  try {
    return await prisma.review.create({ data: {
      buyerId, productId, orderId: row.orderId, rating: input.rating,
      comment: input.comment?.trim() || null,
    } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Feedback for this product was already submitted', undefined,
        'RETURN_FEEDBACK_EXISTS');
    }
    throw error;
  }
}

export async function confirmReturnReceipt(
  returnId: bigint,
  sellerId: bigint,
  condition: ReturnReceiptCondition,
) {
  const row = await ownedReturn(returnId, sellerId, 'SELLER');
  if (
    !row.orderItem ||
    !row.fulfillment ||
    row.fulfillment.status !== 'AWAITING_SELLER_RECEIPT' ||
    row.shipments.find((shipment) => shipment.leg === 'RETURN')?.status !== 'DELIVERED'
  ) {
    throw new BusinessRuleError(
      'Return parcel has not been delivered to the seller',
      undefined,
      'RETURN_RECEIPT_NOT_READY',
    );
  }
  const receipt = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT return_id FROM returns WHERE return_id = ${returnId} FOR UPDATE`;
    const changed = await tx.returnFulfillment.updateMany({
      where: {
        returnId,
        status: 'AWAITING_SELLER_RECEIPT',
        OR: [{ receiptConfirmedAt: null }, { receiptCondition: 'NEEDS_INSPECTION' }],
      },
      data: {
        receiptCondition: condition,
        receiptConfirmedBy: sellerId,
        receiptConfirmedAt: new Date(),
        status:
          condition === 'NEEDS_INSPECTION' ? 'AWAITING_SELLER_RECEIPT' : 'REPLACEMENT_PENDING',
        ...(condition !== 'NEEDS_INSPECTION' ? { inventoryReconciledAt: new Date() } : {}),
      },
    });
    if (changed.count !== 1)
      throw new ConflictError('Receipt already recorded', undefined, 'RETURN_RECEIPT_CONFLICT');
    if (condition === 'RESELLABLE')
      await restoreStock(row.orderItem!.productId, row.orderItem!.quantity, tx);
    if (condition !== 'NEEDS_INSPECTION')
      await tx.orderItem.update({
        where: { orderItemId: row.orderItem!.orderItemId },
        data: { resolution: 'RETURNED' },
      });
    await createAuditLog(
      {
        actorId: sellerId,
        action: 'MODERATION',
        entity: 'returns',
        entityId: returnId,
        reason: `Seller received simulated return: ${condition}`,
        after: { condition, stockRestored: condition === 'RESELLABLE' },
      },
      tx,
    );
    return tx.returnFulfillment.findUniqueOrThrow({ where: { returnId } });
  });
  if (condition !== 'NEEDS_INSPECTION')
    await notifyReturn(returnId, row.order.buyerId, 'RETURN_RECEIVED').catch(() => undefined);
  return receipt;
}

export async function reserveReplacement(
  returnId: bigint,
  sellerId: bigint,
  productPublicId: string,
) {
  const row = await ownedReturn(returnId, sellerId, 'SELLER');
  if (
    !row.fulfillment ||
    !row.orderItem ||
    !['REPLACEMENT_PENDING', 'REFUND_DECLINED'].includes(row.fulfillment.status) ||
    !row.fulfillment.receiptConfirmedAt ||
    row.fulfillment.receiptCondition === 'NEEDS_INSPECTION'
  ) {
    throw new BusinessRuleError(
      'Seller must verify the returned item first',
      undefined,
      'RETURN_REPLACEMENT_NOT_READY',
    );
  }
  const reserved = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT return_id FROM returns WHERE return_id = ${returnId} FOR UPDATE`;
    const current = await tx.returnFulfillment.findUniqueOrThrow({ where: { returnId } });
    if (
      current.replacementReservedAt ||
      !['NONE', 'DECLINED'].includes(current.refundProposalStatus)
    )
      throw new ConflictError(
        'Replacement or refund proposal already exists',
        undefined,
        'RETURN_RESOLUTION_EXISTS',
      );
    const product = await tx.product.findUnique({ where: { publicId: productPublicId } });
    if (
      !product ||
      product.sellerId !== sellerId ||
      product.deletedAt ||
      !['LIVE', 'OUT_OF_STOCK'].includes(product.status)
    ) {
      throw new BusinessRuleError(
        'Replacement product is unavailable in this store',
        undefined,
        'RETURN_REPLACEMENT_INVALID',
      );
    }
    await decrementStock(product.productId, row.orderItem!.quantity, tx);
    const reserved = await tx.returnFulfillment.update({
      where: { returnId },
      data: {
        status: 'REPLACEMENT_PENDING',
        replacementProductId: product.productId,
        replacementQuantity: row.orderItem!.quantity,
        replacementReservedAt: new Date(),
      },
    });
    await createAuditLog(
      {
        actorId: sellerId,
        action: 'MODERATION',
        entity: 'returns',
        entityId: returnId,
        reason: 'Replacement stock reserved',
        after: { productId: product.productId.toString(), quantity: row.orderItem!.quantity },
      },
      tx,
    );
    return reserved;
  });
  await notifyReturn(returnId, row.order.buyerId, 'RETURN_REPLACEMENT_RESERVED').catch(() => undefined);
  return reserved;
}

export async function packReplacement(returnId: bigint, sellerId: bigint) {
  await ownedReturn(returnId, sellerId, 'SELLER');
  const packed = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT return_id FROM returns WHERE return_id = ${returnId} FOR UPDATE`;
    const changed = await tx.returnFulfillment.updateMany({
      where: { returnId, status: 'REPLACEMENT_PENDING', replacementReservedAt: { not: null },
        replacementProductId: { not: null }, replacementPackedAt: null },
      data: { status: 'REPLACEMENT_PACKED', replacementPackedAt: new Date() },
    });
    if (changed.count !== 1) throw new ConflictError('Replacement is not ready for packing',
      undefined, 'RETURN_REPLACEMENT_NOT_READY');
    await createAuditLog({ actorId: sellerId, action: 'MODERATION', entity: 'returns', entityId: returnId,
      reason: 'Seller packed reserved replacement', after: { status: 'REPLACEMENT_PACKED' } }, tx);
    return tx.returnFulfillment.findUniqueOrThrow({ where: { returnId } });
  });
  const row = await prisma.return.findUniqueOrThrow({ where: { returnId }, select: { order: {
    select: { buyerId: true } } } });
  await notifyReturn(returnId, row.order.buyerId, 'RETURN_REPLACEMENT_PACKED').catch(() => undefined);
  return packed;
}

export async function proposeRefundInstead(returnId: bigint, sellerId: bigint, reason: string) {
  const row = await ownedReturn(returnId, sellerId, 'SELLER');
  if (
    !row.fulfillment ||
    !row.fulfillment.receiptConfirmedAt ||
    row.fulfillment.status !== 'REPLACEMENT_PENDING'
  ) {
    throw new BusinessRuleError(
      'Return must be received before proposing a refund',
      undefined,
      'RETURN_REFUND_NOT_READY',
    );
  }
  if (!reason.trim())
    throw new BusinessRuleError(
      'A refund proposal reason is required',
      undefined,
      'RETURN_REFUND_REASON_REQUIRED',
    );
  const proposal = await prisma.$transaction(async (tx) => {
    const changed = await tx.returnFulfillment.updateMany({
      where: {
        returnId,
        status: 'REPLACEMENT_PENDING',
        refundProposalStatus: 'NONE',
        replacementReservedAt: null,
      },
      data: {
        status: 'REFUND_PROPOSED',
        refundProposalStatus: 'PENDING_BUYER',
        refundProposalReason: reason.trim(),
        refundProposedBy: sellerId,
        refundProposedAt: new Date(),
      },
    });
    if (changed.count !== 1)
      throw new ConflictError('A resolution already exists', undefined, 'RETURN_RESOLUTION_EXISTS');
    await createAuditLog(
      {
        actorId: sellerId,
        action: 'MODERATION',
        entity: 'returns',
        entityId: returnId,
        reason: 'Seller proposed refund instead of replacement',
        after: { proposal: 'PENDING_BUYER' },
      },
      tx,
    );
    return tx.returnFulfillment.findUniqueOrThrow({ where: { returnId } });
  });
  await notifyReturn(returnId, row.order.buyerId, 'RETURN_REFUND_PROPOSED').catch(() => undefined);
  return proposal;
}

export async function respondToRefundProposal(returnId: bigint, buyerId: bigint, accept: boolean) {
  const row = await ownedReturn(returnId, buyerId, 'BUYER');
  const response = await prisma.$transaction(async (tx) => {
    const changed = await tx.returnFulfillment.updateMany({
      where: { returnId, status: 'REFUND_PROPOSED', refundProposalStatus: 'PENDING_BUYER' },
      data: {
        status: accept ? 'REFUND_CONSENTED' : 'REFUND_DECLINED',
        refundProposalStatus: accept ? 'ACCEPTED' : 'DECLINED',
        buyerRespondedAt: new Date(),
      },
    });
    if (changed.count !== 1)
      throw new ConflictError(
        'Refund proposal is no longer pending',
        undefined,
        'RETURN_REFUND_PROPOSAL_CONFLICT',
      );
    await createAuditLog(
      {
        actorId: buyerId,
        action: 'MODERATION',
        entity: 'returns',
        entityId: returnId,
        reason: accept ? 'Buyer consented to proposed refund' : 'Buyer declined proposed refund',
        after: { consent: accept },
      },
      tx,
    );
    return tx.returnFulfillment.findUniqueOrThrow({ where: { returnId } });
  });
  await notifyReturn(returnId, row.sellerId, 'RETURN_REFUND_RESPONSE', {
    response: accept ? 'accepted' : 'declined',
  }).catch(() => undefined);
  return response;
}
