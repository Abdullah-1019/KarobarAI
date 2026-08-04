import { enumerateDays, previousPeriod, resolveDateRange, toLocalDateKey, yearToDateRange } from '../../src/modules/analytics/analytics.dateRange';

// Task 1.2/1.4 — pure-function unit tests, no DB/Redis needed. Assertions use toLocalDateKey
// (local calendar day), never toISOString, to stay correct on positive-UTC-offset machines (this
// suite runs in PKT/UTC+5) — see the bug this same helper was added to fix in the source.

describe('resolveDateRange', () => {
  it('defaults to the 7d preset when range is omitted (7 zero-filled calendar days, inclusive of today)', () => {
    const range = resolveDateRange({});
    expect(enumerateDays(range)).toHaveLength(7);
    expect(enumerateDays(range)[6]).toBe(toLocalDateKey(new Date()));
  });

  it('30d and 3m presets resolve to the expected span', () => {
    const r30 = resolveDateRange({ range: '30d' });
    const r3m = resolveDateRange({ range: '3m' });
    expect(enumerateDays(r30)).toHaveLength(30);
    expect(enumerateDays(r3m)).toHaveLength(90);
  });

  it('custom range resolves to the exact start-of-day..end-of-day boundaries given', () => {
    const range = resolveDateRange({ range: 'custom', startDate: '2026-01-01', endDate: '2026-01-05' });
    expect(toLocalDateKey(range.from)).toBe('2026-01-01');
    expect(toLocalDateKey(range.to)).toBe('2026-01-05');
    expect(range.from.getHours()).toBe(0);
    expect(range.to.getHours()).toBe(23);
  });
});

describe('previousPeriod', () => {
  it('returns an immediately-preceding window of the same length', () => {
    const range = { from: new Date('2026-01-08T00:00:00'), to: new Date('2026-01-14T23:59:59.999') };
    const prev = previousPeriod(range);
    expect(prev.to.getTime()).toBe(range.from.getTime() - 1);
    expect(prev.to.getTime() - prev.from.getTime()).toBe(range.to.getTime() - range.from.getTime());
  });
});

describe('yearToDateRange', () => {
  it('spans January 1st of the given year through the given date', () => {
    const now = new Date('2026-08-04T12:00:00');
    const range = yearToDateRange(now);
    expect(toLocalDateKey(range.from)).toBe('2026-01-01');
    expect(toLocalDateKey(range.to)).toBe('2026-08-04');
  });
});

describe('enumerateDays', () => {
  it('zero-fills every calendar day in the range, inclusive of both ends', () => {
    const range = { from: new Date('2026-01-01T00:00:00'), to: new Date('2026-01-03T23:59:59.999') };
    expect(enumerateDays(range)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });

  it('a single-day range yields exactly one entry', () => {
    const range = { from: new Date('2026-01-01T00:00:00'), to: new Date('2026-01-01T23:59:59.999') };
    expect(enumerateDays(range)).toEqual(['2026-01-01']);
  });
});

describe('toLocalDateKey (regression — must not roll back a day on positive-UTC-offset machines)', () => {
  it('reads the local calendar day of a local-midnight Date, not the UTC day', () => {
    const localMidnight = new Date(2026, 0, 1, 0, 0, 0, 0); // local Jan 1st, 00:00
    expect(toLocalDateKey(localMidnight)).toBe('2026-01-01');
  });

  it('agrees with the local getFullYear/getMonth/getDate components for an arbitrary instant', () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(toLocalDateKey(d)).toBe(expected);
  });
});
