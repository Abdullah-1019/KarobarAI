import { randomUUID } from 'node:crypto';
import type { UserRole } from '@prisma/client';

import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors/AppError';
import { prisma } from '../../core/prisma';
import { validateImageFile } from '../../core/upload/imageValidation';
import { getOwnedReturn } from './returns.service';
import { readPrivateEvidence, savePrivateEvidence } from './private-evidence.storage';

export async function uploadDispatchEvidence(
  orderPublicId: string, productPublicId: string, sellerId: bigint,
  files: Array<{ buffer: Buffer; size: number }>,
): Promise<Array<{ id: string; url: string }>> {
  const order = await prisma.order.findUnique({
    where: { publicId: orderPublicId },
    include: { items: { include: { product: { select: { publicId: true } }, dispatchEvidence: true } } },
  });
  if (!order) throw new NotFoundError('Order not found', undefined, 'ORDER_NOT_FOUND');
  if (order.sellerId !== sellerId) throw new ForbiddenError('Order does not belong to this seller', undefined, 'ORDER_NOT_OWNED');
  if (!['PAYMENT_CONFIRMED', 'PROCESSING'].includes(order.status)) {
    throw new BusinessRuleError('Dispatch evidence must be captured before pickup', undefined, 'DISPATCH_EVIDENCE_CLOSED');
  }
  const item = order.items.find((candidate) => candidate.product.publicId === productPublicId);
  if (!item) throw new ValidationError('Product is not in this order', undefined, 'RETURN_ITEM_INVALID');
  if (!files.length || item.dispatchEvidence.length + files.length > 3) {
    throw new ValidationError('Submit one to three dispatch images for this item', undefined, 'DISPATCH_EVIDENCE_LIMIT');
  }
  for (const file of files) {
    const mime = validateImageFile(file, 'RETURN_IMAGE_TOO_LARGE', 'RETURN_IMAGE_INVALID_FILE');
    const key = `dispatch/${item.orderItemId}/${randomUUID()}.${mime.split('/')[1]}`;
    await savePrivateEvidence(key, file.buffer, mime);
    await prisma.dispatchEvidence.create({ data: { orderItemId: item.orderItemId, storageKey: key } });
  }
  const records = await prisma.dispatchEvidence.findMany({ where: { orderItemId: item.orderItemId } });
  return records.map((record) => ({ id: record.evidenceId.toString(), url: `/api/v1/seller/orders/${orderPublicId}/items/${productPublicId}/dispatch-evidence/${record.evidenceId}/content` }));
}

export async function readReturnEvidence(
  returnId: bigint, evidenceId: bigint, source: 'return' | 'dispatch',
  requester: { userId: bigint; role: UserRole },
): Promise<{ buffer: Buffer; contentType: string }> {
  const ret = await getOwnedReturn(returnId, requester);
  if (source !== 'return') throw new NotFoundError('Evidence not found', undefined, 'RETURN_IMAGE_NOT_FOUND');
  const key = ret.images.find((image) => image.returnImageId === evidenceId)?.storageKey;
  if (!key) throw new NotFoundError('Evidence not found', undefined, 'RETURN_IMAGE_NOT_FOUND');
  return readPrivateEvidence(key);
}

export async function readSellerDispatchEvidence(
  orderPublicId: string, productPublicId: string, evidenceId: bigint, sellerId: bigint,
): Promise<{ buffer: Buffer; contentType: string }> {
  const order = await prisma.order.findUnique({ where: { publicId: orderPublicId }, select: { sellerId: true, items: {
    include: { product: { select: { publicId: true } }, dispatchEvidence: true },
  } } });
  if (!order) throw new NotFoundError('Order not found', undefined, 'ORDER_NOT_FOUND');
  if (order.sellerId !== sellerId) throw new ForbiddenError('Order does not belong to this seller', undefined, 'ORDER_NOT_OWNED');
  const key = order.items.find((item) => item.product.publicId === productPublicId)
    ?.dispatchEvidence.find((image) => image.evidenceId === evidenceId)?.storageKey;
  if (!key) throw new NotFoundError('Evidence not found', undefined, 'RETURN_IMAGE_NOT_FOUND');
  return readPrivateEvidence(key);
}

export async function listSellerDispatchEvidence(orderPublicId: string, productPublicId: string, sellerId: bigint) {
  const order = await prisma.order.findUnique({ where: { publicId: orderPublicId }, select: { sellerId: true, items: {
    include: { product: { select: { publicId: true } }, dispatchEvidence: true },
  } } });
  if (!order) throw new NotFoundError('Order not found', undefined, 'ORDER_NOT_FOUND');
  if (order.sellerId !== sellerId) throw new ForbiddenError('Order does not belong to this seller', undefined, 'ORDER_NOT_OWNED');
  const item = order.items.find((candidate) => candidate.product.publicId === productPublicId);
  if (!item) throw new NotFoundError('Order item not found', undefined, 'RETURN_ITEM_INVALID');
  return item.dispatchEvidence.map((image) => ({ id: image.evidenceId.toString(),
    url: `/api/v1/seller/orders/${orderPublicId}/items/${productPublicId}/dispatch-evidence/${image.evidenceId}/content` }));
}
