import type { AuditAction, Prisma } from '@prisma/client';

import { createAuditLog } from '../../core/audit';
import { prisma } from '../../core/prisma';

// Task 1.4 — AuditedMutation helper, generalized from Feature 10 Task 5.6's existing
// mutation+audit-write transaction pattern (decision.service.ts's decideReturn), not reinvented.
// Every privileged write in this feature (suspend/ban/reactivate, takedown/restore, config
// change) goes through this single helper — Doc 5 §10's "insert an audit_logs row in the same
// transaction... or the transaction rolls back" rule enforced in exactly one place.
export interface AuditedMutationInput<T> {
  actorId: bigint;
  action: AuditAction;
  entity: string;
  entityId: bigint | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  mutate: (tx: Prisma.TransactionClient) => Promise<T>;
}

export async function runAuditedMutation<T>(input: AuditedMutationInput<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const result = await input.mutate(tx);
    await createAuditLog(
      {
        actorId: input.actorId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        reason: input.reason,
        before: input.before,
        after: input.after,
      },
      tx,
    );
    return result;
  });
}
