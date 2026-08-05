import type { AdminReactivateInput, AdminSuspendBanInput, AdminUserSearchQueryInput } from '@karobarai/shared';

import { asyncHandler } from '../../../core/http/asyncHandler';
import { ok } from '../../../core/http/envelope';
import { resolveUserId } from '../../../core/http/resolveUserId';
import * as usersService from './users.service';

export const searchUsersHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as AdminUserSearchQueryInput;
  const result = await usersService.searchUsers(query);
  res.status(200).json(ok(result));
});

export const getUserDetailHandler = asyncHandler(async (req, res) => {
  const result = await usersService.getUserDetail(req.params.id as string);
  res.status(200).json(ok(result));
});

export const suspendUserHandler = asyncHandler(async (req, res) => {
  const actorId = await resolveUserId(req.user!.sub);
  const { reason } = req.body as AdminSuspendBanInput;
  const result = await usersService.suspendUser(actorId, req.params.id as string, reason);
  res.status(200).json(ok(result));
});

export const banUserHandler = asyncHandler(async (req, res) => {
  const actorId = await resolveUserId(req.user!.sub);
  const { reason } = req.body as AdminSuspendBanInput;
  const result = await usersService.banUser(actorId, req.params.id as string, reason);
  res.status(200).json(ok(result));
});

export const reactivateUserHandler = asyncHandler(async (req, res) => {
  const actorId = await resolveUserId(req.user!.sub);
  const { reason } = req.body as AdminReactivateInput;
  const result = await usersService.reactivateUser(actorId, req.params.id as string, reason);
  res.status(200).json(ok(result));
});
