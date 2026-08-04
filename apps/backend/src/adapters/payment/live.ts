import type { ChargeResult, PaymentAdapter, RefundResult } from './index';

// Stub until real JazzCash/Easypaisa gateway credentials + integration exist (Feature 12,
// per adapters/payment's original placeholder). Throwing here (rather than silently no-oping)
// makes it obvious immediately if ADAPTER_MODE is ever flipped to "live" before this is
// actually implemented — same pattern as sms/email's live stubs.
export class LivePaymentAdapter implements PaymentAdapter {
  async charge(): Promise<ChargeResult> {
    throw new Error('LivePaymentAdapter not implemented — no payment gateway credentials configured yet');
  }

  async refund(): Promise<RefundResult> {
    throw new Error('LivePaymentAdapter not implemented — no payment gateway credentials configured yet');
  }
}
