import { Router } from 'express';

import { authenticate } from '../../core/middleware/authenticate';
import { authorize } from '../../core/middleware/authorize';
import { validateBody } from '../../core/middleware/validate';
import { checkoutHandler } from './order.controller';
import { checkoutSchema } from './checkout.dto';

// Buyer-only, mirrors cart/address's authenticate + authorize('BUYER') pattern.
export const checkoutRouter = Router();
checkoutRouter.use(authenticate, authorize('BUYER'));

/**
 * @swagger
 * /api/v1/checkout:
 *   post:
 *     summary: Split the eligible cart into one order per seller, initiate payment, decrement stock
 *     tags: [Checkout]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string }
 *         description: Resubmitting the same key returns the original result, never duplicate orders.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               addressId: { type: string }
 *               paymentMethod: { type: string, enum: [JAZZCASH, EASYPAISA, COD] }
 *     responses:
 *       201:
 *         description: "CheckoutResultDTO: { orders: CreatedOrderDTO[] } — one entry per seller group"
 *       400:
 *         description: Missing Idempotency-Key header (IDEMPOTENCY_KEY_REQUIRED)
 *       422:
 *         description: No eligible seller groups to checkout (CHECKOUT_NOT_ELIGIBLE)
 *       409:
 *         description: Stock changed since the cart was last viewed (INSUFFICIENT_STOCK)
 */
checkoutRouter.post('/', validateBody(checkoutSchema), checkoutHandler);
