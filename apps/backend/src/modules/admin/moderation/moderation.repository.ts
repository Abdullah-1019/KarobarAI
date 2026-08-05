import type { Prisma, ProductStatus } from '@prisma/client';

import { prisma } from '../../../core/prisma';

// Task 4.1 — "reported/flagged listings queue" per SCR-AD05, but no report-submission mechanism
// exists anywhere in this codebase (no table, no buyer-facing "report this listing" flow —
// Documentation Gap #1, module doc's own Assumption #4). Rather than expose a `reported` query
// param that would silently do nothing, this repository/schema only supports the part that's
// actually real: all products, filterable by status, across every seller.

const MODERATION_LIST_SELECT = {
  productId: true,
  publicId: true,
  titleEn: true,
  status: true,
  createdAt: true,
  seller: { select: { userId: true, storeName: true, user: { select: { publicId: true } } } },
} satisfies Prisma.ProductSelect;

export type ModerationListRow = Prisma.ProductGetPayload<{ select: typeof MODERATION_LIST_SELECT }>;

export async function listFlagged(
  status: ProductStatus | undefined,
  cursor: string | undefined,
  limit: number,
): Promise<{ products: ModerationListRow[]; hasMore: boolean }> {
  const products = await prisma.product.findMany({
    where: { ...(status && { status }), ...(cursor && { productId: { lt: BigInt(cursor) } }) },
    orderBy: { productId: 'desc' },
    take: limit + 1,
    select: MODERATION_LIST_SELECT,
  });
  const hasMore = products.length > limit;
  return { products: hasMore ? products.slice(0, limit) : products, hasMore };
}

const MODERATION_DETAIL_SELECT = {
  ...MODERATION_LIST_SELECT,
  titleUr: true,
  descriptionEn: true,
  price: true,
  stock: true,
} satisfies Prisma.ProductSelect;

export type ModerationDetailRow = Prisma.ProductGetPayload<{ select: typeof MODERATION_DETAIL_SELECT }>;

export async function findProductDetailByPublicId(publicId: string): Promise<ModerationDetailRow | null> {
  return prisma.product.findUnique({ where: { publicId }, select: MODERATION_DETAIL_SELECT });
}

export async function findProductByPublicId(publicId: string) {
  return prisma.product.findUnique({ where: { publicId } });
}

// Task 4.5 — single-column update only, enforced at the method signature: this function accepts
// nothing but a status value, so it is structurally impossible for a caller to smuggle a
// seller-authored field (price, title, ...) into a moderation write.
export async function updateProductStatus(tx: Prisma.TransactionClient, productId: bigint, status: ProductStatus): Promise<void> {
  await tx.product.update({ where: { productId }, data: { status } });
}

// Task 4.4 — restore-from-audit-snapshot: the most recent MODERATION audit row for this product
// carries its pre-takedown status in `before`, so no new tracking column is needed.
export async function findLastTakedownAudit(productId: bigint): Promise<{ status: ProductStatus } | null> {
  const row = await prisma.auditLog.findFirst({
    where: { entity: 'products', entityId: productId, action: 'MODERATION' },
    orderBy: { createdAt: 'desc' },
  });
  if (!row || row.before === null) return null;
  const before = row.before as { status?: ProductStatus };
  return before.status ? { status: before.status } : null;
}
