import type { AuditTrailEntryDTO, CreateReturnInput, ReturnDetailDTO, ReturnListDTO, ReturnListItemDTO } from '@karobarai/shared';
import type { Prisma, ReturnStatus, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { getStorageAdapter } from '../../adapters/storage';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors/AppError';
import { prisma } from '../../core/prisma';
import { canTransition } from '../../core/state-machines/return.state-machine';
import { validateImageFile } from '../../core/upload/imageValidation';
import { enqueueNotification } from '../notification';
import * as repo from './returns.repository';
import type { ReturnDetailRow } from './returns.repository';

// Feature 10 — extends nothing (this is the one genuinely new module TRD §12 always intended for
// returns/disputes). No returns.repository-layer deviation: matches the doc's own explicit
// Repository pattern instruction (the one module in this codebase with a literal *.repository.ts
// file, per Task 1's Engineering Decision — every other feature's "no repository layer"
// convention was this session's own choice, not a hard rule; this module follows its own doc).

async function getReturnWindowDays(): Promise<number> {
  const row = await prisma.platformConfig.findUnique({ where: { configKey: 'return_window_days' } });
  return row ? Number(row.value) : 14;
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
  if (order.status !== 'DELIVERED' && order.status !== 'COMPLETED') {
    throw new BusinessRuleError('Order is not yet delivered', { status: order.status }, 'RETURN_WINDOW_CLOSED');
  }
  const existing = await repo.findReturnByOrderId(order.orderId);
  if (existing) {
    throw new ConflictError('A return already exists for this order', undefined, 'RETURN_ALREADY_EXISTS');
  }
  const windowDays = await getReturnWindowDays();
  const deliveredAt = order.deliveredAt;
  if (!deliveredAt || Date.now() > deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000) {
    throw new BusinessRuleError('The return window for this order has closed', undefined, 'RETURN_WINDOW_CLOSED');
  }
  return order;
}

export async function createReturn(buyerId: bigint, input: CreateReturnInput): Promise<ReturnDetailDTO> {
  const order = await checkEligibility(input.orderId, buyerId);

  let created;
  try {
    created = await repo.createReturn({ orderId: order.orderId, sellerId: order.sellerId, reason: input.reason });
  } catch (err) {
    // Defense in depth (Task 2's Engineering Decision): the pre-check above closes the normal
    // window, but returns.order_id's UNIQUE constraint is the final backstop against a race.
    if (err instanceof Object && 'code' in err && (err as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
      throw new ConflictError('A return already exists for this order', undefined, 'RETURN_ALREADY_EXISTS');
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

export function toDetailDTO(row: ReturnDetailRow, auditTrail?: AuditTrailEntryDTO[]): ReturnDetailDTO {
  return {
    id: row.returnId.toString(),
    orderId: row.order.publicId,
    status: row.status,
    reason: row.reason,
    decision: row.decision,
    images: row.images.map((img) => ({ id: img.returnImageId.toString(), cdnUrl: img.cdnUrl })),
    dispute: row.dispute
      ? { status: row.dispute.status, adminReason: row.dispute.adminReason, resolvedAt: row.dispute.resolvedAt?.toISOString() ?? null }
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
  return toDetailDTO(row, auditTrail);
}

export function parseReturnId(raw: string): bigint {
  if (!/^\d+$/.test(raw)) throw new ValidationError('Invalid return id', undefined, 'VALIDATION_ERROR');
  return BigInt(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 3 — Return Image Upload
// ─────────────────────────────────────────────────────────────────────────────

const MIN_RETURN_IMAGES = 3;

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

  const storage = getStorageAdapter();
  for (const file of files) {
    const mimeType = validateImageFile(file, 'RETURN_IMAGE_TOO_LARGE', 'RETURN_IMAGE_INVALID_FILE');
    const ext = mimeType.split('/')[1];
    const key = `returns/${returnId}/${randomUUID()}.${ext}`;
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
    await repo.updateReturnStatus(client, returnId, targetStatus, extra);
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
  if (row.images.length < MIN_RETURN_IMAGES) {
    throw new BusinessRuleError(
      `At least ${MIN_RETURN_IMAGES} images are required to submit a return`,
      { imageCount: row.images.length },
      'RETURN_IMAGES_INSUFFICIENT',
    );
  }

  // Task 3.5 — two sequential transitions in one call: INITIATED -> IMAGES_SUBMITTED, then
  // immediately -> MANUAL_REVIEW (MVP never enters UNDER_AI_REVIEW, D3/Task 3.6).
  await transitionReturnStatus(returnId, 'IMAGES_SUBMITTED');
  await transitionReturnStatus(returnId, 'MANUAL_REVIEW');

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

export async function appealReturn(returnId: bigint, buyerId: bigint): Promise<ReturnDetailDTO> {
  const row = await repo.findReturnById(returnId);
  if (!row) throw new NotFoundError('Return not found', undefined, 'RETURN_NOT_FOUND');
  if (row.order.buyerId !== buyerId) {
    throw new ForbiddenError('This return does not belong to you', undefined, 'RETURN_NOT_OWNED');
  }
  if (row.status !== 'REJECTED') {
    throw new BusinessRuleError('Only a rejected return can be appealed', { status: row.status }, 'RETURN_INVALID_STATE');
  }

  await prisma.$transaction(async (tx) => {
    await repo.createDispute(returnId, tx);
    await transitionReturnStatus(returnId, 'UNDER_DISPUTE', undefined, tx);
  });

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
  order: { publicId: string };
}): ReturnListItemDTO {
  return {
    id: row.returnId.toString(),
    orderId: row.order.publicId,
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
