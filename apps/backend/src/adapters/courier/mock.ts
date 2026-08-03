import type { OrderStatus } from '@prisma/client';

import { logger } from '../../core/logger';
import type {
  BookParams,
  BookResult,
  CancelParams,
  CheckCoverageParams,
  CourierAdapter,
  CoverageResult,
  GetRateParams,
  QuoteParams,
  QuoteResult,
  RateResult,
  TrackParams,
  TrackResult,
} from './index';

const FLAT_RATE_PKR = 150;

// Deterministic per-courier attributes (D2 — Feature 8 Gap #3's "plausible, deterministic" mock
// data, not real courier pricing/coverage). Encodes a few deliberate coverage gaps so Task 3.1's
// COD-coverage filter and Task 8's adversarial tests have something real to exercise.
const QUOTES: Record<string, QuoteResult> = {
  TCS: { cost: 200, etaHours: 24, reliability: 0.9 },
  LEOPARDS: { cost: 150, etaHours: 36, reliability: 0.8 },
  TRAX: { cost: 100, etaHours: 48, reliability: 0.7 },
};

// Courier -> cities it does not serve at all (any payment method).
const GENERAL_COVERAGE_GAPS: Record<string, string[]> = {
  TCS: [],
  LEOPARDS: ['Gilgit'],
  TRAX: [],
};

// Courier -> cities where it serves normally but cannot accept COD.
const COD_COVERAGE_GAPS: Record<string, string[]> = {
  TCS: [],
  LEOPARDS: ['Quetta'],
  TRAX: ['Quetta', 'Peshawar'],
};

// Deterministic milestone progression (Gap #3) — one step forward per track() call, independent
// of destination, so the poll job's "did the milestone change" logic has something predictable
// to test against.
const MILESTONE_SEQUENCE: OrderStatus[] = ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];

// A fixed depot origin (Karachi) and a fixed delivery-side offset — not real geocoding, just a
// plausible-looking progression for the map/timeline demo (Gap #3 is explicit that real GPS only
// arrives with Feature 16's live adapter swap-in).
const DEPOT = { lat: 24.8607, lng: 67.0011 };
const DELIVERY_OFFSET = { lat: 2.0, lng: 1.5 };

export class MockCourierAdapter implements CourierAdapter {
  async getRate(params: GetRateParams): Promise<RateResult> {
    logger.info(
      { destinationCity: params.destinationCity, destinationProvince: params.destinationProvince },
      '[MockCourierAdapter] rate estimated (ADAPTER_MODE=mock, flat rate, no real courier called)',
    );
    return { courier: 'mock-courier', fee: FLAT_RATE_PKR };
  }

  async checkCoverage(params: CheckCoverageParams): Promise<CoverageResult> {
    const generalGaps = GENERAL_COVERAGE_GAPS[params.courier] ?? [];
    if (generalGaps.includes(params.destinationCity)) {
      return { covered: false };
    }
    if (params.isCOD) {
      const codGaps = COD_COVERAGE_GAPS[params.courier] ?? [];
      return { covered: !codGaps.includes(params.destinationCity) };
    }
    return { covered: true };
  }

  async getQuote(params: QuoteParams): Promise<QuoteResult> {
    const quote = QUOTES[params.courier];
    if (!quote) throw new Error(`[MockCourierAdapter] unknown courier: ${params.courier}`);
    return { ...quote };
  }

  async book(params: BookParams): Promise<BookResult> {
    logger.info({ courier: params.courier, orderId: params.orderId }, '[MockCourierAdapter] shipment booked (mock)');
    return { trackingNo: `MOCK-${params.courier}-${params.orderId.slice(0, 8)}` };
  }

  async track(params: TrackParams): Promise<TrackResult> {
    const currentIndex = params.previousStatus ? MILESTONE_SEQUENCE.indexOf(params.previousStatus) : -1;
    const nextIndex = Math.min(currentIndex + 1, MILESTONE_SEQUENCE.length - 1);
    const status = MILESTONE_SEQUENCE[nextIndex]!;
    const progress = (nextIndex + 1) / MILESTONE_SEQUENCE.length;

    return {
      status,
      description: `${params.courier} — ${status.replace(/_/g, ' ').toLowerCase()}`,
      locationLat: DEPOT.lat + DELIVERY_OFFSET.lat * progress,
      locationLng: DEPOT.lng + DELIVERY_OFFSET.lng * progress,
    };
  }

  async cancel(params: CancelParams): Promise<void> {
    logger.info({ courier: params.courier, trackingNo: params.trackingNo }, '[MockCourierAdapter] shipment cancelled (mock)');
  }
}
