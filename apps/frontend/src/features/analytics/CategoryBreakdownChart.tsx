import { Alert, Card } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { SkeletonLoader } from '../../components';
import { useLanguage } from '../../hooks';
import type { AnalyticsRangeParams } from './analyticsApi';
import { getCategoryBreakdown, categoryBreakdownQueryKey } from './analyticsApi';
import { formatAnalyticsError } from './analyticsErrors';

// REQ-F-Analytics-002 — revenue by category. Null category_id comes back from the backend as a
// synthetic "Uncategorized" bucket (Task 3's own flagged gap, resolved server-side), so no
// special-casing is needed here.
export function CategoryBreakdownChart({ rangeParams }: { rangeParams: AnalyticsRangeParams }) {
  const { t } = useTranslation(['analytics']);
  const { language } = useLanguage();
  const { data, isPending, isError, error } = useQuery({
    queryKey: categoryBreakdownQueryKey(rangeParams),
    queryFn: () => getCategoryBreakdown(rangeParams),
  });

  const chartData = data?.items.map((item) => ({
    name: language === 'UR' ? item.categoryNameUr : item.categoryNameEn,
    revenue: Number(item.revenue),
    pctOfTotal: item.pctOfTotal,
  }));

  return (
    <Card title={t('categoryBreakdown.title')}>
      {isPending && <SkeletonLoader rows={4} />}
      {isError && <Alert type="error" showIcon message={formatAnalyticsError(t, error)} />}
      {!isPending && !isError && chartData && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value: number) => [`Rs. ${value.toLocaleString()}`, t('categoryBreakdown.revenueLabel')]} />
            {/* chart-1 (green), not chart-2 (marigold) — this is the chart's only series (a
                revenue metric, not a secondary/highlight one), so it gets the primary token
                per UIUX §18, same as SalesTrendChart's single revenue line. */}
            <Bar dataKey="revenue" fill="var(--chart-1)" />
          </BarChart>
        </ResponsiveContainer>
      )}
      {!isPending && !isError && chartData && chartData.length === 0 && <Alert type="info" message={t('categoryBreakdown.empty')} />}
    </Card>
  );
}
