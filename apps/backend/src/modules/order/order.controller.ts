import { ValidationError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import { resolveUserId } from '../../core/http/resolveUserId';
import * as checkoutService from './checkout.service';
import { generateInvoiceHtml } from './invoice.service';
import * as orderService from './order.service';
import type { CheckoutInput } from './checkout.dto';
import type { ListOrdersQueryInput } from './order.dto';

// Task 7.2 — Idempotency-Key header required on this payment-affecting POST (REQ-F-Payment-004,
// TRD §9). No generic middleware: enforced directly here since the actual "return the original
// result on a repeat key" behavior lives in checkout.service.ts's own Redis check, not in
// Express middleware plumbing.
export const checkoutHandler = asyncHandler(async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new ValidationError(
      'Idempotency-Key header is required',
      undefined,
      'IDEMPOTENCY_KEY_REQUIRED',
    );
  }

  const buyerId = await resolveUserId(req.user!.sub);
  const input = req.body as CheckoutInput;
  const result = await checkoutService.processCheckout(buyerId, input, idempotencyKey);
  res.status(201).json(ok(result));
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 2/4/6/8 — Order Retrieval, Status Management, Invoice. Role is always derived from the
// authenticated JWT (req.user.role via authorize()), never a client-supplied ?role= query param
// — a client can't spoof which list they see.
// ─────────────────────────────────────────────────────────────────────────────

export const listBuyerOrdersHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const query = req.query as unknown as ListOrdersQueryInput;
  const result = await orderService.getOrdersForBuyer(buyerId, query);
  res.status(200).json(ok(result));
});

export const listSellerOrdersHandler = asyncHandler(async (req, res) => {
  const sellerId = await resolveUserId(req.user!.sub);
  const query = req.query as unknown as ListOrdersQueryInput;
  const result = await orderService.getOrdersForSeller(sellerId, query);
  res.status(200).json(ok(result));
});

export const getOrderDetailHandler = asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req.user!.sub);
  const order = await orderService.getOrderById(req.params.id ?? '', { userId, role: req.user!.role });
  res.status(200).json(ok(order));
});

export const cancelOrderHandler = asyncHandler(async (req, res) => {
  const sellerId = await resolveUserId(req.user!.sub);
  await orderService.cancelOrder(sellerId, req.params.id ?? '');
  const order = await orderService.getOrderById(req.params.id ?? '', { userId: sellerId, role: req.user!.role });
  res.status(200).json(ok(order));
});

export const getOrderInvoiceHandler = asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req.user!.sub);
  const html = await generateInvoiceHtml(req.params.id ?? '', { userId, role: req.user!.role });
  res.status(200).set('Content-Type', 'text/html; charset=utf-8').send(html);
});
