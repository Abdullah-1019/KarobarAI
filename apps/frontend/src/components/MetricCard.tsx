import type { ReactNode } from 'react';
import { Card, Typography } from 'antd';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  tone?: 'neutral' | 'warning';
}

// E4: a plain count (products live, out of stock, recent orders) needed the same "number sits
// high in hierarchy" treatment PriceDisplay already gives money (UIUX §4, §6.1 tabular figures),
// but isn't itself a price — AntD's own <Statistic> (used by RevenueCards) carries its own
// currency-oriented formatting/animation that doesn't fit a plain integer count. One small shared
// tile instead of ad hoc Typography per dashboard metric.
export function MetricCard({ label, value, tone = 'neutral' }: MetricCardProps) {
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
    </Card>
  );
}
