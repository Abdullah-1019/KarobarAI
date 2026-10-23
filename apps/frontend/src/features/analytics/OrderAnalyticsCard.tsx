import { useQuery } from '@tanstack/react-query';
import { Gauge } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AnalyticsRangeParams } from './analyticsApi';
import { getOrderAnalytics, orderAnalyticsQueryKey } from './analyticsApi';
import { AnalyticsError, Shimmer } from './AnalyticsCardState';
import { formatRupees } from './analyticsFormat';
import { useCountUp } from './useCountUp';

const TICKS = 32;
const DELIVERED_STATUSES = ['DELIVERED', 'COMPLETED'];

// Order volume/lifecycle distribution (Task 4) — placed_at-anchored, all statuses including
// in-flight/cancelled, distinct from Sales Analytics' realized-only basis. Shown as a tick gauge:
// the share of this range's orders that reached the buyer. Status labels reuse the `orders`
// namespace's existing translations rather than duplicating the enum copy here.
export function OrderAnalyticsCard({ rangeParams }: { rangeParams: AnalyticsRangeParams }) {
  const { t } = useTranslation(['analytics', 'orders']);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: orderAnalyticsQueryKey(rangeParams),
    queryFn: () => getOrderAnalytics(rangeParams),
  });

  const total = data?.totalOrders ?? 0;
  const done = DELIVERED_STATUSES.reduce((sum, s) => sum + (data?.byStatus[s] ?? 0), 0);
  const pct = total > 0 ? (done / total) * 100 : 0;
  const shown = useCountUp(pct, 1000);
  const lit = Math.round((pct / 100) * TICKS);
  const statuses = Object.entries(data?.byStatus ?? {}).filter(([, count]) => count > 0);

  return (
    <section className="anCard" aria-labelledby="an-health-title">
      <header className="anCardHead">
        <span className="anIcon anIcon--lilac" aria-hidden="true">
          <Gauge size={18} />
        </span>
        <div>
          <h2 className="anCardTitle" id="an-health-title">
            {t('orderAnalytics.title')}
          </h2>
          <p className="anCardSub">{t('orderAnalytics.subtitle')}</p>
        </div>
      </header>

      {isPending && <Shimmer height={180} />}
      {isError && <AnalyticsError error={error} onRetry={() => void refetch()} />}
      {data && (
        <>
          <div className="anGauge" role="img" aria-label={t('orderAnalytics.gaugeCaption', { done, total })}>
            <svg viewBox="0 0 200 112" className="anGaugeTicks" aria-hidden="true">
              {Array.from({ length: TICKS }, (_, i) => {
                const angle = Math.PI - (i / (TICKS - 1)) * Math.PI;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                return (
                  <line
                    key={i}
                    x1={100 + cos * 70}
                    y1={104 - sin * 70}
                    x2={100 + cos * 92}
                    y2={104 - sin * 92}
                    className={i < lit ? 'anTick is-lit' : 'anTick'}
                    style={i < lit ? { animationDelay: `${i * 28}ms` } : undefined}
                  />
                );
              })}
            </svg>
            <div className="anGaugeCenter">
              <span className="anGaugeNum">{total > 0 ? `${shown.toFixed(1)}%` : '—'}</span>
              <span className="anGaugeLabel">{t('orderAnalytics.gaugeLabel')}</span>
            </div>
          </div>
          <p className="anGaugeCaption">{total > 0 ? t('orderAnalytics.gaugeCaption', { done, total }) : t('orderAnalytics.noOrders')}</p>

          <dl className="anMiniStats">
            <div>
              <dt>{t('orderAnalytics.totalOrders')}</dt>
              <dd>{total}</dd>
            </div>
            <div>
              <dt>{t('orderAnalytics.cancelledRate')}</dt>
              <dd>{data.cancelledRate.toFixed(1)}%</dd>
            </div>
            <div>
              <dt>{t('orderAnalytics.avgOrderValue')}</dt>
              <dd>{formatRupees(Number(data.avgOrderValue)).whole}</dd>
            </div>
          </dl>

          {statuses.length > 0 && (
            <ul className="anChips">
              {statuses.map(([status, count]) => (
                <li key={status} className="anChip">
                  {t(`orders:status.${status}`, { defaultValue: status })}
                  <strong>{count}</strong>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
