import { Router } from 'express';

import { authenticate } from '../../core/middleware/authenticate';
import { authorize } from '../../core/middleware/authorize';
import { validateBody, validateQuery } from '../../core/middleware/validate';
import {
  cancelOrderHandler,
  checkoutHandler,
  getOrderDetailHandler,
  getOrderInvoiceHandler,
  listBuyerOrdersHandler,
  listSellerOrdersHandler,
} from './order.controller';
import { checkoutSchema } from './checkout.dto';
import { listOrdersQuerySchema } from './order.dto';

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

// ─────────────────────────────────────────────────────────────────────────────
// Buyer-facing order routes, mounted at /api/v1/orders. Authenticated (any role) at the router
// level — the list route is Buyer-only, but detail/invoice use tri-mode ownership inside the
// service itself (Buyer OR Seller OR Admin/Support), so they can't be gated by authorize() alone.
// ─────────────────────────────────────────────────────────────────────────────
export const orderRouter = Router();
orderRouter.use(authenticate);

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: The authenticated buyer's own orders, tab-filtered and cursor-paginated
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tab
 *         schema: { type: string, enum: [Pending, ConfirmedProcessing, Shipped, Delivered, Cancelled] }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "OrderListDTO: { items: OrderListItemDTO[], nextCursor: string | null }"
 */
orderRouter.get('/', authorize('BUYER'), validateQuery(listOrdersQuerySchema), listBuyerOrdersHandler);

/**
 * @swagger
 * /api/v1/orders/{id}:
 *   get:
 *     summary: Order detail — tri-mode ownership (Buyer, Seller, or Admin/Support)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: OrderDetailDTO (commission present only when requester is the order's own Seller)
 *       403:
 *         description: Requester is neither the buyer, the seller, nor Admin/Support (ORDER_NOT_OWNED)
 *       404:
 *         description: Order not found (ORDER_NOT_FOUND)
 */
orderRouter.get('/:id', getOrderDetailHandler);

/**
 * @swagger
 * /api/v1/orders/{id}/cancel:
 *   post:
 *     summary: Seller-only manual cancellation from any pre-shipment status; restores stock
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated OrderDetailDTO (status CANCELLED)
 *       403:
 *         description: Order belongs to another seller (ORDER_NOT_OWNED)
 *       422:
 *         description: Order is already past the pre-shipment stage (ORDER_NOT_CANCELLABLE)
 */
orderRouter.post('/:id/cancel', authorize('SELLER'), cancelOrderHandler);

/**
 * @swagger
 * /api/v1/orders/{id}/invoice:
 *   get:
 *     summary: On-demand print-friendly HTML invoice (tri-mode ownership); commission always excluded
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: text/html invoice document
 *       403:
 *         description: Requester is neither the buyer, the seller, nor Admin/Support (ORDER_NOT_OWNED)
 */
orderRouter.get('/:id/invoice', getOrderInvoiceHandler);

// ─────────────────────────────────────────────────────────────────────────────
// Seller-facing order list, mounted at /api/v1/seller/orders — mirrors the seller/products
// router split (Task 1.4 pattern), Seller-only.
// ─────────────────────────────────────────────────────────────────────────────
export const sellerOrderRouter = Router();
sellerOrderRouter.use(authenticate, authorize('SELLER'));

/**
 * @swagger
 * /api/v1/seller/orders:
 *   get:
 *     summary: The authenticated seller's own orders, tab-filtered and cursor-paginated
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tab
 *         schema: { type: string, enum: [Pending, ConfirmedProcessing, Shipped, Delivered, Cancelled] }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "OrderListDTO — counterpartyName is the order's snapshotted recipient name, not full buyer PII"
 */
sellerOrderRouter.get('/', validateQuery(listOrdersQuerySchema), listSellerOrdersHandler);
