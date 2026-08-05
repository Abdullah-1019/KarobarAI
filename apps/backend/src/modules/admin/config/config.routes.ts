import { Router } from 'express';
import { adminConfigPatchSchema } from '@karobarai/shared';

import { authenticate } from '../../../core/middleware/authenticate';
import { authorize } from '../../../core/middleware/authorize';
import { validateBody } from '../../../core/middleware/validate';
import { requireAdminWrite } from '../admin.middleware';
import { getAllConfigHandler, patchConfigHandler } from './config.controller';

// Task 6 — Support reads (GET), Admin-only writes (PATCH).
export const adminConfigRouter = Router();
adminConfigRouter.use(authenticate, authorize('ADMIN', 'SUPPORT'));

/**
 * @swagger
 * /api/v1/admin/config:
 *   get:
 *     summary: Current values for all platform_config keys (returns_confidence_threshold is read-only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: AdminConfigListDTO
 */
adminConfigRouter.get('/', getAllConfigHandler);

/**
 * @swagger
 * /api/v1/admin/config/{key}:
 *   patch:
 *     summary: Update a single config value — reason mandatory, audited, validated per key
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: AdminConfigEntryDTO
 *       422:
 *         description: INVALID_CONFIG_VALUE
 *       403:
 *         description: CONFIG_KEY_NOT_WRITABLE (returns_confidence_threshold) or ADMIN_WRITE_REQUIRED (Support)
 */
adminConfigRouter.patch('/:key', requireAdminWrite, validateBody(adminConfigPatchSchema), patchConfigHandler);
