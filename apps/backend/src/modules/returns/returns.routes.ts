import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '../../core/middleware/authenticate';
import { authorize } from '../../core/middleware/authorize';
import { validateBody, validateQuery } from '../../core/middleware/validate';
import { arrayImageUpload } from '../../core/upload/imageValidation';
import { asyncHandler } from '../../core/http/asyncHandler';
import { resolveUserId } from '../../core/http/resolveUserId';
import { readReturnEvidence } from './return-evidence.service';
import { parseReturnId } from './returns.service';
import { confirmReplacementReceiptHandler, respondRefundHandler, submitExchangeFeedbackHandler } from './return-fulfillment.controller';
import { createReturnSchema, listReturnsQuerySchema } from './returns.dto';
import {
  appealReturnHandler,
  createReturnHandler,
  deleteReturnImageHandler,
  getReturnDetailHandler,
  listBuyerReturnsHandler,
  submitReturnHandler,
  uploadReturnImagesHandler,
} from './returns.controller';

// Task 1.4 — always authenticated (no guest access); GET /:id is reachable by any authenticated
// role (tri-mode ownership checked inside the service, mirroring Feature 7's Order Detail
// pattern) — every other route here is Buyer-only.
export const returnsRouter = Router();
returnsRouter.use(authenticate);

/**
 * @swagger
 * /api/v1/returns:
 *   post:
 *     summary: Initiate a return on an eligible delivered order (Buyer-only)
 *     tags: [Returns]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId: { type: string }
 *               reason: { type: string }
 *     responses:
 *       201:
 *         description: ReturnDetailDTO (status INITIATED)
 *       403:
 *         description: Order belongs to another buyer (RETURN_NOT_OWNED)
 *       409:
 *         description: A return already exists for this order (RETURN_ALREADY_EXISTS)
 *       422:
 *         description: Order not delivered / outside the return window (RETURN_WINDOW_CLOSED)
 *   get:
 *     summary: The buyer's own return history, all statuses
 *     tags: [Returns]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: ReturnListDTO
 */
returnsRouter.post('/', authorize('BUYER'), validateBody(createReturnSchema), createReturnHandler);
returnsRouter.get('/', authorize('BUYER'), validateQuery(listReturnsQuerySchema), listBuyerReturnsHandler);

/**
 * @swagger
 * /api/v1/returns/{id}:
 *   get:
 *     summary: Return case detail — tri-mode ownership (Buyer, Seller, or Admin/Support)
 *     tags: [Returns]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: ReturnDetailDTO
 *       403:
 *         description: Requester does not own this return (RETURN_NOT_OWNED)
 */
returnsRouter.get('/:id', getReturnDetailHandler);
returnsRouter.get('/:id/images/:imageId/content', asyncHandler(async (req, res) => {
  const result = await readReturnEvidence(parseReturnId(req.params.id ?? ''), parseReturnId(req.params.imageId ?? ''), 'return', {
    userId: await resolveUserId(req.user!.sub), role: req.user!.role,
  });
  res.setHeader('Cache-Control', 'private, no-store');
  res.type(result.contentType).send(result.buffer);
}));

/**
 * @swagger
 * /api/v1/returns/{id}/images:
 *   post:
 *     summary: Attach photos to a return while it is still INITIATED (Buyer-only)
 *     tags: [Returns]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Updated ReturnDetailDTO
 *       422:
 *         description: Return is no longer INITIATED (RETURN_INVALID_STATE)
 */
returnsRouter.post('/:id/images', authorize('BUYER'), arrayImageUpload('images', 10, 'RETURN_IMAGE_TOO_LARGE'), uploadReturnImagesHandler);

/**
 * @swagger
 * /api/v1/returns/{id}/images/{imageId}:
 *   delete:
 *     summary: Remove a photo before submission (Buyer-only, INITIATED only)
 *     tags: [Returns]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated ReturnDetailDTO
 *       404:
 *         description: Image not found on this return (RETURN_IMAGE_NOT_FOUND)
 */
returnsRouter.delete('/:id/images/:imageId', authorize('BUYER'), deleteReturnImageHandler);

/**
 * @swagger
 * /api/v1/returns/{id}/submit:
 *   post:
 *     summary: Submit the return (requires >=3 images) — advances INITIATED -> MANUAL_REVIEW
 *     tags: [Returns]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated ReturnDetailDTO (status MANUAL_REVIEW)
 *       422:
 *         description: Fewer than 3 images (RETURN_IMAGES_INSUFFICIENT)
 */
returnsRouter.post('/:id/submit', authorize('BUYER'), submitReturnHandler);

/**
 * @swagger
 * /api/v1/returns/{id}/appeal:
 *   post:
 *     summary: Appeal a REJECTED return — creates a dispute, advances to UNDER_DISPUTE (Buyer-only)
 *     tags: [Returns]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated ReturnDetailDTO (status UNDER_DISPUTE)
 *       422:
 *         description: Return is not REJECTED (RETURN_INVALID_STATE)
 */
returnsRouter.post('/:id/appeal', authorize('BUYER'),
  validateBody(z.object({ reason: z.string().trim().min(1).max(500) }).strict()), appealReturnHandler);
returnsRouter.post('/:id/refund-proposal/respond', authorize('BUYER'),
  validateBody(z.object({ accept: z.boolean() }).strict()), respondRefundHandler);
returnsRouter.post('/:id/replacement/confirm-receipt', authorize('BUYER'),
  confirmReplacementReceiptHandler);
returnsRouter.post('/:id/exchange-feedback', authorize('BUYER'),
  validateBody(z.object({ rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).optional() }).strict()), submitExchangeFeedbackHandler);
