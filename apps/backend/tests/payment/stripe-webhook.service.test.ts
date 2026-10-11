import type Stripe from 'stripe';

import { config } from '../../src/core/config';
import { BusinessRuleError, NotFoundError, PaymentOutcomeUncertainError, ValidationError } from '../../src/core/errors/AppError';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { processStripeEvent, reconcileStripeOrderFromProvider } from '../../src/modules/payment/stripe-webhook.service';
import { enqueuePaymentConfirmationEffects } from '../../src/modules/order/order.service';
import { createTestOrder, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

jest.mock('../../src/modules/order/order.service', () => ({ enqueuePaymentConfirmationEffects: jest.fn() }));

const enqueueEffectsMock = jest.mocked(enqueuePaymentConfirmationEffects);
const originalStripeConfig = { ...config.stripe };

beforeEach(async () => {
  Object.assign(config.stripe, {
    secretKey: 'sk_test_webhook_service',
    publishableKey: 'pk_test_webhook_service',
    webhookSecret: 'whsec_webhook_service',
  });
  await resetDb();
  await resetRedis();
  enqueueEffectsMock.mockReset().mockResolvedValue(undefined);
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
  Object.assign(config.stripe, originalStripeConfig);
});

async function stripeOrder(status: 'PAYMENT_PENDING' | 'CANCELLED' | 'PAYMENT_CONFIRMED' = 'PAYMENT_PENDING') {
  const seller = await createTestUser('SELLER', { onboarded: true });
  const buyer = await createTestUser('BUYER');
  const product = await createTestProduct(seller.userId, { price: 100, stock: 10, status: 'LIVE' });
  const order = await createTestOrder(buyer.userId, seller.userId, product, { paymentMethod: 'STRIPE', status });
  const reference = `pi_${order.publicId}`;
  const payment = await prisma.payment.update({
    where: { orderId: order.orderId },
    data: { transactionRef: reference, gateway: 'stripe', status: status === 'PAYMENT_CONFIRMED' ? 'CONFIRMED' : 'PENDING' },
  });
  return { order, payment, reference };
}

function intentEvent(
  id: string,
  type: 'payment_intent.succeeded' | 'payment_intent.payment_failed' | 'payment_intent.canceled',
  reference: string,
  orderPublicId: string,
  paymentId: bigint,
  amount: number,
  status: string,
): Stripe.Event {
  return {
    id,
    object: 'event',
    type,
    livemode: false,
    data: { object: {
      id: reference,
      object: 'payment_intent',
      amount,
      currency: 'usd',
      status,
      metadata: { orderId: orderPublicId, paymentId: paymentId.toString() },
    } },
  } as unknown as Stripe.Event;
}

describe('Stripe webhook state handling with isolated PostgreSQL', () => {
  it('reconciles only a real matching provider success event and remains idempotent', async () => {
    const { order, payment, reference } = await stripeOrder();
    const intent = {
      id: reference, livemode: false, status: 'succeeded', currency: 'usd',
      amount: Number(payment.amount.toFixed(0)),
      amount_received: Number(payment.amount.toFixed(0)),
      metadata: { orderId: order.publicId, paymentId: payment.paymentId.toString() },
      latest_charge: { object: 'charge', payment_intent: reference, status: 'succeeded',
        captured: true, refunded: false, amount_refunded: 0,
        amount: Number(payment.amount.toFixed(0)), currency: 'usd' },
    };
    const event = intentEvent('evt_feature19_reconcile_success', 'payment_intent.succeeded',
      reference, order.publicId, payment.paymentId, intent.amount, 'succeeded');
    const client = {
      paymentIntents: { retrieve: jest.fn().mockResolvedValue(intent) },
      events: { list: jest.fn().mockResolvedValue({ data: [event], has_more: false }) },
    } as unknown as Stripe;

    expect(await reconcileStripeOrderFromProvider(order.publicId, order.buyerId, client))
      .toEqual({ duplicate: false, status: 'CONFIRMED' });
    expect(await reconcileStripeOrderFromProvider(order.publicId, order.buyerId, client))
      .toEqual({ duplicate: true, status: 'CONFIRMED' });
    expect(await prisma.payment.findUniqueOrThrow({ where: { paymentId: payment.paymentId } })).toMatchObject({ status: 'CONFIRMED' });
    expect(await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } })).toMatchObject({ status: 'PAYMENT_CONFIRMED' });
    expect(await prisma.stripeWebhookEvent.count({ where: { paymentId: payment.paymentId } })).toBe(1);
  });

  it('rejects another buyer before contacting Stripe', async () => {
    const { order, payment } = await stripeOrder();
    const client = { paymentIntents: { retrieve: jest.fn() } } as unknown as Stripe;
    await expect(reconcileStripeOrderFromProvider(order.publicId, order.buyerId + 1n, client))
      .rejects.toBeInstanceOf(NotFoundError);
    expect(client.paymentIntents.retrieve).not.toHaveBeenCalled();
    expect(await prisma.payment.findUniqueOrThrow({ where: { paymentId: payment.paymentId } })).toMatchObject({ status: 'PENDING' });
  });

  it('does not change state for a canceled intent, mismatched amount, or absent success event', async () => {
    const { order, payment, reference } = await stripeOrder();
    const matching = {
      id: reference, livemode: false, status: 'succeeded', currency: 'usd',
      amount: Number(payment.amount.toFixed(0)),
      amount_received: Number(payment.amount.toFixed(0)),
      metadata: { orderId: order.publicId, paymentId: payment.paymentId.toString() },
      latest_charge: { object: 'charge', payment_intent: reference, status: 'succeeded',
        captured: true, refunded: false, amount_refunded: 0,
        amount: Number(payment.amount.toFixed(0)), currency: 'usd' },
    };
    const retrieve = jest.fn().mockResolvedValue({ ...matching, status: 'canceled' });
    const list = jest.fn().mockResolvedValue({ data: [], has_more: false });
    const client = { paymentIntents: { retrieve }, events: { list } } as unknown as Stripe;
    await expect(reconcileStripeOrderFromProvider(order.publicId, order.buyerId, client))
      .rejects.toBeInstanceOf(PaymentOutcomeUncertainError);
    retrieve.mockResolvedValue({ ...matching, amount: 1 });
    await expect(reconcileStripeOrderFromProvider(order.publicId, order.buyerId, client))
      .rejects.toBeInstanceOf(PaymentOutcomeUncertainError);
    retrieve.mockResolvedValue({ ...matching, latest_charge: { ...matching.latest_charge, refunded: true, amount_refunded: 1 } });
    await expect(reconcileStripeOrderFromProvider(order.publicId, order.buyerId, client))
      .rejects.toBeInstanceOf(PaymentOutcomeUncertainError);
    retrieve.mockResolvedValue(matching);
    await expect(reconcileStripeOrderFromProvider(order.publicId, order.buyerId, client))
      .rejects.toBeInstanceOf(PaymentOutcomeUncertainError);
    expect(await prisma.payment.findUniqueOrThrow({ where: { paymentId: payment.paymentId } })).toMatchObject({ status: 'PENDING' });
    expect(await prisma.stripeWebhookEvent.count({ where: { paymentId: payment.paymentId } })).toBe(0);
  });

  it('confirms only correlated success and handles duplicate delivery idempotently', async () => {
    const { order, payment, reference } = await stripeOrder();
    const amount = Number(payment.amount.toFixed(0));
    const event = intentEvent('evt_feature19_success_1', 'payment_intent.succeeded', reference, order.publicId, payment.paymentId, amount, 'succeeded');

    const concurrent = await Promise.all([processStripeEvent(event), processStripeEvent(event)]);
    expect(concurrent.map((result) => result.status)).toEqual(['CONFIRMED', 'CONFIRMED']);
    expect(concurrent.filter((result) => result.duplicate)).toHaveLength(1);
    expect(await processStripeEvent(event)).toEqual({ duplicate: true, status: 'CONFIRMED' });
    expect(await prisma.payment.findUniqueOrThrow({ where: { paymentId: payment.paymentId } })).toMatchObject({ status: 'CONFIRMED' });
    expect(await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } })).toMatchObject({ status: 'PAYMENT_CONFIRMED' });
    expect(await prisma.stripeWebhookEvent.count()).toBe(1);
    expect(enqueueEffectsMock).toHaveBeenCalledTimes(3);
  });

  it('records failed card attempts without marking the order paid', async () => {
    const { order, payment, reference } = await stripeOrder();
    const event = intentEvent('evt_feature19_failed_1', 'payment_intent.payment_failed', reference, order.publicId, payment.paymentId, Number(payment.amount.toFixed(0)), 'requires_payment_method');

    expect(await processStripeEvent(event)).toMatchObject({ status: 'PENDING' });
    expect(await prisma.payment.findUniqueOrThrow({ where: { paymentId: payment.paymentId } })).toMatchObject({ status: 'PENDING', retryCount: 1 });
    expect(await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } })).toMatchObject({ status: 'PAYMENT_PENDING' });
  });

  it('binds a verified early intent event before checkout stores the provider reference', async () => {
    const { order, payment, reference } = await stripeOrder();
    await prisma.payment.update({ where: { paymentId: payment.paymentId }, data: { transactionRef: null } });
    const event = intentEvent(
      'evt_feature19_early_success', 'payment_intent.succeeded', reference,
      order.publicId, payment.paymentId, Number(payment.amount.toFixed(0)), 'succeeded',
    );

    expect(await processStripeEvent(event)).toEqual({ duplicate: false, status: 'CONFIRMED' });
    expect(await prisma.payment.findUniqueOrThrow({ where: { paymentId: payment.paymentId } }))
      .toMatchObject({ transactionRef: reference, status: 'CONFIRMED' });
    expect(await prisma.order.findUniqueOrThrow({ where: { orderId: order.orderId } }))
      .toMatchObject({ status: 'PAYMENT_CONFIRMED' });
    expect(await prisma.stripeWebhookEvent.count({ where: { paymentId: payment.paymentId } })).toBe(1);

    const invalid = await stripeOrder();
    await prisma.payment.update({ where: { paymentId: invalid.payment.paymentId }, data: { transactionRef: null } });
    const wrongAmount = intentEvent(
      'evt_feature19_early_wrong_amount', 'payment_intent.succeeded', invalid.reference,
      invalid.order.publicId, invalid.payment.paymentId, 1, 'succeeded',
    );
    await expect(processStripeEvent(wrongAmount)).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.payment.findUniqueOrThrow({ where: { paymentId: invalid.payment.paymentId } }))
      .toMatchObject({ transactionRef: null, status: 'PENDING' });
    expect(await prisma.stripeWebhookEvent.findUnique({ where: { eventId: wrongAmount.id } })).toBeNull();
  });

  it('applies full refund events to a confirmed payment but leaves partial refunds confirmed', async () => {
    const full = await stripeOrder('PAYMENT_CONFIRMED');
    const fullCharge = {
      id: 'ch_feature19_full', object: 'charge', payment_intent: full.reference,
      amount: Number(full.payment.amount.toFixed(0)), amount_refunded: Number(full.payment.amount.toFixed(0)), currency: 'usd',
    };
    const fullResult = await processStripeEvent({
      id: 'evt_feature19_full_refund', object: 'event', type: 'charge.refunded', livemode: false, data: { object: fullCharge },
    } as unknown as Stripe.Event);
    expect(fullResult.status).toBe('REFUNDED');
    expect(await prisma.payment.findUniqueOrThrow({ where: { paymentId: full.payment.paymentId } })).toMatchObject({ status: 'REFUNDED' });

    const partial = await stripeOrder('PAYMENT_CONFIRMED');
    const partialCharge = {
      id: 'ch_feature19_partial', object: 'charge', payment_intent: partial.reference,
      amount: Number(partial.payment.amount.toFixed(0)), amount_refunded: 1, currency: 'usd',
    };
    const partialResult = await processStripeEvent({
      id: 'evt_feature19_partial_refund', object: 'event', type: 'charge.refunded', livemode: false, data: { object: partialCharge },
    } as unknown as Stripe.Event);
    expect(partialResult.status).toBe('CONFIRMED');
    expect(await prisma.payment.findUniqueOrThrow({ where: { paymentId: partial.payment.paymentId } })).toMatchObject({ status: 'CONFIRMED' });
  });

  it('cancels an unpaid order and rejects a success event for an invalid order state', async () => {
    const canceled = await stripeOrder();
    const cancelEvent = intentEvent('evt_feature19_cancel_1', 'payment_intent.canceled', canceled.reference, canceled.order.publicId, canceled.payment.paymentId, Number(canceled.payment.amount.toFixed(0)), 'canceled');
    expect(await processStripeEvent(cancelEvent)).toMatchObject({ status: 'CANCELLED' });
    expect(await prisma.order.findUniqueOrThrow({ where: { orderId: canceled.order.orderId } })).toMatchObject({ status: 'CANCELLED' });

    const invalid = await stripeOrder('CANCELLED');
    const successEvent = intentEvent('evt_feature19_invalid_transition', 'payment_intent.succeeded', invalid.reference, invalid.order.publicId, invalid.payment.paymentId, Number(invalid.payment.amount.toFixed(0)), 'succeeded');
    await expect(processStripeEvent(successEvent)).rejects.toBeInstanceOf(BusinessRuleError);
    expect(await prisma.stripeWebhookEvent.findUnique({ where: { eventId: successEvent.id } })).toBeNull();
  });

  it('rejects mismatched metadata, amounts, live-mode, and unsupported event types', async () => {
    const { order, payment, reference } = await stripeOrder();
    const wrongMetadata = intentEvent('evt_feature19_wrong_metadata', 'payment_intent.succeeded', reference, 'another_order', payment.paymentId, Number(payment.amount.toFixed(0)), 'succeeded');
    await expect(processStripeEvent(wrongMetadata)).rejects.toBeInstanceOf(ValidationError);

    const wrongAmount = intentEvent('evt_feature19_wrong_amount', 'payment_intent.succeeded', reference, order.publicId, payment.paymentId, 1, 'succeeded');
    await expect(processStripeEvent(wrongAmount)).rejects.toBeInstanceOf(ValidationError);

    const liveEvent = { ...wrongAmount, id: 'evt_feature19_live', livemode: true } as Stripe.Event;
    await expect(processStripeEvent(liveEvent)).rejects.toBeInstanceOf(ValidationError);

    const unsupported = { ...wrongAmount, id: 'evt_feature19_unsupported', type: 'customer.created' } as Stripe.Event;
    await expect(processStripeEvent(unsupported)).rejects.toBeInstanceOf(ValidationError);
  });
});
