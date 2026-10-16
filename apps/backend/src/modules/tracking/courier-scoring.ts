import type { CourierCode, QuoteResult } from '../../adapters/courier';
import { BusinessRuleError } from '../../core/errors/AppError';

export type CourierWeights = { cost: number; speed: number; sla: number; rating: number };
export const DEFAULT_COURIER_WEIGHTS: CourierWeights = { cost: 0.4, speed: 0.3, sla: 0.2, rating: 0.1 };
export type ScoredCourier = {
  courier: CourierCode;
  quote: QuoteResult;
  score: number;
  breakdown: {
    factors: CourierWeights;
    weights: CourierWeights;
    contributions: CourierWeights;
    total: number;
  };
};

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export function parseCourierWeights(value: unknown): CourierWeights {
  if (value == null) return DEFAULT_COURIER_WEIGHTS;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new BusinessRuleError('Invalid courier scoring weights', undefined, 'INVALID_COURIER_WEIGHTS');
  }
  const row = value as Record<string, unknown>;
  // Existing PlatformConfig rows/admin UI use reliability/coverage. Preserve those keys while
  // interpreting them as the approved SLA/rating factors; new rows may use sla/rating directly.
  const weights = {
    cost: row.cost, speed: row.speed ?? row.time,
    sla: row.sla ?? row.reliability, rating: row.rating ?? row.coverage,
  };
  const numbers = Object.values(weights);
  if (numbers.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1)
    || Math.abs((numbers as number[]).reduce((sum, n) => sum + n, 0) - 1) > 0.001) {
    throw new BusinessRuleError('Courier scoring weights must be finite values from 0 to 1 summing to 1', undefined, 'INVALID_COURIER_WEIGHTS');
  }
  return weights as CourierWeights;
}

export function validCourierQuote(quote: QuoteResult): boolean {
  return Number.isFinite(quote.cost) && quote.cost > 0
    && Number.isInteger(quote.etaHours) && quote.etaHours > 0
    && Number.isFinite(quote.slaScore) && quote.slaScore >= 0 && quote.slaScore <= 1
    && Number.isFinite(quote.ratingScore) && quote.ratingScore >= 0 && quote.ratingScore <= 1;
}

function inverse(values: number[], current: number): number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max === min ? 1 : (max - current) / (max - min);
}

// Score precision is six decimal places in the breakdown and three in the persisted ranking.
// Ties after three-place rounding use alphabetical courier code, consistently in API and DB.
export function calculateCourierScores(
  candidates: Array<{ courier: CourierCode; quote: QuoteResult }>,
  weights: CourierWeights,
): ScoredCourier[] {
  const valid = candidates.filter((candidate) => validCourierQuote(candidate.quote));
  if (!valid.length) return [];
  const costs = valid.map(({ quote }) => quote.cost);
  const times = valid.map(({ quote }) => quote.etaHours);
  return valid.map(({ courier, quote }) => {
    const factors = { cost: round(inverse(costs, quote.cost)), speed: round(inverse(times, quote.etaHours)),
      sla: quote.slaScore, rating: quote.ratingScore };
    const contributions = {
      cost: round(factors.cost * weights.cost), speed: round(factors.speed * weights.speed),
      sla: round(factors.sla * weights.sla), rating: round(factors.rating * weights.rating),
    };
    const total = round(Object.values(contributions).reduce((sum, contribution) => sum + contribution, 0));
    return { courier, quote, score: Math.round(total * 1000) / 1000,
      breakdown: { factors, weights, contributions, total } };
  }).sort((a, b) => b.score - a.score || a.courier.localeCompare(b.courier));
}
