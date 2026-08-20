import { useState } from 'react';
import { Alert, Card, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Scale, ShieldAlert, Truck, Wallet, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { AdminAlertFeedDTO } from '@karobarai/shared';
import { MetricCard, PageHeader, SkeletonLoader } from '../../components';
import { DateRangeFilter, toRangeParams, type RangePreset } from '../analytics/DateRangeFilter';
import { adminAlertsQueryKey, adminKpisQueryKey, getAdminAlerts, getAdminKpis } from './adminApi';
import { formatAdminError } from './adminErrors';

const CONTEXT_LABEL_KEY: Record<RangePreset, string> = {
  '7d': 'dashboard.vsPrevious7d',
  '30d': 'dashboard.vsPrevious30d',
  '3m': 'dashboard.vsPrevious3m',
  custom: 'dashboard.vsPreviousPeriod',
};

const ALERT_ITEMS: { key: keyof AdminAlertFeedDTO; icon: LucideIcon; labelKey: string; to?: string }[] = [
  { key: 'manualLogisticsOrders', icon: Truck, labelKey: 'dashboard.manualLogisticsOrders' },
  { key: 'stuckPayments', icon: Wallet, labelKey: 'dashboard.stuckPayments' },
  { key: 'openDisputes', icon: Scale, labelKey: 'dashboard.openDisputes', to: '/admin/returns' },
  { key: 'fraudFlaggedSellers', icon: ShieldAlert, labelKey: 'dashboard.fraudFlaggedSellers', to: '/admin/reports' },
];

// SCR-AD01 — "what needs my attention?" (distinct from /admin/reports' "how is the platform
// performing?", per the brief's explicit Dashboard-vs-Analytics split). KPI tiles answer the
// former with the one real period-over-period figure the backend actually computes (GMV); the
// alert row is the operational half — each tile links to a real screen where a real screen exists
// (Disputes -> the returns queue, Fraud-flagged sellers -> the seller-performance report) and
// stays a plain, non-interactive count where none does yet (Manual logistics, Stuck payments —
// there is no admin order or payment-management screen in this codebase to link to; inventing a
// destination would be worse than an honest dead-end-free tile).
export function AdminDashboardPage() {
  const { t } = useTranslation(['admin']);
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [customRange, setCustomRange] = useState<[string, string] | null>(null);
  const rangeParams = toRangeParams(preset, customRange);

  const kpis = useQuery({ queryKey: adminKpisQueryKey(rangeParams), queryFn: () => getAdminKpis(rangeParams) });
  const alerts = useQuery({ queryKey: adminAlertsQueryKey, queryFn: () => getAdminAlerts() });

  return (
    <div>
      <PageHeader title={t('dashboard.title')} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        <DateRangeFilter preset={preset} customRange={customRange} onPresetChange={setPreset} onCustomRangeChange={setCustomRange} />

        <div>
          <Typography.Text
            strong
            style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-2)' }}
          >
            {t('dashboard.kpisTitle')}
          </Typography.Text>
          {kpis.isPending && <SkeletonLoader rows={2} />}
          {kpis.isError && <Alert type="error" showIcon message={formatAdminError(t, kpis.error)} />}
          {kpis.isSuccess && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-4)' }}>
              <MetricCard
                label={t('dashboard.gmv')}
                value={`Rs. ${Number(kpis.data.gmv).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                trend={
                  kpis.data.pctChangeVsPrevious !== null
                    ? { value: kpis.data.pctChangeVsPrevious, contextLabel: t(CONTEXT_LABEL_KEY[preset]) }
                    : null
                }
              />
              <MetricCard label={t('dashboard.activeUsers')} value={kpis.data.activeUsers.toLocaleString()} />
              <MetricCard label={t('dashboard.adapterUptime')} value={`${kpis.data.adapterUptime}%`} />
            </div>
          )}
        </div>

        <div>
          <Typography.Text
            strong
            style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-2)' }}
          >
            {t('dashboard.alertsTitle')}
          </Typography.Text>
          {alerts.isPending && <SkeletonLoader rows={2} />}
          {alerts.isError && <Alert type="error" showIcon message={formatAdminError(t, alerts.error)} />}
          {alerts.isSuccess && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-4)' }}>
              {ALERT_ITEMS.map(({ key, icon: Icon, labelKey, to }) => {
                const count = alerts.data[key];
                const needsAttention = count > 0;
                const content = (
                  <Card size="small" hoverable={!!to} style={{ height: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: needsAttention ? 'var(--warning-soft)' : 'var(--bg-sunken)',
                          color: needsAttention ? 'var(--warning)' : 'var(--text-secondary)',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={18} />
                      </span>
                      <div>
                        <div
                          style={{
                            fontSize: 'var(--fs-xl)',
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            color: needsAttention ? 'var(--warning)' : 'var(--text-primary)',
                          }}
                        >
                          {count}
                        </div>
                        <Typography.Text style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                          {t(labelKey)}
                        </Typography.Text>
                      </div>
                    </div>
                  </Card>
                );
                return to ? (
                  <Link key={key} to={to} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {content}
                  </Link>
                ) : (
                  <div key={key}>{content}</div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
