import type { PaymentStatus } from '@prisma/client';

import { PaymentGatewayUnavailableError } from '../../core/errors/AppError';
import type { PaymentAdapter, PaymentInitiationInput, PaymentInitiationResult, PaymentRefundResult } from './payment.adapter';

export class CODAdapter implements PaymentAdapter {
  readonly method = 'COD' as const;

  async assertAvailable(): Promise<void> {}

  async initiate(_input: PaymentInitiationInput): Promise<PaymentInitiationResult> {
    // Cash is collected at delivery. Creating an order never represents cash as already received.
    return { paymentReference: null };
  }

  async confirm(_paymentReference: string, _confirmation?: unknown): Promise<PaymentStatus> {
    return 'PENDING';
  }

  async refund(): Promise<PaymentRefundResult> {
    throw new PaymentGatewayUnavailableError('COD refunds require an audited manual refund process.');
  }
}
