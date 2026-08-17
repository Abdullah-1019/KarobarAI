import { useState } from 'react';
import { Alert, Card, Col, Row, Space, Statistic, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { SkeletonLoader } from '../../components';
import { DateRangeFilter, toRangeParams, type RangePreset } from '../analytics/DateRangeFilter';
import { adminAlertsQueryKey, adminKpisQueryKey, getAdminAlerts, getAdminKpis } from './adminApi';
import { formatAdminError } from './adminErrors';

// SCR-AD01 — platform-wide KPI tiles + alert feed. Reuses Feature 11's DateRangeFilter/
// toRangeParams verbatim (AdminRangeParams and AnalyticsRangeParams are the identical
// {range,startDate,endDate} shape) rather than rebuilding the same date-range picker a second
// time for a structurally identical query param.
export function AdminDashboardPage() {
  const { t } = useTranslation(['admin']);
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [customRange, setCustomRange] = useState<[string, string] | null>(null);
  const rangeParams = toRangeParams(preset, customRange);

  const kpis = useQuery({ queryKey: adminKpisQueryKey(rangeParams), queryFn: () => getAdminKpis(rangeParams) });
  const alerts = useQuery({ queryKey: adminAlertsQueryKey, queryFn: () => getAdminAlerts() });

  return (
    <div>
      <Typography.Title level={3} style={{ marginBottom: 'var(--sp-4)' }}>
        {t('dashboard.title')}
      </Typography.Title>

      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <DateRangeFilter preset={preset} customRange={customRange} onPresetChange={setPreset} onCustomRangeChange={setCustomRange} />

        <Card title={t('dashboard.kpisTitle')}>
          {kpis.isPending && <SkeletonLoader rows={2} />}
          {kpis.isError && <Alert type="error" showIcon message={formatAdminError(t, kpis.error)} />}
          {kpis.isSuccess && (
            <Row gutter={16}>
              <Col xs={12} sm={6}>
                <Statistic
                  title={t('dashboard.gmv')}
                  value={Number(kpis.data.gmv)}
                  precision={2}
                  prefix="Rs."
                  suffix={
                    kpis.data.pctChangeVsPrevious !== null ? (
                      <span
                        style={{
                          fontSize: 'var(--fs-sm)',
                          color: kpis.data.pctChangeVsPrevious >= 0 ? 'var(--success)' : 'var(--error)',
                        }}
                      >
                        {kpis.data.pctChangeVsPrevious >= 0 ? '+' : ''}
                        {kpis.data.pctChangeVsPrevious.toFixed(1)}%
                      </span>
                    ) : undefined
                  }
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title={t('dashboard.activeUsers')} value={kpis.data.activeUsers} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title={t('dashboard.adapterUptime')} value={kpis.data.adapterUptime} suffix="%" />
              </Col>
            </Row>
          )}
        </Card>

        <Card title={t('dashboard.alertsTitle')}>
          {alerts.isPending && <SkeletonLoader rows={2} />}
          {alerts.isError && <Alert type="error" showIcon message={formatAdminError(t, alerts.error)} />}
          {alerts.isSuccess && (
            <Row gutter={16}>
              <Col xs={12} sm={6}>
                <Statistic title={t('dashboard.manualLogisticsOrders')} value={alerts.data.manualLogisticsOrders} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title={t('dashboard.stuckPayments')} value={alerts.data.stuckPayments} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title={t('dashboard.openDisputes')} value={alerts.data.openDisputes} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title={t('dashboard.fraudFlaggedSellers')} value={alerts.data.fraudFlaggedSellers} />
              </Col>
            </Row>
          )}
        </Card>
      </Space>
    </div>
  );
}
