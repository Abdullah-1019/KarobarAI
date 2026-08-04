import { Prisma } from '@prisma/client';
import type { AuditAction } from '@prisma/client';

import { prisma } from '../prisma';

// Feature 10's own gap: the module doc assumes an existing "audit_logs write pattern... reused
// from Feature 1/Admin foundation, not rebuilt here" — no such pattern exists anywhere in this
// codebase (the AuditLog model has been in the schema since the Database feature, but nothing has
// ever written to it). This is the first writer, built minimally and generically enough that any
// future privileged-action feature (Admin suspend/ban, config changes, ...) can reuse it as-is.
export interface AuditLogInput {
  actorId: bigint | null;
  action: AuditAction;
  entity: string;
  entityId: bigint | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}

// Accepts an optional transaction client so a caller (e.g. Feature 10's admin decision service)
// can write the audit row in the exact same transaction as the business-state mutation it's
// logging — Doc 5 §10's "if the audit write fails, the whole transaction rolls back" requirement.
export async function createAuditLog(input: AuditLogInput, tx?: Prisma.TransactionClient): Promise<void> {
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      reason: input.reason ?? null,
      before: input.before === undefined ? Prisma.JsonNull : (input.before as Prisma.InputJsonValue),
      after: input.after === undefined ? Prisma.JsonNull : (input.after as Prisma.InputJsonValue),
    },
  });
}
