import type { Prisma } from '@prisma/client';

import { prisma } from '../../../core/prisma';

// Task 6.1 — reads/writes the existing platform_config table (Doc 5 §4.25) directly; no new
// table, per this task's own Engineering Decision (the table's JSONB value column is already
// designed as generic admin-tunable key/value storage).
export async function getAll() {
  return prisma.platformConfig.findMany({ orderBy: { configKey: 'asc' } });
}

export async function getByKey(key: string) {
  return prisma.platformConfig.findUnique({ where: { configKey: key } });
}

export async function updateValue(tx: Prisma.TransactionClient, key: string, value: Prisma.InputJsonValue, updatedBy: bigint): Promise<void> {
  await tx.platformConfig.update({ where: { configKey: key }, data: { value, updatedBy } });
}
