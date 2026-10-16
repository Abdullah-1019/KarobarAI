import { Router } from 'express';
import { z } from 'zod';

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
import { bookReplacementHandler, bookReturnCourierHandler, confirmReturnReceiptHandler,
  packReplacementHandler, proposeRefundHandler, reserveReplacementHandler } from '../return-fulfillment.controller';

export const sellerReturnsRouter = Router();
sellerReturnsRouter.use(authenticate, authorize('SELLER'));

/**
 * @swagger
 * /api/v1/seller/returns:
 *   get:
 *     summary: The seller's manual-review and AI-accepted queue, or full history (?history=true)
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
 *     summary: Decide a manual-review return or reject an AI acceptance (reason mandatory on reject)
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
sellerReturnsRouter.post('/:id/confirm-receipt',
  validateBody(z.object({ condition: z.enum(['RESELLABLE', 'DAMAGED', 'NEEDS_INSPECTION']) }).strict()),
  confirmReturnReceiptHandler);
sellerReturnsRouter.post('/:id/replacement',
  validateBody(z.object({ productId: z.string().uuid() }).strict()), reserveReplacementHandler);
sellerReturnsRouter.post('/:id/replacement/pack', packReplacementHandler);
sellerReturnsRouter.post('/:id/book-replacement', bookReplacementHandler);
sellerReturnsRouter.post('/:id/book-return-courier', bookReturnCourierHandler);
sellerReturnsRouter.post('/:id/refund-proposal',
  validateBody(z.object({ reason: z.string().trim().min(1).max(500) }).strict()), proposeRefundHandler);
