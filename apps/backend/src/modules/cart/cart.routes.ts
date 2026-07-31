import { Router } from 'express';

import { authenticate } from '../../core/middleware/authenticate';
import { authorize } from '../../core/middleware/authorize';
import { validateBody } from '../../core/middleware/validate';
import {
  addCartItemHandler,
  getCartHandler,
  removeCartItemHandler,
  updateCartItemHandler,
} from './cart.controller';
import { addCartItemSchema, updateCartItemSchema } from './cart.dto';

// Cart is Buyer-only, always requires a valid session (D4: "persisted per buyer") — unlike
// Feature 5's guest-friendly public router, there is no meaningful anonymous cart state here.
export const cartRouter = Router();
cartRouter.use(authenticate, authorize('BUYER'));

/**
 * @swagger
 * /api/v1/cart:
 *   get:
 *     summary: Get the buyer's cart, grouped by seller, with stock-conflict/min-order flags
 *     tags: [Cart]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "CartDTO: { sellerGroups: [...], grandSubtotal }. A brand-new buyer with no cart activity gets an empty-groups 200, never a 404."
 */
cartRouter.get('/', getCartHandler);

/**
 * @swagger
 * /api/v1/cart/items:
 *   post:
 *     summary: Add a product to the cart (creates or increments the existing line item)
 *     tags: [Cart]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId: { type: string, description: Product's publicId (UUID) }
 *               quantity: { type: integer }
 *     responses:
 *       201:
 *         description: Updated CartDTO
 *       404:
 *         description: Product does not exist or is not LIVE (PRODUCT_NOT_FOUND)
 */
cartRouter.post('/items', validateBody(addCartItemSchema), addCartItemHandler);

/**
 * @swagger
 * /api/v1/cart/items/{itemId}:
 *   patch:
 *     summary: Set a cart line item's quantity directly
 *     tags: [Cart]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity: { type: integer }
 *     responses:
 *       200:
 *         description: Updated CartDTO
 *       403:
 *         description: Cart item belongs to a different buyer (CART_ITEM_NOT_OWNED)
 *   delete:
 *     summary: Remove a cart line item (hard delete — cart items are ephemeral working-state)
 *     tags: [Cart]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated CartDTO
 */
cartRouter.patch('/items/:itemId', validateBody(updateCartItemSchema), updateCartItemHandler);
cartRouter.delete('/items/:itemId', removeCartItemHandler);
