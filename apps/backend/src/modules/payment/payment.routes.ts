import express, { Router } from 'express';
import Stripe from 'stripe';

import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import { config } from '../../core/config';
import { logger } from '../../core/logger';
import { AuthError, PaymentGatewayUnavailableError, ValidationError } from '../../core/errors/AppError';
import { processStripeEvent } from './stripe-webhook.service';
import { getPublicPaymentConfig } from './payment.service';

export const paymentRouter = Router();
paymentRouter.get('/config', (_req, res) => res.status(200).json(ok(getPublicPaymentConfig())));

export const stripeWebhookRouter = Router();
stripeWebhookRouter.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  asyncHandler(async (req, res) => {
    if (!config.stripe.secretKey.startsWith('sk_test_') || config.stripe.secretKey.length <= 8
      || !config.stripe.webhookSecret.startsWith('whsec_') || config.stripe.webhookSecret.length <= 6) {
      throw new PaymentGatewayUnavailableError('Stripe test-mode webhook is not configured.');
    }
    if (!Buffer.isBuffer(req.body)) throw new ValidationError('Stripe webhook body must be raw JSON bytes.', undefined, 'INVALID_PAYMENT_EVENT');
    const signature = req.header('stripe-signature');
    if (!signature) throw new AuthError('Stripe signature header is required.', undefined, 'INVALID_STRIPE_SIGNATURE');

    let event: Stripe.Event;
    try {
      event = new Stripe(config.stripe.secretKey).webhooks.constructEvent(req.body, signature, config.stripe.webhookSecret);
    } catch {
      throw new AuthError('Stripe webhook signature is invalid.', undefined, 'INVALID_STRIPE_SIGNATURE');
    }

    if (typeof event.id !== 'string' || !event.id.startsWith('evt_') || event.livemode !== false || !event.data?.object) {
      throw new ValidationError('Stripe webhook must be a valid test-mode event.', undefined, 'INVALID_PAYMENT_EVENT');
    }

    const result = await processStripeEvent(event);
    logger.info({ eventId: event.id, eventType: event.type, duplicate: result.duplicate, paymentStatus: result.status }, 'Stripe webhook processed');
    res.status(200).json(ok({ received: true, duplicate: result.duplicate }));
  }),
);
