import type { TrackingEventDTO } from '@karobarai/shared';
import { Timeline, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

interface TrackingTimelineProps {
  deliveryStageLabel: string;
  timeline: TrackingEventDTO[];
}

// Same status-history rendering as features/orders/OrderDetailPage.tsx's own Timeline block, plus
// the current deliveryStageLabel headline (a friendlier stage description than the raw status).
export function TrackingTimeline({ deliveryStageLabel, timeline }: TrackingTimelineProps) {
  const { t } = useTranslation(['orders']);

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {deliveryStageLabel}
      </Typography.Title>
      <Timeline
        items={timeline.map((event) => ({
          children: (
            <>
              <div>{t(`status.${event.status}`)}</div>
              {event.description && <Typography.Text type="secondary">{event.description}</Typography.Text>}
              <div>
                <Typography.Text type="secondary">{new Date(event.eventTime).toLocaleString()}</Typography.Text>
              </div>
            </>
          ),
        }))}
      />
    </div>
  );
}
