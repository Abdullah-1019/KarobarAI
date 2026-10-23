import { useQuery } from '@tanstack/react-query';
import { LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../hooks';
import type { AnalyticsRangeParams } from './analyticsApi';
import { getCategoryBreakdown, categoryBreakdownQueryKey } from './analyticsApi';
import { AnalyticsError, Shimmer } from './AnalyticsCardState';
import { formatRupees } from './analyticsFormat';

const MAX_ROWS = 5;

// REQ-F-Analytics-002 — revenue by category. Null category_id comes back from the backend as a
// synthetic "Uncategorized" bucket (Task 3's own flagged gap, resolved server-side), so no
// special-casing is needed here. Horizontal bars (names stay readable on a phone) in one ink
// hue; anything past the top five folds into "Other" instead of getting its own colour.
export function CategoryBreakdownChart({ rangeParams }: { rangeParams: AnalyticsRangeParams }) {
  const { t } = useTranslation(['analytics']);
  const { language } = useLanguage();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: categoryBreakdownQueryKey(rangeParams),
    queryFn: () => getCategoryBreakdown(rangeParams),
  });

  const items = [...(data?.items ?? [])]
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
    .map((item) => ({
      key: item.categoryId ?? 'uncategorized',
      name: language === 'UR' ? item.categoryNameUr : item.categoryNameEn,
      revenue: Number(item.revenue),
      pct: item.pctOfTotal,
    }));
  const rows = items.length > MAX_ROWS + 1 ? items.slice(0, MAX_ROWS) : items;
  if (rows.length < items.length) {
    const rest = items.slice(MAX_ROWS);
    rows.push({
      key: 'other',
      name: t('categoryBreakdown.other'),
      revenue: rest.reduce((sum, r) => sum + r.revenue, 0),
      pct: rest.reduce((sum, r) => sum + r.pct, 0),
    });
  }
  const top = Math.max(1, ...rows.map((r) => r.pct));

  return (
    <section className="anCard" aria-labelledby="an-cat-title">
      <header className="anCardHead">
        <span className="anIcon anIcon--sand" aria-hidden="true">
          <LayoutGrid size={18} />
        </span>
        <div>
          <h2 className="anCardTitle" id="an-cat-title">
            {t('categoryBreakdown.title')}
          </h2>
          <p className="anCardSub">{t('categoryBreakdown.subtitle')}</p>
        </div>
      </header>

      {isPending && <Shimmer height={180} />}
      {isError && <AnalyticsError error={error} onRetry={() => void refetch()} />}
      {data && rows.length === 0 && <p className="anQuiet">{t('categoryBreakdown.empty')}</p>}
      {rows.length > 0 && (
        <ul className="anCats">
          {rows.map((row, i) => (
            <li key={row.key} className="anCat">
              <div className="anCatLine">
                <span className="anCatName">{row.name}</span>
                <span className="anCatVal">
                  {formatRupees(row.revenue).whole}
                  <span className="anCatPct">{row.pct.toFixed(0)}%</span>
                </span>
              </div>
              <span className="anCatTrack" aria-hidden="true">
                <span className="anCatFill" style={{ inlineSize: `${(row.pct / top) * 100}%`, animationDelay: `${i * 70}ms` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
