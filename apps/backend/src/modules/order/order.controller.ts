import { ValidationError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import { resolveUserId } from '../../core/http/resolveUserId';
import * as checkoutService from './checkout.service';
import type { CheckoutInput } from './checkout.dto';

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
