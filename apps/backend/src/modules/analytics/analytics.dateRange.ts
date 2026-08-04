import type { DateRangeQueryInput } from '@karobarai/shared';

import { ValidationError } from '../../core/errors/AppError';

// Task 1.2/1.4 — the shared date-range resolver every metric task reuses (never redefined
// per-metric). Zod (packages/shared/schemas/analytics.ts) already validates custom's
// start<=end/presence; this only resolves a preset into concrete boundaries.
export interface ResolvedRange {
  from: Date;
  to: Date;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

// `d.toISOString().slice(0, 10)` reads the UTC calendar day, which silently rolls back a day for
// any positive-UTC-offset timezone (e.g. PKT, UTC+5) applied to a local-midnight Date — the
// exact bug this helper exists to avoid. Every date-bucket key in this module (here and in
// analytics.repository.ts's dailyRevenueSeries) must go through this, so the seller's own local
// calendar day is what "today"/"yesterday" mean in the trend chart, not UTC's.
export function toLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function resolveDateRange(input: DateRangeQueryInput): ResolvedRange {
  const now = new Date();
  const range = input.range ?? '7d';

  if (range === 'custom') {
    // Presence/ordering already Zod-validated; a malformed date string here would mean the
    // schema's own Date parse silently accepted something new Date() then rejects — defensive.
    const start = new Date(input.startDate!);
    const end = new Date(input.endDate!);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new ValidationError('Invalid custom date range', undefined, 'INVALID_DATE_RANGE');
    }
    return { from: startOfDay(start), to: endOfDay(end) };
  }

  const daysBack: Record<'7d' | '30d' | '3m', number> = { '7d': 7, '30d': 30, '3m': 90 };
  const from = new Date(now);
  from.setDate(from.getDate() - (daysBack[range] - 1)); // inclusive of today
  return { from: startOfDay(from), to: endOfDay(now) };
}

// Task 2.2 — previous period is the same length, immediately preceding `from`.
export function previousPeriod(range: ResolvedRange): ResolvedRange {
  const lengthMs = range.to.getTime() - range.from.getTime();
  const to = new Date(range.from.getTime() - 1);
  const from = new Date(to.getTime() - lengthMs);
  return { from, to };
}

export function yearToDateRange(now: Date = new Date()): ResolvedRange {
  return { from: startOfDay(new Date(now.getFullYear(), 0, 1)), to: endOfDay(now) };
}

// Zero-fills every calendar day in [from, to] — Task 3.3's continuous-series requirement.
export function enumerateDays(range: ResolvedRange): string[] {
  const days: string[] = [];
  const cursor = startOfDay(range.from);
  const end = startOfDay(range.to);
  while (cursor <= end) {
    days.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
