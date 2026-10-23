import { useState } from 'react';
import { Button } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PROFILE_QUERY_KEY, getProfile } from '../profile/profileApi';
import { getOrderAnalytics, orderAnalyticsQueryKey } from './analyticsApi';
import { Shimmer } from './AnalyticsCardState';
import { ActivityHeatmap } from './ActivityHeatmap';
import { CategoryBreakdownChart } from './CategoryBreakdownChart';
import { CustomerAnalyticsCard } from './CustomerAnalyticsCard';
import { DateRangeFilter } from './DateRangeFilter';
import { OrdersHero, SalesHero } from './HeroMetrics';
import { toRangeParams, type RangePreset } from './rangePresets';
import { OrderAnalyticsCard } from './OrderAnalyticsCard';
import { RevenueCards } from './RevenueCards';
import { SalesTrendChart } from './SalesTrendChart';
import { TopProductsTable } from './TopProductsTable';
import './analytics.css';

// SCR-S08 — Seller Analytics Dashboard (Feature 11). Backend is complete (6 endpoints, F11-
// analytics-backend.md); this page is the first thing to consume any of them. The date-range
// filter drives every widget below through one shared AnalyticsRangeParams object, matching the
// TRD's "one query layer, per-metric widgets" shape rather than each widget owning its own range
// state.
//
// Layout: a frosted lilac header band (title, range tabs, three divided hero segments, payouts
// strip) over a grid of glass cards. AI Recommendation card [R1.1] and Export [Future] are
// explicitly out of scope (module doc's Feature Overview) and are not stubbed here.
export function AnalyticsDashboardPage() {
  const { t } = useTranslation(['analytics']);
  const navigate = useNavigate();
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [customRange, setCustomRange] = useState<[string, string] | null>(null);
  const rangeParams = toRangeParams(preset, customRange);
  const { data: profile } = useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: getProfile });
  const storeName = profile?.role === 'SELLER' ? profile.storeName : undefined;

  // App Flow's "Empty (new seller)" state is about lifetime order history, not just the
  // currently selected range — a seller with a quiet last 7 days shouldn't see "no orders yet".
  // 3m is the widest built-in preset, so it doubles as a best-effort "has this seller ever had an
  // order" check without a dedicated endpoint; it's the same query the Orders card issues when a
  // seller picks 3m themselves, so React Query dedupes it rather than double-fetching.
  const { data: lifetimeCheck, isPending: lifetimeCheckPending } = useQuery({
    queryKey: orderAnalyticsQueryKey({ range: '3m' }),
    queryFn: () => getOrderAnalytics({ range: '3m' }),
  });

  const isNewSeller = lifetimeCheck?.totalOrders === 0;

  return (
    <div className="anPage">
      <section className="anHero" aria-labelledby="an-title">
        <div className="anHeroHead">
          <div>
            <p className="anEyebrow">{t('dashboard.eyebrow')}</p>
            <h1 className="anTitle" id="an-title">
              {storeName ? t('dashboard.greeting', { storeName }) : t('dashboard.title')}
            </h1>
          </div>
          {!lifetimeCheckPending && !isNewSeller && (
            <DateRangeFilter preset={preset} customRange={customRange} onPresetChange={setPreset} onCustomRangeChange={setCustomRange} />
          )}
        </div>

        {lifetimeCheckPending && (
          <div className="anHeroRow">
            {[0, 1, 2].map((i) => (
              <div key={i} className="anSeg">
                <Shimmer height={14} width="40%" />
                <Shimmer height={44} width="70%" />
              </div>
            ))}
          </div>
        )}

        {!lifetimeCheckPending && !isNewSeller && (
          <>
            <div className="anHeroRow">
              <SalesHero rangeParams={rangeParams} />
              <OrdersHero rangeParams={rangeParams} />
              <CustomerAnalyticsCard rangeParams={rangeParams} />
            </div>
            <RevenueCards rangeParams={rangeParams} />
          </>
        )}

        {isNewSeller && (
          <div className="anEmpty">
            <div className="anEmptyArt" aria-hidden="true">
              {[38, 56, 44, 72, 60, 88, 70].map((h, i) => (
                <span key={i} style={{ blockSize: `${h}%`, animationDelay: `${i * 90}ms` }} />
              ))}
              <span className="anEmptyBadge">
                <BarChart3 size={18} />
              </span>
            </div>
            <div className="anEmptyText">
              <h2 className="anEmptyTitle">{t('dashboard.emptyTitle')}</h2>
              <p className="anEmptyBody">{t('dashboard.emptyDescription')}</p>
              <Button type="primary" icon={<Plus size={16} />} onClick={() => navigate('/seller/products/new')}>
                {t('dashboard.emptyCta')}
              </Button>
            </div>
          </div>
        )}
      </section>

      {lifetimeCheckPending && (
        <div className="anGrid">
          <div className="anCard anSpan2">
            <Shimmer height={300} />
          </div>
          <div className="anCard">
            <Shimmer height={300} />
          </div>
        </div>
      )}

      {!lifetimeCheckPending && !isNewSeller && (
        <div className="anGrid">
          <SalesTrendChart rangeParams={rangeParams} />
          <OrderAnalyticsCard rangeParams={rangeParams} />
          <ActivityHeatmap rangeParams={rangeParams} />
          <CategoryBreakdownChart rangeParams={rangeParams} />
          <TopProductsTable rangeParams={rangeParams} />
        </div>
      )}
    </div>
  );
}
