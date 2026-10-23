import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ProductThumbnail } from '../../components';
import { useLanguage } from '../../hooks';
import type { TopProductsParams } from './analyticsApi';
import { getTopProducts, topProductsQueryKey } from './analyticsApi';
import { AnalyticsError, Shimmer } from './AnalyticsCardState';
import { formatRupees } from './analyticsFormat';

// REQ-F-Analytics-003 — ranked by realized revenue (Task 6), soft-deleted products excluded.
// App Flow's "click-through to product analytics" names a per-product analytics screen that was
// never built (F11-analytics-backend.md's own unresolved doc gap) — this links to the existing
// product-edit screen instead of a fabricated route, since that's the only per-product seller
// screen that actually exists today. A ranked list rather than a table, so it fits a phone.
export function TopProductsTable({ rangeParams }: { rangeParams: TopProductsParams }) {
  const { t } = useTranslation(['analytics']);
  const { language } = useLanguage();
  const params = { ...rangeParams, limit: 5 };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: topProductsQueryKey(params),
    queryFn: () => getTopProducts(params),
  });

  return (
    <section className="anCard" aria-labelledby="an-top-title">
      <header className="anCardHead">
        <span className="anIcon anIcon--rose" aria-hidden="true">
          <Trophy size={18} />
        </span>
        <div>
          <h2 className="anCardTitle" id="an-top-title">
            {t('topProducts.title')}
          </h2>
          <p className="anCardSub">{t('topProducts.subtitle')}</p>
        </div>
      </header>

      {isPending && (
        <div className="anRanks">
          {[0, 1, 2].map((i) => (
            <Shimmer key={i} height={52} />
          ))}
        </div>
      )}
      {isError && <AnalyticsError error={error} onRetry={() => void refetch()} />}
      {data && data.items.length === 0 && <p className="anQuiet">{t('topProducts.empty')}</p>}
      {data && data.items.length > 0 && (
        <ol className="anRanks">
          {data.items.map((item, i) => {
            const title = language === 'UR' && item.titleUr ? item.titleUr : item.titleEn;
            return (
              <li key={item.productId} className={i === 0 ? 'anRank is-first' : 'anRank'} style={{ animationDelay: `${i * 60}ms` }}>
                <span className="anRankNo">{i + 1}</span>
                <ProductThumbnail src={item.thumbnailUrl} alt="" size={44} radius="md" />
                <span className="anRankBody">
                  <Link to={`/seller/products/${item.productId}/edit`} className="anRankTitle">
                    {title}
                  </Link>
                  <span className="anRankMeta">{t('topProducts.unitsSold', { count: item.unitsSold })}</span>
                </span>
                <span className="anRankVal">{formatRupees(Number(item.revenue)).whole}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
