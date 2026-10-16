import { ALL_COURIERS } from '../../src/adapters/courier';
import { MockCourierAdapter } from '../../src/adapters/courier/mock';
import { calculateCourierScores, DEFAULT_COURIER_WEIGHTS, parseCourierWeights } from '../../src/modules/tracking/courier-scoring';

const quote = (cost: number, etaHours: number, slaScore: number, ratingScore: number) =>
  ({ cost, etaHours, slaScore, ratingScore, reliability: slaScore });

describe('Feature 20 deterministic simulated courier scoring (no database)', () => {
  it('registers four mock providers and quotes deterministically by route and parcel weight', async () => {
    expect(ALL_COURIERS).toEqual(['TCS', 'LEOPARDS', 'TRAX', 'POSTEX']);
    const adapter = new MockCourierAdapter();
    for (const courier of ALL_COURIERS) {
      const params = { courier, originCity: 'Karachi', destinationCity: 'Lahore', destinationProvince: 'Punjab', weightKg: 1 };
      expect(await adapter.getQuote(params)).toEqual(await adapter.getQuote(params));
      expect((await adapter.getQuote({ ...params, weightKg: 3 })).cost).toBeGreaterThan((await adapter.getQuote(params)).cost);
      expect((await adapter.getQuote({ ...params, destinationCity: 'Karachi' })).etaHours)
        .toBeLessThan((await adapter.getQuote(params)).etaHours);
    }
  });

  it('produces different winners for two documented synthetic demo routes', async () => {
    const adapter = new MockCourierAdapter();
    async function winner(destinationCity: string, weightKg: number) {
      const candidates = await Promise.all(ALL_COURIERS.map(async (courier) => ({
        courier, quote: await adapter.getQuote({ courier, originCity: 'Karachi', destinationCity,
          destinationProvince: 'Sindh', weightKg }),
      })));
      return calculateCourierScores(candidates, DEFAULT_COURIER_WEIGHTS)[0]?.courier;
    }
    expect(await winner('Karachi', 1)).toBe('POSTEX');
    expect(await winner('Peshawar', 5)).toBe('TCS');
  });

  it('matches a hand-calculated 40/30/20/10 example and exposes every contribution', () => {
    const results = calculateCourierScores([
      { courier: 'TCS', quote: quote(200, 24, 0.9, 0.8) },
      { courier: 'TRAX', quote: quote(100, 48, 0.8, 0.7) },
      { courier: 'POSTEX', quote: quote(150, 36, 0.85, 0.75) },
    ], DEFAULT_COURIER_WEIGHTS);
    expect(results.map(({ courier }) => courier)).toEqual(['TRAX', 'POSTEX', 'TCS']);
    expect(results.find(({ courier }) => courier === 'TCS')?.breakdown.contributions)
      .toEqual({ cost: 0, speed: 0.3, sla: 0.18, rating: 0.08 });
    expect(results.find(({ courier }) => courier === 'TCS')?.score).toBe(0.56);
    expect(results.find(({ courier }) => courier === 'TRAX')?.score).toBe(0.63);
    expect(results.find(({ courier }) => courier === 'POSTEX')?.score).toBe(0.595);
  });

  it('scores equal cost and ETA equally and breaks complete ties alphabetically', () => {
    const results = calculateCourierScores([
      { courier: 'TCS', quote: quote(100, 24, 0.8, 0.8) },
      { courier: 'LEOPARDS', quote: quote(100, 24, 0.8, 0.8) },
    ], DEFAULT_COURIER_WEIGHTS);
    expect(results[0]?.courier).toBe('LEOPARDS');
    expect(results[0]?.breakdown.factors.cost).toBe(1);
    expect(results[0]?.breakdown.factors.speed).toBe(1);
  });

  it('excludes invalid quotes instead of treating them as cheap or fast', () => {
    const results = calculateCourierScores([
      { courier: 'TCS', quote: quote(150, 24, 0.9, 0.9) },
      { courier: 'TRAX', quote: quote(0, 0, 2, 0.7) },
    ], DEFAULT_COURIER_WEIGHTS);
    expect(results).toHaveLength(1);
    expect(results[0]?.courier).toBe('TCS');
    expect(calculateCourierScores([], DEFAULT_COURIER_WEIGHTS)).toEqual([]);
  });

  it('rejects missing, negative, infinite, or non-normalized configured weights', () => {
    expect(parseCourierWeights(null)).toEqual(DEFAULT_COURIER_WEIGHTS);
    expect(parseCourierWeights({ cost: 0.4, time: 0.3, reliability: 0.2, coverage: 0.1 })).toEqual(DEFAULT_COURIER_WEIGHTS);
    for (const invalid of [
      { cost: -0.1, time: 0.8, reliability: 0.2, coverage: 0.1 },
      { cost: 0.4, time: 0.3, reliability: Infinity, coverage: 0.1 },
      { cost: 0.4, time: 0.3, reliability: 0.1, coverage: 0.1 },
      { cost: 0.4, time: 0.3, reliability: 0.2 },
    ]) expect(() => parseCourierWeights(invalid)).toThrow();
  });
});
