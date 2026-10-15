import type { DisputeStatus, Prisma, ReturnStatus } from '@prisma/client';

import { BusinessRuleError } from '../../core/errors/AppError';
import { prisma } from '../../core/prisma';

// Task 1.4 — Prisma-backed methods for returns/return_images/disputes only.

export const RETURN_DETAIL_INCLUDE = {
  order: {
    select: {
      publicId: true,
      orderNumber: true,
      buyerId: true,
      sellerId: true,
      shipCity: true,
      shipProvince: true,
      courier: true,
      paymentMethod: true,
      totalAmount: true,
      deliveredAt: true,
    },
  },
  images: { orderBy: { returnImageId: 'asc' } },
  inspection: true,
  fulfillment: { include: { replacementProduct: { select: { publicId: true, titleEn: true } } } },
  shipments: { include: { events: { orderBy: { eventTime: 'asc' } } } },
  orderItem: { include: { product: { select: { publicId: true,
    images: { orderBy: [{ position: 'asc' }, { imageId: 'asc' }], take: 5,
      select: { imageId: true, cdnUrl: true } },
  } } } },
  dispute: true,
} satisfies Prisma.ReturnInclude;

export type ReturnDetailRow = Prisma.ReturnGetPayload<{ include: typeof RETURN_DETAIL_INCLUDE }>;

export async function findReturnForItem(orderId: bigint, orderItemId: bigint) {
  return prisma.return.findFirst({ where: { orderId,
    OR: [{ orderItemId }, { orderItemId: null }] } });
}

export async function findReturnById(returnId: bigint): Promise<ReturnDetailRow | null> {
  return prisma.return.findUnique({ where: { returnId }, include: RETURN_DETAIL_INCLUDE });
}

export async function createReturn(data: { orderId: bigint; sellerId: bigint; reason: string; orderItemId?: bigint }) {
  return prisma.return.create({ data: { orderId: data.orderId, sellerId: data.sellerId, reason: data.reason, orderItemId: data.orderItemId } });
}

export async function findReturnImages(returnId: bigint) {
  return prisma.returnImage.findMany({ where: { returnId }, orderBy: { createdAt: 'asc' } });
}

export async function createReturnImage(returnId: bigint, cdnUrl: string, storageKey?: string) {
  return prisma.returnImage.create({ data: { returnId, cdnUrl, storageKey } });
}

export async function findReturnImageById(returnImageId: bigint) {
  return prisma.returnImage.findUnique({ where: { returnImageId } });
}

export async function deleteReturnImage(returnImageId: bigint): Promise<void> {
  await prisma.returnImage.delete({ where: { returnImageId } });
}

export async function createDispute(returnId: bigint, buyerReason: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  return client.dispute.create({ data: { returnId, buyerReason } });
}

export async function findDisputeByReturnId(returnId: bigint) {
  return prisma.dispute.findUnique({ where: { returnId } });
}

export async function resolveDispute(
  tx: Prisma.TransactionClient,
  returnId: bigint,
  status: DisputeStatus,
  adminReason: string,
  resolvedBy: bigint,
): Promise<void> {
  await tx.dispute.update({
    where: { returnId },
    data: { status, adminReason, resolvedBy, resolvedAt: new Date() },
  });
}

// Task 2/4/5/7 — one shared query builder (mirrors order.service.ts's queryOrders pattern),
// reused by the buyer/seller/admin list AND history endpoints — the only difference between an
// "active queue" and "history" call is which statuses the caller passes in `where`.
export async function queryReturns(
  where: Prisma.ReturnWhereInput,
  cursor: string | undefined,
  limit: number,
) {
  const returns = await prisma.return.findMany({
    where: {
      ...where,
      ...(cursor && { returnId: { lt: BigInt(cursor) } }),
    },
    orderBy: { returnId: 'desc' },
    take: limit + 1,
    include: { images: { select: { returnImageId: true } }, order: { select: { publicId: true, orderNumber: true } },
      orderItem: { select: { titleSnapshot: true, product: { select: { images: { orderBy: { position: 'asc' }, take: 1,
        select: { cdnUrl: true } } } } } },
      fulfillment: { select: { status: true } } },
  });
  const hasMore = returns.length > limit;
  return { returns: hasMore ? returns.slice(0, limit) : returns, hasMore };
}

export async function updateReturnStatus(
  tx: Prisma.TransactionClient,
  returnId: bigint,
  status: ReturnStatus,
  extra?: { decision?: 'APPROVED' | 'REJECTED'; decidedAt?: Date; refundedAt?: Date },
  expectedStatus?: ReturnStatus,
): Promise<void> {
  const changed = await tx.return.updateMany({
    where: { returnId, ...(expectedStatus ? { status: expectedStatus } : {}) },
    data: { status, ...extra },
  });
  if (changed.count !== 1) throw new BusinessRuleError('Return status changed; refresh and try again', undefined, 'RETURN_INVALID_STATE');
}
