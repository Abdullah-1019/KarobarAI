import { Alert, Card } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { SkeletonLoader } from '../../components';
import type { AnalyticsRangeParams } from './analyticsApi';
import { getSalesTrend, salesTrendQueryKey } from './analyticsApi';
import { formatAnalyticsError } from './analyticsErrors';

// REQ-F-Analytics-002 — daily sales trend. Backend zero-fills every day in range (Task 3), so the
// line is always continuous even with sparse data (App Flow's "charts handle gaps gracefully").
export function SalesTrendChart({ rangeParams }: { rangeParams: AnalyticsRangeParams }) {
  const { t } = useTranslation(['analytics']);
  const { data, isPending, isError, error } = useQuery({
    queryKey: salesTrendQueryKey(rangeParams),
    queryFn: () => getSalesTrend(rangeParams),
  });

  return (
    <Card title={t('salesTrend.title')}>
      {isPending && <SkeletonLoader rows={4} />}
      {isError && <Alert type="error" showIcon message={formatAnalyticsError(t, error)} />}
      {!isPending && !isError && (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.points.map((p) => ({ ...p, revenue: Number(p.revenue) }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value: number) => [`Rs. ${value.toLocaleString()}`, t('salesTrend.revenueLabel')]} />
            <Line type="monotone" dataKey="revenue" stroke="var(--chart-1, #1677ff)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
