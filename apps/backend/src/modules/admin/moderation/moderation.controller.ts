import type { AdminModerationActionInput, AdminModerationListQueryInput } from '@karobarai/shared';

import { asyncHandler } from '../../../core/http/asyncHandler';
import { ok } from '../../../core/http/envelope';
import { resolveUserId } from '../../../core/http/resolveUserId';
import * as moderationService from './moderation.service';

export const listFlaggedHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as AdminModerationListQueryInput;
  const result = await moderationService.listFlagged(query);
  res.status(200).json(ok(result));
});

export const getProductDetailHandler = asyncHandler(async (req, res) => {
  const result = await moderationService.getProductDetail(req.params.id as string);
  res.status(200).json(ok(result));
});

export const takedownProductHandler = asyncHandler(async (req, res) => {
  const actorId = await resolveUserId(req.user!.sub);
  const { reason } = req.body as AdminModerationActionInput;
  const result = await moderationService.takedownProduct(actorId, req.params.id as string, reason);
  res.status(200).json(ok(result));
});

export const restoreProductHandler = asyncHandler(async (req, res) => {
  const actorId = await resolveUserId(req.user!.sub);
  const { reason } = req.body as AdminModerationActionInput;
  const result = await moderationService.restoreProduct(actorId, req.params.id as string, reason);
  res.status(200).json(ok(result));
});
