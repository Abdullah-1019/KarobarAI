import { Prisma } from '@prisma/client';
import Stripe from 'stripe';

import { config } from '../../core/config';
import { DependencyError, PaymentGatewayUnavailableError, PaymentOutcomeUncertainError, ValidationError } from '../../core/errors/AppError';
import { logger } from '../../core/logger';
import type { PaymentAdapter, PaymentInitiationInput, PaymentInitiationResult, PaymentRefundResult } from './payment.adapter';

export const STRIPE_CURRENCY = 'usd';

/** Academic demo mapping: PKR 100.00 maps to USD 1.00; fractional PKR rounds to the nearest USD cent. */
export function toStripeMinorUnits(amountPkr: string | number | Prisma.Decimal): number {
  const amount = new Prisma.Decimal(amountPkr);
  if (!amount.isFinite() || amount.lte(0)) throw new ValidationError('Payment amount must be positive.', undefined, 'INVALID_PAYMENT_AMOUNT');
  const cents = amount.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new ValidationError('Payment amount is outside Stripe limits.', undefined, 'INVALID_PAYMENT_AMOUNT');
  return cents;
}

/** Formats the exact minor-unit amount used by Stripe for clear pre-confirmation checkout display. */
export function toStripeDisplayAmountUsd(amountPkr: string | number | Prisma.Decimal): string {
  const cents = toStripeMinorUnits(amountPkr);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export function stripeTestCredentialsReady(): boolean {
  return config.stripe.secretKey.startsWith('sk_test_') && config.stripe.secretKey.length > 8
    && config.stripe.publishableKey.startsWith('pk_test_') && config.stripe.publishableKey.length > 8
    && config.stripe.webhookSecret.startsWith('whsec_') && config.stripe.webhookSecret.length > 6;
}

export class StripeAdapter implements PaymentAdapter {
  readonly method = 'STRIPE' as const;
  private readonly stripe: Stripe;

  constructor(secretKey = config.stripe.secretKey, injectedClient?: Stripe) {
    if (!injectedClient && (!secretKey.startsWith('sk_test_') || secretKey.length <= 8)) {
      throw new PaymentGatewayUnavailableError('Stripe test-mode credentials are not configured.');
    }
    this.stripe = injectedClient ?? new Stripe(secretKey);
  }

  async assertAvailable(): Promise<void> {
    if (!stripeTestCredentialsReady()) {
      throw new PaymentGatewayUnavailableError('Stripe test mode requires test secret, publishable, and webhook keys.');
    }
  }

  async initiate(input: PaymentInitiationInput, idempotencyKey: string): Promise<PaymentInitiationResult> {
    await this.assertAvailable();
    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.stripe.paymentIntents.create(
        {
          amount: toStripeMinorUnits(input.amountPkr),
          currency: STRIPE_CURRENCY,
          automatic_payment_methods: { enabled: true },
          metadata: {
            orderId: input.orderId,
            paymentId: input.paymentId,
            currencyPolicy: 'PKR_100_PER_USD_1',
          },
        },
        { idempotencyKey },
      );
    } catch (error) {
      const providerError = error as { code?: string; type?: string; statusCode?: number };
      logger.error({ provider: 'stripe', code: providerError.code, type: providerError.type, statusCode: providerError.statusCode }, 'Stripe PaymentIntent creation failed');
      // No response or a provider 5xx does not prove that Stripe rejected the request. Keep the
      // local attempt pending and retry with the same Stripe idempotency key to reconcile it.
      if (typeof providerError.statusCode !== 'number' || providerError.statusCode >= 500) {
        throw new PaymentOutcomeUncertainError();
      }
      throw new PaymentGatewayUnavailableError('Stripe rejected payment setup. The checkout attempt was not completed.');
    }
    if (!intent.client_secret) throw new PaymentGatewayUnavailableError('Stripe did not return a payment confirmation token.');
    return { paymentReference: intent.id, clientSecret: intent.client_secret };
  }

  /** Retrieve an already persisted intent. This remains safe after Stripe's create-key retention window. */
  async resume(input: PaymentInitiationInput, paymentReference: string): Promise<PaymentInitiationResult> {
    await this.assertAvailable();
    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.stripe.paymentIntents.retrieve(paymentReference);
    } catch (error) {
      const providerError = error as { code?: string; type?: string; statusCode?: number };
      logger.warn({ provider: 'stripe', code: providerError.code, type: providerError.type, statusCode: providerError.statusCode }, 'Stripe PaymentIntent lookup failed');
      throw new PaymentOutcomeUncertainError('The existing Stripe payment could not be checked. Try again later.');
    }
    if (intent.livemode || intent.id !== paymentReference
      || intent.metadata.orderId !== input.orderId || intent.metadata.paymentId !== input.paymentId
      || intent.currency !== STRIPE_CURRENCY || intent.amount !== toStripeMinorUnits(input.amountPkr)) {
      throw new PaymentOutcomeUncertainError('The existing Stripe payment does not match this order. Contact support.');
    }
    if (intent.status === 'succeeded' || intent.status === 'processing') {
      throw new PaymentOutcomeUncertainError('Stripe is processing this payment. Wait for confirmation before retrying checkout.');
    }
    if (!['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(intent.status) || !intent.client_secret) {
      throw new PaymentOutcomeUncertainError('The existing Stripe payment needs reconciliation before a new checkout.');
    }
    return { paymentReference: intent.id, clientSecret: intent.client_secret };
  }

  async confirm(paymentReference: string, confirmation?: unknown) {
    if (!confirmation || typeof confirmation !== 'object') {
      throw new ValidationError('Stripe confirmation event is required.', undefined, 'INVALID_PAYMENT_EVENT');
    }
    const event = confirmation as Stripe.Event;
    if (typeof event.type !== 'string' || !event.data?.object) {
      throw new ValidationError('Stripe confirmation event is malformed.', undefined, 'INVALID_PAYMENT_EVENT');
    }
    const intent = event.data.object as Stripe.PaymentIntent;
    if (intent.id !== paymentReference) throw new ValidationError('Stripe event payment reference mismatch.', undefined, 'INVALID_PAYMENT_EVENT');
    if (event.type === 'payment_intent.succeeded' && intent.status === 'succeeded') return 'CONFIRMED' as const;
    if (event.type === 'payment_intent.canceled' && intent.status === 'canceled') return 'CANCELLED' as const;
    if (event.type === 'payment_intent.payment_failed' && intent.status === 'requires_payment_method') return 'FAILED' as const;
    throw new ValidationError('Stripe event type and payment state do not match.', undefined, 'INVALID_PAYMENT_EVENT');
  }

  async cancel(paymentReference: string): Promise<void> {
    try {
      await this.stripe.paymentIntents.cancel(paymentReference);
    } catch (error) {
      const providerError = error as { code?: string; type?: string; statusCode?: number };
      logger.warn({ provider: 'stripe', code: providerError.code, type: providerError.type, statusCode: providerError.statusCode }, 'Stripe PaymentIntent cleanup failed');
      // Until cancellation is confirmed, a later checkout must not create another PaymentIntent.
      throw new PaymentOutcomeUncertainError('Stripe cancellation is not confirmed. Retry the same checkout so its payment can be reconciled.');
    }
  }

  async refund(
    paymentReference: string,
    amountPkr: string,
    originalAmountPkr: string,
    idempotencyKey: string,
  ): Promise<PaymentRefundResult> {
    const amount = new Prisma.Decimal(amountPkr);
    const original = new Prisma.Decimal(originalAmountPkr);
    if (!amount.isFinite() || amount.lte(0) || amount.gt(original)) {
      throw new ValidationError('Refund amount must be positive and cannot exceed the original payment.', undefined, 'INVALID_REFUND_AMOUNT');
    }
    let refund: Stripe.Refund;
    try {
      refund = await this.stripe.refunds.create(
        { payment_intent: paymentReference, amount: toStripeMinorUnits(amount) },
        { idempotencyKey },
      );
    } catch (error) {
      logger.error({ provider: 'stripe', code: (error as { code?: string }).code }, 'Stripe refund request failed');
      throw new DependencyError('Stripe could not process this test refund.', undefined, 'PAYMENT_PROVIDER_ERROR');
    }
    return { success: refund.status === 'succeeded', refundReference: refund.id };
  }
}
