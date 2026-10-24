import { Prisma, type PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';

import { config } from '../../core/config';
import { prisma } from '../../core/prisma';
import { BusinessRuleError, ConflictError, NotFoundError, PaymentGatewayUnavailableError, PaymentOutcomeUncertainError, RateLimitError, ValidationError } from '../../core/errors/AppError';
import { logger } from '../../core/logger';
import { redis } from '../../core/redis';
import { restoreStock } from '../catalog/catalog.service';
import { canTransition } from '../../core/state-machines/order.state-machine';
import { enqueuePaymentConfirmationEffects } from '../order/order.service';
import { StripeAdapter, STRIPE_CURRENCY, stripeTestCredentialsReady, toStripeMinorUnits } from './stripe.adapter';

const SUPPORTED_EVENTS = new Set([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'charge.refunded',
]);

/** Recover a missed webhook only from Stripe's authenticated test API and its real event ID. */
export async function reconcileStripeOrderFromProvider(
  orderPublicId: string,
  buyerId: bigint,
  client?: Stripe,
): Promise<{ status: PaymentStatus; duplicate: boolean }> {
  const payment = await prisma.payment.findFirst({
    where: { order: { publicId: orderPublicId, buyerId }, method: 'STRIPE' },
    include: { order: { select: { publicId: true } } },
  });
  if (!payment) throw new NotFoundError('Stripe order was not found.', undefined, 'ORDER_NOT_FOUND');
  if (!payment.transactionRef) {
    throw new PaymentOutcomeUncertainError('This order has no saved Stripe reference to reconcile.');
  }
  if (!stripeTestCredentialsReady()) throw new PaymentGatewayUnavailableError('Stripe test mode is not configured.');

  const rateKey = `stripe:reconcile:${buyerId}:${payment.paymentId}`;
  const requests = await redis.incr(rateKey);
  if (requests === 1) await redis.expire(rateKey, 60);
  if (requests > 5) throw new RateLimitError('Wait before checking this Stripe payment again.', undefined, 'PAYMENT_RECONCILE_RATE_LIMIT');

  const stripe = client ?? new Stripe(config.stripe.secretKey);
  try {
    const intent = await stripe.paymentIntents.retrieve(payment.transactionRef, { expand: ['latest_charge'] });
    if (intent.livemode || intent.id !== payment.transactionRef
      || intent.metadata.orderId !== payment.order.publicId || intent.metadata.paymentId !== payment.paymentId.toString()
      || intent.currency !== STRIPE_CURRENCY || intent.amount !== toStripeMinorUnits(payment.amount)) {
      throw new PaymentOutcomeUncertainError('Stripe payment details do not match this order. Contact support.');
    }
    if (intent.status !== 'succeeded') {
      throw new PaymentOutcomeUncertainError('Stripe has not confirmed this payment. No order status was changed.');
    }
    const charge = intent.latest_charge;
    if (intent.amount_received !== intent.amount || !charge || typeof charge === 'string'
      || charge.object !== 'charge' || charge.payment_intent !== intent.id
      || charge.status !== 'succeeded' || !charge.captured || charge.refunded
      || charge.amount_refunded !== 0 || charge.amount !== intent.amount || charge.currency !== intent.currency) {
      throw new PaymentOutcomeUncertainError('The Stripe charge is not an unrefunded, captured payment. No order status was changed.');
    }

    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const events = await stripe.events.list({
        type: 'payment_intent.succeeded',
        created: { gte: Math.max(0, Math.floor(payment.createdAt.getTime() / 1000) - 60) },
        limit: 100,
        ...(cursor ? { starting_after: cursor } : {}),
      });
      const matching = events.data.find((event) => {
        const eventIntent = event.data.object as Stripe.PaymentIntent;
        return event.livemode === false && event.type === 'payment_intent.succeeded'
          && eventIntent.id === intent.id && eventIntent.status === 'succeeded';
      });
      if (matching) return processStripeEvent(matching);
      if (!events.has_more || events.data.length === 0) break;
      cursor = events.data[events.data.length - 1]?.id;
    }
    throw new PaymentOutcomeUncertainError('Stripe success event was not found; this order was not changed.');
  } catch (error) {
    if (error instanceof PaymentOutcomeUncertainError || error instanceof BusinessRuleError || error instanceof ValidationError) throw error;
    logger.warn({ paymentId: payment.paymentId.toString(), errorType: (error as { type?: string }).type }, 'Stripe reconciliation failed');
    throw new PaymentOutcomeUncertainError('Stripe could not be checked. Try again later.');
  }
}

function invalidEvent(message: string): never {
  throw new ValidationError(message, undefined, 'INVALID_PAYMENT_EVENT');
}

function paymentIntentId(object: Stripe.Event.Data.Object): string {
  const candidate = object as { object?: unknown; id?: unknown; payment_intent?: unknown };
  if (candidate.object === 'payment_intent' && typeof candidate.id === 'string') return candidate.id;
  if (candidate.object === 'charge') {
    const intent = candidate.payment_intent;
    if (typeof intent === 'string') return intent;
    if (intent && typeof intent === 'object') {
      const id = (intent as { id?: unknown }).id;
      if (typeof id === 'string') return id;
    }
  }
  return invalidEvent('Stripe event does not contain a supported payment reference.');
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isConcurrentTransactionConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

/** The event ledger and payment/order changes commit together; duplicate Stripe deliveries are safe. */
export async function processStripeEvent(event: Stripe.Event): Promise<{ duplicate: boolean; status: PaymentStatus }> {
  if (typeof event.id !== 'string' || !event.id.startsWith('evt_') || event.livemode !== false || !event.data?.object) {
    invalidEvent('A verified Stripe test-mode event is required.');
  }
  if (!SUPPORTED_EVENTS.has(event.type)) invalidEvent(`Unsupported Stripe event: ${event.type}`);

  const reference = paymentIntentId(event.data.object);
  const adapter = new StripeAdapter();
  let outcome: { duplicate: boolean; status: PaymentStatus; orderId: bigint; confirmed: boolean };

  try {
    outcome = await prisma.$transaction(async (tx) => {
      const prior = await tx.stripeWebhookEvent.findUnique({ where: { eventId: event.id }, select: { paymentId: true } });
      if (prior) {
        const existing = await tx.payment.findUnique({ where: { paymentId: prior.paymentId }, select: { status: true, orderId: true } });
        return {
          duplicate: true,
          status: existing?.status ?? 'PENDING',
          orderId: existing?.orderId ?? 0n,
          confirmed: existing?.status === 'CONFIRMED',
        };
      }

      let payment = await tx.payment.findFirst({
        where: { transactionRef: reference, method: 'STRIPE' },
        include: { order: { select: { orderId: true, publicId: true, status: true, buyerId: true } } },
      });
      if (!payment && event.type.startsWith('payment_intent.')) {
        // Stripe can deliver the event before initiate() saves the new reference. Correlate by
        // the server-written payment ID, then validate order metadata, amount, currency and
        // provider status below in this same transaction before committing the reference.
        const candidateId = (event.data.object as Stripe.PaymentIntent).metadata?.paymentId;
        if (typeof candidateId === 'string' && /^[1-9]\d*$/.test(candidateId)
          && BigInt(candidateId) <= 9_223_372_036_854_775_807n) {
          payment = await tx.payment.findFirst({
            where: { paymentId: BigInt(candidateId), method: 'STRIPE', transactionRef: null },
            include: { order: { select: { orderId: true, publicId: true, status: true, buyerId: true } } },
          });
          if (payment) {
            const bound = await tx.payment.updateMany({
              where: { paymentId: payment.paymentId, status: 'PENDING', transactionRef: null },
              data: { transactionRef: reference },
            });
            if (bound.count !== 1) throw new ConflictError('Payment reference changed while processing the Stripe event.', undefined, 'PAYMENT_STATE_CONFLICT');
          }
        }
      }
      if (!payment) throw new NotFoundError('Stripe payment reference was not found.', undefined, 'PAYMENT_NOT_FOUND');

      if (event.type.startsWith('payment_intent.')) {
        const intent = event.data.object as Stripe.PaymentIntent;
        if (intent.metadata.orderId !== payment.order.publicId || intent.metadata.paymentId !== payment.paymentId.toString()) {
          invalidEvent('Stripe payment metadata does not match the persisted order and payment.');
        }
        if (intent.currency !== STRIPE_CURRENCY || intent.amount !== toStripeMinorUnits(payment.amount)) {
          invalidEvent('Stripe payment amount or currency does not match the persisted order.');
        }
      } else {
        const charge = event.data.object as Stripe.Charge;
        if (charge.currency !== STRIPE_CURRENCY || charge.amount !== toStripeMinorUnits(payment.amount)) {
          invalidEvent('Stripe charge amount or currency does not match the persisted order.');
        }
      }

      const providerStatus = event.type.startsWith('payment_intent.')
        ? await adapter.confirm(reference, event)
        : payment.status;
      let status = payment.status;
      let confirmed = false;

      if (event.type === 'charge.refunded') {
        const charge = event.data.object as Stripe.Charge;
        if (charge.amount_refunded >= charge.amount) {
          if (payment.status === 'CONFIRMED') {
            await tx.payment.updateMany({ where: { paymentId: payment.paymentId, status: 'CONFIRMED' }, data: { status: 'REFUNDED' } });
            status = 'REFUNDED';
          } else if (payment.status !== 'REFUNDED') {
            throw new BusinessRuleError('A refund cannot be applied before payment confirmation.', undefined, 'INVALID_STATUS_TRANSITION');
          }
        }
      } else if (providerStatus === 'CONFIRMED') {
        if (payment.status === 'PENDING' && payment.order.status === 'PAYMENT_PENDING') {
          if (!canTransition(payment.order.status, 'PAYMENT_CONFIRMED')) {
            throw new BusinessRuleError('Payment confirmation is not a valid order transition.', undefined, 'INVALID_STATUS_TRANSITION');
          }
          const paymentUpdate = await tx.payment.updateMany({ where: { paymentId: payment.paymentId, status: 'PENDING' }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
          const orderUpdate = await tx.order.updateMany({ where: { orderId: payment.order.orderId, status: 'PAYMENT_PENDING' }, data: { status: 'PAYMENT_CONFIRMED' } });
          if (paymentUpdate.count !== 1 || orderUpdate.count !== 1) throw new ConflictError('Payment state changed while processing the Stripe event.', undefined, 'PAYMENT_STATE_CONFLICT');
          await tx.trackingEvent.create({ data: { orderId: payment.order.orderId, status: 'PAYMENT_CONFIRMED', description: 'Stripe payment confirmed', eventTime: new Date() } });
          status = 'CONFIRMED';
          confirmed = true;
        } else if (payment.status !== 'CONFIRMED') {
          throw new BusinessRuleError('Stripe success cannot be applied to the current payment/order state.', undefined, 'INVALID_STATUS_TRANSITION');
        } else {
          confirmed = true;
        }
      } else if (providerStatus === 'FAILED') {
        // A failed card attempt leaves the PaymentIntent retryable. Keep the order and payment
        // pending so the buyer can use Stripe's supported retry flow; record the attempt count.
        if (payment.status === 'PENDING' && payment.order.status === 'PAYMENT_PENDING') {
          await tx.payment.updateMany({ where: { paymentId: payment.paymentId, status: 'PENDING' }, data: { retryCount: { increment: 1 } } });
        } else if (payment.status !== 'CONFIRMED') {
          logger.info({ eventId: event.id, paymentId: payment.paymentId.toString() }, 'Ignoring stale Stripe payment failure event');
        }
      } else if (providerStatus === 'CANCELLED') {
        if (payment.status === 'PENDING' && payment.order.status === 'PAYMENT_PENDING') {
          if (!canTransition(payment.order.status, 'CANCELLED')) {
            throw new BusinessRuleError('Payment cancellation is not a valid order transition.', undefined, 'INVALID_STATUS_TRANSITION');
          }
          await tx.payment.updateMany({ where: { paymentId: payment.paymentId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
          await tx.order.updateMany({ where: { orderId: payment.order.orderId, status: 'PAYMENT_PENDING' }, data: { status: 'CANCELLED' } });
          await tx.trackingEvent.create({ data: { orderId: payment.order.orderId, status: 'CANCELLED', description: 'Stripe payment was canceled', eventTime: new Date() } });
          const items = await tx.orderItem.findMany({ where: { orderId: payment.order.orderId } });
          for (const item of items) {
            // eslint-disable-next-line no-await-in-loop -- stock restoration must remain in this transaction
            await restoreStock(item.productId, item.quantity, tx, item.variantId);
          }
          status = 'CANCELLED';
        } else if (payment.status !== 'CANCELLED') {
          throw new BusinessRuleError('Stripe cancellation cannot be applied to the current payment/order state.', undefined, 'INVALID_STATUS_TRANSITION');
        }
      }

      await tx.stripeWebhookEvent.create({ data: { eventId: event.id, eventType: event.type, paymentId: payment.paymentId } });
      return { duplicate: false, status, orderId: payment.order.orderId, confirmed };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isUniqueViolation(error) || isConcurrentTransactionConflict(error)) {
      const duplicate = await prisma.stripeWebhookEvent.findUnique({ where: { eventId: event.id }, include: { payment: { select: { status: true, orderId: true } } } });
      if (duplicate) {
        outcome = {
          duplicate: true,
          status: duplicate.payment.status,
          orderId: duplicate.payment.orderId,
          confirmed: duplicate.payment.status === 'CONFIRMED',
        };
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  if (outcome.confirmed && outcome.orderId > 0n) {
    await enqueuePaymentConfirmationEffects(outcome.orderId);
  }
  return { duplicate: outcome.duplicate, status: outcome.status };
}
