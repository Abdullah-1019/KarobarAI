import type { ReturnDetailDTO, ReturnListDTO, SellerDecisionInput } from '@karobarai/shared';
import type { ReturnStatus } from '@prisma/client';

import { createAuditLog } from '../../../core/audit';
import { BusinessRuleError } from '../../../core/errors/AppError';
import { decideReturn } from '../decision.service';
import * as repo from '../returns.repository';
import { getOwnedReturn, getReturnDetail, toListItemDTO } from '../returns.service';

// Task 4 — Seller Review. Active queue = MANUAL_REVIEW only; history=true widens to every status
// tied to the seller's own orders (Task 7.2's extension of this same endpoint).
const SELLER_ACTIVE_STATUSES: ReturnStatus[] = ['MANUAL_REVIEW'];

export async function listSellerReturns(
  sellerId: bigint,
  filters: { status?: string; cursor?: string; limit?: number; history?: boolean },
): Promise<ReturnListDTO> {
  const limit = filters.limit ?? 20;
  const { returns, hasMore } = await repo.queryReturns(
    {
      sellerId,
      ...(filters.status
        ? { status: filters.status as ReturnStatus }
        : !filters.history && { status: { in: SELLER_ACTIVE_STATUSES } }),
    },
    filters.cursor,
    limit,
  );
  const last = returns[returns.length - 1];
  return { items: returns.map(toListItemDTO), nextCursor: hasMore && last ? last.returnId.toString() : null };
}

export async function getSellerReturnDetail(sellerId: bigint, returnId: bigint): Promise<ReturnDetailDTO> {
  return getReturnDetail(returnId, { userId: sellerId, role: 'SELLER' });
}

export async function sellerDecision(sellerId: bigint, returnId: bigint, input: SellerDecisionInput): Promise<ReturnDetailDTO> {
  await getOwnedReturn(returnId, { userId: sellerId, role: 'SELLER' }); // ownership + existence check
  await decideReturn(returnId, { userId: sellerId, role: 'SELLER' }, input.decision, input.reason, 'MODERATION');
  return getReturnDetail(returnId, { userId: sellerId, role: 'SELLER' });
}

// Task 4.6 — Engineering Decision: no new return_status value for "escalated" (schema frozen).
// This only writes an audit trail entry; the case remains queryable by Admin in MANUAL_REVIEW
// regardless of whether the seller explicitly escalates or simply never decides.
export async function sellerEscalate(sellerId: bigint, returnId: bigint): Promise<void> {
  const row = await getOwnedReturn(returnId, { userId: sellerId, role: 'SELLER' });
  if (row.status !== 'MANUAL_REVIEW') {
    throw new BusinessRuleError('Only a return awaiting review can be escalated', { status: row.status }, 'RETURN_INVALID_STATE');
  }
  await createAuditLog({
    actorId: sellerId,
    action: 'MODERATION',
    entity: 'returns',
    entityId: returnId,
    reason: 'Escalated to admin by seller',
  });
}
