import { Router } from 'express';
import { adminReactivateSchema, adminSuspendBanSchema, adminUserSearchQuerySchema } from '@karobarai/shared';

import { authenticate } from '../../../core/middleware/authenticate';
import { authorize } from '../../../core/middleware/authorize';
import { validateBody, validateQuery } from '../../../core/middleware/validate';
import { requireAdminWrite } from '../admin.middleware';
import { banUserHandler, getUserDetailHandler, reactivateUserHandler, searchUsersHandler, suspendUserHandler } from './users.controller';

// Task 3 — Support reads (search/detail), Admin-only writes (suspend/ban/reactivate).
export const adminUsersRouter = Router();
adminUsersRouter.use(authenticate, authorize('ADMIN', 'SUPPORT'));

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Searchable, paginated user list (role/status/blind-index phone-or-email search)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: AdminUserListDTO
 */
adminUsersRouter.get('/', validateQuery(adminUserSearchQuerySchema), searchUsersHandler);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Full account detail (role-specific extension data)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: AdminUserDetailDTO
 */
adminUsersRouter.get('/:id', getUserDetailHandler);

/**
 * @swagger
 * /api/v1/admin/users/{id}/suspend:
 *   post:
 *     summary: Suspend an account — reason mandatory, audited, revokes all active sessions
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: AdminSuspendBanResultDTO
 *       403:
 *         description: Support attempted a write (ADMIN_WRITE_REQUIRED)
 */
adminUsersRouter.post('/:id/suspend', requireAdminWrite, validateBody(adminSuspendBanSchema), suspendUserHandler);

/**
 * @swagger
 * /api/v1/admin/users/{id}/ban:
 *   post:
 *     summary: Ban an account — reason mandatory, audited, revokes all active sessions
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "AdminSuspendBanResultDTO, includes openOrdersCount when banning a seller with open orders"
 */
adminUsersRouter.post('/:id/ban', requireAdminWrite, validateBody(adminSuspendBanSchema), banUserHandler);

/**
 * @swagger
 * /api/v1/admin/users/{id}/reactivate:
 *   post:
 *     summary: Reactivate a suspended/banned account — reason optional (Assumption #3)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: AdminSuspendBanResultDTO
 */
adminUsersRouter.post('/:id/reactivate', requireAdminWrite, validateBody(adminReactivateSchema), reactivateUserHandler);
