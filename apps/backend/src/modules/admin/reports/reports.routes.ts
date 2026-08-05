import { Router } from 'express';
import { adminReportsQuerySchema } from '@karobarai/shared';

import { authenticate } from '../../../core/middleware/authenticate';
import { authorize } from '../../../core/middleware/authorize';
import { validateQuery } from '../../../core/middleware/validate';
import { getGmvTrendHandler, getOrderReturnTrendHandler, getSellerPerformanceHandler } from './reports.controller';

// Task 5 — read-only, both Admin and Support. Returns Management itself introduces zero new
// endpoints here (Task 5.5's reuse-only checklist) — Feature 10's existing /api/v1/admin/returns
// router already enforces the same RBAC parity independently.
export const adminReportsRouter = Router();
adminReportsRouter.use(authenticate, authorize('ADMIN', 'SUPPORT'));

/**
 * @swagger
 * /api/v1/admin/reports/gmv-trend:
 *   get:
 *     summary: Platform GMV over time, optionally grouped by seller or category
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [seller, category] }
 *     responses:
 *       200:
 *         description: "AdminGmvTrendDTO — groupBy=category uses a different revenue basis, see basisNote"
 */
adminReportsRouter.get('/gmv-trend', validateQuery(adminReportsQuerySchema), getGmvTrendHandler);

/**
 * @swagger
 * /api/v1/admin/reports/order-return-trend:
 *   get:
 *     summary: Order volume vs. return volume over time (fraud/quality signal)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: OrderReturnTrendDTO
 */
adminReportsRouter.get('/order-return-trend', validateQuery(adminReportsQuerySchema), getOrderReturnTrendHandler);

/**
 * @swagger
 * /api/v1/admin/reports/seller-performance:
 *   get:
 *     summary: Ranked seller list (GMV, return-fraud rate, fulfilment rate) for BR-006 fraud-flag visibility
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: SellerPerformanceDTO
 */
adminReportsRouter.get('/seller-performance', validateQuery(adminReportsQuerySchema), getSellerPerformanceHandler);
