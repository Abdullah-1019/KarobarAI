import { Alert, Card, Col, Row, Statistic } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { SkeletonLoader } from '../../components';
import type { AnalyticsRangeParams } from './analyticsApi';
import { getRevenue, revenueQueryKey } from './analyticsApi';
import { formatAnalyticsError } from './analyticsErrors';

// REQ-F-Analytics-001 — current/previous month + YTD, sourced from settlements.net WHERE
// status=SETTLED. Reads "Rs. 0" for every real seller until a settlement engine exists
// (F11-analytics-backend.md's documented, honest gap) — not a frontend bug.
export function RevenueCards({ rangeParams }: { rangeParams: AnalyticsRangeParams }) {
  const { t } = useTranslation(['analytics']);
  const { data, isPending, isError, error } = useQuery({
    queryKey: revenueQueryKey(rangeParams),
    queryFn: () => getRevenue(rangeParams),
  });

  if (isPending) return <SkeletonLoader rows={2} />;
  if (isError) return <Alert type="error" showIcon message={formatAnalyticsError(t, error)} />;

  const pctChange = data.pctChangeVsPrevious;

  return (
    <Row gutter={16}>
      <Col xs={24} sm={8}>
        <Card>
          <Statistic
            title={t('revenue.current')}
            value={Number(data.current)}
            precision={2}
            prefix="Rs."
            suffix={
              pctChange !== null ? (
                <span style={{ fontSize: 14, color: pctChange >= 0 ? 'var(--success, #3f8600)' : 'var(--error, #cf1322)' }}>
                  {pctChange >= 0 ? '+' : ''}
                  {pctChange.toFixed(1)}%
                </span>
              ) : undefined
            }
          />
        </Card>
      </Col>
      <Col xs={24} sm={8}>
        <Card>
          <Statistic title={t('revenue.previous')} value={Number(data.previous)} precision={2} prefix="Rs." />
        </Card>
      </Col>
      <Col xs={24} sm={8}>
        <Card>
          <Statistic title={t('revenue.ytd')} value={Number(data.ytd)} precision={2} prefix="Rs." />
        </Card>
      </Col>
    </Row>
  );
}
