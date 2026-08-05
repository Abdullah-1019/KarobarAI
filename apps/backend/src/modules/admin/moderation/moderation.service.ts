import type {
  AdminModerationResultDTO,
  AdminModerationListQueryInput,
  AdminProductDetailDTO,
  AdminProductListDTO,
  AdminProductListItemDTO,
} from '@karobarai/shared';

import { BusinessRuleError, NotFoundError } from '../../../core/errors/AppError';
import { runAuditedMutation } from '../admin.mutation';
import * as repo from './moderation.repository';
import type { ModerationDetailRow, ModerationListRow } from './moderation.repository';

const DEFAULT_LIMIT = 20;

function toListItemDTO(row: ModerationListRow): AdminProductListItemDTO {
  return {
    id: row.publicId,
    titleEn: row.titleEn,
    status: row.status,
    sellerId: row.seller.user.publicId,
    storeName: row.seller.storeName,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listFlagged(input: AdminModerationListQueryInput): Promise<AdminProductListDTO> {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const { products, hasMore } = await repo.listFlagged(input.status, input.cursor, limit);
  const items = products.map(toListItemDTO);
  const last = products[products.length - 1];
  return { items, nextCursor: hasMore && last ? last.productId.toString() : null };
}

function toDetailDTO(row: ModerationDetailRow): AdminProductDetailDTO {
  return { ...toListItemDTO(row), titleUr: row.titleUr, descriptionEn: row.descriptionEn, price: row.price.toFixed(2), stock: row.stock };
}

export async function getProductDetail(publicId: string): Promise<AdminProductDetailDTO> {
  const row = await repo.findProductDetailByPublicId(publicId);
  if (!row) throw new NotFoundError('Product not found', undefined, 'PRODUCT_NOT_FOUND');
  return toDetailDTO(row);
}

export async function takedownProduct(actorId: bigint, publicId: string, reason: string): Promise<AdminModerationResultDTO> {
  const product = await repo.findProductByPublicId(publicId);
  if (!product) throw new NotFoundError('Product not found', undefined, 'PRODUCT_NOT_FOUND');
  if (product.status === 'REMOVED') {
    throw new BusinessRuleError('Product is already removed', { status: product.status }, 'PRODUCT_INVALID_MODERATION_STATE');
  }

  await runAuditedMutation({
    actorId,
    action: 'MODERATION',
    entity: 'products',
    entityId: product.productId,
    reason,
    before: { status: product.status },
    after: { status: 'REMOVED' },
    mutate: (tx) => repo.updateProductStatus(tx, product.productId, 'REMOVED'),
  });

  return { id: product.publicId, status: 'REMOVED' };
}

export async function restoreProduct(actorId: bigint, publicId: string, reason: string): Promise<AdminModerationResultDTO> {
  const product = await repo.findProductByPublicId(publicId);
  if (!product) throw new NotFoundError('Product not found', undefined, 'PRODUCT_NOT_FOUND');
  if (product.status !== 'REMOVED') {
    throw new BusinessRuleError('Product is not currently removed', { status: product.status }, 'PRODUCT_INVALID_MODERATION_STATE');
  }

  // Task 4.4 — restores to the pre-takedown status sourced from the takedown's own audit
  // snapshot, never unconditionally LIVE. Falls back to LIVE only if no prior takedown audit row
  // can be found (shouldn't happen in practice — REMOVED is only ever reached via takedown).
  const priorState = await repo.findLastTakedownAudit(product.productId);
  const targetStatus = priorState?.status ?? 'LIVE';

  await runAuditedMutation({
    actorId,
    action: 'MODERATION',
    entity: 'products',
    entityId: product.productId,
    reason,
    before: { status: product.status },
    after: { status: targetStatus },
    mutate: (tx) => repo.updateProductStatus(tx, product.productId, targetStatus),
  });

  return { id: product.publicId, status: targetStatus };
}
