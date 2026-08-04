import { Router } from 'express';

import { authenticate } from '../../../core/middleware/authenticate';
import { authorize } from '../../../core/middleware/authorize';
import { validateBody, validateQuery } from '../../../core/middleware/validate';
import { adminDecisionSchema, listReturnsQuerySchema } from '../returns.dto';
import { adminDecisionHandler, getAdminReturnDetailHandler, listAdminReturnsHandler } from './admin.controller';

// Task 5.1 — Support gets read access; only Admin gets write (the decision endpoint). This is
// the first feature in this codebase to actually gate a route by ADMIN/SUPPORT via authorize()
// — every prior Admin/Support access (Feature 7's Order Detail) checked role inside the service
// instead, since those routes were also reachable by Buyer/Seller. These admin/* routes are
// admin-only surfaces from the start, so the RBAC gate belongs at the router level.
export const adminReturnsRouter = Router();
adminReturnsRouter.use(authenticate, authorize('ADMIN', 'SUPPORT'));

/**
 * @swagger
 * /api/v1/admin/returns:
 *   get:
 *     summary: Full return queue (MANUAL_REVIEW + UNDER_DISPUTE) or full history (?history=true)
 *     tags: [Returns]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: history
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: ReturnListDTO — Admin and Support both get read access
 */
adminReturnsRouter.get('/', validateQuery(listReturnsQuerySchema), listAdminReturnsHandler);

/**
 * @swagger
 * /api/v1/admin/returns/{id}:
 *   get:
 *     summary: Full case detail incl. images, dispute (if any), and the audit trail
 *     tags: [Returns]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: ReturnDetailDTO with auditTrail populated
 */
adminReturnsRouter.get('/:id', getAdminReturnDetailHandler);

/**
 * @swagger
 * /api/v1/admin/returns/{id}/decision:
 *   post:
 *     summary: Final approve/reject — reason always mandatory (REQ-F-Admin-003). Admin-only, not Support.
 *     tags: [Returns]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               decision: { type: string, enum: [APPROVED, REJECTED] }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Updated ReturnDetailDTO
 *       400:
 *         description: Missing reason (VALIDATION_ERROR)
 *       403:
 *         description: Support role attempted a write (FORBIDDEN)
 */
adminReturnsRouter.post('/:id/decision', authorize('ADMIN'), validateBody(adminDecisionSchema), adminDecisionHandler);
