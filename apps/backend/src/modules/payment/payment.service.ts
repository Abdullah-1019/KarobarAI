import { Prisma, type PaymentMethod } from '@prisma/client';

import { NotFoundError, PaymentGatewayUnavailableError } from '../../core/errors/AppError';
import { prisma } from '../../core/prisma';
import { config } from '../../core/config';
import { getPaymentGatewayAdapter } from './payment.factory';
import { stripeTestCredentialsReady } from './stripe.adapter';

export function getPublicPaymentConfig() {
  const stripeEnabled = stripeTestCredentialsReady();
  return {
    stripeEnabled,
    stripePublishableKey: stripeEnabled ? config.stripe.publishableKey : null,
    jazzCashEnabled: false,
    easyPaisaEnabled: false,
  };
}

export async function assertCheckoutMethodAvailable(method: PaymentMethod): Promise<void> {
  await getPaymentGatewayAdapter(method).assertAvailable();
}

export async function refundOrderPayment(orderPublicId: string, amountPkr: string, idempotencyKey: string) {
  const payment = await prisma.payment.findFirst({
    where: { order: { publicId: orderPublicId } },
    include: { order: { select: { totalAmount: true } } },
  });
  if (!payment) throw new NotFoundError('Payment was not found for this order.', undefined, 'PAYMENT_NOT_FOUND');
  if (payment.status !== 'CONFIRMED' || !payment.transactionRef) {
    throw new PaymentGatewayUnavailableError('Only a confirmed provider payment can be refunded.');
  }

  const result = await getPaymentGatewayAdapter(payment.method).refund(
    payment.transactionRef,
    amountPkr,
    payment.order.totalAmount.toString(),
    idempotencyKey,
  );
  if (result.success && new Prisma.Decimal(amountPkr).eq(payment.order.totalAmount)) {
    await prisma.payment.updateMany({ where: { paymentId: payment.paymentId, status: 'CONFIRMED' }, data: { status: 'REFUNDED' } });
  }
  return result;
}
