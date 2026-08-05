import type { AdminReportsQueryInput } from '@karobarai/shared';

import { asyncHandler } from '../../../core/http/asyncHandler';
import { ok } from '../../../core/http/envelope';
import * as reportsService from './reports.service';

export const getGmvTrendHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as AdminReportsQueryInput;
  const result = await reportsService.gmvTrend(query);
  res.status(200).json(ok(result));
});

export const getOrderReturnTrendHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as AdminReportsQueryInput;
  const result = await reportsService.orderReturnTrend(query);
  res.status(200).json(ok(result));
});

export const getSellerPerformanceHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as AdminReportsQueryInput;
  const result = await reportsService.sellerPerformance(query);
  res.status(200).json(ok(result));
});
