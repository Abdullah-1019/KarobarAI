import type { ReturnDetailDTO, ReturnListDTO, SellerDecisionInput } from '@karobarai/shared';
import type { ReturnStatus } from '@prisma/client';

import { createAuditLog } from '../../../core/audit';
import { BusinessRuleError } from '../../../core/errors/AppError';
import { decideReturn } from '../decision.service';
import * as repo from '../returns.repository';
import { getOwnedReturn, getReturnDetail, toListItemDTO } from '../returns.service';

// Every unresolved case belongs to its owning seller, including AI review and appeals.

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
        : !filters.history && { OR: [
          { status: 'MANUAL_REVIEW' },
          { status: 'UNDER_DISPUTE' },
          { status: 'APPROVED', fulfillment: { is: { status: 'AWAITING_COURIER' } } },
          { fulfillment: { is: { status: { in: [
            'AWAITING_SELLER_RECEIPT', 'REPLACEMENT_PENDING', 'REFUND_DECLINED',
            'RETURN_IN_TRANSIT', 'REPLACEMENT_PACKED', 'REPLACEMENT_IN_TRANSIT', 'REPLACEMENT_DELIVERED',
          ] } } } },
        ] }),
    },
    filters.cursor,
    limit,
  );
  const last = returns[returns.length - 1];
  return { items: returns.map(toListItemDTO), nextCursor: hasMore && last ? last.returnId.toString() : null };
}

export async function getSellerReturnDetail(sellerId: bigint, returnId: bigint): Promise<ReturnDetailDTO> {
  return getReturnDetail(returnId, { userId: sellerId, role: 'SELLER' }, true);
}

export async function sellerDecision(sellerId: bigint, returnId: bigint, input: SellerDecisionInput): Promise<ReturnDetailDTO> {
  const row = await getOwnedReturn(returnId, { userId: sellerId, role: 'SELLER' });
  if ((row.inspection || row.status === 'UNDER_DISPUTE' || input.decision === 'REJECTED') && !input.reason?.trim()) {
    throw new BusinessRuleError('A reason is required for an AI-inspected return decision', undefined, 'RETURN_DECISION_REASON_REQUIRED');
  }
  await decideReturn(returnId, { userId: sellerId, role: 'SELLER' }, input.decision, input.reason,
    row.status === 'UNDER_DISPUTE' ? 'DISPUTE_RESOLVE' : 'MODERATION');
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
