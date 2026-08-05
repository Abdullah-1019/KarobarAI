import { Router } from 'express';
import { dateRangeQuerySchema } from '@karobarai/shared';

import { authenticate } from '../../../core/middleware/authenticate';
import { authorize } from '../../../core/middleware/authorize';
import { validateQuery } from '../../../core/middleware/validate';
import { getAlertFeedHandler, getKpisHandler } from './dashboard.controller';

// Task 2.5 — read-only, both Admin and Support (no writeGuard needed anywhere on this router).
export const adminDashboardRouter = Router();
adminDashboardRouter.use(authenticate, authorize('ADMIN', 'SUPPORT'));

/**
 * @swagger
 * /api/v1/admin/dashboard/kpis:
 *   get:
 *     summary: Platform-wide GMV, active users, adapter reachability, trend vs. previous period
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: AdminKpiDTO
 */
adminDashboardRouter.get('/kpis', validateQuery(dateRangeQuerySchema), getKpisHandler);

/**
 * @swagger
 * /api/v1/admin/dashboard/alerts:
 *   get:
 *     summary: Live counts — manual-logistics orders, stuck payments, open disputes, fraud-flagged sellers
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: AdminAlertFeedDTO
 */
adminDashboardRouter.get('/alerts', getAlertFeedHandler);
