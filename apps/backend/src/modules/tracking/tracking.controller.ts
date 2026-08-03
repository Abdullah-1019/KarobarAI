import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import { resolveUserId } from '../../core/http/resolveUserId';
import * as trackingService from './tracking.service';
import type { BookCourierInput } from './tracking.dto';

// Task 1.3 — Seller-only for selection/booking (ownership re-checked inside the service via
// Feature 7's getOwnedOrderRow, so a Seller who isn't this order's own Seller still gets 403, not
// just "any Seller"). Authenticated (any role) for tracking reads; the public route has no auth
// middleware at all.

export const getCourierQuotesHandler = asyncHandler(async (req, res) => {
  const sellerId = await resolveUserId(req.user!.sub);
  const quotes = await trackingService.getCourierQuotesForSeller(req.params.id ?? '', sellerId);
  res.status(200).json(ok(quotes));
});

export const refreshCourierRatesHandler = asyncHandler(async (req, res) => {
  const sellerId = await resolveUserId(req.user!.sub);
  const quotes = await trackingService.refreshCourierRates(req.params.id ?? '', sellerId);
  res.status(200).json(ok(quotes));
});

export const bookCourierHandler = asyncHandler(async (req, res) => {
  const sellerId = await resolveUserId(req.user!.sub);
  const input = req.body as BookCourierInput;
  const order = await trackingService.bookCourier(req.params.id ?? '', sellerId, input.courierCode);
  res.status(200).json(ok(order));
});

export const getAuthenticatedTrackingHandler = asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req.user!.sub);
  const tracking = await trackingService.getAuthenticatedTracking(req.params.orderId ?? '', {
    userId,
    role: req.user!.role,
  });
  res.status(200).json(ok(tracking));
});

export const getPublicTrackingHandler = asyncHandler(async (req, res) => {
  const tracking = await trackingService.getPublicTracking(req.params.publicToken ?? '');
  res.status(200).json(ok(tracking));
});
