import type { OrderStatus } from '@karobarai/shared';
import { Typography } from 'antd';
import { Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { STATUS_ICON } from './TrackingTimeline';

interface TrackingStatusCardProps {
  status: OrderStatus;
  /** Real, server-computed human label (TrackingDTO.deliveryStageLabel) — never a client-derived guess. */
  deliveryStageLabel: string;
  colorForStatus?: (status: string) => string;
}

// E6 — "what is happening to my order right now?" is the first question the brief calls out;
// this card answers it in one glance, above the timeline/map. No invented ETA — TrackingDTO has
// no such field, so the message stays honest and status-only rather than guessing a delivery date.
export function TrackingStatusCard({ status, deliveryStageLabel, colorForStatus }: TrackingStatusCardProps) {
  const { t } = useTranslation(['orders']);
  const Icon = STATUS_ICON[status] ?? Circle;
  const color = colorForStatus?.(status) ?? 'var(--brand-primary)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-4)',
        padding: 'var(--sp-5)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-surface)',
        boxShadow: 'var(--shadow-md)',
        borderInlineStart: `3px solid ${color}`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: color,
          color: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <Icon size={24} />
      </span>
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {deliveryStageLabel}
        </Typography.Title>
        <Typography.Text type="secondary">{t(`tracking.statusMessage.${status}`)}</Typography.Text>
      </div>
    </div>
  );
}
