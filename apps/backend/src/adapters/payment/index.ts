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

export interface PaymentAdapter {
  charge(params: ChargeParams): Promise<ChargeResult>;
}

let cachedAdapter: PaymentAdapter | null = null;

export function getPaymentAdapter(): PaymentAdapter {
  if (!cachedAdapter) {
    cachedAdapter = config.adapterMode === 'live' ? new LivePaymentAdapter() : new MockPaymentAdapter();
  }
  return cachedAdapter;
}
