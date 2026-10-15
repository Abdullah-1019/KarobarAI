import type { AuditTrailEntryDTO, CreateReturnInput, ReturnDetailDTO, ReturnListDTO, ReturnListItemDTO } from '@karobarai/shared';
import type { Prisma, ReturnStatus, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createAuditLog } from '../../core/audit';

import { getStorageAdapter } from '../../adapters/storage';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors/AppError';
import { prisma } from '../../core/prisma';
import { canTransition } from '../../core/state-machines/return.state-machine';
import { validateImageFile } from '../../core/upload/imageValidation';
import { deletePrivateEvidence, savePrivateEvidence } from './private-evidence.storage';
import { enqueueReturnInspection } from './return-inspection.service';
import { enqueueNotification } from '../notification';
import * as repo from './returns.repository';
import type { ReturnDetailRow } from './returns.repository';

// Feature 10 — extends nothing (this is the one genuinely new module TRD §12 always intended for
// returns/disputes). No returns.repository-layer deviation: matches the doc's own explicit
// Repository pattern instruction (the one module in this codebase with a literal *.repository.ts
// file, per Task 1's Engineering Decision — every other feature's "no repository layer"
// convention was this session's own choice, not a hard rule; this module follows its own doc).

async function getReturnWindowDays(): Promise<number> {
  return 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 2.1 — ReturnEligibilityService. A single-order check, distinct from Feature 7's own
// batch return-eligibility gate on the buyer's order list (getReturnEligibilityByOrderId,
// order.service.ts) — same business rule (window + no existing return), different query shape
// (one order vs. a page of orders). Not literally reused, since the two serve different callers
// with incompatible signatures; documented as a conscious, minimal duplication of a ~3-line
// predicate, not a divergent reimplementation.
export async function checkEligibility(orderPublicId: string, buyerId: bigint) {
  const order = await prisma.order.findUnique({ where: { publicId: orderPublicId } });
  if (!order) throw new NotFoundError('Order not found', undefined, 'ORDER_NOT_FOUND');
  if (order.buyerId !== buyerId) {
    throw new ForbiddenError('This order does not belong to you', undefined, 'RETURN_NOT_OWNED');
  }
  if (order.status !== 'COMPLETED' || !order.buyerConfirmedAt) {
    throw new BusinessRuleError('Buyer receipt must be confirmed before a return',
      { status: order.status }, 'RETURN_WINDOW_CLOSED');
  }
  const windowDays = await getReturnWindowDays();
  const confirmedAt = order.buyerConfirmedAt;
  if (Date.now() > confirmedAt.getTime() + windowDays * 24 * 60 * 60 * 1000) {
    throw new BusinessRuleError('The return window for this order has closed', undefined, 'RETURN_WINDOW_CLOSED');
  }
  return order;
}

export async function createReturn(buyerId: bigint, input: CreateReturnInput): Promise<ReturnDetailDTO> {
  const order = await checkEligibility(input.orderId, buyerId);
  const items = await prisma.orderItem.findMany({
    where: { orderId: order.orderId }, include: { product: { select: { publicId: true } } },
  });
  const selected = input.productId ? items.find((item) => item.product.publicId === input.productId)
    : items.length === 1 ? items[0] : undefined;
  if (input.productId && !selected) throw new ValidationError('Product is not in this order', undefined, 'RETURN_ITEM_INVALID');
  if (!selected) throw new ValidationError('Select an item from this order', undefined, 'RETURN_ITEM_REQUIRED');
  const existing = await repo.findReturnForItem(order.orderId, selected.orderItemId);
  if (existing) throw new ConflictError('A return already exists for this item', undefined, 'RETURN_ALREADY_EXISTS');

  let created;
  try {
    created = await repo.createReturn({ orderId: order.orderId, sellerId: order.sellerId,
      reason: input.reasonCode === 'OTHER' ? `OTHER: ${input.otherReason}` : input.reasonCode,
      orderItemId: selected.orderItemId });
  } catch (err) {
    // Defense in depth (Task 2's Engineering Decision): the pre-check above closes the normal
    // window, but returns.order_item_id's UNIQUE constraint is the final backstop against a race.
    if (err instanceof Object && 'code' in err && (err as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
      throw new ConflictError('A return already exists for this item', undefined, 'RETURN_ALREADY_EXISTS');
    }
    throw err;
  }

  // Task 2.6 — reuses Feature 9's producer, no new notification infra. Notifies the seller (the
  // buyer already knows — they just submitted it).
  await enqueueNotification({
    userId: order.sellerId.toString(),
    type: 'RETURN_INITIATED',
    orderId: order.publicId,
    vars: { orderId: order.publicId },
  }).catch(() => undefined);

  return getReturnDetail(created.returnId, { userId: buyerId, role: 'BUYER' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tri-mode ownership (mirrors Feature 7's getOwnedOrderRow exactly): Buyer (via the order),
// Seller (Return.sellerId is denormalized, Schema §15.5), or Admin/Support.
// ─────────────────────────────────────────────────────────────────────────────

export async function getOwnedReturn(
  returnId: bigint,
  requester: { userId: bigint; role: UserRole },
): Promise<ReturnDetailRow> {
  const row = await repo.findReturnById(returnId);
  if (!row) throw new NotFoundError('Return not found', undefined, 'RETURN_NOT_FOUND');
  const isBuyer = row.order.buyerId === requester.userId;
  const isSeller = row.sellerId === requester.userId;
  const isAdmin = requester.role === 'ADMIN' || requester.role === 'SUPPORT';
  if (!isBuyer && !isSeller && !isAdmin) {
    throw new ForbiddenError('This return does not belong to you', undefined, 'RETURN_NOT_OWNED');
  }
  return row;
}

async function findAuditTrail(returnId: bigint): Promise<AuditTrailEntryDTO[]> {
  const rows = await prisma.auditLog.findMany({
    where: { entity: 'returns', entityId: returnId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => ({ action: r.action, reason: r.reason, createdAt: r.createdAt.toISOString() }));
}

export function toDetailDTO(row: ReturnDetailRow, auditTrail?: AuditTrailEntryDTO[], sellerOverrideReason: string | null = null): ReturnDetailDTO {
  const isComparison = row.inspection?.policyVersion === 'dinov2_comparison_v1';
  const metadata = isComparison && row.inspection?.predictions && !Array.isArray(row.inspection.predictions)
    ? row.inspection.predictions as Record<string, unknown> : {};
  const rawAiDecision = metadata.aiDecision;
  const aiDecision = rawAiDecision && typeof rawAiDecision === 'object' && !Array.isArray(rawAiDecision)
    && 'status' in rawAiDecision && ['APPROVED', 'REJECTED', 'MANUAL_REVIEW'].includes(String(rawAiDecision.status))
    && 'reason' in rawAiDecision && typeof rawAiDecision.reason === 'string'
    && 'acceptThreshold' in rawAiDecision && typeof rawAiDecision.acceptThreshold === 'number'
    && 'reviewThreshold' in rawAiDecision && typeof rawAiDecision.reviewThreshold === 'number'
    && 'decidedAt' in rawAiDecision && typeof rawAiDecision.decidedAt === 'string'
    ? rawAiDecision as NonNullable<NonNullable<ReturnDetailDTO['inspection']>['aiDecision']> : null;
  const snapshot = Array.isArray(metadata.referenceImages) ? metadata.referenceImages : null;
  const referenceImages = snapshot && snapshot.every((item) => typeof item === 'object' && item !== null
    && 'id' in item && typeof item.id === 'string' && 'url' in item && typeof item.url === 'string')
    ? snapshot as Array<{ id: string; url: string }>
    : row.orderItem?.product.images.map((image) => ({ id: image.imageId.toString(), url: image.cdnUrl })) ?? [];
  const returnShipment = row.shipments.find((shipment) => shipment.leg === 'RETURN');
  return {
    id: row.returnId.toString(),
    orderId: row.order.publicId,
    orderNumber: row.order.orderNumber.toString(),
    productId: row.orderItem?.product.publicId ?? null,
    productName: row.orderItem?.titleSnapshot ?? null,
    itemQuantity: row.orderItem?.quantity ?? null,
    productImage: row.orderItem?.product.images[0]?.cdnUrl ?? null,
    itemResolution: row.orderItem?.resolution ?? null,
    inspection: row.inspection ? {
      state: row.inspection.state,
      status: isComparison ? row.inspection.outcome : null,
      similarityScore: isComparison ? row.inspection.confidence : null,
      reasonCode: isComparison && typeof metadata.reasonCode === 'string' ? metadata.reasonCode : null,
      referenceImageCount: typeof metadata.referenceImageCount === 'number' ? metadata.referenceImageCount
        : referenceImages.length,
      returnImageCount: typeof metadata.returnImageCount === 'number' ? metadata.returnImageCount : row.images.length,
      pairs: Array.isArray(metadata.pairs) ? metadata.pairs as Array<{ index: number; similarityScore: number }> : [],
      evidenceSufficient: metadata.evidenceSufficient === true,
      comparisonAvailable: row.inspection.comparisonAvailable,
      policyVersion: row.inspection.policyVersion,
      provider: row.inspection.provider,
      model: row.inspection.model,
      revision: typeof metadata.revision === 'string' ? metadata.revision : null,
      processedAt: row.inspection.completedAt?.toISOString() ?? null,
      aiDecision,
    } : null,
    referenceImages,
    status: row.status,
    reason: row.reason,
    decision: row.decision,
    decisionSource: sellerOverrideReason ? 'SELLER' : aiDecision && row.decision === aiDecision.status
      ? 'AI' : row.decision ? 'SELLER' : null,
    sellerOverrideReason,
    returnShipping: {
      status: returnShipment?.status
        ?? (row.status === 'PICKUP_BOOKED' ? 'BOOKING_DETAILS_UNAVAILABLE' : 'NOT_BOOKED'),
      courier: returnShipment?.courier ?? null,
      bookingReference: returnShipment?.bookingReference ?? null,
      trackingNumber: returnShipment?.trackingId ?? null,
      trackingUrl: null,
      estimatedPickupAt: null,
      estimatedDeliveryAt: returnShipment?.bookedAt && returnShipment.quoteEtaHours
        ? new Date(returnShipment.bookedAt.getTime() + returnShipment.quoteEtaHours * 3_600_000).toISOString() : null,
    },
    shipments: row.shipments.map((shipment) => ({
      leg: shipment.leg, status: shipment.status, simulated: shipment.source === 'SIMULATED',
      courier: shipment.courier, bookingReference: shipment.bookingReference,
      trackingNumber: shipment.trackingId, bookedAt: shipment.bookedAt?.toISOString() ?? null,
      estimatedDeliveryAt: shipment.bookedAt && shipment.quoteEtaHours
        ? new Date(shipment.bookedAt.getTime() + shipment.quoteEtaHours * 3_600_000).toISOString() : null,
      deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
      events: shipment.events.map((event) => ({ status: event.status,
        description: event.description, eventTime: event.eventTime.toISOString() })),
    })),
    fulfillment: row.fulfillment ? {
      status: row.fulfillment.status, receiptCondition: row.fulfillment.receiptCondition,
      receiptConfirmedAt: row.fulfillment.receiptConfirmedAt?.toISOString() ?? null,
      replacementBuyerConfirmedAt: row.fulfillment.replacementBuyerConfirmedAt?.toISOString() ?? null,
      replacementPackedAt: row.fulfillment.replacementPackedAt?.toISOString() ?? null,
      inventoryReconciledAt: row.fulfillment.inventoryReconciledAt?.toISOString() ?? null,
      replacementProductId: row.fulfillment.replacementProduct?.publicId ?? null,
      replacementProductName: row.fulfillment.replacementProduct?.titleEn ?? null,
      refundProposalStatus: row.fulfillment.refundProposalStatus,
      refundProposalReason: row.fulfillment.refundProposalReason,
      refundProposedAt: row.fulfillment.refundProposedAt?.toISOString() ?? null,
      buyerRespondedAt: row.fulfillment.buyerRespondedAt?.toISOString() ?? null,
    } : null,
    images: row.images.map((img) => ({ id: img.returnImageId.toString(), cdnUrl: img.storageKey
      ? `/api/v1/returns/${row.returnId}/images/${img.returnImageId}/content` : img.cdnUrl })),
    dispute: row.dispute
      ? { status: row.dispute.status, buyerReason: row.dispute.buyerReason,
        resolutionReason: row.dispute.adminReason, adminReason: row.dispute.adminReason,
        resolvedAt: row.dispute.resolvedAt?.toISOString() ?? null }
      : null,
    refundStatus: row.status === 'REFUND_ISSUED' ? 'ISSUED' : 'NOT_ISSUED',
    refundedAt: row.refundedAt ? row.refundedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    ...(auditTrail && { auditTrail }),
  };
}

export async function getReturnDetail(
  returnId: bigint,
  requester: { userId: bigint; role: UserRole },
  includeAuditTrail = false,
): Promise<ReturnDetailDTO> {
  const row = await getOwnedReturn(returnId, requester);
  const auditTrail = includeAuditTrail ? await findAuditTrail(returnId) : undefined;
  const override = row.status === 'REJECTED' && row.inspection
    ? await prisma.auditLog.findFirst({ where: { entity: 'returns', entityId: returnId,
      reason: { startsWith: 'Seller override of AI acceptance: ' } },
    orderBy: { createdAt: 'desc' }, select: { reason: true } }) : null;
  const detail = toDetailDTO(row, auditTrail, override?.reason?.replace(/^Seller override of AI acceptance: /, '') ?? null);
  if (row.decision) {
    const latestHumanDecision = await prisma.auditLog.findFirst({
      where: { entity: 'returns', entityId: returnId, actorId: { not: null },
        action: { in: ['MODERATION', 'DISPUTE_RESOLVE'] },
        after: { path: ['status'], equals: row.decision } },
      orderBy: { createdAt: 'desc' }, select: { actorId: true, reason: true },
    });
    detail.decisionSource = latestHumanDecision
      ? latestHumanDecision.actorId === row.sellerId ? 'SELLER' : 'ADMIN'
        : detail.inspection?.aiDecision?.status === row.decision ? 'AI' : null;
    detail.decisionReason = detail.sellerOverrideReason ?? latestHumanDecision?.reason ?? null;
  }
  if (requester.role === 'BUYER') {
    if (row.fulfillment?.status === 'EXCHANGE_COMPLETED' && row.fulfillment.replacementProductId) {
      const review = await prisma.review.findUnique({ where: { buyerId_productId: {
        buyerId: requester.userId, productId: row.fulfillment.replacementProductId,
      } }, select: { rating: true, comment: true } });
      detail.exchangeFeedback = review;
    }
    // Buyers receive the canonical decision and timeline, not provider internals or raw scores.
    detail.inspection = row.inspection ? { ...detail.inspection!, similarityScore: null,
      reasonCode: null, pairs: [], policyVersion: '', provider: null, model: null,
      revision: null, aiDecision: null } : null;
  }
  return detail;
}

export function parseReturnId(raw: string): bigint {
  if (!/^\d+$/.test(raw)) throw new ValidationError('Invalid return id', undefined, 'VALIDATION_ERROR');
  return BigInt(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 3 — Return Image Upload
// ─────────────────────────────────────────────────────────────────────────────

const MIN_RETURN_IMAGES = 3;

function requiredImageCount(row: ReturnDetailRow): number {
  return row.orderItem?.product.images.length || MIN_RETURN_IMAGES;
}

export async function uploadReturnImages(
  returnId: bigint,
  buyerId: bigint,
  files: Array<{ buffer: Buffer; size: number }>,
): Promise<ReturnDetailDTO> {
  const row = await repo.findReturnById(returnId);
  if (!row) throw new NotFoundError('Return not found', undefined, 'RETURN_NOT_FOUND');
  if (row.order.buyerId !== buyerId) {
    throw new ForbiddenError('This return does not belong to you', undefined, 'RETURN_NOT_OWNED');
  }
  if (row.status !== 'INITIATED') {
    throw new BusinessRuleError('Images can only be attached while the return is INITIATED', { status: row.status }, 'RETURN_INVALID_STATE');
  }
  const maxImages = row.orderItemId ? requiredImageCount(row) : 10;
  if (!files.length || row.images.length + files.length > maxImages) {
    throw new ValidationError(`Submit no more than ${maxImages} return images`, undefined, 'RETURN_IMAGE_LIMIT');
  }

  const storage = getStorageAdapter();
  for (const file of files) {
    const mimeType = validateImageFile(file, 'RETURN_IMAGE_TOO_LARGE', 'RETURN_IMAGE_INVALID_FILE');
    const ext = mimeType.split('/')[1];
    const key = `returns/${returnId}/${randomUUID()}.${ext}`;
    if (row.orderItemId) {
      await savePrivateEvidence(key, file.buffer, mimeType);
      await repo.createReturnImage(returnId, '', key);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop -- sequential uploads, consistent with Feature 4's product-image upload loop
    const uploaded = await storage.upload({ key, buffer: file.buffer, contentType: mimeType });
    // eslint-disable-next-line no-await-in-loop -- one row per file, order doesn't matter but must not race
    await repo.createReturnImage(returnId, uploaded.url);
  }

  return getReturnDetail(returnId, { userId: buyerId, role: 'BUYER' });
}

export async function deleteReturnImage(returnId: bigint, imageId: bigint, buyerId: bigint): Promise<ReturnDetailDTO> {
  const row = await repo.findReturnById(returnId);
  if (!row) throw new NotFoundError('Return not found', undefined, 'RETURN_NOT_FOUND');
  if (row.order.buyerId !== buyerId) {
    throw new ForbiddenError('This return does not belong to you', undefined, 'RETURN_NOT_OWNED');
  }
  if (row.status !== 'INITIATED') {
    throw new BusinessRuleError('Images can only be removed while the return is INITIATED', { status: row.status }, 'RETURN_INVALID_STATE');
  }
  const image = row.images.find((img) => img.returnImageId === imageId);
  if (!image) throw new NotFoundError('Image not found on this return', undefined, 'RETURN_IMAGE_NOT_FOUND');

  if (image.storageKey) await deletePrivateEvidence(image.storageKey);
  await repo.deleteReturnImage(imageId);
  return getReturnDetail(returnId, { userId: buyerId, role: 'BUYER' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared status-transition helper (mirrors Feature 7/8's optional-tx-client pattern exactly).
// ─────────────────────────────────────────────────────────────────────────────

export async function transitionReturnStatus(
  returnId: bigint,
  targetStatus: ReturnStatus,
  extra?: { decision?: 'APPROVED' | 'REJECTED'; decidedAt?: Date; refundedAt?: Date },
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const run = async (client: Prisma.TransactionClient) => {
    const current = await client.return.findUniqueOrThrow({ where: { returnId } });
    if (!canTransition(current.status, targetStatus)) {
      throw new BusinessRuleError(
        `Cannot transition a return from ${current.status} to ${targetStatus}`,
        { from: current.status, to: targetStatus },
        'RETURN_INVALID_STATE',
      );
    }
    await repo.updateReturnStatus(client, returnId, targetStatus, extra, current.status);
  };

  if (tx) {
    await run(tx);
  } else {
    await prisma.$transaction((innerTx) => run(innerTx));
  }
}

export async function submitReturn(returnId: bigint, buyerId: bigint): Promise<ReturnDetailDTO> {
  const row = await repo.findReturnById(returnId);
  if (!row) throw new NotFoundError('Return not found', undefined, 'RETURN_NOT_FOUND');
  if (row.order.buyerId !== buyerId) {
    throw new ForbiddenError('This return does not belong to you', undefined, 'RETURN_NOT_OWNED');
  }
  if (row.status !== 'INITIATED') {
    throw new BusinessRuleError('Return has already been submitted', { status: row.status }, 'RETURN_INVALID_STATE');
  }
  const required = requiredImageCount(row);
  if (row.images.length !== required) {
    throw new BusinessRuleError(
      `Exactly ${required} return image(s) are required for the displayed listing references`,
      { imageCount: row.images.length, required },
      'RETURN_IMAGES_INSUFFICIENT',
    );
  }

  // Commit submission and the inspection claim together, so neither can be stranded
  // between IMAGES_SUBMITTED and its review destination.
  const inspect = Boolean(row.orderItemId && row.orderItem?.product.images.length && row.images.every((image) => image.storageKey));
  await prisma.$transaction(async (tx) => {
    await transitionReturnStatus(returnId, 'IMAGES_SUBMITTED', undefined, tx);
    await transitionReturnStatus(returnId, inspect ? 'UNDER_AI_REVIEW' : 'MANUAL_REVIEW', undefined, tx);
    if (inspect) await tx.returnInspection.create({ data: { returnId, state: 'PENDING',
      policyVersion: 'dinov2_comparison_v1',
      categorySlug: row.orderItem?.categorySlugSnapshot ?? null,
      predictions: { referenceImages: row.orderItem!.product.images.map((image) => ({
        id: image.imageId.toString(), url: image.cdnUrl,
      })) },
    } });
  });
  if (inspect) {
    await enqueueReturnInspection(returnId).catch(async () => {
      await prisma.returnInspection.update({ where: { returnId }, data: { state: 'FAILED', outcome: 'PROVIDER_ERROR', errorCode: 'QUEUE_UNAVAILABLE', completedAt: new Date() } });
      await transitionReturnStatus(returnId, 'MANUAL_REVIEW');
    });
  }

  await enqueueNotification({
    userId: row.sellerId.toString(),
    type: 'RETURN_UNDER_REVIEW',
    orderId: row.order.publicId,
    vars: { orderId: row.order.publicId },
  }).catch(() => undefined);

  return getReturnDetail(returnId, { userId: buyerId, role: 'BUYER' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Buyer appeal (REJECTED -> UNDER_DISPUTE) — no task in the module doc explicitly assigns this
// endpoint, despite the doc's own Flow diagram (§2) showing it and Task 5's dependencies assuming
// disputed cases exist to review. Built here as a natural extension of this module's buyer-facing
// surface — see the handoff doc's "gap found" section.
// ─────────────────────────────────────────────────────────────────────────────

export async function appealReturn(returnId: bigint, buyerId: bigint, reason: string): Promise<ReturnDetailDTO> {
  const row = await repo.findReturnById(returnId);
  if (!row) throw new NotFoundError('Return not found', undefined, 'RETURN_NOT_FOUND');
  if (row.order.buyerId !== buyerId) {
    throw new ForbiddenError('This return does not belong to you', undefined, 'RETURN_NOT_OWNED');
  }
  if (row.status !== 'REJECTED') {
    throw new BusinessRuleError('Only a rejected return can be appealed', { status: row.status }, 'RETURN_INVALID_STATE');
  }
  if (row.dispute) throw new ConflictError('This return has already been appealed', undefined, 'RETURN_APPEAL_EXISTS');

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT return_id FROM returns WHERE return_id = ${returnId} FOR UPDATE`;
    const current = await tx.return.findUniqueOrThrow({ where: { returnId } });
    if (current.status !== 'REJECTED') throw new BusinessRuleError(
      'Return decision changed; refresh before appealing', undefined, 'RETURN_INVALID_STATE');
    await repo.createDispute(returnId, reason.trim(), tx);
    await transitionReturnStatus(returnId, 'UNDER_DISPUTE', undefined, tx);
    await createAuditLog({ actorId: buyerId, action: 'MODERATION', entity: 'returns', entityId: returnId,
      reason: 'Buyer submitted an appeal', before: { status: 'REJECTED' },
      after: { status: 'UNDER_DISPUTE' } }, tx);
  });

  await enqueueNotification({ userId: row.sellerId.toString(), type: 'RETURN_APPEAL_SUBMITTED',
    orderId: row.order.publicId, vars: { orderId: row.order.publicId } },
  `return-${returnId}-appeal-seller`).catch(() => undefined);

  return getReturnDetail(returnId, { userId: buyerId, role: 'BUYER' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 7.1 — buyer's own return history, all statuses.
// ─────────────────────────────────────────────────────────────────────────────

function toListItemDTO(row: {
  returnId: bigint;
  status: ReturnStatus;
  reason: string;
  createdAt: Date;
  images: { returnImageId: bigint }[];
  order: { publicId: string; orderNumber?: bigint };
  orderItem?: { titleSnapshot: string; product: { images: { cdnUrl: string }[] } } | null;
  fulfillment?: { status: string } | null;
}): ReturnListItemDTO {
  return {
    id: row.returnId.toString(),
    orderId: row.order.publicId,
    orderNumber: row.order.orderNumber?.toString(),
    productName: row.orderItem?.titleSnapshot ?? null,
    productImage: row.orderItem?.product.images[0]?.cdnUrl ?? null,
    fulfillmentStatus: row.fulfillment?.status ?? null,
    status: row.status,
    reason: row.reason,
    imageCount: row.images.length,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listReturnsForBuyer(
  buyerId: bigint,
  filters: { status?: string; cursor?: string; limit?: number },
): Promise<ReturnListDTO> {
  const limit = filters.limit ?? 20;
  const { returns, hasMore } = await repo.queryReturns(
    {
      order: { buyerId },
      ...(filters.status && { status: filters.status as ReturnStatus }),
    },
    filters.cursor,
    limit,
  );
  const last = returns[returns.length - 1];
  return { items: returns.map(toListItemDTO), nextCursor: hasMore && last ? last.returnId.toString() : null };
}

export { toListItemDTO, getReturnWindowDays };
