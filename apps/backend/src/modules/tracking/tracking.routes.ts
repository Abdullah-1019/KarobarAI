import { Router } from 'express';

import { authenticate } from '../../core/middleware/authenticate';
import { authorize } from '../../core/middleware/authorize';
import { validateBody } from '../../core/middleware/validate';
import { bookCourierSchema } from './tracking.dto';
import {
  bookCourierHandler,
  getAuthenticatedTrackingHandler,
  getCourierQuotesHandler,
  getPublicTrackingHandler,
  refreshCourierRatesHandler,
} from './tracking.controller';

// Task 1.3 — three separate routers, one per access pattern, each mounted at its own prefix in
// server.ts (Express allows multiple routers sharing a prefix; no path collision since these
// sub-paths are distinct from Feature 7's own order.routes.ts routes at the same '/orders' base).

// Seller-only: courier selection/booking. Ownership beyond "is a Seller" is re-checked inside
// tracking.service.ts via Feature 7's getOwnedOrderRow.
export const courierRouter = Router();
courierRouter.use(authenticate, authorize('SELLER'));

/**
 * @swagger
 * /api/v1/orders/{id}/courier-quotes:
 *   get:
 *     summary: The scored, ranked courier list for a PAYMENT_CONFIRMED order (Seller-only)
 *     tags: [Tracking]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "CourierQuotesDTO: { quotes: CourierQuoteDTO[] }, sorted by score desc"
 *       403:
 *         description: Order belongs to another seller (ORDER_NOT_OWNED)
 *       422:
 *         description: Quotes not scored yet (COURIER_QUOTES_NOT_READY)
 */
courierRouter.get('/:id/courier-quotes', getCourierQuotesHandler);

/**
 * @swagger
 * /api/v1/orders/{id}/refresh-rates:
 *   post:
 *     summary: Re-score couriers and replace the existing courier_quotes rows (Task 3.7)
 *     tags: [Tracking]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated CourierQuotesDTO
 *       422:
 *         description: Order is no longer courier-selection-eligible (ORDER_NOT_COURIER_ELIGIBLE)
 */
courierRouter.post('/:id/refresh-rates', refreshCourierRatesHandler);

/**
 * @swagger
 * /api/v1/orders/{id}/book-courier:
 *   post:
 *     summary: Confirm & Book Courier — retry x3 @30s then fallback to next-best; all-fail -> PENDING_MANUAL_LOGISTICS
 *     tags: [Tracking]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               courierCode: { type: string, enum: [TCS, LEOPARDS, TRAX] }
 *     responses:
 *       200:
 *         description: Updated OrderDetailDTO (status PROCESSING on success, or PENDING_MANUAL_LOGISTICS if every courier failed)
 *       409:
 *         description: Order already has a booked courier (COURIER_ALREADY_BOOKED)
 *       422:
 *         description: Not eligible (ORDER_NOT_COURIER_ELIGIBLE) or unscored courier selected (INVALID_COURIER_SELECTION)
 */
courierRouter.post('/:id/book-courier', validateBody(bookCourierSchema), bookCourierHandler);

// Authenticated tracking read — any role, tri-mode ownership (Buyer/Seller/Admin) enforced inside
// the service via Feature 7's getOwnedOrderRow.
export const authenticatedTrackingRouter = Router();
authenticatedTrackingRouter.use(authenticate);

/**
 * @swagger
 * /api/v1/tracking/{orderId}:
 *   get:
 *     summary: Authenticated tracking read (Buyer, Seller, or Admin/Support of the order)
 *     tags: [Tracking]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: TrackingDTO — status/courier/trackingNo/timeline/lastLocation, no shipping PII
 *       403:
 *         description: Requester does not own this order (ORDER_NOT_OWNED)
 */
authenticatedTrackingRouter.get('/:orderId', getAuthenticatedTrackingHandler);

// Public, login-free tracking (SCR-B09, REQ-F-Track005) — resolves purely via the order's own
// tracking_token (Feature 6, Schema §4.10). No authenticate middleware here, ever.
export const publicTrackingRouter = Router();

/**
 * @swagger
 * /api/v1/t/{publicToken}:
 *   get:
 *     summary: Public, login-free order tracking (no PII beyond status/courier/timeline)
 *     tags: [Tracking]
 *     responses:
 *       200:
 *         description: TrackingDTO
 *       404:
 *         description: Invalid/unknown token (TRACKING_TOKEN_INVALID)
 */
publicTrackingRouter.get('/:publicToken', getPublicTrackingHandler);
