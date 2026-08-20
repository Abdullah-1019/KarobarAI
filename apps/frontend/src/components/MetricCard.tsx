import type { ReactNode } from 'react';
import { Card, Typography } from 'antd';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface MetricCardTrend {
  /** Real period-over-period % change from the API — never compute or guess this client-side. */
  value: number;
  /** e.g. "vs previous 30 days" — must describe what the comparison actually is. */
  contextLabel: string;
}

interface MetricCardProps {
  label: string;
  value: ReactNode;
  trend?: MetricCardTrend | null;
  tone?: 'neutral' | 'warning';
}

// E4: a plain count (products live, out of stock, recent orders) needed the same "number sits
// high in hierarchy" treatment PriceDisplay already gives money (UIUX §4, §6.1 tabular figures),
// but isn't itself a price — AntD's own <Statistic> (used by RevenueCards) carries its own
// currency-oriented formatting/animation that doesn't fit a plain integer count. One small shared
// tile instead of ad hoc Typography per dashboard metric.
//
// E7: added an optional `trend` line (metric -> value -> context, the brief's own KPI-card
// formula) — only ever fed a real API-computed pctChangeVsPrevious, never fabricated here. Icon +
// color together (never color alone), muted rather than a bright badge, since a whole dashboard of
// loud trend chips reads as noisy, not "precise and professional."
export function MetricCard({ label, value, trend, tone = 'neutral' }: MetricCardProps) {
  return (
    <Card size="small" style={{ height: '100%' }}>
      <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-sm)' }}>
        {label}
      </Typography.Text>
      <div
        style={{
          fontSize: 'var(--fs-2xl)',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: tone === 'warning' ? 'var(--warning)' : 'var(--text-primary)',
          marginTop: 'var(--sp-1)',
        }}
      >
        {value}
      </div>
      {trend && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-1)',
            marginTop: 'var(--sp-1)',
            fontSize: 'var(--fs-xs)',
            color: trend.value >= 0 ? 'var(--success)' : 'var(--error)',
          }}
        >
          {trend.value >= 0 ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
          <span>
            {trend.value >= 0 ? '+' : ''}
            {trend.value.toFixed(1)}%
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>{trend.contextLabel}</span>
        </div>
      )}
    </Card>
  );
}
