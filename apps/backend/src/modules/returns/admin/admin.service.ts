import type { ReturnDetailDTO, ReturnListDTO } from '@karobarai/shared';
import type { ReturnStatus, UserRole } from '@prisma/client';

import { decideReturn } from '../decision.service';
import * as repo from '../returns.repository';
import { getReturnDetail, toListItemDTO } from '../returns.service';
import type { AdminDecisionInput } from '../returns.dto';

// Task 5 — Admin Review. Active queue = MANUAL_REVIEW + UNDER_DISPUTE (Task 5.1); history=true
// widens to every status, no ownership filter at all (Admin/Support see everything).
const ADMIN_QUEUE_STATUSES: ReturnStatus[] = ['MANUAL_REVIEW', 'UNDER_DISPUTE'];

export async function listAdminReturns(filters: {
  status?: string;
  cursor?: string;
  limit?: number;
  history?: boolean;
}): Promise<ReturnListDTO> {
  const limit = filters.limit ?? 20;
  const { returns, hasMore } = await repo.queryReturns(
    filters.status
      ? { status: filters.status as ReturnStatus }
      : !filters.history
        ? { status: { in: ADMIN_QUEUE_STATUSES } }
        : {},
    filters.cursor,
    limit,
  );
  const last = returns[returns.length - 1];
  return { items: returns.map(toListItemDTO), nextCursor: hasMore && last ? last.returnId.toString() : null };
}

export async function getAdminReturnDetail(returnId: bigint, requester: { userId: bigint; role: UserRole }): Promise<ReturnDetailDTO> {
  // Task 5.2 — joined with the audit trail (prior seller decision, if escalated post-rejection).
  return getReturnDetail(returnId, requester, true);
}

export async function adminDecision(adminId: bigint, returnId: bigint, input: AdminDecisionInput): Promise<ReturnDetailDTO> {
  await decideReturn(returnId, { userId: adminId, role: 'ADMIN' }, input.decision, input.reason, 'DISPUTE_RESOLVE');
  return getReturnDetail(returnId, { userId: adminId, role: 'ADMIN' }, true);
}
