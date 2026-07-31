import { logger } from '../../core/logger';
import type { CourierAdapter, GetRateParams, RateResult } from './index';

const FLAT_RATE_PKR = 150;

// Deterministic mock (D2): a flat estimate, no real distance/weight calculation — this is
// exactly the "single representative estimate" Gap #1 calls for, not real courier pricing.
export class MockCourierAdapter implements CourierAdapter {
  async getRate(params: GetRateParams): Promise<RateResult> {
    logger.info(
      { destinationCity: params.destinationCity, destinationProvince: params.destinationProvince },
      '[MockCourierAdapter] rate estimated (ADAPTER_MODE=mock, flat rate, no real courier called)',
    );
    return { courier: 'mock-courier', fee: FLAT_RATE_PKR };
  }
}
