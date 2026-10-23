import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';

import { useLanguage } from '../../hooks';
import type { AnalyticsRangeParams } from './analyticsApi';
import { getSalesTrend, salesTrendQueryKey } from './analyticsApi';
import { AnalyticsError, Shimmer } from './AnalyticsCardState';
import { formatCompactRupees, formatRupees, parseDay } from './analyticsFormat';

interface TrendRow {
  date: string;
  revenue: number;
  orderCount: number;
}

// REQ-F-Analytics-002 — daily sales trend. Backend zero-fills every day in range (Task 3), so the
// area is always continuous even with sparse data (App Flow's "charts handle gaps gracefully").
// Single series → no legend box; the title names it. The area reveals left-to-right on load
// (Recharts' own clip animation), mirrored in Urdu.
export function SalesTrendChart({ rangeParams }: { rangeParams: AnalyticsRangeParams }) {
  const { t } = useTranslation(['analytics']);
  const { language, dir } = useLanguage();
  const rtl = dir === 'rtl';
  const locale = language === 'UR' ? 'ur-PK' : 'en-GB';
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: salesTrendQueryKey(rangeParams),
    queryFn: () => getSalesTrend(rangeParams),
  });

  const rows: TrendRow[] = data?.points.map((p) => ({ date: p.date, revenue: Number(p.revenue), orderCount: p.orderCount })) ?? [];
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const allZero = rows.length > 0 && rows.every((r) => r.revenue === 0);
  const shortDate = (date: string) => parseDay(date).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  const renderTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    const row = active ? (payload?.[0]?.payload as TrendRow | undefined) : undefined;
    if (!row) return null;
    return (
      <div className="anTip">
        <p className="anTipDate">{parseDay(row.date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
        <p className="anTipRow">
          <span className="anDot is-sales" aria-hidden="true" />
          {t('salesTrend.revenueLabel')} <strong>{formatRupees(row.revenue).whole}</strong>
        </p>
        <p className="anTipRow anTipMuted">{t('salesTrend.ordersLine', { count: row.orderCount })}</p>
      </div>
    );
  };

  return (
    <section className="anCard anSpan2" aria-labelledby="an-trend-title">
      <header className="anCardHead">
        <span className="anIcon anIcon--peach" aria-hidden="true">
          <TrendingUp size={18} />
        </span>
        <div>
          <h2 className="anCardTitle" id="an-trend-title">
            {t('salesTrend.title')}
          </h2>
          <p className="anCardSub">{t('salesTrend.subtitle')}</p>
        </div>
      </header>

      {isPending && <Shimmer height={260} />}
      {isError && <AnalyticsError error={error} onRetry={() => void refetch()} />}
      {data && (
        <div className="anChart">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="anTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="date"
                reversed={rtl}
                tickFormatter={shortDate}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
                tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
              />
              <YAxis
                orientation={rtl ? 'right' : 'left'}
                tickFormatter={(v: number) => formatCompactRupees(v)}
                tickLine={false}
                axisLine={false}
                width={56}
                allowDecimals={false}
                tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
              />
              <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#anTrendFill)"
                activeDot={{ r: 5, fill: 'var(--chart-1)', stroke: 'var(--bg-surface)', strokeWidth: 2 }}
                isAnimationActive={!reduceMotion}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
          {allZero && <p className="anChartNote">{t('salesTrend.empty')}</p>}
          <table className="anSrOnly">
            <caption>{t('salesTrend.title')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('salesTrend.dateLabel')}</th>
                <th scope="col">{t('salesTrend.revenueLabel')}</th>
                <th scope="col">{t('salesTrend.ordersLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date}>
                  <td>{shortDate(r.date)}</td>
                  <td>{formatRupees(r.revenue).whole}</td>
                  <td>{r.orderCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
