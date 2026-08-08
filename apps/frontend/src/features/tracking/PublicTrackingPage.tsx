import { Alert, Card, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { ApiError } from '../../api';
import { EmptyState, SkeletonLoader } from '../../components';
import { OrderStatusTag } from '../orders/OrderStatusTag';
import { formatOrdersError } from '../orders/ordersErrors';
import { TrackingMap } from './TrackingMap';
import { TrackingTimeline } from './TrackingTimeline';
import { getPublicTracking, publicTrackingQueryKey } from './trackingApi';

const POLL_INTERVAL_MS = 15_000;

// SCR-B09 — read-only, login-free tracking (REQ-F-Track005). TrackingDTO carries no order
// identifier (Task 5.2's deliberately minimal, no-PII shape), so unlike AuthenticatedTrackingPage
// this page has nothing to subscribe a Socket.IO room with — it polls on an interval instead.
// Standalone page (no StorefrontLayout), same top-level pattern as LoginPage/RegisterPage.
export function PublicTrackingPage() {
  const { t } = useTranslation(['orders']);
  const { publicToken = '' } = useParams<{ publicToken: string }>();

  const {
    data: tracking,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: publicTrackingQueryKey(publicToken),
    queryFn: () => getPublicTracking(publicToken),
    enabled: !!publicToken,
    retry: false,
    refetchInterval: (query) => (query.state.error ? false : POLL_INTERVAL_MS),
  });

  if (isPending) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !tracking) {
    const notFound = error instanceof ApiError && error.code === 'TRACKING_TOKEN_INVALID';
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        {notFound ? (
          <EmptyState title={t('tracking.notFoundTitle')} description={t('tracking.notFoundBody')} />
        ) : (
          <Alert type="error" showIcon message={formatOrdersError(t, error)} />
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('tracking.publicTitle')}
        </Typography.Title>
        <OrderStatusTag status={tracking.status} />
      </div>

      <Card style={{ marginTop: 16 }}>
        <TrackingMap lastLocation={tracking.lastLocation} />
      </Card>

      <Card style={{ marginTop: 16 }}>
        <TrackingTimeline deliveryStageLabel={tracking.deliveryStageLabel} timeline={tracking.timeline} />
      </Card>

      {tracking.courier && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('tracking.courier')}</span>
            <span>{t(`courierNames.${tracking.courier}`)}</span>
          </div>
          {tracking.trackingNo && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('tracking.trackingNo')}</span>
              <span>{tracking.trackingNo}</span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
