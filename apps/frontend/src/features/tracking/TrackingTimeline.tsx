import type { TrackingEventDTO } from '@karobarai/shared';
import { Timeline, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

interface TrackingTimelineProps {
  /** Heading rendered above the timeline — omit when the caller already provides one (e.g. a
   * Card's own `title`), as OrderDetailPage.tsx does. */
  deliveryStageLabel?: string;
  timeline: TrackingEventDTO[];
  /** Per-item dot color, keyed by the event's status. Left to the caller rather than imported
   * here, so this component doesn't have to depend on features/orders' status→color mapping
   * (avoids a features/tracking <-> features/orders import cycle, since OrderDetailPage.tsx
   * already imports from features/tracking for CourierRecommendationCard). */
  colorForStatus?: (status: string) => string;
}

// Shared by AuthenticatedTrackingPage/PublicTrackingPage (their own heading) and, via
// features/tracking's barrel, OrderDetailPage.tsx's "Status history" card (no heading — the Card
// already provides one) — one timeline rendering, not three copies of it.
export function TrackingTimeline({ deliveryStageLabel, timeline, colorForStatus }: TrackingTimelineProps) {
  const { t } = useTranslation(['orders']);

  return (
    <div>
      {deliveryStageLabel && (
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          {deliveryStageLabel}
        </Typography.Title>
      )}
      <Timeline
        items={timeline.map((event) => ({
          color: colorForStatus?.(event.status),
          children: (
            <>
              <Typography.Text strong>{t(`status.${event.status}`)}</Typography.Text>
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
            </>
          ),
        }))}
      />
    </div>
  );
}
