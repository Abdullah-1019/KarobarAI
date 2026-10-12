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
// Academic simulation profiles, not actual provider tariffs or performance statistics.
// Distance bands are synthetic and only make the local demo sensitive to route and weight.
const PROFILES = {
  TCS: { base: 160, perKg: 25, per100Km: 10, baseEta: 20, kmPerHour: 40, sla: 0.90, rating: 0.88 },
  LEOPARDS: { base: 110, perKg: 35, per100Km: 14, baseEta: 30, kmPerHour: 37, sla: 0.82, rating: 0.80 },
  TRAX: { base: 85, perKg: 40, per100Km: 16, baseEta: 38, kmPerHour: 35, sla: 0.76, rating: 0.75 },
  POSTEX: { base: 130, perKg: 20, per100Km: 12, baseEta: 24, kmPerHour: 36, sla: 0.86, rating: 0.84 },
} as const;

const ROUTE_KM: Record<string, number> = {
  karachi: 0, hyderabad: 170, lahore: 1200, islamabad: 1400,
  rawalpindi: 1410, peshawar: 1550, quetta: 690, gilgit: 1900,
};

function simulatedDistance(origin: string, destination: string): number {
  const from = ROUTE_KM[origin.trim().toLowerCase()] ?? 600;
  const to = ROUTE_KM[destination.trim().toLowerCase()] ?? 600;
  return origin.trim().toLowerCase() === destination.trim().toLowerCase() ? 0 : Math.max(100, Math.abs(to - from));
}

// Courier -> cities it does not serve at all (any payment method).
const GENERAL_COVERAGE_GAPS: Record<string, string[]> = {
  TCS: [],
  LEOPARDS: ['Gilgit'],
  TRAX: [],
  POSTEX: ['Gilgit'],
};

// Courier -> cities where it serves normally but cannot accept COD.
const COD_COVERAGE_GAPS: Record<string, string[]> = {
  TCS: [],
  LEOPARDS: ['Quetta'],
  TRAX: ['Quetta', 'Peshawar'],
  POSTEX: ['Quetta'],
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
    if (generalGaps.some((city) => city.toLowerCase() === params.destinationCity.trim().toLowerCase())) {
      return { covered: false };
    }
    if (params.isCOD) {
      const codGaps = COD_COVERAGE_GAPS[params.courier] ?? [];
      return { covered: !codGaps.some((city) => city.toLowerCase() === params.destinationCity.trim().toLowerCase()) };
    }
    return { covered: true };
  }

  async getQuote(params: QuoteParams): Promise<QuoteResult> {
    const profile = PROFILES[params.courier];
    if (!profile) throw new Error(`[MockCourierAdapter] unknown courier: ${params.courier}`);
    const weight = params.weightKg ?? 0.5; // explicit simulated estimate for legacy callers
    if (!Number.isFinite(weight) || weight <= 0) throw new Error('Invalid simulated parcel weight');
    const distance = simulatedDistance(params.originCity ?? 'Karachi', params.destinationCity);
    return {
      cost: Math.round((profile.base + profile.perKg * weight + profile.per100Km * distance / 100) * 100) / 100,
      etaHours: Math.ceil(profile.baseEta + distance / profile.kmPerHour),
      reliability: profile.sla, slaScore: profile.sla, ratingScore: profile.rating,
    };
  }

  async book(params: BookParams): Promise<BookResult> {
    logger.info({ courier: params.courier, orderId: params.orderId }, '[MockCourierAdapter] shipment booked (mock)');
    return {
      trackingNo: `MOCK-${params.courier}-${params.orderId.slice(0, 8)}`,
      bookingReference: `SIM-${params.courier}-${params.orderId.slice(0, 8)}`,
    };
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
