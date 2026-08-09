import { Alert, Card, Col, Row, Statistic } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { SkeletonLoader } from '../../components';
import type { AnalyticsRangeParams } from './analyticsApi';
import { getCustomerAnalytics, customerAnalyticsQueryKey } from './analyticsApi';
import { formatAnalyticsError } from './analyticsErrors';

// Aggregate buyer counts only (Task 5) — new/repeat classified against lifetime order history,
// never per-buyer PII (Doc 5 §17).
export function CustomerAnalyticsCard({ rangeParams }: { rangeParams: AnalyticsRangeParams }) {
  const { t } = useTranslation(['analytics']);
  const { data, isPending, isError, error } = useQuery({
    queryKey: customerAnalyticsQueryKey(rangeParams),
    queryFn: () => getCustomerAnalytics(rangeParams),
  });

  return (
    <Card title={t('customerAnalytics.title')}>
      {isPending && <SkeletonLoader rows={2} />}
      {isError && <Alert type="error" showIcon message={formatAnalyticsError(t, error)} />}
      {!isPending && !isError && (
        <Row gutter={16}>
          <Col xs={12} sm={6}>
            <Statistic title={t('customerAnalytics.uniqueBuyers')} value={data.uniqueBuyers} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title={t('customerAnalytics.newBuyers')} value={data.newBuyers} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title={t('customerAnalytics.repeatBuyers')} value={data.repeatBuyers} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title={t('customerAnalytics.repeatRate')} value={data.repeatRate} precision={1} suffix="%" />
          </Col>
        </Row>
      )}
    </Card>
  );
}
