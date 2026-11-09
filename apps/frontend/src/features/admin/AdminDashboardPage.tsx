import { useState } from 'react';
import { Alert, Button } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, CheckCircle2, Scale, ShieldAlert, TrendingDown, TrendingUp, Truck, Wallet,
  type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { AdminAlertFeedDTO } from '@karobarai/shared';
import { DateRangeFilter } from '../analytics/DateRangeFilter';
import { Shimmer } from '../analytics/AnalyticsCardState';
import { toRangeParams, type RangePreset } from '../analytics/rangePresets';
import { useCountUp } from '../analytics/useCountUp';
import { adminAlertsQueryKey, adminKpisQueryKey, getAdminAlerts, getAdminKpis } from './adminApi';
import { formatAdminError } from './adminErrors';
import '../analytics/analytics.css';

const CONTEXT_LABEL_KEY: Record<RangePreset, string> = {
  '7d': 'dashboard.vsPrevious7d',
  '30d': 'dashboard.vsPrevious30d',
  '3m': 'dashboard.vsPrevious3m',
  custom: 'dashboard.vsPreviousPeriod',
};

const ALERT_ITEMS: { key: keyof AdminAlertFeedDTO; icon: LucideIcon; labelKey: string; to?: string }[] = [
  { key: 'openDisputes', icon: Scale, labelKey: 'dashboard.openDisputes', to: '/admin/returns' },
  { key: 'fraudFlaggedSellers', icon: ShieldAlert, labelKey: 'dashboard.fraudFlaggedSellers', to: '/admin/reports' },
  { key: 'manualLogisticsOrders', icon: Truck, labelKey: 'dashboard.manualLogisticsOrders' },
  { key: 'stuckPayments', icon: Wallet, labelKey: 'dashboard.stuckPayments' },
];

function formatRs(value: number) {
  return `Rs ${Math.round(value).toLocaleString()}`;
}

function CountNum({ value, format }: { value: number; format: (n: number) => string }) {
  const shown = useCountUp(value);
  return <>{format(shown)}</>;
}

// SCR-AD01 — "what needs my attention?" (distinct from /admin/reports' "how is the platform
// performing?"). A cool header band holds the range filter and the three real KPIs the backend
// computes (settled GMV with its period-over-period change, buyers/sellers who logged in, and a
// database+cache reachability snapshot — not a rolling uptime, so it's labelled as "right now").
// Below, the alert queues: each tile links to a real screen where one exists and says so plainly
// where none does yet (manual logistics, stuck payments — no admin order/payment screen exists).
export function AdminDashboardPage() {
  const { t } = useTranslation(['admin', 'common']);
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [customRange, setCustomRange] = useState<[string, string] | null>(null);
  const rangeParams = toRangeParams(preset, customRange);

  const kpis = useQuery({ queryKey: adminKpisQueryKey(rangeParams), queryFn: () => getAdminKpis(rangeParams) });
  const alerts = useQuery({ queryKey: adminAlertsQueryKey, queryFn: () => getAdminAlerts() });

  const pct = kpis.data?.pctChangeVsPrevious ?? null;
  const allClear = alerts.isSuccess && ALERT_ITEMS.every(({ key }) => alerts.data[key] === 0);

  return (
    <div className="adPage">
      <section className="adHero" aria-labelledby="ad-title">
        <div className="adHeroHead">
          <div>
            <p className="adEyebrow">{t('dashboard.eyebrow')}</p>
            <h1 className="adTitle" id="ad-title">{t('dashboard.title')}</h1>
          </div>
          <DateRangeFilter preset={preset} customRange={customRange} onPresetChange={setPreset} onCustomRangeChange={setCustomRange} />
        </div>

        {kpis.isError ? (
          <Alert type="error" showIcon message={formatAdminError(t, kpis.error)}
            action={<Button size="small" shape="round" onClick={() => void kpis.refetch()}>{t('common:actions.retry')}</Button>} />
        ) : (
          <div className="adKpis" aria-busy={kpis.isPending}>
            <div className="adKpi">
              <p className="adKpiLabel">{t('dashboard.gmv')}</p>
              {kpis.isSuccess ? (
                <p className="adKpiNum"><CountNum value={Number(kpis.data.gmv)} format={formatRs} /></p>
              ) : <Shimmer height={40} width="70%" />}
              {pct !== null && (
                <span className="adTrend" data-down={pct < 0 || undefined}>
                  {pct < 0 ? <TrendingDown size={14} aria-hidden="true" /> : <TrendingUp size={14} aria-hidden="true" />}
                  <span dir="ltr">{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>
                  <span className="adTrendCtx">{t(CONTEXT_LABEL_KEY[preset])}</span>
                </span>
              )}
              <p className="adKpiHint">{t('dashboard.gmvHint')}</p>
            </div>
            <div className="adKpi">
              <p className="adKpiLabel">{t('dashboard.activeUsers')}</p>
              {kpis.isSuccess ? (
                <p className="adKpiNum"><CountNum value={kpis.data.activeUsers} format={(n) => Math.round(n).toLocaleString()} /></p>
              ) : <Shimmer height={40} width="50%" />}
              <p className="adKpiHint">{t('dashboard.usersHint')}</p>
            </div>
            <div className="adKpi">
              <p className="adKpiLabel">{t('dashboard.adapterUptime')}</p>
              {kpis.isSuccess ? (
                <>
                  <p className="adKpiNum">{kpis.data.adapterUptime}%</p>
                  <span className="adMeter" data-level={kpis.data.adapterUptime >= 100 ? 'ok' : kpis.data.adapterUptime > 0 ? 'warn' : 'down'}>
                    <span style={{ inlineSize: `${kpis.data.adapterUptime}%` }} />
                  </span>
                </>
              ) : <Shimmer height={40} width="40%" />}
              <p className="adKpiHint">{t('dashboard.uptimeHint')}</p>
            </div>
          </div>
        )}
      </section>

      <section className="adSection" aria-labelledby="ad-attention">
        <header className="adSectionHead">
          <h2 className="adSectionTitle" id="ad-attention">{t('dashboard.attentionTitle')}</h2>
          <p className="adSectionSub">{t('dashboard.attentionSub')}</p>
        </header>

        {alerts.isPending && (
          <div className="adAlerts">
            {ALERT_ITEMS.map(({ key }) => <div key={key} className="adAlert"><Shimmer height={64} /></div>)}
          </div>
        )}
        {alerts.isError && (
          <Alert type="error" showIcon message={formatAdminError(t, alerts.error)}
            action={<Button size="small" shape="round" onClick={() => void alerts.refetch()}>{t('common:actions.retry')}</Button>} />
        )}
        {allClear && (
          <p className="adClear"><CheckCircle2 size={18} aria-hidden="true" /> {t('dashboard.allClear')}</p>
        )}
        {alerts.isSuccess && (
          <div className="adAlerts">
            {ALERT_ITEMS.map(({ key, icon: Icon, labelKey, to }, index) => {
              const count = alerts.data[key];
              const body = (
                <>
                  <span className="adAlertIcon" aria-hidden="true"><Icon size={18} /></span>
                  <span className="adAlertNum">{count.toLocaleString()}</span>
                  <span className="adAlertLabel">{t(labelKey)}</span>
                  <span className="adAlertFoot">
                    {to ? <>{t('dashboard.open')} <ArrowUpRight size={14} aria-hidden="true" /></> : t('dashboard.noScreenYet')}
                  </span>
                </>
              );
              const props = { className: 'adAlert', 'data-hot': count > 0 || undefined, style: { animationDelay: `${index * 60}ms` } };
              return to ? <Link key={key} to={to} {...props}>{body}</Link> : <div key={key} {...props}>{body}</div>;
            })}
          </div>
        )}
      </section>
    </div>
  );
}
