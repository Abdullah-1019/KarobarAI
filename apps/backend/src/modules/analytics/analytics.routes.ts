import { Router } from 'express';

import { authenticate } from '../../core/middleware/authenticate';
import { authorize } from '../../core/middleware/authorize';
import { validateQuery } from '../../core/middleware/validate';
import { dateRangeQuerySchema } from './analytics.dto';
import {
  getCategoryBreakdownHandler,
  getCustomerAnalyticsHandler,
  getOrderAnalyticsHandler,
  getRevenueHandler,
  getSalesTrendHandler,
  getTopProductsHandler,
} from './analytics.controller';

// Task 1.1/2.3 — Seller-only (Doc 5 §9's ownership rule); Admin's platform-wide KPIs live at the
// existing, separate SCR-AD01 and are not duplicated here.
export const analyticsRouter = Router();
analyticsRouter.use(authenticate, authorize('SELLER'));

/**
 * @swagger
 * /api/v1/seller/analytics/revenue:
 *   get:
 *     summary: Current/previous month + YTD revenue, sourced from settled settlements only
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: range
 *         schema: { type: string, enum: [7d, 30d, 3m, custom] }
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: "RevenueSummaryDTO — will read 0.00 until settlement rows exist (see handoff doc)"
 */
analyticsRouter.get('/revenue', validateQuery(dateRangeQuerySchema), getRevenueHandler);

/**
 * @swagger
 * /api/v1/seller/analytics/sales-trend:
 *   get:
 *     summary: Zero-filled daily revenue/order-count trend over the selected range
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: SalesTrendDTO
 */
analyticsRouter.get('/sales-trend', validateQuery(dateRangeQuerySchema), getSalesTrendHandler);

/**
 * @swagger
 * /api/v1/seller/analytics/category-breakdown:
 *   get:
 *     summary: Revenue by category (uncategorized products bucketed separately, not dropped)
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: CategoryBreakdownDTO
 */
analyticsRouter.get('/category-breakdown', validateQuery(dateRangeQuerySchema), getCategoryBreakdownHandler);

/**
 * @swagger
 * /api/v1/seller/analytics/orders:
 *   get:
 *     summary: Order volume + status-distribution + average order value (placed_at-anchored, all statuses)
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: OrderAnalyticsDTO
 */
analyticsRouter.get('/orders', validateQuery(dateRangeQuerySchema), getOrderAnalyticsHandler);

/**
 * @swagger
 * /api/v1/seller/analytics/customers:
 *   get:
 *     summary: Unique/new/repeat buyer counts (aggregate only, zero PII) — new/repeat classified against lifetime history
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: CustomerAnalyticsDTO
 */
analyticsRouter.get('/customers', validateQuery(dateRangeQuerySchema), getCustomerAnalyticsHandler);

/**
 * @swagger
 * /api/v1/seller/analytics/top-products:
 *   get:
 *     summary: Top products ranked by realized revenue (soft-deleted products excluded)
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: TopProductsDTO
 */
analyticsRouter.get('/top-products', validateQuery(dateRangeQuerySchema), getTopProductsHandler);
