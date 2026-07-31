import { config } from '../../core/config';
import { LiveCourierAdapter } from './live';
import { MockCourierAdapter } from './mock';

// CourierAdapter (D2) — Feature 6 Gap #1's explicit boundary: checkout calls getRate() once per
// seller group for a single representative shipping-fee estimate. The full parallel-scoring
// algorithm (cost/time/reliability/coverage weights, courier_quotes logging) is Feature 7's
// Order Detail/booking concern — this adapter is never used for that here. Same mock/live
// factory shape as sms/email/storage (TRD §28).
export interface GetRateParams {
  destinationCity: string;
  destinationProvince: string;
}

export interface RateResult {
  courier: string;
  fee: number; // PKR
}

export interface CourierAdapter {
  getRate(params: GetRateParams): Promise<RateResult>;
}

let cachedAdapter: CourierAdapter | null = null;

export function getCourierAdapter(): CourierAdapter {
  if (!cachedAdapter) {
    cachedAdapter = config.adapterMode === 'live' ? new LiveCourierAdapter() : new MockCourierAdapter();
  }
  return cachedAdapter;
}
