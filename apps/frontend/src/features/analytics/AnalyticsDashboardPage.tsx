import { useState } from 'react';
import { Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { EmptyState, SkeletonLoader } from '../../components';
import { getOrderAnalytics, orderAnalyticsQueryKey } from './analyticsApi';
import { CategoryBreakdownChart } from './CategoryBreakdownChart';
import { CustomerAnalyticsCard } from './CustomerAnalyticsCard';
import { DateRangeFilter, toRangeParams, type RangePreset } from './DateRangeFilter';
import { OrderAnalyticsCard } from './OrderAnalyticsCard';
import { RevenueCards } from './RevenueCards';
import { SalesTrendChart } from './SalesTrendChart';
import { TopProductsTable } from './TopProductsTable';

// SCR-S08 — Seller Analytics Dashboard (Feature 11). Backend is complete (6 endpoints, F11-
// analytics-backend.md); this page is the first thing to consume any of them. The date-range
// filter drives every widget below through one shared AnalyticsRangeParams object, matching the
// TRD's "one query layer, per-metric widgets" shape rather than each widget owning its own range
// state.
//
// AI Recommendation card [R1.1] and Export [Future] are explicitly out of scope (module doc's
// Feature Overview) and are not stubbed here.
export function AnalyticsDashboardPage() {
  const { t } = useTranslation(['analytics']);
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [customRange, setCustomRange] = useState<[string, string] | null>(null);
  const rangeParams = toRangeParams(preset, customRange);

  // App Flow's "Empty (new seller)" state is about lifetime order history, not just the
  // currently selected range — a seller with a quiet last 7 days shouldn't see "no orders yet".
  // 3m is the widest built-in preset, so it doubles as a best-effort "has this seller ever had an
  // order" check without a dedicated endpoint; it's the same query the Orders card issues when a
  // seller picks 3m themselves, so React Query dedupes it rather than double-fetching.
  const { data: lifetimeCheck, isPending: lifetimeCheckPending } = useQuery({
    queryKey: orderAnalyticsQueryKey({ range: '3m' }),
    queryFn: () => getOrderAnalytics({ range: '3m' }),
  });

  if (lifetimeCheckPending) {
    return <SkeletonLoader rows={6} />;
  }

  const isNewSeller = lifetimeCheck?.totalOrders === 0;

  return (
    <div>
      <Typography.Title level={3} style={{ marginBottom: 'var(--sp-4)' }}>
        {t('dashboard.title')}
      </Typography.Title>

      {isNewSeller ? (
        <EmptyState title={t('dashboard.emptyTitle')} description={t('dashboard.emptyDescription')} />
      ) : (
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <DateRangeFilter preset={preset} customRange={customRange} onPresetChange={setPreset} onCustomRangeChange={setCustomRange} />
          <RevenueCards rangeParams={rangeParams} />
          <SalesTrendChart rangeParams={rangeParams} />
          <CategoryBreakdownChart rangeParams={rangeParams} />
          <OrderAnalyticsCard rangeParams={rangeParams} />
          <CustomerAnalyticsCard rangeParams={rangeParams} />
          <TopProductsTable rangeParams={rangeParams} />
        </Space>
      )}
    </div>
  );
}
