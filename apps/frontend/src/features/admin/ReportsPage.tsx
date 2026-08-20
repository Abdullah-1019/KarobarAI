import { useState } from 'react';
import { Alert, Card, Segmented, Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { SellerFraudFlag, SellerPerformanceItemDTO } from '@karobarai/shared';
import { EmptyState, PageHeader, PriceDisplay, SkeletonLoader, StatusTag, type StatusVariant } from '../../components';
import { DateRangeFilter, toRangeParams, type RangePreset } from '../analytics/DateRangeFilter';
import { getGmvTrend, getOrderReturnTrend, getSellerPerformance, gmvTrendQueryKey, orderReturnTrendQueryKey, sellerPerformanceQueryKey } from './adminApi';
import { formatAdminError } from './adminErrors';

const FRAUD_FLAG_VARIANT: Record<SellerFraudFlag, StatusVariant> = {
  NONE: 'neutral',
  WARNING: 'warning',
  AUTO_SUSPEND: 'error',
};

type GmvGroupBy = 'none' | 'seller' | 'category';

// Extended SCR-AD01 report views (Task 5) — platform-wide, composed from Feature 11's aggregation
// patterns with ownership removed, not rebuilt. `groupBy=category` carries the backend's own
// documented basisNote (realized order-item revenue, not settlement net) — surfaced verbatim,
// not silently hidden, since it genuinely won't sum to the same total as the default/seller view.
//
// E7 — this is the "how is the platform performing" screen (distinct from /admin's "what needs my
// attention"). Two chart-type fixes from the prior version: GMV trend now renders as an area chart
// when grouped by date (a trend over time, per the brief's own chart-selection rule) and only
// switches to bars when the seller/category grouping turns it into a comparison across discrete
// categories — a bar chart was previously used for both, which is the wrong type for the date case.
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
    {
      title: t('reports.columnGmv'),
      dataIndex: 'gmv',
      key: 'gmv',
      sorter: (a: SellerPerformanceItemDTO, b: SellerPerformanceItemDTO) => Number(a.gmv) - Number(b.gmv),
      render: (v: string) => <PriceDisplay amount={v} size="sm" />,
    },
    {
      title: t('reports.columnFraudRate'),
      dataIndex: 'fraudRate30d',
      key: 'fraudRate30d',
      sorter: (a: SellerPerformanceItemDTO, b: SellerPerformanceItemDTO) => a.fraudRate30d - b.fraudRate30d,
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: t('reports.columnFraudFlag'),
      dataIndex: 'fraudFlag',
      key: 'fraudFlag',
      render: (flag: SellerFraudFlag) => <StatusTag variant={FRAUD_FLAG_VARIANT[flag]} label={t(`reports.fraudFlag.${flag}`)} />,
    },
    {
      title: t('reports.columnFulfilmentRate'),
      dataIndex: 'fulfilmentRate',
      key: 'fulfilmentRate',
      sorter: (a: SellerPerformanceItemDTO, b: SellerPerformanceItemDTO) => a.fulfilmentRate - b.fulfilmentRate,
      render: (v: number) => `${v.toFixed(1)}%`,
    },
  ];

  // A single, conservative, real-data-derived observation — not a fabricated "AI insight" (no
  // insight-generation system exists anywhere in this codebase, confirmed during research). Every
  // clause below reads directly from data already fetched for this exact page; nothing is computed
  // or guessed beyond what the API returned.
  const insights: string[] = [];
  if (sellerPerformance.data && sellerPerformance.data.items.length > 0) {
    const top = [...sellerPerformance.data.items].sort((a, b) => Number(b.gmv) - Number(a.gmv))[0]!;
    insights.push(t('reports.insightTopSeller', { store: top.storeName }));
    const flagged = sellerPerformance.data.items.filter((s) => s.fraudFlag !== 'NONE').length;
    if (flagged > 0) insights.push(t('reports.insightFraudFlags', { count: flagged }));
  }
  if (orderReturnTrend.data && orderReturnTrend.data.points.length > 0) {
    const latest = orderReturnTrend.data.points.at(-1)!;
    if (latest.returnRate > 0) insights.push(t('reports.insightReturnRate', { rate: latest.returnRate.toFixed(1) }));
  }

  return (
    <div>
      <PageHeader title={t('reports.title')} />
      <Typography.Paragraph type="secondary" style={{ marginTop: 'calc(-1 * var(--sp-3))', marginBottom: 'var(--sp-4)' }}>
        {t('reports.subtitle')}
      </Typography.Paragraph>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
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
          {gmvTrend.isSuccess && gmvTrend.data.points.every((p) => Number(p.gmv) === 0) && (
            <EmptyState title={t('reports.notEnoughDataTitle')} description={t('reports.notEnoughDataBody')} />
          )}
          {gmvTrend.isSuccess && gmvTrend.data.points.some((p) => Number(p.gmv) !== 0) && (
            <>
              {gmvTrend.data.basisNote && (
                <Alert style={{ marginBottom: 'var(--sp-3)' }} type="warning" showIcon message={gmvTrend.data.basisNote} />
              )}
              <ResponsiveContainer width="100%" height={280}>
                {groupBy === 'none' ? (
                  <AreaChart data={gmvTrend.data.points.map((p) => ({ key: p.key, gmv: Number(p.gmv) }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="key" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => [`Rs. ${value.toLocaleString()}`, t('reports.gmvLabel')]}
                      labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
                    />
                    <Area type="monotone" dataKey="gmv" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.12} strokeWidth={2} />
                  </AreaChart>
                ) : (
                  <BarChart data={gmvTrend.data.points.map((p) => ({ key: p.key, gmv: Number(p.gmv) }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="key" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [`Rs. ${value.toLocaleString()}`, t('reports.gmvLabel')]} />
                    <Bar dataKey="gmv" fill="var(--chart-1)" />
                  </BarChart>
                )}
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
                <Tooltip labelFormatter={(label: string) => new Date(label).toLocaleDateString()} />
                {/* orders = chart-1 (green, the primary metric); returns = chart-3 (neutral),
                    not chart-2/marigold — marigold means celebration/highlight (UIUX §5.1,
                    §12), and a returns count isn't that. Neutral reads as "the comparison
                    line" per §18, which is exactly its role here. */}
                <Line type="monotone" dataKey="orderCount" name={t('reports.orders')} stroke="var(--chart-1)" dot={false} />
                <Line type="monotone" dataKey="returnCount" name={t('reports.returns')} stroke="var(--chart-3)" dot={false} />
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
              scroll={{ x: true }}
              locale={{ emptyText: <EmptyState title={t('reports.notEnoughDataTitle')} description={t('reports.notEnoughDataBody')} /> }}
            />
          )}
        </Card>

        {insights.length > 0 && (
          <Card title={t('reports.insightsTitle')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {insights.map((text, i) => (
                <div key={i} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'flex-start' }}>
                  <Lightbulb size={16} aria-hidden="true" style={{ color: 'var(--text-secondary)', marginTop: 2, flexShrink: 0 }} />
                  <Typography.Text>{text}</Typography.Text>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
