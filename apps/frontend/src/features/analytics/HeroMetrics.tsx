import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { AnalyticsRangeParams } from './analyticsApi';
import { getOrderAnalytics, getSalesTrend, orderAnalyticsQueryKey, salesTrendQueryKey } from './analyticsApi';
import { AnalyticsError, Shimmer } from './AnalyticsCardState';
import { formatRupees } from './analyticsFormat';
import { useCountUp } from './useCountUp';

// The header band's first two segments. Sales is the sum of the realized-sales trend (DELIVERED/
// COMPLETED, anchored on deliveredAt) — real numbers, unlike settlement revenue, which reads 0
// until payouts exist (see RevenueCards). Both queries are shared with the widgets below, so
// React Query dedupes them.
export function SalesHero({ rangeParams }: { rangeParams: AnalyticsRangeParams }) {
  const { t } = useTranslation(['analytics']);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: salesTrendQueryKey(rangeParams),
    queryFn: () => getSalesTrend(rangeParams),
  });

  const total = data?.points.reduce((sum, p) => sum + Number(p.revenue), 0) ?? 0;
  const delivered = data?.points.reduce((sum, p) => sum + p.orderCount, 0) ?? 0;
  const shown = useCountUp(total);
  const { whole, fraction } = formatRupees(shown);

  return (
    <div className="anSeg anSeg--lead">
      <p className="anSegLabel">{t('hero.salesLabel')}</p>
      {isPending && <Shimmer height={52} width="70%" />}
      {isError && <AnalyticsError error={error} onRetry={() => void refetch()} />}
      {data && (
        <>
          <p className="anHeroNum">
            {whole}
            <span className="anHeroFrac">{fraction}</span>
          </p>
          <p className="anSegHint">
            {t('hero.deliveredCount', { count: delivered })} · {t('hero.salesHint')}
          </p>
        </>
      )}
    </div>
  );
}

export function OrdersHero({ rangeParams }: { rangeParams: AnalyticsRangeParams }) {
  const { t } = useTranslation(['analytics']);
  const orders = useQuery({ queryKey: orderAnalyticsQueryKey(rangeParams), queryFn: () => getOrderAnalytics(rangeParams) });
  const trend = useQuery({ queryKey: salesTrendQueryKey(rangeParams), queryFn: () => getSalesTrend(rangeParams) });

  const shown = useCountUp(orders.data?.totalOrders ?? 0, 700);
  const points = trend.data?.points ?? [];
  const peak = Math.max(1, ...points.map((p) => p.orderCount));

  return (
    <div className="anSeg">
      <p className="anSegLabel">{t('hero.ordersLabel')}</p>
      {orders.isPending && <Shimmer height={36} width="40%" />}
      {orders.isError && <AnalyticsError error={orders.error} onRetry={() => void orders.refetch()} />}
      {orders.data && (
        <p className="anSegNum">
          {Math.round(shown).toLocaleString('en-PK')}
          <span className="anSegAside">{t('hero.avgOrder', { value: formatRupees(Number(orders.data.avgOrderValue)).whole })}</span>
        </p>
      )}
      {points.length > 0 && (
        <div className={`anBars${points.length > 40 ? ' anBars--dense' : ''}`} aria-hidden="true">
          {points.map((p, i) => (
            <span
              key={p.date}
              className={p.orderCount > 0 ? 'anBar is-on' : 'anBar'}
              style={{ blockSize: `${p.orderCount > 0 ? 18 + (p.orderCount / peak) * 82 : 8}%`, animationDelay: `${Math.min(i * 12, 600)}ms` }}
            />
          ))}
        </div>
      )}
      <p className="anSegHint">{t('hero.ordersHint')}</p>
    </div>
  );
}
