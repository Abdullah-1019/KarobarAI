import type Stripe from 'stripe';

import { config } from '../../src/core/config';
import { PaymentGatewayUnavailableError, PaymentOutcomeUncertainError, ValidationError } from '../../src/core/errors/AppError';
import { prisma } from '../../src/core/prisma';
import { CODAdapter } from '../../src/modules/payment/cod.adapter';
import { EasyPaisaAdapter, JazzCashAdapter } from '../../src/modules/payment/local-gateway.adapter';
import { getPaymentGatewayAdapter } from '../../src/modules/payment/payment.factory';
import { STRIPE_CURRENCY, StripeAdapter, stripeTestCredentialsReady, toStripeDisplayAmountUsd, toStripeMinorUnits } from '../../src/modules/payment/stripe.adapter';
import { checkoutSchema } from '../../src/modules/order/checkout.dto';

const createIntent = jest.fn();
const retrieveIntent = jest.fn();
const createRefund = jest.fn();
const cancelIntent = jest.fn();
const fakeStripe = {
  paymentIntents: { create: createIntent, retrieve: retrieveIntent, cancel: cancelIntent },
  refunds: { create: createRefund },
} as unknown as Stripe;

const originalStripeConfig = { ...config.stripe };

beforeEach(() => {
  Object.assign(config.stripe, {
    secretKey: 'sk_test_feature19',
    publishableKey: 'pk_test_feature19',
    webhookSecret: 'whsec_feature19',
  });
  createIntent.mockReset();
  retrieveIntent.mockReset();
  createRefund.mockReset();
  cancelIntent.mockReset();
});

afterAll(() => Object.assign(config.stripe, originalStripeConfig));

describe('Feature 19 payment adapters', () => {
  it('selects the correct shared adapter for all four payment methods', () => {
    expect(getPaymentGatewayAdapter('COD')).toBeInstanceOf(CODAdapter);
    expect(getPaymentGatewayAdapter('STRIPE')).toBeInstanceOf(StripeAdapter);
    expect(getPaymentGatewayAdapter('JAZZCASH')).toBeInstanceOf(JazzCashAdapter);
    expect(getPaymentGatewayAdapter('EASYPAISA')).toBeInstanceOf(EasyPaisaAdapter);
  });

  it('keeps COD pending without claiming cash was received', async () => {
    const result = await new CODAdapter().initiate({ orderId: 'order_1', paymentId: '1', amountPkr: '150.00' });
    expect(result).toEqual({ paymentReference: null });
    expect(await new CODAdapter().confirm('')).toBe('PENDING');
  });

  it('maps PKR amounts to USD cents using the documented 100 PKR = USD 1 conversion', () => {
    expect(toStripeMinorUnits('100.00')).toBe(100);
    expect(toStripeMinorUnits('150.49')).toBe(150);
    expect(toStripeMinorUnits('150.50')).toBe(151);
    expect(() => toStripeMinorUnits('0')).toThrow(ValidationError);
  });

  it('formats the exact converted USD amount shown before Stripe confirmation', () => {
    expect(toStripeDisplayAmountUsd('100.00')).toBe('1.00');
    expect(toStripeDisplayAmountUsd('150.50')).toBe('1.51');
    expect(toStripeDisplayAmountUsd('12345.00')).toBe('123.45');
  });

  it('does not accept a client-supplied amount as part of checkout input', () => {
    const parsed = checkoutSchema.safeParse({ addressId: '12', paymentMethod: 'STRIPE', amount: 1 });
    expect(parsed.success).toBe(false);
  });

  it('creates a real Stripe SDK PaymentIntent from server-derived order data and an idempotency key', async () => {
    createIntent.mockResolvedValue({ id: 'pi_test_123', client_secret: 'pi_test_123_secret_demo' });
    const adapter = new StripeAdapter('sk_test_feature19', fakeStripe);
    const result = await adapter.initiate({ orderId: 'order_public', paymentId: '44', amountPkr: '100.00' }, 'intent-idempotency');

    expect(createIntent).toHaveBeenCalledWith(expect.objectContaining({
      amount: 100,
      currency: STRIPE_CURRENCY,
      metadata: expect.objectContaining({ orderId: 'order_public', paymentId: '44', currencyPolicy: 'PKR_100_PER_USD_1' }),
    }), { idempotencyKey: 'intent-idempotency' });
    expect(result).toEqual({ paymentReference: 'pi_test_123', clientSecret: 'pi_test_123_secret_demo' });
  });

  it('resumes an old referenced intent without creating another and validates its order data', async () => {
    retrieveIntent.mockResolvedValue({
      id: 'pi_existing', livemode: false, status: 'requires_payment_method',
      client_secret: 'pi_existing_secret', amount: 100, currency: 'usd',
      metadata: { orderId: 'order_public', paymentId: '44' },
    });
    const adapter = new StripeAdapter('sk_test_feature19', fakeStripe);
    await expect(adapter.resume({ orderId: 'order_public', paymentId: '44', amountPkr: '100.00' }, 'pi_existing'))
      .resolves.toEqual({ paymentReference: 'pi_existing', clientSecret: 'pi_existing_secret' });
    expect(retrieveIntent).toHaveBeenCalledWith('pi_existing');
    expect(createIntent).not.toHaveBeenCalled();

    retrieveIntent.mockResolvedValueOnce({
      id: 'pi_existing', livemode: false, status: 'succeeded', client_secret: 'pi_existing_secret',
      amount: 100, currency: 'usd', metadata: { orderId: 'order_public', paymentId: '44' },
    });
    await expect(adapter.resume({ orderId: 'order_public', paymentId: '44', amountPkr: '100.00' }, 'pi_existing'))
      .rejects.toBeInstanceOf(PaymentOutcomeUncertainError);
  });

  it('maps only event-consistent Stripe payment states and rejects mismatched references', async () => {
    const adapter = new StripeAdapter('sk_test_feature19', fakeStripe);
    const event = {
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_123', status: 'succeeded' } },
    } as unknown as Stripe.Event;
    expect(await adapter.confirm('pi_test_123', event)).toBe('CONFIRMED');
    await expect(adapter.confirm('pi_other', event)).rejects.toThrow(ValidationError);
  });

  it('validates refunds, uses the provider idempotency key, and never reports a pending refund as successful', async () => {
    createRefund.mockResolvedValue({ id: 're_test_1', status: 'succeeded' });
    const adapter = new StripeAdapter('sk_test_feature19', fakeStripe);
    await expect(adapter.refund('pi_test_123', '200.01', '200.00', 'refund-key')).rejects.toThrow(ValidationError);
    expect(createRefund).not.toHaveBeenCalled();

    expect(await adapter.refund('pi_test_123', '50.00', '200.00', 'refund-key')).toEqual({ success: true, refundReference: 're_test_1' });
    expect(createRefund).toHaveBeenCalledWith({ payment_intent: 'pi_test_123', amount: 50 }, { idempotencyKey: 'refund-key' });
    createRefund.mockResolvedValueOnce({ id: 're_pending', status: 'pending' });
    expect((await adapter.refund('pi_test_123', '50.00', '200.00', 'refund-pending')).success).toBe(false);
  });

  it('rejects absent or live-mode credentials', async () => {
    config.stripe.secretKey = 'sk_live_not_allowed';
    expect(stripeTestCredentialsReady()).toBe(false);
    expect(() => new StripeAdapter()).toThrow(PaymentGatewayUnavailableError);
  });

  it('returns a typed provider error when Stripe cannot create a PaymentIntent', async () => {
    createIntent.mockRejectedValueOnce(new Error('provider unavailable'));
    const adapter = new StripeAdapter('sk_test_feature19', fakeStripe);
    await expect(adapter.initiate({ orderId: 'order_public', paymentId: '44', amountPkr: '100.00' }, 'intent-failed')).rejects.toBeInstanceOf(PaymentOutcomeUncertainError);
  });

  it('classifies provider 4xx rejection as definitive but provider/network uncertainty as retryable', async () => {
    const adapter = new StripeAdapter('sk_test_feature19', fakeStripe);
    createIntent.mockRejectedValueOnce(Object.assign(new Error('invalid request'), { statusCode: 400 }));
    await expect(adapter.initiate({ orderId: 'order_public', paymentId: '44', amountPkr: '100.00' }, 'intent-rejected'))
      .rejects.toBeInstanceOf(PaymentGatewayUnavailableError);
    createIntent.mockRejectedValueOnce(Object.assign(new Error('server error'), { statusCode: 500 }));
    await expect(adapter.initiate({ orderId: 'order_public', paymentId: '44', amountPkr: '100.00' }, 'intent-uncertain'))
      .rejects.toBeInstanceOf(PaymentOutcomeUncertainError);
  });

  it('does not swallow an unconfirmed PaymentIntent cancellation', async () => {
    cancelIntent.mockRejectedValueOnce(new Error('network failure'));
    const adapter = new StripeAdapter('sk_test_feature19', fakeStripe);
    await expect(adapter.cancel('pi_test_123')).rejects.toBeInstanceOf(PaymentOutcomeUncertainError);
  });

  it.each([
    ['JazzCash', new JazzCashAdapter(), 'jazzcash_enabled'],
    ['EasyPaisa', new EasyPaisaAdapter(), 'easypaisa_enabled'],
  ])('%s fails with a typed unavailable error while its PlatformConfig flag is disabled', async (_name, adapter, flagKey) => {
    const lookup = jest.spyOn(prisma.platformConfig, 'findUnique').mockResolvedValue({ value: false } as never);
    await expect(adapter.assertAvailable()).rejects.toThrow(PaymentGatewayUnavailableError);
    expect(lookup).toHaveBeenCalledWith({ where: { configKey: flagKey }, select: { value: true } });
    lookup.mockRestore();
  });

  it.each([
    ['JazzCash', new JazzCashAdapter(), 'jazzcash_enabled'],
    ['EasyPaisa', new EasyPaisaAdapter(), 'easypaisa_enabled'],
  ])('%s remains unavailable when its flag is on but credentials are missing', async (_name, adapter, flagKey) => {
    Object.assign(config.jazzCash, { merchantId: '', password: '', secretKey: '' });
    Object.assign(config.easyPaisa, { storeId: '', hashKey: '' });
    const lookup = jest.spyOn(prisma.platformConfig, 'findUnique').mockResolvedValue({ value: true } as never);
    await expect(adapter.assertAvailable()).rejects.toThrow(PaymentGatewayUnavailableError);
    expect(lookup).toHaveBeenCalledWith({ where: { configKey: flagKey }, select: { value: true } });
    lookup.mockRestore();
  });
});
