import { Prisma } from '@prisma/client';

import { prisma } from '../../core/prisma';

// Older development databases may not have the optional F21 display-name column yet.
// Keep chat and profile reads available while that migration is pending.
let missingColumnUntil = 0;

export function isMissingBuyerDisplayNameColumn(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022'
    && String(error.meta?.column).includes('display_name');
}

export async function buyerDisplayNames(userIds: bigint[]): Promise<Map<bigint, string>> {
  if (userIds.length === 0 || Date.now() < missingColumnUntil) return new Map();
  try {
    const rows = await prisma.buyerProfile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, displayName: true },
    });
    return new Map(rows.flatMap((row) => row.displayName?.trim() ? [[row.userId, row.displayName.trim()]] : []));
  } catch (error) {
    if (isMissingBuyerDisplayNameColumn(error)) {
      missingColumnUntil = Date.now() + 30_000;
      return new Map();
    }
    throw error;
  }
}

export async function buyerDisplayName(userId: bigint): Promise<string | null> {
  return (await buyerDisplayNames([userId])).get(userId) ?? null;
}
