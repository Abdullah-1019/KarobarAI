import type { DateRangeQueryInput } from '@karobarai/shared';

import { asyncHandler } from '../../../core/http/asyncHandler';
import { ok } from '../../../core/http/envelope';
import * as dashboardService from './dashboard.service';

export const getKpisHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as DateRangeQueryInput;
  const result = await dashboardService.getKpis(query);
  res.status(200).json(ok(result));
});

export const getAlertFeedHandler = asyncHandler(async (_req, res) => {
  const result = await dashboardService.getAlertFeed();
  res.status(200).json(ok(result));
});
