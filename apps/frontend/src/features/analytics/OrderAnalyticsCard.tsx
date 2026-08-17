import { Alert, Card, Col, Row, Statistic, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { SkeletonLoader } from '../../components';
import type { AnalyticsRangeParams } from './analyticsApi';
import { getOrderAnalytics, orderAnalyticsQueryKey } from './analyticsApi';
import { formatAnalyticsError } from './analyticsErrors';

// Order volume/lifecycle distribution (Task 4) — placed_at-anchored, all statuses including
// in-flight/cancelled, distinct from Sales Analytics' realized-only basis. Status labels reuse
// the `orders` namespace's existing translations rather than duplicating the enum copy here.
export function OrderAnalyticsCard({ rangeParams }: { rangeParams: AnalyticsRangeParams }) {
  const { t } = useTranslation(['analytics', 'orders']);
  const { data, isPending, isError, error } = useQuery({
    queryKey: orderAnalyticsQueryKey(rangeParams),
    queryFn: () => getOrderAnalytics(rangeParams),
  });

  return (
    <Card title={t('orderAnalytics.title')}>
      {isPending && <SkeletonLoader rows={3} />}
      {isError && <Alert type="error" showIcon message={formatAnalyticsError(t, error)} />}
      {!isPending && !isError && (
        <>
          <Row gutter={16} style={{ marginBottom: 'var(--sp-4)' }}>
            <Col xs={12} sm={8}>
              <Statistic title={t('orderAnalytics.totalOrders')} value={data.totalOrders} />
            </Col>
            <Col xs={12} sm={8}>
              <Statistic title={t('orderAnalytics.cancelledRate')} value={data.cancelledRate} precision={1} suffix="%" />
            </Col>
            <Col xs={12} sm={8}>
              <Statistic title={t('orderAnalytics.avgOrderValue')} value={Number(data.avgOrderValue)} precision={2} prefix="Rs." />
            </Col>
          </Row>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
            {Object.entries(data.byStatus).map(([status, count]) => (
              <Tag key={status}>
                {t(`orders:status.${status}`, { defaultValue: status })}: {count}
              </Tag>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
