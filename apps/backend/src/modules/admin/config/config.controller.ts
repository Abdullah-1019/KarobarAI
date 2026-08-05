import type { AdminConfigPatchInput } from '@karobarai/shared';

import { asyncHandler } from '../../../core/http/asyncHandler';
import { ok } from '../../../core/http/envelope';
import { resolveUserId } from '../../../core/http/resolveUserId';
import * as configService from './config.service';

export const getAllConfigHandler = asyncHandler(async (_req, res) => {
  const result = await configService.getAllConfig();
  res.status(200).json(ok(result));
});

export const patchConfigHandler = asyncHandler(async (req, res) => {
  const actorId = await resolveUserId(req.user!.sub);
  const { value, reason } = req.body as AdminConfigPatchInput;
  const result = await configService.updateConfig(actorId, req.params.key as string, value, reason);
  res.status(200).json(ok(result));
});
