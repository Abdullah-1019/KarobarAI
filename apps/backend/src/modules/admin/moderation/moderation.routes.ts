import { Router } from 'express';
import { adminModerationActionSchema, adminModerationListQuerySchema } from '@karobarai/shared';

import { authenticate } from '../../../core/middleware/authenticate';
import { authorize } from '../../../core/middleware/authorize';
import { validateBody, validateQuery } from '../../../core/middleware/validate';
import { requireAdminWrite } from '../admin.middleware';
import { getProductDetailHandler, listFlaggedHandler, restoreProductHandler, takedownProductHandler } from './moderation.controller';

// Task 4 — Support reads, Admin-only writes (takedown/restore).
export const adminModerationRouter = Router();
adminModerationRouter.use(authenticate, authorize('ADMIN', 'SUPPORT'));

/**
 * @swagger
 * /api/v1/admin/moderation/products:
 *   get:
 *     summary: Product moderation queue — all products across every seller, filterable by status
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: AdminProductListDTO
 */
adminModerationRouter.get('/', validateQuery(adminModerationListQuerySchema), listFlaggedHandler);

/**
 * @swagger
 * /api/v1/admin/moderation/products/{id}:
 *   get:
 *     summary: Listing detail + seller context (store name)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: AdminProductDetailDTO
 */
adminModerationRouter.get('/:id', getProductDetailHandler);

/**
 * @swagger
 * /api/v1/admin/moderation/products/{id}/takedown:
 *   post:
 *     summary: Remove a listing from the storefront — reason mandatory, audited, status-only
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: AdminModerationResultDTO
 */
adminModerationRouter.post('/:id/takedown', requireAdminWrite, validateBody(adminModerationActionSchema), takedownProductHandler);

/**
 * @swagger
 * /api/v1/admin/moderation/products/{id}/restore:
 *   post:
 *     summary: Restore a previously taken-down listing to its pre-takedown status (not unconditionally LIVE)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: AdminModerationResultDTO
 */
adminModerationRouter.post('/:id/restore', requireAdminWrite, validateBody(adminModerationActionSchema), restoreProductHandler);
