import { randomUUID } from 'node:crypto';

import { logger } from '../../core/logger';
import type { ChargeParams, ChargeResult, PaymentAdapter } from './index';

// Deterministic mock (D2): never contacts a real gateway. Always "succeeds" at initiation
// (status PENDING) — a real failure-at-initiation path isn't modeled here since Feature 6's
// scope stops at initiating the charge, not processing its outcome.
export class MockPaymentAdapter implements PaymentAdapter {
  async charge(params: ChargeParams): Promise<ChargeResult> {
    logger.info(
      { orderPublicId: params.orderPublicId, amount: params.amount, method: params.method },
      '[MockPaymentAdapter] charge initiated (ADAPTER_MODE=mock, no real gateway called)',
    );
    return {
      transactionRef: `mock-txn-${randomUUID()}`,
      gateway: `mock-${params.method.toLowerCase()}`,
      status: 'PENDING',
    };
  }
}
