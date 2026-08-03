import type { OrderStatus } from '@prisma/client';

import { config } from '../../core/config';
import { LiveCourierAdapter } from './live';
import { MockCourierAdapter } from './mock';

// CourierAdapter (D2) — Feature 6 Gap #1's explicit boundary: checkout calls getRate() once per
// seller group for a single representative shipping-fee estimate. The full parallel-scoring
// algorithm (cost/time/reliability/coverage weights, courier_quotes logging) is Feature 8's
// booking concern — this adapter is never used for that here. Same mock/live factory shape as
// sms/email/storage (TRD §28).
export interface GetRateParams {
  destinationCity: string;
  destinationProvince: string;
}

export interface RateResult {
  courier: string;
  fee: number; // PKR
}

// Feature 8 — the adapter's primary real consumer. checkCoverage/getQuote/book/track/cancel were
// never built (Feature 6 only ever called getRate()); building them is this feature's own scope.
export type CourierCode = 'TCS' | 'LEOPARDS' | 'TRAX';

export const ALL_COURIERS: readonly CourierCode[] = ['TCS', 'LEOPARDS', 'TRAX'];

export interface CheckCoverageParams {
  courier: CourierCode;
  destinationCity: string;
  isCOD: boolean;
}

export interface CoverageResult {
  covered: boolean;
}

export interface QuoteParams {
  courier: CourierCode;
  destinationCity: string;
  destinationProvince: string;
}

export interface QuoteResult {
  cost: number; // PKR
  etaHours: number;
  reliability: number; // 0..1
}

export interface BookParams {
  courier: CourierCode;
  orderId: string;
  destinationCity: string;
}

export interface BookResult {
  trackingNo: string;
}

export interface TrackParams {
  courier: CourierCode;
  trackingNo: string;
  previousStatus: OrderStatus | null;
}

export interface TrackResult {
  status: OrderStatus;
  description: string;
  locationLat: number;
  locationLng: number;
}

export interface CancelParams {
  courier: CourierCode;
  trackingNo: string;
}

export interface CourierAdapter {
  getRate(params: GetRateParams): Promise<RateResult>;
  checkCoverage(params: CheckCoverageParams): Promise<CoverageResult>;
  getQuote(params: QuoteParams): Promise<QuoteResult>;
  book(params: BookParams): Promise<BookResult>;
  track(params: TrackParams): Promise<TrackResult>;
  cancel(params: CancelParams): Promise<void>;
}

let cachedAdapter: CourierAdapter | null = null;

export function getCourierAdapter(): CourierAdapter {
  if (!cachedAdapter) {
    cachedAdapter = config.adapterMode === 'live' ? new LiveCourierAdapter() : new MockCourierAdapter();
  }
  return cachedAdapter;
}
