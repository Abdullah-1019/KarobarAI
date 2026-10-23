import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { AnalyticsRangeParams } from './analyticsApi';
import { getCustomerAnalytics, customerAnalyticsQueryKey } from './analyticsApi';
import { AnalyticsError, Shimmer } from './AnalyticsCardState';
import { useCountUp } from './useCountUp';

// Aggregate buyer counts only (Task 5) — new/repeat classified against lifetime order history,
// never per-buyer PII (Doc 5 §17). Rendered as the header band's third segment: unique buyers
// plus a two-part new/repeat bar, labelled with counts so identity is never colour-alone.
export function CustomerAnalyticsCard({ rangeParams }: { rangeParams: AnalyticsRangeParams }) {
  const { t } = useTranslation(['analytics']);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: customerAnalyticsQueryKey(rangeParams),
    queryFn: () => getCustomerAnalytics(rangeParams),
  });

  const shown = useCountUp(data?.uniqueBuyers ?? 0, 700);
  const total = (data?.newBuyers ?? 0) + (data?.repeatBuyers ?? 0);
  const newPct = total > 0 ? ((data?.newBuyers ?? 0) / total) * 100 : 0;

  return (
    <div className="anSeg">
      <p className="anSegLabel">{t('customerAnalytics.uniqueBuyers')}</p>
      {isPending && <Shimmer height={36} width="40%" />}
      {isError && <AnalyticsError error={error} onRetry={() => void refetch()} />}
      {data && (
        <>
          <p className="anSegNum">
            {Math.round(shown).toLocaleString('en-PK')}
            <span className="anSegAside">{t('hero.repeatRate', { value: data.repeatRate.toFixed(1) })}</span>
          </p>
          <div className="anSplit" aria-hidden="true">
            {total === 0 ? (
              <span className="anSplitPart is-empty" style={{ flexBasis: '100%' }} />
            ) : (
              <>
                {data.newBuyers > 0 && <span className="anSplitPart is-new" style={{ flexBasis: `${newPct}%` }} />}
                {data.repeatBuyers > 0 && <span className="anSplitPart is-repeat" style={{ flexBasis: `${100 - newPct}%` }} />}
              </>
            )}
          </div>
          <ul className="anLegend">
            <li>
              <span className="anDot is-new" aria-hidden="true" />
              {t('customerAnalytics.newBuyers')} <strong>{data.newBuyers}</strong>
            </li>
            <li>
              <span className="anDot is-repeat" aria-hidden="true" />
              {t('customerAnalytics.repeatBuyers')} <strong>{data.repeatBuyers}</strong>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
