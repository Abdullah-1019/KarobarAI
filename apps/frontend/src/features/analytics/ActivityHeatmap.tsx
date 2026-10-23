import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { DailyTrendPointDTO } from '@karobarai/shared';
import { useLanguage } from '../../hooks';
import type { AnalyticsRangeParams } from './analyticsApi';
import { getSalesTrend, salesTrendQueryKey } from './analyticsApi';
import { AnalyticsError, Shimmer } from './AnalyticsCardState';
import { formatRupees, parseDay } from './analyticsFormat';

// Weekday names for the column heads, Monday first (2024-01-01 was a Monday).
function weekdayNames(locale: string): string[] {
  return Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' }));
}

// Lays the zero-filled daily trend out as weeks (rows) × weekdays (columns), padding the first
// and last week so every day sits under its own weekday.
function toWeeks(points: DailyTrendPointDTO[]): (DailyTrendPointDTO | null)[][] {
  const first = points[0];
  if (!first) return [];
  const lead = (parseDay(first.date).getDay() + 6) % 7;
  const cells: (DailyTrendPointDTO | null)[] = [...Array<null>(lead).fill(null), ...points];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (DailyTrendPointDTO | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// "Busy days": the same realized-sales trend, read as a calendar. One sequential hue (indigo,
// the seller side's lilac key) from light to dark; the readout under the grid names the busiest
// day by default and follows hover/tap, so no value is colour-only.
export function ActivityHeatmap({ rangeParams }: { rangeParams: AnalyticsRangeParams }) {
  const { t } = useTranslation(['analytics']);
  const { language } = useLanguage();
  const locale = language === 'UR' ? 'ur-PK' : 'en-GB';
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: salesTrendQueryKey(rangeParams),
    queryFn: () => getSalesTrend(rangeParams),
  });
  const [focus, setFocus] = useState<DailyTrendPointDTO | null>(null);

  const points = data?.points ?? [];
  const weeks = toWeeks(points);
  const peak = Math.max(0, ...points.map((p) => p.orderCount));
  const busiest = peak > 0 ? points.find((p) => p.orderCount === peak) : undefined;
  const level = (count: number) => (count === 0 || peak === 0 ? 0 : Math.max(1, Math.ceil((count / peak) * 4)));
  const dayLabel = (p: DailyTrendPointDTO) => parseDay(p.date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const shown = focus ?? busiest;

  return (
    <section className="anCard" aria-labelledby="an-busy-title">
      <header className="anCardHead">
        <span className="anIcon anIcon--sky" aria-hidden="true">
          <CalendarDays size={18} />
        </span>
        <div>
          <h2 className="anCardTitle" id="an-busy-title">
            {t('activity.title')}
          </h2>
          <p className="anCardSub">{t('activity.subtitle')}</p>
        </div>
      </header>

      {isPending && <Shimmer height={180} />}
      {isError && <AnalyticsError error={error} onRetry={() => void refetch()} />}
      {data && (
        <>
          <div className={`anHeat${weeks.length > 6 ? ' anHeat--dense' : ''}`} onMouseLeave={() => setFocus(null)}>
            {weekdayNames(locale).map((name) => (
              <span key={name} className="anHeatHead">
                {name}
              </span>
            ))}
            {weeks.flat().map((cell, i) =>
              cell ? (
                <span
                  key={cell.date}
                  className={`anCell l${level(cell.orderCount)}${shown?.date === cell.date ? ' is-focus' : ''}`}
                  style={{ animationDelay: `${Math.min(i * 10, 500)}ms` }}
                  title={`${dayLabel(cell)} · ${t('salesTrend.ordersLine', { count: cell.orderCount })}`}
                  onMouseEnter={() => setFocus(cell)}
                  onClick={() => setFocus(cell)}
                />
              ) : (
                <span key={`pad-${i}`} className="anCell is-pad" />
              ),
            )}
          </div>
          <div className="anHeatFoot">
            <p className="anHeatReadout" aria-live="polite">
              {shown ? (
                <>
                  {!focus && <span className="anHeatTag">{t('activity.busiest')}</span>}
                  {dayLabel(shown)} · {t('salesTrend.ordersLine', { count: shown.orderCount })}
                  {shown.orderCount > 0 && ` · ${formatRupees(Number(shown.revenue)).whole}`}
                </>
              ) : (
                t('activity.quiet')
              )}
            </p>
            <span className="anHeatScale" aria-hidden="true">
              {t('activity.less')}
              {[0, 1, 2, 3, 4].map((l) => (
                <span key={l} className={`anCell l${l}`} />
              ))}
              {t('activity.more')}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
