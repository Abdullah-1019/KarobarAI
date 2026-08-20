import type { ComponentType } from 'react';
import type { TrackingEventDTO } from '@karobarai/shared';
import { Typography } from 'antd';
import {
  CheckCircle2,
  Circle,
  MapPin,
  Package,
  PackageCheck,
  Truck,
  XCircle,
  type LucideProps,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TrackingTimelineProps {
  timeline: TrackingEventDTO[];
  /** Per-item color, keyed by the event's status. Left to the caller rather than imported here,
   * so this component doesn't have to depend on features/orders' status→color mapping (avoids a
   * features/tracking <-> features/orders import cycle, since OrderDetailPage.tsx already imports
   * from features/tracking for CourierRecommendationCard/TrackingTimeline itself). */
  colorForStatus?: (status: string) => string;
}

// The happy-path milestone order a buyer expects to see ahead of them — deliberately excludes
// PAYMENT_PENDING (precedes tracking existing at all) and COMPLETED (a post-delivery settlement
// status, not a delivery milestone the buyer is waiting on). CANCELLED/PENDING_MANUAL_LOGISTICS
// are exception branches, not part of this line — handled separately below.
const HAPPY_PATH = ['PAYMENT_CONFIRMED', 'PROCESSING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export const STATUS_ICON: Record<string, ComponentType<LucideProps>> = {
  PAYMENT_PENDING: Package,
  PAYMENT_CONFIRMED: PackageCheck,
  PROCESSING: Package,
  PICKED_UP: Truck,
  IN_TRANSIT: Truck,
  OUT_FOR_DELIVERY: MapPin,
  DELIVERED: CheckCircle2,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
  PENDING_MANUAL_LOGISTICS: Circle,
};

// E6 — completed/current/upcoming is the strongest signal a tracking timeline can give (§ "Order
// Tracking" brief). `timeline` is the real, already-happened history the backend returned — every
// event in it is "completed" except the last, which is "current" (most prominent). "Upcoming" is
// the remainder of the happy path that hasn't happened yet, shown quiet/hollow with no timestamp
// (nothing to report yet — not a guess at when it'll happen). A CANCELLED order shows no upcoming
// steps at all: there's nothing further to expect.
export function TrackingTimeline({ timeline, colorForStatus }: TrackingTimelineProps) {
  const { t } = useTranslation(['orders']);

  const currentStatus = timeline.at(-1)?.status;
  const doneStatuses = new Set<string>(timeline.map((e) => e.status));
  const upcoming = currentStatus === 'CANCELLED' ? [] : HAPPY_PATH.filter((s) => !doneStatuses.has(s));

  return (
    <div>
      {timeline.map((event, index) => {
        const isCurrent = index === timeline.length - 1;
        const Icon = STATUS_ICON[event.status] ?? Circle;
        const color = colorForStatus?.(event.status) ?? (isCurrent ? 'var(--brand-primary)' : 'var(--text-secondary)');
        return (
          <div key={`${event.status}-${event.eventTime}`} style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: isCurrent ? 32 : 24,
                  height: isCurrent ? 32 : 24,
                  borderRadius: '50%',
                  background: isCurrent ? color : 'transparent',
                  color: isCurrent ? 'var(--bg-surface)' : color,
                  flexShrink: 0,
                }}
              >
                <Icon size={isCurrent ? 18 : 14} aria-hidden="true" />
              </span>
              {(index < timeline.length - 1 || upcoming.length > 0) && (
                <span style={{ width: 2, flex: 1, minHeight: 'var(--sp-4)', background: 'var(--border)' }} aria-hidden="true" />
              )}
            </div>
            <div style={{ paddingBottom: 'var(--sp-4)' }}>
              <Typography.Text strong={isCurrent} style={{ fontSize: isCurrent ? 'var(--fs-base)' : 'var(--fs-sm)' }}>
                {t(`status.${event.status}`)}
              </Typography.Text>
              {event.description && (
                <div>
                  <Typography.Text type="secondary">{event.description}</Typography.Text>
                </div>
              )}
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-xs)' }}>
                  {new Date(event.eventTime).toLocaleString()}
                </Typography.Text>
              </div>
            </div>
          </div>
        );
      })}

      {upcoming.map((status, index) => (
        <div key={status} style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: '2px solid var(--border)',
                color: 'var(--text-disabled)',
                flexShrink: 0,
              }}
            >
              <Circle size={10} aria-hidden="true" />
            </span>
            {index < upcoming.length - 1 && (
              <span style={{ width: 2, flex: 1, minHeight: 'var(--sp-4)', background: 'var(--border)' }} aria-hidden="true" />
            )}
          </div>
          <div style={{ paddingBottom: 'var(--sp-4)' }}>
            <Typography.Text type="secondary">{t(`status.${status}`)}</Typography.Text>
          </div>
        </div>
      ))}
    </div>
  );
}
