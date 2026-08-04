import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import { resolveUserId } from '../../core/http/resolveUserId';
import * as analyticsService from './analytics.service';
import type { DateRangeQueryInput } from './analytics.dto';

// Task 1.3 — AnalyticsOwnershipGuard, in practice: every handler resolves the caller's own
// internal userId and passes it as `sellerId` to the service, which threads it into every
// repository query's `where` clause. There is no separate guard class (this codebase has no
// class-based middleware anywhere) — the guarantee comes from every query being sellerId-scoped
// by construction, the same discipline Feature 7/10's ownership checks already follow.

export const getRevenueHandler = asyncHandler(async (req, res) => {
  const sellerId = await resolveUserId(req.user!.sub);
  const query = req.query as unknown as DateRangeQueryInput;
  const result = await analyticsService.getRevenueSummary(sellerId, query);
  res.status(200).json(ok(result));
});

export const getSalesTrendHandler = asyncHandler(async (req, res) => {
  const sellerId = await resolveUserId(req.user!.sub);
  const query = req.query as unknown as DateRangeQueryInput;
  const result = await analyticsService.getSalesTrend(sellerId, query);
  res.status(200).json(ok(result));
});

export const getCategoryBreakdownHandler = asyncHandler(async (req, res) => {
  const sellerId = await resolveUserId(req.user!.sub);
  const query = req.query as unknown as DateRangeQueryInput;
  const result = await analyticsService.getCategoryBreakdown(sellerId, query);
  res.status(200).json(ok(result));
});

export const getOrderAnalyticsHandler = asyncHandler(async (req, res) => {
  const sellerId = await resolveUserId(req.user!.sub);
  const query = req.query as unknown as DateRangeQueryInput;
  const result = await analyticsService.getOrderAnalytics(sellerId, query);
  res.status(200).json(ok(result));
});

export const getCustomerAnalyticsHandler = asyncHandler(async (req, res) => {
  const sellerId = await resolveUserId(req.user!.sub);
  const query = req.query as unknown as DateRangeQueryInput;
  const result = await analyticsService.getCustomerAnalytics(sellerId, query);
  res.status(200).json(ok(result));
});

export const getTopProductsHandler = asyncHandler(async (req, res) => {
  const sellerId = await resolveUserId(req.user!.sub);
  const query = req.query as unknown as DateRangeQueryInput;
  const result = await analyticsService.getTopProducts(sellerId, query);
  res.status(200).json(ok(result));
});
