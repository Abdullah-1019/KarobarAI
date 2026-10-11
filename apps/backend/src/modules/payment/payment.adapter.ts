import type { PaymentMethod, PaymentStatus } from '@prisma/client';

export interface PaymentInitiationInput {
  orderId: string;
  paymentId: string;
  amountPkr: string;
}

export interface PaymentInitiationResult {
  paymentReference: string | null;
  clientSecret?: string;
}

export interface PaymentRefundResult {
  success: boolean;
  refundReference: string;
}

export interface PaymentAdapter {
  readonly method: PaymentMethod;
  assertAvailable(): Promise<void>;
  initiate(input: PaymentInitiationInput, idempotencyKey: string): Promise<PaymentInitiationResult>;
  resume?(input: PaymentInitiationInput, paymentReference: string): Promise<PaymentInitiationResult>;
  cancel?(paymentReference: string): Promise<void>;
  confirm(paymentReference: string, confirmation?: unknown): Promise<PaymentStatus>;
  refund(
    paymentReference: string,
    amountPkr: string,
    originalAmountPkr: string,
    idempotencyKey: string,
  ): Promise<PaymentRefundResult>;
}
