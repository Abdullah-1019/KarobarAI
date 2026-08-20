import { Alert, Button, Card } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { ApiError } from '../../api';
import { EmptyState, PageHeader, STATUS_VARIANT_COLOR, SkeletonLoader } from '../../components';
import { ORDER_STATUS_VARIANT, OrderStatusTag } from '../orders/OrderStatusTag';
import { formatOrdersError } from '../orders/ordersErrors';
import { TrackingMap } from './TrackingMap';
import { TrackingStatusCard } from './TrackingStatusCard';
import { TrackingTimeline } from './TrackingTimeline';
import { getPublicTracking, publicTrackingQueryKey } from './trackingApi';

const POLL_INTERVAL_MS = 15_000;

function colorForStatus(status: string) {
  return STATUS_VARIANT_COLOR[ORDER_STATUS_VARIANT[status as keyof typeof ORDER_STATUS_VARIANT]];
}

// SCR-B09 — read-only, login-free tracking (REQ-F-Track005). TrackingDTO carries no order
// identifier (Task 5.2's deliberately minimal, no-PII shape), so unlike AuthenticatedTrackingPage
// this page has nothing to subscribe a Socket.IO room with — it polls on an interval instead.
// Standalone page (no StorefrontLayout), same top-level pattern as LoginPage/RegisterPage.
export function PublicTrackingPage() {
  const { t } = useTranslation(['orders', 'common']);
  const { publicToken = '' } = useParams<{ publicToken: string }>();

  const {
    data: tracking,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: publicTrackingQueryKey(publicToken),
    queryFn: () => getPublicTracking(publicToken),
    enabled: !!publicToken,
    retry: false,
    refetchInterval: (query) => (query.state.error ? false : POLL_INTERVAL_MS),
  });

  if (isPending) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--sp-6)' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !tracking) {
    const notFound = error instanceof ApiError && error.code === 'TRACKING_TOKEN_INVALID';
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--sp-6)' }}>
        {notFound ? (
          <EmptyState title={t('tracking.notFoundTitle')} description={t('tracking.notFoundBody')} />
        ) : (
          <Alert
            type="error"
            showIcon
            message={formatOrdersError(t, error)}
            action={
              <Button size="small" onClick={() => refetch()}>
                {t('common:actions.retry')}
              </Button>
            }
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--sp-6)' }}>
      <PageHeader title={t('tracking.publicTitle')} actions={<OrderStatusTag status={tracking.status} />} />

      <TrackingStatusCard status={tracking.status} deliveryStageLabel={tracking.deliveryStageLabel} colorForStatus={colorForStatus} />

      {tracking.timeline.length === 0 && (
        <Alert
          type="info"
          showIcon
          message={t('tracking.preparingTitle')}
          description={t('tracking.preparingBody')}
          style={{ marginTop: 'var(--sp-4)' }}
        />
      )}

      <Card style={{ marginTop: 'var(--sp-4)' }}>
        <TrackingMap lastLocation={tracking.lastLocation} />
      </Card>

      <Card style={{ marginTop: 'var(--sp-4)' }}>
        <TrackingTimeline timeline={tracking.timeline} colorForStatus={colorForStatus} />
      </Card>

      {tracking.courier && (
        <Card style={{ marginTop: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t('tracking.courier')}</span>
            <span>{t(`courierNames.${tracking.courier}`)}</span>
          </div>
          {tracking.trackingNo && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--sp-1)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t('tracking.trackingNo')}</span>
              <span>{tracking.trackingNo}</span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
