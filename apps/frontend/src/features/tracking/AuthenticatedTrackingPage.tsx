import { Alert, Button, Card, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { SkeletonLoader, toast } from '../../components';
import { OrderStatusTag } from '../orders/OrderStatusTag';
import { formatOrdersError } from '../orders/ordersErrors';
import { TrackingMap } from './TrackingMap';
import { TrackingTimeline } from './TrackingTimeline';
import { getAuthenticatedTracking, trackingQueryKey } from './trackingApi';
import { useTrackingSocket } from './useTrackingSocket';

interface AuthenticatedTrackingPageProps {
  scope: 'buyer' | 'seller';
}

// SCR-B08 — live shipment visibility, reachable by both the Buyer (My Orders) and the Seller
// (Order Detail's tracking link); backend ownership is tri-mode (Buyer/Seller/Admin) on the same
// GET /tracking/:orderId endpoint, so this page itself doesn't need role-specific data fetching —
// `scope` only decides where "back" goes, same thin-wrapper pattern as OrderDetailPage.
export function AuthenticatedTrackingPage({ scope }: AuthenticatedTrackingPageProps) {
  const { t } = useTranslation(['orders']);
  const { id = '' } = useParams<{ id: string }>();
  useTrackingSocket(id);

  const {
    data: tracking,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: trackingQueryKey(id),
    queryFn: () => getAuthenticatedTracking(id),
    enabled: !!id,
  });

  const backHref = scope === 'buyer' ? `/orders/${id}` : `/seller/orders/${id}`;

  if (isPending) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !tracking) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <Alert type="error" showIcon message={formatOrdersError(t, error)} />
      </div>
    );
  }

  function copyLink() {
    void navigator.clipboard.writeText(window.location.href).then(() => toast.success(t('tracking.linkCopied')));
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('tracking.trackButton')}
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

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <Button onClick={copyLink}>{t('tracking.copyLink')}</Button>
        <Link to={backHref}>
          <Button>{t('tracking.backToOrder')}</Button>
        </Link>
      </div>
    </div>
  );
}
