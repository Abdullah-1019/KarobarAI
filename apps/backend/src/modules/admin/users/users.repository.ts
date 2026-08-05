import type { Prisma, UserRole, UserStatus } from '@prisma/client';

import { prisma } from '../../../core/prisma';

// Task 1.5/3.1 — "AdminScopeRepository" in practice: plain functions querying users without any
// seller/buyer ownership filter (Admin/Support bypass, Doc 5 §9), same shape as every other
// repository in this codebase (no class hierarchy — see Feature 11's identical repository
// comment on the module doc's OOP-flavored "base class" wording).

export interface UserSearchFilters {
  role?: UserRole;
  status?: UserStatus;
  phoneBidx?: string;
  emailBidx?: string;
}

const USER_LIST_SELECT = {
  userId: true,
  publicId: true,
  role: true,
  status: true,
  email: true,
  phone: true,
  createdAt: true,
  lastLoginAt: true,
  sellerProfile: { select: { storeName: true, fraudRate30d: true } },
} satisfies Prisma.UserSelect;

export type UserListRow = Prisma.UserGetPayload<{ select: typeof USER_LIST_SELECT }>;

export async function searchUsers(
  filters: UserSearchFilters,
  cursor: string | undefined,
  limit: number,
): Promise<{ users: UserListRow[]; hasMore: boolean }> {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(filters.role && { role: filters.role }),
    ...(filters.status && { status: filters.status }),
    // Task 3.1 — blind-index EXACT match only (Doc 5 §4.1); never queries the ciphertext columns.
    ...((filters.phoneBidx || filters.emailBidx) && {
      OR: [...(filters.phoneBidx ? [{ phoneBidx: filters.phoneBidx }] : []), ...(filters.emailBidx ? [{ emailBidx: filters.emailBidx }] : [])],
    }),
  };

  const users = await prisma.user.findMany({
    where: { ...where, ...(cursor && { userId: { lt: BigInt(cursor) } }) },
    orderBy: { userId: 'desc' },
    take: limit + 1,
    select: USER_LIST_SELECT,
  });
  const hasMore = users.length > limit;
  return { users: hasMore ? users.slice(0, limit) : users, hasMore };
}

const USER_DETAIL_SELECT = {
  ...USER_LIST_SELECT,
  sellerProfile: {
    select: { storeName: true, fraudRate30d: true, onboardingCompletedAt: true, commissionRate: true },
  },
  buyerProfile: { select: { userId: true, _count: { select: { addresses: true } } } },
} satisfies Prisma.UserSelect;

export type UserDetailRow = Prisma.UserGetPayload<{ select: typeof USER_DETAIL_SELECT }>;

export async function findUserDetailByPublicId(publicId: string): Promise<UserDetailRow | null> {
  return prisma.user.findUnique({ where: { publicId }, select: USER_DETAIL_SELECT });
}

export async function findUserByPublicId(publicId: string) {
  return prisma.user.findUnique({ where: { publicId } });
}

// Task 3.6 — non-terminal order count for the seller-ban-with-open-orders warning (Assumption
// #2: a non-blocking warning, not a blocking reconciliation workflow no source document defines).
const TERMINAL_ORDER_STATUSES = ['COMPLETED', 'CANCELLED'] as const;

export async function countOpenOrdersForSeller(sellerId: bigint): Promise<number> {
  return prisma.order.count({ where: { sellerId, status: { notIn: [...TERMINAL_ORDER_STATUSES] } } });
}

export async function updateUserStatus(tx: Prisma.TransactionClient, userId: bigint, status: UserStatus): Promise<void> {
  await tx.user.update({ where: { userId }, data: { status } });
}
