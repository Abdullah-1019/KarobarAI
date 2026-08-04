import { config } from '../../core/config';
import { LivePaymentAdapter } from './live';
import { MockPaymentAdapter } from './mock';

// PaymentAdapter (D2) — Feature 6 Gap #2's explicit boundary: checkout calls charge() to
// *initiate* payment only. Retry/webhook-confirmation/settlement are Feature 8's scope, built
// against the payments row this call creates — never implemented here. Same mock/live factory
// shape as sms/email/storage (TRD §28).
export interface ChargeParams {
  orderPublicId: string;
  amount: number; // PKR, matches orders.total_amount for this order
  method: 'JAZZCASH' | 'EASYPAISA';
  idempotencyKey: string;
}

export interface ChargeResult {
  transactionRef: string;
  gateway: string;
  // PENDING, never CONFIRMED — confirmation is webhook-driven (REQ-F-Payment-002), which is
  // explicitly Feature 8's scope, not this adapter's to decide.
  status: 'PENDING';
}

// Feature 10's own gap, resolved the same way every prior "claimed to already exist" gap in this
// project has been: the module doc assumes an already-built "Payments Feature" with a refund-
// trigger interface — no such interface exists anywhere in this codebase (PaymentAdapter only
// ever had charge()). Extended here, same D2 shape, mock-only — real gateway refund integration
// remains Feature 12/16's job, exactly like charge()'s own live stub.
export interface RefundParams {
  orderPublicId: string;
  amount: number; // PKR — full order total, no partial-refund logic specified anywhere
  method: 'JAZZCASH' | 'EASYPAISA' | 'COD';
  idempotencyKey: string;
}

export interface RefundResult {
  refundRef: string;
  // The mock is synchronous/immediate — every other mock adapter in this codebase (courier
  // book()/track(), sms/email send()) resolves deterministically on the first call, with no
  // separate confirmation step; a real gateway's webhook-driven confirmation is deferred to
  // Feature 12/16 alongside the rest of real payment integration, not modeled here.
  status: 'CONFIRMED';
}

export interface PaymentAdapter {
  charge(params: ChargeParams): Promise<ChargeResult>;
  refund(params: RefundParams): Promise<RefundResult>;
}

let cachedAdapter: PaymentAdapter | null = null;

export function getPaymentAdapter(): PaymentAdapter {
  if (!cachedAdapter) {
    cachedAdapter = config.adapterMode === 'live' ? new LivePaymentAdapter() : new MockPaymentAdapter();
  }
  return cachedAdapter;
}
