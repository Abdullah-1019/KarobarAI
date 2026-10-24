import type { CheckoutResultDTO, CreatedOrderDTO } from '@karobarai/shared';
import { Prisma } from '@prisma/client';

import { getCourierAdapter } from '../../adapters/courier';
import { encryptField } from '../../core/crypto/fieldCipher';
import { BusinessRuleError, ConflictError, PaymentAttemptFailedError, PaymentGatewayUnavailableError, PaymentOutcomeUncertainError, ValidationError } from '../../core/errors/AppError';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';
import { redis } from '../../core/redis';
import { getOwnedAddressForOrder } from '../address/address.service';
import { assertCheckoutMethodAvailable } from '../payment/payment.service';
import { getPaymentGatewayAdapter } from '../payment/payment.factory';
import { toStripeDisplayAmountUsd } from '../payment/stripe.adapter';
import { getRawCart, removeCartItems, type RawSellerGroup } from '../cart/cart.service';
import { decrementStock, restoreStock } from '../catalog/catalog.service';
import { enqueueProductEmbeddingSync } from '../chatbot/product-embedding.service';
import { enqueueNotification } from '../notification';
import type { CheckoutInput } from './checkout.dto';
import { confirmPayment } from './order.service';

// Feature 6 Task 7 — the checkout-creation slice of the order/ module (TRD §12's folder note:
// lifecycle/state-machine transitions past this point are Feature 7's scope). No
// order.repository.ts, consistent with the no-repository-layer convention (Feature 4/6).

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24; // 24h — long enough to cover any reasonable retry window
// Stripe may prune idempotency keys after 24 hours. Stop automatic retries with margin before
// that boundary; an older unresolved attempt needs provider reconciliation, never a fresh intent.
const STRIPE_IDEMPOTENCY_SAFE_WINDOW_MS = 23 * 60 * 60 * 1000;

const CHECKOUT_ATTEMPT_INCLUDE = {
  order: {
    include: {
      seller: { include: { user: { select: { publicId: true } } } },
      items: { include: { product: { select: { publicId: true } } } },
    },
  },
} satisfies Prisma.PaymentInclude;

type CheckoutAttemptPayment = Prisma.PaymentGetPayload<{ include: typeof CHECKOUT_ATTEMPT_INCLUDE }>;

function idempotencyRedisKey(buyerId: bigint, key: string): string {
  return `idempotency:checkout:${buyerId}:${key}`;
}

function isPaymentIdempotencyConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error) || (error as { code?: unknown }).code !== 'P2002') return false;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  return Array.isArray(target)
    ? target.some((field) => field === 'idempotency_key' || field === 'idempotencyKey')
    : typeof target === 'string' && /idempotency_key|idempotencyKey/.test(target);
}

async function findCheckoutAttempt(buyerId: bigint, idempotencyKey: string): Promise<CheckoutAttemptPayment[]> {
  const payments = await prisma.payment.findMany({
    where: { idempotencyKey: { startsWith: `${idempotencyKey}:` }, order: { buyerId } },
    include: CHECKOUT_ATTEMPT_INCLUDE,
    orderBy: { paymentId: 'asc' },
  });
  return payments.filter((payment) => payment.idempotencyKey.slice(0, payment.idempotencyKey.lastIndexOf(':')) === idempotencyKey);
}

function toCreatedOrder(payment: CheckoutAttemptPayment): CreatedOrderDTO {
  const order = payment.order;
  return {
    id: order.publicId,
    sellerId: order.seller.user.publicId,
    storeName: order.seller.storeName,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: payment.status,
    subtotal: order.subtotal.toFixed(2),
    shippingFee: order.shippingFee.toFixed(2),
    totalAmount: order.totalAmount.toFixed(2),
    items: order.items.map((item) => ({
      productId: item.product.publicId,
      titleSnapshot: item.titleSnapshot,
      variantLabel: item.variantLabel,
      unitPrice: item.unitPrice.toFixed(2),
      quantity: item.quantity,
    })),
    placedAt: order.placedAt.toISOString(),
  };
}

async function cacheCheckoutResult(cacheKey: string, result: CheckoutResultDTO): Promise<void> {
  await redis
    .set(cacheKey, JSON.stringify(result), 'EX', IDEMPOTENCY_TTL_SECONDS)
    .catch((err) => logger.warn({ err }, 'Failed to cache idempotent checkout result (non-fatal)'));
}

async function recordStripeReference(paymentId: bigint, reference: string): Promise<boolean> {
  const updated = await prisma.payment.updateMany({
    where: {
      paymentId,
      status: 'PENDING',
      OR: [{ transactionRef: null }, { transactionRef: reference }],
    },
    data: { transactionRef: reference },
  });
  if (updated.count === 1) return false;
  // A signed webhook may have confirmed the payment before checkout saved its reference.
  const latest = await prisma.payment.findUnique({
    where: { paymentId },
    select: { status: true, transactionRef: true, order: { select: { status: true } } },
  });
  if (latest?.status === 'CONFIRMED' && latest.transactionRef === reference && latest.order.status === 'PAYMENT_CONFIRMED') {
    return true;
  }
  throw new PaymentOutcomeUncertainError('Stripe payment state changed during checkout. Check the order before paying again.');
}

async function resumeCheckoutAttempt(
  buyerId: bigint,
  input: CheckoutInput,
  cacheKey: string,
  payments: CheckoutAttemptPayment[],
): Promise<CheckoutResultDTO> {
  if (payments.some((payment) => payment.method !== input.paymentMethod)) {
    throw new ConflictError('This checkout key was already used for a different payment method.', undefined, 'IDEMPOTENCY_KEY_CONFLICT');
  }

  if (payments.every((payment) => payment.status === 'FAILED' || payment.status === 'CANCELLED')
    && payments.every((payment) => payment.order.status === 'CANCELLED')) {
    throw new PaymentAttemptFailedError();
  }

  const terminal = payments.some((payment) => payment.status === 'FAILED' || payment.status === 'CANCELLED'
    || payment.order.status === 'CANCELLED');
  const resumable = payments.every((payment) => payment.status === 'PENDING' || payment.status === 'CONFIRMED')
    && payments.every((payment) => payment.order.status === 'PAYMENT_PENDING' || payment.order.status === 'PAYMENT_CONFIRMED');
  if (terminal || !resumable) {
    throw new PaymentOutcomeUncertainError('This checkout has an unresolved payment state. Retry with its original key so it can be reconciled.');
  }

  if (input.paymentMethod === 'COD') {
    for (const payment of payments) {
      if (payment.order.status === 'PAYMENT_PENDING') {
        try {
          await confirmPayment(payment.orderId);
        } catch (error) {
          // A concurrent same-key request may have completed this idempotent transition first.
          const latest = await prisma.order.findUnique({ where: { orderId: payment.orderId }, select: { status: true } });
          if (latest?.status !== 'PAYMENT_CONFIRMED') throw error;
        }
        payment.order.status = 'PAYMENT_CONFIRMED';
      }
    }
  }

  const orders = payments.map(toCreatedOrder);
  if (input.paymentMethod === 'STRIPE') {
    const adapter = getPaymentGatewayAdapter('STRIPE');
    await adapter.assertAvailable();
    for (let index = 0; index < payments.length; index++) {
      const payment = payments[index];
      const order = orders[index];
      if (!payment || !order || payment.status !== 'PENDING') continue;
      if (!payment.transactionRef && Date.now() - payment.createdAt.getTime() >= STRIPE_IDEMPOTENCY_SAFE_WINDOW_MS) {
        throw new PaymentOutcomeUncertainError('This payment attempt is too old to retry safely. It must be reconciled before a new checkout can start.');
      }
      try {
        const providerInput = { orderId: payment.order.publicId, paymentId: payment.paymentId.toString(), amountPkr: payment.amount.toString() };
        // Once the reference is persisted, retrieve that intent directly. Stripe can prune the
        // original create key after 24 hours, so replaying create() would risk a second intent.
        if (payment.transactionRef && !adapter.resume) {
          throw new PaymentOutcomeUncertainError('The existing Stripe payment cannot be safely resumed.');
        }
        const result = payment.transactionRef
          ? await adapter.resume!(providerInput, payment.transactionRef)
          : await adapter.initiate(providerInput, `stripe-payment-${payment.idempotencyKey}`);
        if (!result.paymentReference) throw new PaymentOutcomeUncertainError();
        const confirmed = await recordStripeReference(payment.paymentId, result.paymentReference);
        if (confirmed) {
          order.status = 'PAYMENT_CONFIRMED';
          order.paymentStatus = 'CONFIRMED';
          continue;
        }
        if (!result.clientSecret) throw new PaymentOutcomeUncertainError();
        order.paymentClientSecret = result.clientSecret;
        order.paymentAmountUsd = toStripeDisplayAmountUsd(payment.amount);
      } catch (error) {
        if (error instanceof PaymentOutcomeUncertainError) throw error;
        // A repeat with the same provider key is safe, but do not switch to a new key when
        // Stripe's response is ambiguous.
        if (error instanceof PaymentGatewayUnavailableError) {
          await cancelAndFailCheckoutAttempt(payments);
          throw new PaymentAttemptFailedError();
        }
        throw error;
      }
    }
  }

  // The original request only removes the exact rows checked out. After an uncertain response,
  // remove them on reconciliation only if those same product/quantity lines are still present.
  const currentCart = await getRawCart(buyerId);
  const expected = new Map(payments.flatMap((payment) => payment.order.items.map((item) => [item.productId.toString(), item.quantity] as const)));
  const consumedCartItemIds = currentCart.sellerGroups.flatMap((group) => group.items
    .filter((item) => expected.get(item.productId.toString()) === item.quantity)
    .map((item) => item.cartItemId));
  await removeCartItems(consumedCartItemIds);

  const result: CheckoutResultDTO = { orders };
  await notifyOrdersPlaced(buyerId, orders);
  if (input.paymentMethod !== 'STRIPE') await cacheCheckoutResult(cacheKey, result);
  return result;
}

// One ORDER_PLACED to the buyer and one SELLER_NEW_ORDER to each order's seller, after the
// transaction commits. Enqueue failures never fail the checkout, and each job is independent;
// the job ids keep a retried checkout from notifying anyone twice.
async function notifyOrdersPlaced(buyerId: bigint, orders: CreatedOrderDTO[]): Promise<void> {
  const sellers = await prisma.order.findMany({
    where: { publicId: { in: orders.map((order) => order.id) } },
    select: { publicId: true, sellerId: true, orderNumber: true },
  }).catch((err) => {
    logger.error({ err }, 'Failed to resolve sellers for new-order notifications');
    return [];
  });
  await Promise.allSettled([
    ...orders.map((order) => enqueueNotification({
      userId: buyerId.toString(), type: 'ORDER_PLACED', orderId: order.id, vars: { orderId: order.id },
    }, `order-placed-${order.id}`)),
    ...sellers.map((order) => enqueueNotification({
      userId: order.sellerId.toString(), type: 'SELLER_NEW_ORDER', orderId: order.publicId,
      vars: { orderId: order.publicId, orderNumber: order.orderNumber.toString() },
    }, `seller-new-order-${order.publicId}`)),
  ]);
}

async function cancelAndFailCheckoutAttempt(payments: CheckoutAttemptPayment[]): Promise<void> {
  const adapter = getPaymentGatewayAdapter('STRIPE');
  try {
    for (const payment of payments) {
      if (payment.transactionRef) await adapter.cancel?.(payment.transactionRef);
    }
  } catch {
    // A failed cancellation is not a definitive terminal state. Keep DB records pending so a
    // same-key retry reconciles the existing PaymentIntent instead of creating another one.
    throw new PaymentOutcomeUncertainError('Stripe cancellation is not confirmed. Retry with the same checkout key.');
  }
  for (const payment of payments) await confirmCancellationAfterPaymentFailure(payment.orderId);
}

// Create the order's pending payment record in the checkout transaction. Provider calls happen
// after commit so an external API request never holds the inventory/order transaction open.
async function createPaymentRow(
  tx: Prisma.TransactionClient,
  orderId: bigint,
  amount: Prisma.Decimal,
  method: CheckoutInput['paymentMethod'],
  idempotencyKey: string,
) {
  return tx.payment.create({
    data: {
      orderId,
      method,
      gateway: method === 'STRIPE' ? 'stripe' : null,
      status: 'PENDING',
      amount,
      idempotencyKey,
    },
  });
}

// Task 6 — a single representative shipping-fee estimate per seller group (Gap #1), never the
// full parallel-scoring algorithm (Feature 7's Order Detail/booking concern). Exactly one
// getRate() call per eligible seller group, not three.
async function getShippingFeesByGroup(
  groups: RawSellerGroup[],
  destinationCity: string,
  destinationProvince: string,
): Promise<Map<string, Prisma.Decimal>> {
  const courierAdapter = getCourierAdapter();
  const fees = new Map<string, Prisma.Decimal>();

  for (const group of groups) {
    // eslint-disable-next-line no-await-in-loop -- one adapter call per seller group, sequential is fine at checkout scale
    const rate = await courierAdapter.getRate({ destinationCity, destinationProvince });
    fees.set(group.sellerPublicId, new Prisma.Decimal(rate.fee));
  }

  return fees;
}

export async function processCheckout(
  buyerId: bigint,
  input: CheckoutInput,
  idempotencyKey: string,
): Promise<CheckoutResultDTO> {
  // Task 7.2/8.2 — checked before any work begins; resubmitting the identical (buyer,
  // idempotency-key) pair returns the original result verbatim, never a second order set.
  const cacheKey = idempotencyRedisKey(buyerId, idempotencyKey);
  // Stripe status can change by webhook after checkout. A cached pending response would expose
  // an obsolete client secret and stale payment status after confirmation or cancellation.
  const cached = input.paymentMethod === 'STRIPE' ? null : await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as CheckoutResultDTO;
  }

  const priorAttempt = await findCheckoutAttempt(buyerId, idempotencyKey);
  if (priorAttempt.length > 0) {
    return resumeCheckoutAttempt(buyerId, input, cacheKey, priorAttempt);
  }

  // Fail unsupported gateway selections before stock is decremented or orders are created.
  await assertCheckoutMethodAvailable(input.paymentMethod);

  {
    const unresolvedAttempts = await prisma.payment.findMany({
      where: { method: 'STRIPE', status: 'PENDING', order: { buyerId } },
      select: { idempotencyKey: true },
      orderBy: { createdAt: 'asc' },
    });
    if (unresolvedAttempts.length > 0) {
      if (input.paymentMethod !== 'STRIPE') {
        throw new PaymentOutcomeUncertainError('A Stripe checkout is still pending. Finish or reconcile it before starting another order.');
      }
      // The browser can lose its session storage after the order/PaymentIntent has been created.
      // Recover the persisted checkout key and ask Stripe for the same intent using its stable
      // provider idempotency key; never create a second payment just because the browser generated
      // a new request key. Multiple unrelated pending checkouts cannot be safely auto-selected.
      const checkoutKeys = new Set(unresolvedAttempts.map(({ idempotencyKey }) => {
        const separator = idempotencyKey.lastIndexOf(':');
        return separator > 0 ? idempotencyKey.slice(0, separator) : null;
      }));
      if (checkoutKeys.size !== 1 || checkoutKeys.has(null)) {
        throw new PaymentOutcomeUncertainError('More than one unresolved Stripe checkout exists. Contact support before starting another payment.');
      }
      const [existingCheckoutKey] = checkoutKeys;
      if (typeof existingCheckoutKey !== 'string') {
        throw new PaymentOutcomeUncertainError('The pending Stripe checkout cannot be safely resumed. Contact support before starting another payment.');
      }
      const persistedAttempt = await findCheckoutAttempt(buyerId, existingCheckoutKey);
      if (persistedAttempt.length === 0) {
        throw new PaymentOutcomeUncertainError('The pending Stripe checkout could not be reconciled. Contact support before starting another payment.');
      }
      return resumeCheckoutAttempt(
        buyerId,
        input,
        idempotencyRedisKey(buyerId, existingCheckoutKey),
        persistedAttempt,
      );
    }
  }

  const rawCart = await getRawCart(buyerId);
  const eligibleGroups = rawCart.sellerGroups.filter((g) => g.eligibleForCheckout);
  if (eligibleGroups.length === 0) {
    throw new BusinessRuleError(
      'No eligible items to checkout — resolve stock conflicts or below-minimum groups first',
      undefined,
      'CHECKOUT_NOT_ELIGIBLE',
    );
  }

  const addressId = BigInt(input.addressId);
  const address = await getOwnedAddressForOrder(buyerId, addressId);
  // Should be unreachable — createAddressSchema requires contactPhone — but orders.ship_phone is
  // NOT NULL, so this is a hard stop rather than ever writing an empty ciphertext. Narrowed into
  // its own const (not just an `if` on address.contactPhone) so the transaction closure below
  // sees a definite `string`, not `string | null`.
  const contactPhone = address.contactPhone;
  if (!contactPhone) {
    throw new ValidationError('Selected address has no contact phone on file', undefined, 'VALIDATION_ERROR');
  }

  const shippingFees = await getShippingFeesByGroup(eligibleGroups, address.city, address.province);

  const createdOrders: CreatedOrderDTO[] = [];
  const purchasedCartItemIds: bigint[] = [];
  // Parallel to createdOrders (same index) — carries the internal bigint orderId + payment
  // method the post-commit confirmPayment step below needs; CreatedOrderDTO itself only exposes
  // the public order id.
  const createdOrderRefs: Array<{
    orderId: bigint;
    orderPublicId: string;
    paymentId: bigint;
    paymentIdempotencyKey: string;
    amount: Prisma.Decimal;
    paymentMethod: CheckoutInput['paymentMethod'];
    paymentReference?: string;
  }> = [];

  // One transaction, N orders, all-or-nothing (Task 7.3/7.4) — a partial failure (order created,
  // stock not decremented, or vice versa) would violate Schema §0's ACID guarantee.
  try {
    await prisma.$transaction(async (tx) => {
    // Serialize checkout transactions for this buyer. The second request rechecks persisted
    // payments after acquiring the lock, before reserving any stock or creating an order.
    await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${buyerId} FOR UPDATE`;
    const concurrentStripeAttempt = await tx.payment.findFirst({
      where: { method: 'STRIPE', status: 'PENDING', order: { buyerId } },
      select: { paymentId: true },
    });
    if (concurrentStripeAttempt) {
      throw new PaymentOutcomeUncertainError('An existing Stripe checkout must be resumed before starting another order.');
    }
    await tx.$queryRaw`SELECT ci.cart_item_id FROM cart_items ci JOIN carts c ON c.cart_id = ci.cart_id WHERE c.buyer_id = ${buyerId} FOR UPDATE OF ci`;
    const expectedItems = eligibleGroups.flatMap((group) => group.items);
    const persistedItems = await tx.cartItem.findMany({
      where: { cartItemId: { in: expectedItems.map((item) => item.cartItemId) }, cart: { buyerId } },
      select: { cartItemId: true, productId: true, variantId: true, quantity: true,
        product: { select: { category: { select: { slug: true } } } } },
    });
    if (persistedItems.length !== expectedItems.length || expectedItems.some((item) => {
      const current = persistedItems.find((row) => row.cartItemId === item.cartItemId);
      return !current || current.productId !== item.productId || current.quantity !== item.quantity
        || (current.variantId ?? null) !== item.variantId;
    })) {
      throw new ConflictError('The cart changed while placing the order. Review it and try again.', undefined, 'CHECKOUT_CART_CHANGED');
    }
    for (const group of eligibleGroups) {
      // Final re-validation, inside the transaction, closes the race window between "viewed
      // cart" (moments earlier, outside this transaction) and "clicked place order."
      for (const item of group.items) {
        // eslint-disable-next-line no-await-in-loop -- stock decrements must serialize per product within this transaction
        await decrementStock(item.productId, item.quantity, tx, item.variantId);
      }

      const seller = await tx.sellerProfile.findUniqueOrThrow({ where: { userId: group.sellerId } });
      const shippingFee = shippingFees.get(group.sellerPublicId) ?? new Prisma.Decimal(0);
      const totalAmount = group.subtotal.plus(shippingFee);

      const order = await tx.order.create({
        data: {
          buyerId,
          sellerId: group.sellerId,
          status: 'PAYMENT_PENDING',
          paymentMethod: input.paymentMethod,
          subtotal: group.subtotal,
          shippingFee,
          totalAmount,
          // Schema §4.6/§4.3: a per-seller override of the platform default — the seller's
          // actual rate at order time, never platform_config's default value.
          commissionRateSnapshot: seller.commissionRate,
          shipName: address.recipientName,
          shipLine1: encryptField(address.line1),
          shipLine2: address.line2 ? encryptField(address.line2) : null,
          shipCity: address.city,
          shipProvince: address.province,
          shipPostal: address.postalCode,
          shipPhone: encryptField(contactPhone),
        },
      });

      await tx.orderItem.createMany({
        data: group.items.map((item) => ({
          orderId: order.orderId,
          productId: item.productId,
          titleSnapshot: item.titleEn,
          categorySlugSnapshot: persistedItems.find((row) => row.cartItemId === item.cartItemId)?.product.category?.slug ?? null,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          variantId: item.variantId,
          variantLabel: item.variantLabel,
        })),
      });

      // Per-order idempotency key derived from the client's header key — payments.idempotency_key
      // is unique per row (1:1 with an order), so a multi-seller checkout needs one distinct
      // derived key per order while still tracing back to the single client-supplied key.
      const paymentIdempotencyKey = `${idempotencyKey}:${group.sellerPublicId}`;
      const payment = await createPaymentRow(
        tx,
        order.orderId,
        totalAmount,
        input.paymentMethod,
        paymentIdempotencyKey,
      );

      createdOrders.push({
        id: order.publicId,
        sellerId: group.sellerPublicId,
        storeName: group.storeName,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: payment.status,
        subtotal: group.subtotal.toFixed(2),
        shippingFee: shippingFee.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        items: group.items.map((item) => ({
          productId: item.productPublicId,
          titleSnapshot: item.titleEn,
          variantLabel: item.variantLabel,
          unitPrice: item.unitPrice.toFixed(2),
          quantity: item.quantity,
        })),
        placedAt: order.placedAt.toISOString(),
      });
      createdOrderRefs.push({
        orderId: order.orderId,
        orderPublicId: order.publicId,
        paymentId: payment.paymentId,
        paymentIdempotencyKey,
        amount: totalAmount,
        paymentMethod: input.paymentMethod,
      });

      purchasedCartItemIds.push(...group.items.map((item) => item.cartItemId));
    }
    // COD is accepted when this transaction commits. Remove its purchased cart lines before
    // releasing the buyer lock so a concurrent request cannot create the same order again.
    if (input.paymentMethod === 'COD') await removeCartItems(purchasedCartItemIds, tx);
    });
  } catch (error) {
    if (error instanceof ConflictError && error.code === 'CHECKOUT_CART_CHANGED') {
      const racedAttempt = await findCheckoutAttempt(buyerId, idempotencyKey);
      if (racedAttempt.length > 0) return resumeCheckoutAttempt(buyerId, input, cacheKey, racedAttempt);
    }
    if (error instanceof PaymentOutcomeUncertainError && input.paymentMethod === 'STRIPE') {
      const racedAttempt = await findCheckoutAttempt(buyerId, idempotencyKey);
      if (racedAttempt.length > 0) return resumeCheckoutAttempt(buyerId, input, cacheKey, racedAttempt);
    }
    if (!isPaymentIdempotencyConflict(error)) throw error;
    // A concurrent request may have committed this key after our initial lookup. Reconcile that
    // persisted attempt; never catch P2002 and blindly create a different payment.
    const racedAttempt = await findCheckoutAttempt(buyerId, idempotencyKey);
    if (racedAttempt.length > 0) return resumeCheckoutAttempt(buyerId, input, cacheKey, racedAttempt);
    throw new ConflictError('This checkout key is already in use. Start checkout again to create a new attempt.', undefined, 'IDEMPOTENCY_KEY_CONFLICT');
  }

  for (const productId of new Set(eligibleGroups.flatMap((group) => group.items.map((item) => item.productId)))) {
    await enqueueProductEmbeddingSync(productId).catch((err) =>
      logger.error({ err, productId: productId.toString() }, 'Failed to enqueue checked-out product embedding'),
    );
  }

  if (input.paymentMethod === 'STRIPE') {
    const adapter = getPaymentGatewayAdapter('STRIPE');
    for (let index = 0; index < createdOrderRefs.length; index++) {
      const ref = createdOrderRefs[index];
      const createdOrder = createdOrders[index];
      if (!ref || !createdOrder) continue;
      try {
        const result = await adapter.initiate(
          { orderId: ref.orderPublicId, paymentId: ref.paymentId.toString(), amountPkr: ref.amount.toString() },
          `stripe-payment-${ref.paymentIdempotencyKey}`,
        );
        ref.paymentReference = result.paymentReference ?? undefined;
        if (!result.paymentReference) {
          throw new PaymentOutcomeUncertainError('Stripe returned an incomplete payment response. Retry with the same checkout key.');
        }
        const confirmed = await recordStripeReference(ref.paymentId, result.paymentReference);
        if (confirmed) {
          createdOrder.status = 'PAYMENT_CONFIRMED';
          createdOrder.paymentStatus = 'CONFIRMED';
          continue;
        }
        if (!result.clientSecret) {
          throw new PaymentOutcomeUncertainError('Stripe returned an incomplete payment response. Retry with the same checkout key.');
        }
        createdOrder.paymentClientSecret = result.clientSecret;
        createdOrder.paymentAmountUsd = toStripeDisplayAmountUsd(ref.amount);
      } catch (error) {
        // If an intent was returned or the provider outcome is ambiguous, preserve the pending
        // attempt. A same-key retry calls Stripe with the same idempotency key to reconcile it.
        if (error instanceof PaymentOutcomeUncertainError || ref.paymentReference) {
          throw error instanceof PaymentOutcomeUncertainError ? error : new PaymentOutcomeUncertainError();
        }
        const attempt = await findCheckoutAttempt(buyerId, idempotencyKey);
        await cancelAndFailCheckoutAttempt(attempt);
        throw new PaymentAttemptFailedError();
      }
    }
  }

  // COD is fulfillment-eligible after order acceptance, but its payment remains pending until delivery. Stripe stays pending until a verified webhook.
  await Promise.all(
    createdOrderRefs.filter((ref) => ref.paymentMethod === 'COD').map(async (ref, index) => {
      try {
        await confirmPayment(ref.orderId);
        const createdOrder = createdOrders[index];
        if (createdOrder) {
          createdOrder.status = 'PAYMENT_CONFIRMED';
          // COD's payments row deliberately remains PENDING until cash is collected at delivery.
        }
      } catch (err) {
        logger.error({ err, orderId: ref.orderId.toString() }, 'Interim confirmPayment() call failed after checkout — order remains PAYMENT_PENDING');
      }
    }),
  );

  // Only the purchased groups' items are removed — any other seller's still-ineligible or
  // newly-added items remain in the cart untouched.
  if (input.paymentMethod === 'STRIPE') await removeCartItems(purchasedCartItemIds);

  // Closes the gap Feature 9's own event inventory flagged (FEATURE_9_EVENT_INVENTORY.md,
  // Finding #2): this feature previously enqueued zero notification jobs. One ORDER_PLACED per
  // created order, to the buyer, after the transaction commits — a failure to enqueue must never
  // fail the checkout itself, and each order's notification is independent of the others'.
  await notifyOrdersPlaced(buyerId, createdOrders);

  const result: CheckoutResultDTO = { orders: createdOrders };

  if (input.paymentMethod !== 'STRIPE') await cacheCheckoutResult(cacheKey, result);

  return result;
}

async function confirmCancellationAfterPaymentFailure(orderId: bigint): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { orderId } });
    if (order.status === 'PAYMENT_PENDING') {
      await tx.order.update({ where: { orderId }, data: { status: 'CANCELLED' } });
      await tx.trackingEvent.create({ data: { orderId, status: 'CANCELLED', description: 'Stripe payment setup failed', eventTime: new Date() } });
      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const item of items) {
        // eslint-disable-next-line no-await-in-loop -- restore each item within this transaction
        await restoreStock(item.productId, item.quantity, tx, item.variantId);
      }
    }
    await tx.payment.updateMany({ where: { orderId, status: 'PENDING' }, data: { status: 'FAILED' } });
  });
}
