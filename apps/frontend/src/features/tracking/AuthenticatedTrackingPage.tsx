import { Alert, Button, Card } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { PageHeader, STATUS_VARIANT_COLOR, SkeletonLoader, toast } from '../../components';
import { ORDER_STATUS_VARIANT, OrderStatusTag } from '../orders/OrderStatusTag';
import { formatOrdersError } from '../orders/ordersErrors';
import { TrackingMap } from './TrackingMap';
import { TrackingStatusCard } from './TrackingStatusCard';
import { TrackingTimeline } from './TrackingTimeline';
import { getAuthenticatedTracking, trackingQueryKey } from './trackingApi';
import { useTrackingSocket } from './useTrackingSocket';

interface AuthenticatedTrackingPageProps {
  scope: 'buyer' | 'seller';
}

function colorForStatus(status: string) {
  return STATUS_VARIANT_COLOR[ORDER_STATUS_VARIANT[status as keyof typeof ORDER_STATUS_VARIANT]];
}

// SCR-B08 — live shipment visibility, reachable by both the Buyer (My Orders) and the Seller
// (Order Detail's tracking link); backend ownership is tri-mode (Buyer/Seller/Admin) on the same
// GET /tracking/:orderId endpoint, so this page itself doesn't need role-specific data fetching —
// `scope` only decides where "back" goes, same thin-wrapper pattern as OrderDetailPage.
export function AuthenticatedTrackingPage({ scope }: AuthenticatedTrackingPageProps) {
  const { t } = useTranslation(['orders', 'common']);
  const { id = '' } = useParams<{ id: string }>();
  useTrackingSocket(id);

  const {
    data: tracking,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: trackingQueryKey(id),
    queryFn: () => getAuthenticatedTracking(id),
    enabled: !!id,
  });

  const backHref = scope === 'buyer' ? `/orders/${id}` : `/seller/orders/${id}`;

  if (isPending) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !tracking) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
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
      </div>
    );
  }

  function copyLink() {
    void navigator.clipboard.writeText(window.location.href).then(() => toast.success(t('tracking.linkCopied')));
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <PageHeader
        title={t('tracking.trackButton')}
        backTo={backHref}
        backLabel={t('tracking.backToOrder')}
        actions={<OrderStatusTag status={tracking.status} />}
      />

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

      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-6)' }}>
        <Button onClick={copyLink}>{t('tracking.copyLink')}</Button>
      </div>
    </div>
  );
}
