import { useState } from 'react';
import { Alert, Card, Segmented, Space, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { SellerFraudFlag, SellerPerformanceItemDTO } from '@karobarai/shared';
import { SkeletonLoader } from '../../components';
import { DateRangeFilter, toRangeParams, type RangePreset } from '../analytics/DateRangeFilter';
import { getGmvTrend, getOrderReturnTrend, getSellerPerformance, gmvTrendQueryKey, orderReturnTrendQueryKey, sellerPerformanceQueryKey } from './adminApi';
import { formatAdminError } from './adminErrors';

const FRAUD_FLAG_COLOR: Record<SellerFraudFlag, string> = {
  NONE: 'default',
  WARNING: 'gold',
  AUTO_SUSPEND: 'red',
};

type GmvGroupBy = 'none' | 'seller' | 'category';

// Extended SCR-AD01 report views (Task 5) — platform-wide, composed from Feature 11's aggregation
// patterns with ownership removed, not rebuilt. `groupBy=category` carries the backend's own
// documented basisNote (realized order-item revenue, not settlement net) — surfaced verbatim,
// not silently hidden, since it genuinely won't sum to the same total as the default/seller view.
export function ReportsPage() {
  const { t } = useTranslation(['admin']);
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [customRange, setCustomRange] = useState<[string, string] | null>(null);
  const [groupBy, setGroupBy] = useState<GmvGroupBy>('none');
  const rangeParams = toRangeParams(preset, customRange);

  const gmvParams = { ...rangeParams, groupBy: groupBy === 'none' ? undefined : groupBy };
  const gmvTrend = useQuery({ queryKey: gmvTrendQueryKey(gmvParams), queryFn: () => getGmvTrend(gmvParams) });
  const orderReturnTrend = useQuery({
    queryKey: orderReturnTrendQueryKey(rangeParams),
    queryFn: () => getOrderReturnTrend(rangeParams),
  });
  const sellerPerformance = useQuery({
    queryKey: sellerPerformanceQueryKey(rangeParams),
    queryFn: () => getSellerPerformance(rangeParams),
  });

  const columns = [
    { title: t('reports.columnStore'), dataIndex: 'storeName', key: 'storeName' },
    { title: t('reports.columnGmv'), dataIndex: 'gmv', key: 'gmv', render: (v: string) => `Rs. ${Number(v).toLocaleString()}` },
    {
      title: t('reports.columnFraudRate'),
      dataIndex: 'fraudRate30d',
      key: 'fraudRate30d',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: t('reports.columnFraudFlag'),
      dataIndex: 'fraudFlag',
      key: 'fraudFlag',
      render: (flag: SellerFraudFlag) => <Tag color={FRAUD_FLAG_COLOR[flag]}>{t(`reports.fraudFlag.${flag}`)}</Tag>,
    },
    {
      title: t('reports.columnFulfilmentRate'),
      dataIndex: 'fulfilmentRate',
      key: 'fulfilmentRate',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t('reports.title')}</Typography.Title>

      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <DateRangeFilter preset={preset} customRange={customRange} onPresetChange={setPreset} onCustomRangeChange={setCustomRange} />

        <Card
          title={t('reports.gmvTrendTitle')}
          extra={
            <Segmented
              size="small"
              value={groupBy}
              onChange={(v) => setGroupBy(v as GmvGroupBy)}
              options={[
                { label: t('reports.groupByDate'), value: 'none' },
                { label: t('reports.groupBySeller'), value: 'seller' },
                { label: t('reports.groupByCategory'), value: 'category' },
              ]}
            />
          }
        >
          {gmvTrend.isPending && <SkeletonLoader rows={4} />}
          {gmvTrend.isError && <Alert type="error" showIcon message={formatAdminError(t, gmvTrend.error)} />}
          {gmvTrend.isSuccess && (
            <>
              {gmvTrend.data.basisNote && (
                <Alert style={{ marginBottom: 12 }} type="warning" showIcon message={gmvTrend.data.basisNote} />
              )}
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={gmvTrend.data.points.map((p) => ({ key: p.key, gmv: Number(p.gmv) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="key" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`Rs. ${value.toLocaleString()}`, t('reports.gmvLabel')]} />
                  <Bar dataKey="gmv" fill="var(--chart-1, #1677ff)" />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </Card>

        <Card title={t('reports.orderReturnTrendTitle')}>
          {orderReturnTrend.isPending && <SkeletonLoader rows={4} />}
          {orderReturnTrend.isError && <Alert type="error" showIcon message={formatAdminError(t, orderReturnTrend.error)} />}
          {orderReturnTrend.isSuccess && (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={orderReturnTrend.data.points}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="orderCount" name={t('reports.orders')} stroke="var(--chart-1, #1677ff)" dot={false} />
                <Line type="monotone" dataKey="returnCount" name={t('reports.returns')} stroke="var(--chart-2, #cf1322)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title={t('reports.sellerPerformanceTitle')}>
          {sellerPerformance.isPending && <SkeletonLoader rows={4} />}
          {sellerPerformance.isError && <Alert type="error" showIcon message={formatAdminError(t, sellerPerformance.error)} />}
          {sellerPerformance.isSuccess && (
            <Table
              rowKey="sellerId"
              columns={columns}
              dataSource={sellerPerformance.data.items as SellerPerformanceItemDTO[]}
              pagination={false}
              size="middle"
            />
          )}
        </Card>
      </Space>
    </div>
  );
}
