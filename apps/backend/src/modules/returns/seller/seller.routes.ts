import { Router } from 'express';

import { authenticate } from '../../../core/middleware/authenticate';
import { authorize } from '../../../core/middleware/authorize';
import { validateBody, validateQuery } from '../../../core/middleware/validate';
import { listReturnsQuerySchema, sellerDecisionSchema } from '../returns.dto';
import {
  getSellerReturnDetailHandler,
  listSellerReturnsHandler,
  sellerDecisionHandler,
  sellerEscalateHandler,
} from './seller.controller';

export const sellerReturnsRouter = Router();
sellerReturnsRouter.use(authenticate, authorize('SELLER'));

/**
 * @swagger
 * /api/v1/seller/returns:
 *   get:
 *     summary: The seller's own return queue (MANUAL_REVIEW) or full history (?history=true)
 *     tags: [Returns]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: history
 *         schema: { type: string, enum: ['true', 'false'] }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "ReturnListDTO"
 */
sellerReturnsRouter.get('/', validateQuery(listReturnsQuerySchema), listSellerReturnsHandler);

/**
 * @swagger
 * /api/v1/seller/returns/{id}:
 *   get:
 *     summary: Return case detail for the seller's own order
 *     tags: [Returns]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: ReturnDetailDTO
 *       403:
 *         description: Return belongs to another seller's order (RETURN_NOT_OWNED)
 */
sellerReturnsRouter.get('/:id', getSellerReturnDetailHandler);

/**
 * @swagger
 * /api/v1/seller/returns/{id}/decision:
 *   post:
 *     summary: Approve or reject a return in MANUAL_REVIEW (reason mandatory on reject)
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
 *       422:
 *         description: Not in MANUAL_REVIEW (RETURN_INVALID_STATE)
 */
sellerReturnsRouter.post('/:id/decision', validateBody(sellerDecisionSchema), sellerDecisionHandler);

/**
 * @swagger
 * /api/v1/seller/returns/{id}/escalate:
 *   post:
 *     summary: Flag a MANUAL_REVIEW case for Admin attention (audit trail only, no status change)
 *     tags: [Returns]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "{ escalated: true }"
 */
sellerReturnsRouter.post('/:id/escalate', sellerEscalateHandler);
