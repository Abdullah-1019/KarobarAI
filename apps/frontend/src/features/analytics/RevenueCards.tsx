import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AnalyticsRangeParams } from './analyticsApi';
import { getRevenue, revenueQueryKey } from './analyticsApi';
import { AnalyticsError, Shimmer } from './AnalyticsCardState';
import { formatRupees } from './analyticsFormat';

// REQ-F-Analytics-001 — current/previous month + YTD, sourced from settlements.net WHERE
// status=SETTLED. Reads "Rs. 0" for every real seller until a settlement engine exists
// (F11-analytics-backend.md's documented, honest gap) — not a frontend bug. So this is a quiet
// strip under the header, and while everything is zero it says why instead of showing three zeros.
export function RevenueCards({ rangeParams }: { rangeParams: AnalyticsRangeParams }) {
  const { t } = useTranslation(['analytics']);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: revenueQueryKey(rangeParams),
    queryFn: () => getRevenue(rangeParams),
  });

  const noPayouts = data && Number(data.current) === 0 && Number(data.previous) === 0 && Number(data.ytd) === 0;
  const pct = data?.pctChangeVsPrevious ?? null;

  return (
    <div className="anPayouts">
      <span className="anPayoutsIcon" aria-hidden="true">
        <Wallet size={16} />
      </span>
      <span className="anPayoutsTitle">{t('revenue.title')}</span>
      {isPending && <Shimmer height={14} width={220} />}
      {isError && <AnalyticsError error={error} onRetry={() => void refetch()} />}
      {noPayouts && <span className="anPayoutsNote">{t('revenue.pending')}</span>}
      {data && !noPayouts && (
        <dl className="anPayoutsList">
          <div>
            <dt>{t('revenue.current')}</dt>
            <dd>
              {formatRupees(Number(data.current)).whole}
              {pct !== null && (
                <span className={pct >= 0 ? 'anDelta is-up' : 'anDelta is-down'}>
                  {pct >= 0 ? '+' : ''}
                  {pct.toFixed(1)}%
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>{t('revenue.previous')}</dt>
            <dd>{formatRupees(Number(data.previous)).whole}</dd>
          </div>
          <div>
            <dt>{t('revenue.ytd')}</dt>
            <dd>{formatRupees(Number(data.ytd)).whole}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
