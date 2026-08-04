import type { CheckoutResultDTO, CreatedOrderDTO } from '@karobarai/shared';
import { Prisma } from '@prisma/client';

import { getCourierAdapter } from '../../adapters/courier';
import { getPaymentAdapter } from '../../adapters/payment';
import { encryptField } from '../../core/crypto/fieldCipher';
import { BusinessRuleError, ValidationError } from '../../core/errors/AppError';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';
import { redis } from '../../core/redis';
import { getOwnedAddressForOrder } from '../address/address.service';
import { getRawCart, removeCartItems, type RawSellerGroup } from '../cart/cart.service';
import { decrementStock } from '../catalog/catalog.service';
import { enqueueNotification } from '../notification';
import type { CheckoutInput } from './checkout.dto';

// Feature 6 Task 7 — the checkout-creation slice of the order/ module (TRD §12's folder note:
// lifecycle/state-machine transitions past this point are Feature 7's scope). No
// order.repository.ts, consistent with the no-repository-layer convention (Feature 4/6).

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24; // 24h — long enough to cover any reasonable retry window

function idempotencyRedisKey(buyerId: bigint, key: string): string {
  return `idempotency:checkout:${buyerId}:${key}`;
}

// Gap #2's explicit boundary: this function's job ends at charge()-initiation + a PENDING
// payments row. Retry/webhook-confirmation/settlement are Feature 8's scope, built against the
// row this creates.
async function createPaymentRow(
  tx: Prisma.TransactionClient,
  orderId: bigint,
  orderPublicId: string,
  amount: Prisma.Decimal,
  method: CheckoutInput['paymentMethod'],
  idempotencyKey: string,
) {
  if (method === 'COD') {
    return tx.payment.create({
      data: {
        orderId,
        method: 'COD',
        status: 'PENDING',
        amount,
        idempotencyKey,
      },
    });
  }

  const paymentAdapter = getPaymentAdapter();
  const result = await paymentAdapter.charge({
    orderPublicId,
    amount: Number(amount),
    method,
    idempotencyKey,
  });

  return tx.payment.create({
    data: {
      orderId,
      method,
      gateway: result.gateway,
      transactionRef: result.transactionRef,
      status: result.status,
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
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as CheckoutResultDTO;
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

  // One transaction, N orders, all-or-nothing (Task 7.3/7.4) — a partial failure (order created,
  // stock not decremented, or vice versa) would violate Schema §0's ACID guarantee.
  await prisma.$transaction(async (tx) => {
    for (const group of eligibleGroups) {
      // Final re-validation, inside the transaction, closes the race window between "viewed
      // cart" (moments earlier, outside this transaction) and "clicked place order."
      for (const item of group.items) {
        // eslint-disable-next-line no-await-in-loop -- stock decrements must serialize per product within this transaction
        await decrementStock(item.productId, item.quantity, tx);
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
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
      });

      // Per-order idempotency key derived from the client's header key — payments.idempotency_key
      // is unique per row (1:1 with an order), so a multi-seller checkout needs one distinct
      // derived key per order while still tracing back to the single client-supplied key.
      const paymentIdempotencyKey = `${idempotencyKey}:${group.sellerPublicId}`;
      const payment = await createPaymentRow(
        tx,
        order.orderId,
        order.publicId,
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
          unitPrice: item.unitPrice.toFixed(2),
          quantity: item.quantity,
        })),
        placedAt: order.placedAt.toISOString(),
      });

      purchasedCartItemIds.push(...group.items.map((item) => item.cartItemId));
    }
  });

  // Only the purchased groups' items are removed — any other seller's still-ineligible or
  // newly-added items remain in the cart untouched.
  await removeCartItems(purchasedCartItemIds);

  // Closes the gap Feature 9's own event inventory flagged (FEATURE_9_EVENT_INVENTORY.md,
  // Finding #2): this feature previously enqueued zero notification jobs. One ORDER_PLACED per
  // created order, to the buyer, after the transaction commits — a failure to enqueue must never
  // fail the checkout itself, and each order's notification is independent of the others'.
  await Promise.allSettled(
    createdOrders.map((order) =>
      enqueueNotification({
        userId: buyerId.toString(),
        type: 'ORDER_PLACED',
        orderId: order.id,
        vars: { orderId: order.id },
      }),
    ),
  );

  const result: CheckoutResultDTO = { orders: createdOrders };

  await redis
    .set(cacheKey, JSON.stringify(result), 'EX', IDEMPOTENCY_TTL_SECONDS)
    .catch((err) => logger.warn({ err }, 'Failed to cache idempotent checkout result (non-fatal)'));

  return result;
}
