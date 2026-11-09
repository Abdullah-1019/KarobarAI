import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Lightbulb, Store, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';

import type { CategoryDTO, OrderReturnTrendPointDTO, SellerFraudFlag } from '@karobarai/shared';
import { StatusTag, type StatusVariant } from '../../components';
import { useLanguage } from '../../hooks';
import { AnalyticsError, Shimmer } from '../analytics/AnalyticsCardState';
import { DateRangeFilter } from '../analytics/DateRangeFilter';
import { formatCompactRupees, formatRupees, parseDay } from '../analytics/analyticsFormat';
import { toRangeParams, type RangePreset } from '../analytics/rangePresets';
import { CATEGORIES_QUERY_KEY, getCategories } from '../catalog/catalogApi';
import { getGmvTrend, getOrderReturnTrend, getSellerPerformance, gmvTrendQueryKey, orderReturnTrendQueryKey, sellerPerformanceQueryKey } from './adminApi';
import '../analytics/analytics.css';

const FRAUD_FLAG_VARIANT: Record<SellerFraudFlag, StatusVariant> = {
  NONE: 'neutral',
  WARNING: 'warning',
  AUTO_SUSPEND: 'error',
};
const GROUPS = ['none', 'seller', 'category'] as const;
type GmvGroupBy = (typeof GROUPS)[number];
const MAX_BARS = 6;

function flattenCategories(list: CategoryDTO[]): CategoryDTO[] {
  return list.flatMap((c) => [c, ...flattenCategories(c.children ?? [])]);
}

// Extended SCR-AD01 report views — "how is the platform performing" (distinct from /admin's
// "what needs my attention"), in the seller analytics' visual language (glass cards, Studio
// chart tokens, custom tooltips, a screen-reader table per chart).
// - GMV: an area over time when grouped by date; a ranked bar list when grouped by store or
//   category (a comparison, not a trend), top 6 + "Other". The backend already keys those by store
//   name / English category name (never an id); category names are shown in Urdu when available.
//   `groupBy=category` counts delivered order value, not settled money (the backend's basisNote),
//   so the card says so instead of hiding it.
// - Orders vs returns: two counts on one scale, so one axis; legend chips name both lines.
// - Insights stay conservative: each sentence reads straight off data fetched on this page.
export function ReportsPage() {
  const { t } = useTranslation(['admin']);
  const { language, dir } = useLanguage();
  const rtl = dir === 'rtl';
  const locale = language === 'UR' ? 'ur-PK' : 'en-GB';
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [customRange, setCustomRange] = useState<[string, string] | null>(null);
  const [groupBy, setGroupBy] = useState<GmvGroupBy>('none');
  const rangeParams = toRangeParams(preset, customRange);

  const gmvParams = { ...rangeParams, groupBy: groupBy === 'none' ? undefined : groupBy };
  const gmvTrend = useQuery({ queryKey: gmvTrendQueryKey(gmvParams), queryFn: () => getGmvTrend(gmvParams) });
  const orderReturnTrend = useQuery({ queryKey: orderReturnTrendQueryKey(rangeParams), queryFn: () => getOrderReturnTrend(rangeParams) });
  const sellerPerformance = useQuery({ queryKey: sellerPerformanceQueryKey(rangeParams), queryFn: () => getSellerPerformance(rangeParams) });
  const categories = useQuery({ queryKey: CATEGORIES_QUERY_KEY, queryFn: getCategories, enabled: groupBy === 'category' && language === 'UR', staleTime: 30 * 60_000 });

  const urByEn = new Map(flattenCategories(categories.data ?? []).map((c) => [c.nameEn, c.nameUr]));
  const shortDate = (date: string) => parseDay(date).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const longDate = (date: string) => parseDay(date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });

  // GMV
  const gmvPoints = gmvTrend.data?.points.map((p) => ({ key: p.key, gmv: Number(p.gmv) })) ?? [];
  const gmvTotal = gmvPoints.reduce((sum, p) => sum + p.gmv, 0);
  const gmvEmpty = gmvTrend.isSuccess && gmvPoints.every((p) => p.gmv === 0);
  const ranked = [...gmvPoints].sort((a, b) => b.gmv - a.gmv)
    .map((p) => ({ ...p, name: groupBy === 'category' ? urByEn.get(p.key) || p.key : p.key }));
  const bars = ranked.length > MAX_BARS + 1 ? ranked.slice(0, MAX_BARS) : ranked;
  if (bars.length < ranked.length) {
    bars.push({ key: 'other', name: t('reports.other'), gmv: ranked.slice(MAX_BARS).reduce((sum, p) => sum + p.gmv, 0) });
  }
  const topBar = Math.max(1, ...bars.map((b) => b.gmv));

  // Orders vs returns
  const orPoints = orderReturnTrend.data?.points ?? [];
  const orEmpty = orderReturnTrend.isSuccess && orPoints.every((p) => p.orderCount === 0 && p.returnCount === 0);

  // Seller performance
  const sellers = [...(sellerPerformance.data?.items ?? [])].sort((a, b) => Number(b.gmv) - Number(a.gmv));
  const topSeller = Math.max(1, ...sellers.map((s) => Number(s.gmv)));

  const insights: string[] = [];
  if (sellers.length > 0) {
    insights.push(t('reports.insightTopSeller', { store: sellers[0]!.storeName }));
    const flagged = sellers.filter((s) => s.fraudFlag !== 'NONE').length;
    if (flagged > 0) insights.push(t('reports.insightFraudFlags', { count: flagged }));
  }
  if (orPoints.length > 0) {
    const latest = orPoints.at(-1)!;
    if (latest.returnRate > 0) insights.push(t('reports.insightReturnRate', { rate: latest.returnRate.toFixed(1) }));
  }

  const gmvTip = ({ active, payload }: TooltipProps<number, string>) => {
    const row = active ? (payload?.[0]?.payload as { key: string; gmv: number } | undefined) : undefined;
    if (!row) return null;
    return (
      <div className="anTip">
        <p className="anTipDate">{longDate(row.key)}</p>
        <p className="anTipRow"><span className="anDot is-sales" aria-hidden="true" />{t('reports.gmvLabel')} <strong>{formatRupees(row.gmv).whole}</strong></p>
      </div>
    );
  };
  const orTip = ({ active, payload }: TooltipProps<number, string>) => {
    const row = active ? (payload?.[0]?.payload as OrderReturnTrendPointDTO | undefined) : undefined;
    if (!row) return null;
    return (
      <div className="anTip">
        <p className="anTipDate">{longDate(row.date)}</p>
        <p className="anTipRow"><span className="anDot is-sales" aria-hidden="true" />{t('reports.orders')} <strong>{row.orderCount}</strong></p>
        <p className="anTipRow"><span className="anDot is-repeat" aria-hidden="true" />{t('reports.returns')} <strong>{row.returnCount}</strong></p>
        <p className="anTipRow anTipMuted">{t('reports.returnRateLine', { rate: row.returnRate.toFixed(1) })}</p>
      </div>
    );
  };
  const axisTick = { fill: 'var(--text-tertiary)', fontSize: 12 };

  return (
    <div className="adPage anPage">
      <header className="adHeroHead rpHead">
        <div className="adHead">
          <h1 className="adTitle">{t('reports.title')}</h1>
          <p className="adSub">{t('reports.subtitle')}</p>
        </div>
        <DateRangeFilter preset={preset} customRange={customRange} onPresetChange={setPreset} onCustomRangeChange={setCustomRange} />
      </header>

      <div className="rpGrid">
        <section className="anCard rpWide" aria-labelledby="rp-gmv">
          <header className="anCardHead rpCardHead">
            <span className="anIcon anIcon--peach" aria-hidden="true"><TrendingUp size={18} /></span>
            <div className="rpCardText">
              <h2 className="anCardTitle" id="rp-gmv">{t('reports.gmvTrendTitle')}</h2>
              <p className="anCardSub">
                {t(groupBy === 'none' ? 'reports.gmvSubDate' : groupBy === 'seller' ? 'reports.gmvSubSeller' : 'reports.gmvSubCategory')}
                {gmvTrend.isSuccess && !gmvEmpty && <> · <strong>{t('reports.total', { value: formatRupees(gmvTotal).whole })}</strong></>}
              </p>
            </div>
            <div className="adPills" role="radiogroup" aria-label={t('reports.gmvTrendTitle')}>
              {GROUPS.map((value) => (
                <button key={value} type="button" role="radio" aria-checked={groupBy === value} className="adPill"
                  onClick={() => setGroupBy(value)}>
                  {t(value === 'none' ? 'reports.groupByDate' : value === 'seller' ? 'reports.groupBySeller' : 'reports.groupByCategory')}
                </button>
              ))}
            </div>
          </header>

          {gmvTrend.isPending && <Shimmer height={260} />}
          {gmvTrend.isError && <AnalyticsError error={gmvTrend.error} onRetry={() => void gmvTrend.refetch()} />}
          {gmvEmpty && (
            <div className="rpEmpty">
              <p className="rpEmptyTitle">{t('reports.notEnoughDataTitle')}</p>
              <p>{t('reports.notEnoughDataBody')}</p>
            </div>
          )}
          {gmvTrend.isSuccess && !gmvEmpty && (
            <>
              {groupBy === 'category' && <p className="rpBasis">{t('reports.categoryBasis')}</p>}
              {groupBy === 'none' ? (
                <div className="anChart">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={gmvPoints} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                      <defs>
                        <linearGradient id="rpGmvFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.24} />
                          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="key" reversed={rtl} tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={28} tick={axisTick} />
                      <YAxis orientation={rtl ? 'right' : 'left'} tickFormatter={(v: number) => formatCompactRupees(v)} tickLine={false}
                        axisLine={false} width={56} allowDecimals={false} tick={axisTick} />
                      <Tooltip content={gmvTip} cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '4 4' }} />
                      <Area type="monotone" dataKey="gmv" stroke="var(--chart-1)" strokeWidth={2} fill="url(#rpGmvFill)"
                        activeDot={{ r: 5, fill: 'var(--chart-1)', stroke: 'var(--bg-surface)', strokeWidth: 2 }}
                        isAnimationActive={!reduceMotion} animationDuration={1200} animationEasing="ease-out" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ul className="anCats rpBars">
                  {bars.map((bar, i) => (
                    <li key={bar.key} className="anCat">
                      <div className="anCatLine">
                        <span className="anCatName" dir="auto">{bar.name}</span>
                        <span className="anCatVal">
                          {formatRupees(bar.gmv).whole}
                          <span className="anCatPct">{gmvTotal > 0 ? `${((bar.gmv / gmvTotal) * 100).toFixed(0)}%` : ''}</span>
                        </span>
                      </div>
                      <span className="anCatTrack" aria-hidden="true">
                        <span className="anCatFill" style={{ inlineSize: `${(bar.gmv / topBar) * 100}%`, animationDelay: `${i * 70}ms` }} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <table className="anSrOnly">
                <caption>{t('reports.gmvTrendTitle')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{groupBy === 'none' ? t('reports.dateLabel') : groupBy === 'seller' ? t('reports.columnStore') : t('reports.groupByCategory')}</th>
                    <th scope="col">{t('reports.gmvLabel')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(groupBy === 'none' ? gmvPoints.map((p) => ({ ...p, name: shortDate(p.key) })) : ranked).map((p) => (
                    <tr key={p.key}><td>{p.name}</td><td>{formatRupees(p.gmv).whole}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        <section className="anCard rpWide" aria-labelledby="rp-or">
          <header className="anCardHead rpCardHead">
            <span className="anIcon anIcon--sky" aria-hidden="true"><Activity size={18} /></span>
            <div className="rpCardText">
              <h2 className="anCardTitle" id="rp-or">{t('reports.orderReturnTrendTitle')}</h2>
              <p className="anCardSub">{t('reports.ordersSub')}</p>
            </div>
            <ul className="rpLegend">
              <li><span className="anDot is-sales" aria-hidden="true" />{t('reports.orders')}</li>
              <li><span className="anDot is-repeat" aria-hidden="true" />{t('reports.returns')}</li>
            </ul>
          </header>
          {orderReturnTrend.isPending && <Shimmer height={240} />}
          {orderReturnTrend.isError && <AnalyticsError error={orderReturnTrend.error} onRetry={() => void orderReturnTrend.refetch()} />}
          {orEmpty && (
            <div className="rpEmpty">
              <p className="rpEmptyTitle">{t('reports.notEnoughDataTitle')}</p>
              <p>{t('reports.notEnoughDataBody')}</p>
            </div>
          )}
          {orderReturnTrend.isSuccess && !orEmpty && (
            <div className="anChart">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={orPoints} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="date" reversed={rtl} tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={28} tick={axisTick} />
                  <YAxis orientation={rtl ? 'right' : 'left'} tickLine={false} axisLine={false} width={40} allowDecimals={false} tick={axisTick} />
                  <Tooltip content={orTip} cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '4 4' }} />
                  <Line type="monotone" dataKey="orderCount" name={t('reports.orders')} stroke="var(--chart-1)" strokeWidth={2} dot={false}
                    activeDot={{ r: 5, fill: 'var(--chart-1)', stroke: 'var(--bg-surface)', strokeWidth: 2 }} isAnimationActive={!reduceMotion} />
                  <Line type="monotone" dataKey="returnCount" name={t('reports.returns')} stroke="var(--chart-2)" strokeWidth={2} dot={false}
                    activeDot={{ r: 5, fill: 'var(--chart-2)', stroke: 'var(--bg-surface)', strokeWidth: 2 }} isAnimationActive={!reduceMotion} />
                </LineChart>
              </ResponsiveContainer>
              <table className="anSrOnly">
                <caption>{t('reports.orderReturnTrendTitle')}</caption>
                <thead>
                  <tr><th scope="col">{t('reports.dateLabel')}</th><th scope="col">{t('reports.orders')}</th><th scope="col">{t('reports.returns')}</th></tr>
                </thead>
                <tbody>
                  {orPoints.map((p) => <tr key={p.date}><td>{shortDate(p.date)}</td><td>{p.orderCount}</td><td>{p.returnCount}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="anCard rpWide" aria-labelledby="rp-sellers">
          <header className="anCardHead">
            <span className="anIcon anIcon--lilac" aria-hidden="true"><Store size={18} /></span>
            <div>
              <h2 className="anCardTitle" id="rp-sellers">{t('reports.sellerPerformanceTitle')}</h2>
              <p className="anCardSub">{t('reports.perfSub')}</p>
            </div>
          </header>
          {sellerPerformance.isPending && <Shimmer height={200} />}
          {sellerPerformance.isError && <AnalyticsError error={sellerPerformance.error} onRetry={() => void sellerPerformance.refetch()} />}
          {sellerPerformance.isSuccess && sellers.length === 0 && (
            <div className="rpEmpty">
              <p className="rpEmptyTitle">{t('reports.notEnoughDataTitle')}</p>
              <p>{t('reports.notEnoughDataBody')}</p>
            </div>
          )}
          {sellers.length > 0 && (
            <div className="rpTableWrap">
              <table className="rpTable">
                <thead>
                  <tr>
                    <th scope="col">{t('reports.columnStore')}</th>
                    <th scope="col">{t('reports.columnGmv')}</th>
                    <th scope="col">{t('reports.columnFulfilmentRate')}</th>
                    <th scope="col">{t('reports.columnFraudRate')}</th>
                    <th scope="col">{t('reports.columnFraudFlag')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((s, i) => (
                    <tr key={s.sellerId} style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                      <th scope="row">
                        <span className="rpRank">{i + 1}</span>
                        <span dir="auto">{s.storeName}</span>
                      </th>
                      <td>
                        <span className="rpGmv">
                          <span className="rpGmvNum">{formatRupees(Number(s.gmv)).whole}</span>
                          <span className="rpGmvBar" aria-hidden="true"><span style={{ inlineSize: `${(Number(s.gmv) / topSeller) * 100}%` }} /></span>
                        </span>
                      </td>
                      <td className="rpNum">{s.fulfilmentRate.toFixed(1)}%</td>
                      <td className="rpNum" data-hot={s.fraudRate30d > 0 || undefined}>{s.fraudRate30d.toFixed(1)}%</td>
                      <td><StatusTag variant={FRAUD_FLAG_VARIANT[s.fraudFlag]} label={t(`reports.fraudFlag.${s.fraudFlag}`)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {insights.length > 0 && (
          <section className="anCard rpWide rpInsights" aria-labelledby="rp-insights">
            <header className="anCardHead">
              <span className="anIcon anIcon--sand" aria-hidden="true"><Lightbulb size={18} /></span>
              <div>
                <h2 className="anCardTitle" id="rp-insights">{t('reports.insightsTitle')}</h2>
                <p className="anCardSub">{t('reports.insightsSub')}</p>
              </div>
            </header>
            <ul className="rpInsightList">
              {insights.map((text) => <li key={text} dir="auto">{text}</li>)}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
