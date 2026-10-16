jest.mock('../../src/adapters/courier', () => ({
  getCourierAdapter: jest.fn(() => ({ getRate: jest.fn().mockResolvedValue({ fee: '10.00' }) })),
}));
jest.mock('../../src/core/crypto/fieldCipher', () => ({ encryptField: jest.fn((value: string) => value) }));
jest.mock('../../src/core/errors/AppError', () => jest.requireActual('../../src/core/errors/AppError'));
jest.mock('../../src/core/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));
jest.mock('../../src/core/prisma', () => ({
  prisma: {
    payment: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../../src/core/redis', () => ({ redis: { get: jest.fn(), set: jest.fn() } }));
jest.mock('../../src/modules/address/address.service', () => ({ getOwnedAddressForOrder: jest.fn() }));
jest.mock('../../src/modules/cart/cart.service', () => ({ getRawCart: jest.fn(), removeCartItems: jest.fn() }));
jest.mock('../../src/modules/catalog/catalog.service', () => ({ decrementStock: jest.fn(), restoreStock: jest.fn() }));
jest.mock('../../src/modules/chatbot/product-embedding.service', () => ({ enqueueProductEmbeddingSync: jest.fn() }));
jest.mock('../../src/modules/notification', () => ({ enqueueNotification: jest.fn() }));
jest.mock('../../src/modules/order/order.service', () => ({ confirmPayment: jest.fn() }));
jest.mock('../../src/modules/payment/payment.factory', () => ({ getPaymentGatewayAdapter: jest.fn() }));
jest.mock('../../src/modules/payment/payment.service', () => ({ assertCheckoutMethodAvailable: jest.fn() }));
jest.mock('../../src/modules/payment/stripe.adapter', () => ({ toStripeDisplayAmountUsd: jest.fn(() => '1.50') }));

import { PaymentAttemptFailedError, PaymentOutcomeUncertainError } from '../../src/core/errors/AppError';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { getRawCart, removeCartItems } from '../../src/modules/cart/cart.service';
import { decrementStock } from '../../src/modules/catalog/catalog.service';
import { getOwnedAddressForOrder } from '../../src/modules/address/address.service';
import { getPaymentGatewayAdapter } from '../../src/modules/payment/payment.factory';
import { processCheckout } from '../../src/modules/order/checkout.service';

const mockedPrisma = prisma as unknown as {
  payment: { findMany: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; updateMany: jest.Mock };
  $transaction: jest.Mock;
};
const mockedRedis = redis as unknown as { get: jest.Mock; set: jest.Mock };
const mockedGetRawCart = getRawCart as jest.Mock;
const mockedRemoveCartItems = removeCartItems as jest.Mock;
const mockedGetOwnedAddress = getOwnedAddressForOrder as jest.Mock;

function decimal(value: string) {
  return { toFixed: () => value, toString: () => value };
}

function attempt(key: string, overrides: Record<string, unknown> = {}) {
  return {
    paymentId: 9n,
    orderId: 17n,
    idempotencyKey: `${key}:seller-public-id`,
    method: 'STRIPE',
    status: 'PENDING',
    transactionRef: null,
    amount: decimal('150.00'),
    createdAt: new Date(),
    order: {
      publicId: 'order-public-id',
      status: 'PAYMENT_PENDING',
      paymentMethod: 'STRIPE',
      subtotal: decimal('150.00'),
      shippingFee: decimal('0.00'),
      totalAmount: decimal('150.00'),
      placedAt: new Date('2026-10-10T00:00:00.000Z'),
      seller: { storeName: 'Test Store', user: { publicId: 'seller-public-id' } },
      items: [{ productId: 22n, product: { publicId: 'product-public-id' }, titleSnapshot: 'Test item', unitPrice: decimal('150.00'), quantity: 1 }],
    },
    ...overrides,
  };
}

const adapter = {
  method: 'STRIPE',
  assertAvailable: jest.fn().mockResolvedValue(undefined),
  initiate: jest.fn(),
  resume: jest.fn(),
  cancel: jest.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
  jest.clearAllMocks();
  adapter.assertAvailable.mockReset().mockResolvedValue(undefined);
  adapter.initiate.mockReset();
  adapter.resume.mockReset();
  adapter.cancel.mockReset().mockResolvedValue(undefined);
  mockedRedis.get.mockResolvedValue(null);
  mockedRedis.set.mockResolvedValue('OK');
  mockedPrisma.payment.findMany.mockResolvedValue([]);
  mockedPrisma.payment.findFirst.mockResolvedValue(null);
  mockedPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
  mockedPrisma.payment.findUnique.mockReset();
  mockedPrisma.$transaction.mockReset();
  mockedGetRawCart.mockResolvedValue({ cartId: null, sellerGroups: [] });
  mockedRemoveCartItems.mockResolvedValue(undefined);
  mockedGetOwnedAddress.mockResolvedValue({ city: 'Test City', province: 'Test Province', recipientName: 'Buyer', line1: 'Address', line2: null, postalCode: null, contactPhone: 'test' });
  (getPaymentGatewayAdapter as jest.Mock).mockReturnValue(adapter);
});

describe('checkout idempotency recovery', () => {
  it('retries an uncertain attempt with the same Stripe idempotency key and reconciles one intent', async () => {
    const key = 'checkout-key-uncertain';
    const existing = attempt(key);
    mockedPrisma.payment.findMany.mockResolvedValue([existing]);
    adapter.initiate
      .mockRejectedValueOnce(new PaymentOutcomeUncertainError())
      .mockResolvedValueOnce({ paymentReference: 'pi_reconciled', clientSecret: 'pi_reconciled_secret' });

    await expect(processCheckout(1n, { addressId: '1', paymentMethod: 'STRIPE' }, key)).rejects.toBeInstanceOf(PaymentOutcomeUncertainError);
    const result = await processCheckout(1n, { addressId: '1', paymentMethod: 'STRIPE' }, key);

    expect(adapter.initiate).toHaveBeenCalledTimes(2);
    expect(adapter.initiate.mock.calls[0]?.[1]).toBe('stripe-payment-checkout-key-uncertain:seller-public-id');
    expect(adapter.initiate.mock.calls[1]?.[1]).toBe(adapter.initiate.mock.calls[0]?.[1]);
    expect(mockedPrisma.payment.updateMany).toHaveBeenCalledWith({
      where: { paymentId: 9n, status: 'PENDING', OR: [{ transactionRef: null }, { transactionRef: 'pi_reconciled' }] },
      data: { transactionRef: 'pi_reconciled' },
    });
    expect(result.orders[0]).toMatchObject({ paymentClientSecret: 'pi_reconciled_secret', paymentAmountUsd: '1.50' });
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns an actionable terminal error for the same key after definitive failure', async () => {
    const key = 'checkout-key-failed';
    mockedPrisma.payment.findMany.mockResolvedValue([attempt(key, {
      status: 'FAILED', order: { ...attempt(key).order, status: 'CANCELLED' },
    })]);

    await expect(processCheckout(1n, { addressId: '1', paymentMethod: 'STRIPE' }, key)).rejects.toBeInstanceOf(PaymentAttemptFailedError);
    expect(adapter.initiate).not.toHaveBeenCalled();
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('resumes the persisted Stripe attempt when a browser submits a new key', async () => {
    const originalKey = 'checkout-key-original';
    mockedPrisma.payment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ idempotencyKey: `${originalKey}:seller-public-id` }])
      .mockResolvedValueOnce([attempt(originalKey)]);
    mockedGetRawCart.mockResolvedValue({ cartId: null, sellerGroups: [] });
    adapter.initiate.mockResolvedValue({ paymentReference: 'pi_existing', clientSecret: 'pi_existing_secret' });

    const result = await processCheckout(1n, { addressId: '1', paymentMethod: 'STRIPE' }, 'different-user-attempt-key');

    expect(result.orders[0]?.paymentClientSecret).toBe('pi_existing_secret');
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    expect(adapter.initiate).toHaveBeenCalledTimes(1);
    expect(adapter.initiate).toHaveBeenCalledWith(
      { orderId: 'order-public-id', paymentId: '9', amountPkr: '150.00' },
      `stripe-payment-${originalKey}:seller-public-id`,
    );
  });

  it('fails closed when multiple unrelated Stripe checkouts are unresolved', async () => {
    mockedPrisma.payment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { idempotencyKey: 'checkout-key-one:seller-public-id' },
        { idempotencyKey: 'checkout-key-two:seller-public-id' },
      ]);

    await expect(processCheckout(1n, { addressId: '1', paymentMethod: 'STRIPE' }, 'new-checkout-key'))
      .rejects.toBeInstanceOf(PaymentOutcomeUncertainError);
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    expect(adapter.initiate).not.toHaveBeenCalled();
  });

  it('fails closed for an uncertain attempt older than Stripe idempotency retention', async () => {
    const key = 'checkout-key-expired-window';
    const oldAttempt = attempt(key, { createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });
    mockedPrisma.payment.findMany.mockResolvedValue([oldAttempt]);

    await expect(processCheckout(1n, { addressId: '1', paymentMethod: 'STRIPE' }, key))
      .rejects.toBeInstanceOf(PaymentOutcomeUncertainError);
    expect(adapter.initiate).not.toHaveBeenCalled();
  });

  it('retrieves a referenced old intent and ignores stale cached Stripe checkout data', async () => {
    const key = 'checkout-key-referenced';
    mockedRedis.get.mockResolvedValue(JSON.stringify({ orders: [{ status: 'PAYMENT_PENDING' }] }));
    mockedPrisma.payment.findMany.mockResolvedValue([attempt(key, {
      transactionRef: 'pi_existing', createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    })]);
    adapter.resume.mockResolvedValue({ paymentReference: 'pi_existing', clientSecret: 'pi_existing_secret' });

    const result = await processCheckout(1n, { addressId: '1', paymentMethod: 'STRIPE' }, key);

    expect(result.orders[0]?.paymentClientSecret).toBe('pi_existing_secret');
    expect(adapter.resume).toHaveBeenCalledTimes(1);
    expect(adapter.initiate).not.toHaveBeenCalled();
    expect(mockedRedis.get).not.toHaveBeenCalled();
  });

  it('returns the authoritative confirmed state if the webhook wins the reference race', async () => {
    const key = 'checkout-key-early-webhook';
    mockedPrisma.payment.findMany.mockResolvedValue([attempt(key)]);
    mockedPrisma.payment.updateMany.mockResolvedValueOnce({ count: 0 });
    mockedPrisma.payment.findUnique.mockResolvedValue({
      status: 'CONFIRMED', transactionRef: 'pi_early', order: { status: 'PAYMENT_CONFIRMED' },
    });
    adapter.initiate.mockResolvedValue({ paymentReference: 'pi_early', clientSecret: 'pi_early_secret' });

    const result = await processCheckout(1n, { addressId: '1', paymentMethod: 'STRIPE' }, key);

    expect(result.orders[0]).toMatchObject({ status: 'PAYMENT_CONFIRMED', paymentStatus: 'CONFIRMED' });
    expect(result.orders[0]?.paymentClientSecret).toBeUndefined();
    expect(adapter.initiate).toHaveBeenCalledTimes(1);
  });

  it('blocks COD while a different Stripe checkout is pending', async () => {
    mockedPrisma.payment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ idempotencyKey: 'old-stripe-key:seller-public-id' }]);

    await expect(processCheckout(1n, { addressId: '1', paymentMethod: 'COD' }, 'new-cod-key'))
      .rejects.toBeInstanceOf(PaymentOutcomeUncertainError);
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechecks pending Stripe payments under the buyer lock before reserving inventory', async () => {
    mockedPrisma.payment.findMany.mockResolvedValue([]);
    mockedGetRawCart.mockResolvedValue({ cartId: 1n, sellerGroups: [{
      eligibleForCheckout: true, sellerPublicId: 'seller-public-id', sellerId: 2n,
      storeName: 'Test Store', items: [], subtotal: decimal('150.00'),
    }] });
    const queryRaw = jest.fn().mockResolvedValue([]);
    mockedPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $queryRaw: queryRaw,
      payment: { findFirst: jest.fn().mockResolvedValue({ paymentId: 9n }) },
    }));

    await expect(processCheckout(1n, { addressId: '1', paymentMethod: 'STRIPE' }, 'new-checkout-key'))
      .rejects.toBeInstanceOf(PaymentOutcomeUncertainError);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(decrementStock).not.toHaveBeenCalled();
    expect(adapter.initiate).not.toHaveBeenCalled();
  });

  it('reconciles a duplicate-key race against the persisted attempt instead of retrying row creation', async () => {
    const key = 'checkout-key-race';
    const existing = attempt(key);
    mockedPrisma.payment.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([existing]);
    mockedPrisma.payment.findFirst.mockResolvedValue(null);
    mockedGetRawCart.mockResolvedValueOnce({
      cartId: 1n,
      sellerGroups: [{ eligibleForCheckout: true, sellerPublicId: 'seller-public-id', sellerId: 2n, storeName: 'Test Store', items: [], subtotal: decimal('150.00') }],
    });
    mockedGetRawCart.mockResolvedValueOnce({ cartId: null, sellerGroups: [] });
    mockedPrisma.$transaction.mockRejectedValue({ code: 'P2002', meta: { target: ['idempotency_key'] } });
    adapter.initiate.mockResolvedValue({ paymentReference: 'pi_race', clientSecret: 'pi_race_secret' });

    const result = await processCheckout(1n, { addressId: '1', paymentMethod: 'STRIPE' }, key);

    expect(result.orders[0]?.paymentClientSecret).toBe('pi_race_secret');
    expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(adapter.initiate).toHaveBeenCalledTimes(1);
    expect(mockedRemoveCartItems).toHaveBeenCalledWith([]);
  });

  it('does not turn a P2002 on another unique field into an idempotent payment retry', async () => {
    const key = 'checkout-key-other-unique';
    mockedPrisma.payment.findMany.mockResolvedValueOnce([]);
    mockedPrisma.payment.findFirst.mockResolvedValue(null);
    mockedGetRawCart.mockResolvedValue({ cartId: 1n, sellerGroups: [{
      eligibleForCheckout: true, sellerPublicId: 'seller-public-id', sellerId: 2n, storeName: 'Test Store', items: [], subtotal: decimal('150.00'),
    }] });
    mockedPrisma.$transaction.mockRejectedValue({ code: 'P2002', meta: { target: ['public_id'] } });

    await expect(processCheckout(1n, { addressId: '1', paymentMethod: 'STRIPE' }, key)).rejects.toMatchObject({ code: 'P2002' });
    expect(adapter.initiate).not.toHaveBeenCalled();
  });
});
