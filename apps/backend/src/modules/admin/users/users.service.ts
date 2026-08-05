import type {
  AdminSuspendBanResultDTO,
  AdminUserDetailDTO,
  AdminUserListDTO,
  AdminUserListItemDTO,
  AdminUserSearchQueryInput,
} from '@karobarai/shared';
import type { AuditAction, UserStatus } from '@prisma/client';

import { blindIndex, decryptField, normalizeEmail, normalizePhone } from '../../../core/crypto/fieldCipher';
import { NotFoundError } from '../../../core/errors/AppError';
import { revokeAllRefreshTokensForUser } from '../../auth/auth.tokens';
import { runAuditedMutation } from '../admin.mutation';
import * as repo from './users.repository';
import type { UserDetailRow, UserListRow } from './users.repository';

const DEFAULT_LIMIT = 20;

function toListItemDTO(row: UserListRow): AdminUserListItemDTO {
  return {
    id: row.publicId,
    role: row.role,
    status: row.status,
    email: row.email ? decryptField(row.email) : null,
    phone: row.phone ? decryptField(row.phone) : null,
    storeName: row.sellerProfile?.storeName ?? null,
    fraudRate30d: row.sellerProfile ? row.sellerProfile.fraudRate30d.toNumber() : null,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
  };
}

export async function searchUsers(input: AdminUserSearchQueryInput): Promise<AdminUserListDTO> {
  const limit = input.limit ?? DEFAULT_LIMIT;
  // Task 3.1 — the search term is tried against BOTH blind indexes (mirrors auth.service.ts's
  // own identifier classification, but here it's a lookup convenience, not an isEmail branch —
  // an admin searching "0300..." shouldn't have to specify which field they mean).
  const phoneBidx = input.search ? blindIndex(normalizePhone(input.search)) : undefined;
  const emailBidx = input.search ? blindIndex(normalizeEmail(input.search)) : undefined;

  const { users, hasMore } = await repo.searchUsers({ role: input.role, status: input.status, phoneBidx, emailBidx }, input.cursor, limit);
  const items = users.map(toListItemDTO);
  const last = users[users.length - 1];
  return { items, nextCursor: hasMore && last ? last.userId.toString() : null };
}

function toDetailDTO(row: UserDetailRow): AdminUserDetailDTO {
  return {
    ...toListItemDTO(row),
    onboardingCompletedAt: row.sellerProfile?.onboardingCompletedAt?.toISOString() ?? null,
    commissionRate: row.sellerProfile ? row.sellerProfile.commissionRate.toFixed(4) : null,
    addressCount: row.buyerProfile ? row.buyerProfile._count.addresses : null,
  };
}

export async function getUserDetail(publicId: string): Promise<AdminUserDetailDTO> {
  const row = await repo.findUserDetailByPublicId(publicId);
  if (!row) throw new NotFoundError('User not found', undefined, 'USER_NOT_FOUND');
  return toDetailDTO(row);
}

// Task 3.3–3.5 — suspend/ban/reactivate share this one status-change + audit + (for
// suspend/ban) session-revocation pattern, rather than three near-duplicate implementations.
async function changeUserStatus(
  actorId: bigint,
  target: { userId: bigint; publicId: string; status: UserStatus },
  newStatus: UserStatus,
  action: AuditAction,
  reason: string | undefined,
  revokeSessions: boolean,
): Promise<AdminSuspendBanResultDTO> {
  await runAuditedMutation({
    actorId,
    action,
    entity: 'users',
    entityId: target.userId,
    reason,
    before: { status: target.status },
    after: { status: newStatus },
    mutate: (tx) => repo.updateUserStatus(tx, target.userId, newStatus),
  });

  // Task 3.4 — reuses Feature 1's existing mass-revocation mechanism (Redis denylist:user:<jti> +
  // refresh_tokens.revoked_at) verbatim, not reimplemented; not called for reactivation (nothing
  // to revoke — the account had no valid sessions while suspended/banned).
  if (revokeSessions) {
    await revokeAllRefreshTokensForUser(target.userId, target.publicId);
  }

  return { id: target.publicId, status: newStatus };
}

async function resolveTarget(targetPublicId: string) {
  const target = await repo.findUserByPublicId(targetPublicId);
  if (!target) throw new NotFoundError('User not found', undefined, 'USER_NOT_FOUND');
  return target;
}

export async function suspendUser(actorId: bigint, targetPublicId: string, reason: string): Promise<AdminSuspendBanResultDTO> {
  const target = await resolveTarget(targetPublicId);
  return changeUserStatus(actorId, target, 'SUSPENDED', 'SUSPEND', reason, true);
}

export async function banUser(actorId: bigint, targetPublicId: string, reason: string): Promise<AdminSuspendBanResultDTO> {
  const target = await resolveTarget(targetPublicId);
  const result = await changeUserStatus(actorId, target, 'BANNED', 'BAN', reason, true);

  // Task 3.6/Assumption #2 — non-blocking warning (openOrdersCount), not a blocking
  // reconciliation workflow: no source document defines what that workflow would consist of.
  if (target.role === 'SELLER') {
    const openOrdersCount = await repo.countOpenOrdersForSeller(target.userId);
    if (openOrdersCount > 0) return { ...result, openOrdersCount };
  }
  return result;
}

export async function reactivateUser(actorId: bigint, targetPublicId: string, reason?: string): Promise<AdminSuspendBanResultDTO> {
  const target = await resolveTarget(targetPublicId);
  return changeUserStatus(actorId, target, 'ACTIVE', 'UPDATE', reason, false);
}
