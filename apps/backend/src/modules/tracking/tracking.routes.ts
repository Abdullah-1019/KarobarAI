import { Router } from 'express';

import { authenticate } from '../../core/middleware/authenticate';
import { authorize } from '../../core/middleware/authorize';
import { validateBody } from '../../core/middleware/validate';
import { bookCourierSchema } from './tracking.dto';
import {
  autoSelectCourierHandler,
  getAutoSelectionHandler,
  getCourierPerformanceHandler,
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
const sellerOnly = [authenticate, authorize('SELLER')];

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
courierRouter.get('/:id/courier-quotes', ...sellerOnly, getCourierQuotesHandler);

/** Seller-scoped synthetic outcome aggregates; at least five deliveries for rate estimates. */
courierRouter.get('/courier-performance', ...sellerOnly, getCourierPerformanceHandler);

/** Read the persisted simulated selection, quote comparison, and reconciliation state. */
courierRouter.get('/:id/courier-selection', ...sellerOnly, getAutoSelectionHandler);

/** Seller click only; evaluates all valid quotes and books one computed winner. */
courierRouter.post('/:id/auto-select-courier', ...sellerOnly, autoSelectCourierHandler);

/**
 * @swagger
 * /api/v1/orders/{id}/refresh-rates:
 *   post:
 *     summary: Re-score couriers and retain the earlier quote evaluation in history
 *     tags: [Tracking]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated CourierQuotesDTO
 *       422:
 *         description: Order is no longer courier-selection-eligible (ORDER_NOT_COURIER_ELIGIBLE)
 */
courierRouter.post('/:id/refresh-rates', ...sellerOnly, refreshCourierRatesHandler);

/**
 * @swagger
 * /api/v1/orders/{id}/book-courier:
 *   post:
 *     summary: Manually book one eligible simulated courier with no automatic retry or fallback
 *     tags: [Tracking]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               courierCode: { type: string, enum: [TCS, LEOPARDS, TRAX, POSTEX] }
 *     responses:
 *       200:
 *         description: Updated OrderDetailDTO after one confirmed simulated booking
 *       409:
 *         description: Order already has a booked courier (COURIER_ALREADY_BOOKED)
 *       422:
 *         description: Not eligible (ORDER_NOT_COURIER_ELIGIBLE) or unscored courier selected (INVALID_COURIER_SELECTION)
 */
courierRouter.post('/:id/book-courier', ...sellerOnly, validateBody(bookCourierSchema), bookCourierHandler);

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
