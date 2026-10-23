import { Alert, Button, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Copy, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { STATUS_VARIANT_COLOR, SkeletonLoader, toast } from '../../components';
import { getProduct, productQueryKey } from '../catalog/catalogApi';
import { OrderJourney } from '../orders/OrderJourney';
import { ORDER_STATUS_VARIANT, OrderStatusTag } from '../orders/OrderStatusTag';
import { getOrder, orderQueryKey } from '../orders/ordersApi';
import { formatOrdersError } from '../orders/ordersErrors';
import '../orders/orders.css';
import { TrackingMap } from './TrackingMap';
import { TrackingTimeline } from './TrackingTimeline';
import { getAuthenticatedTracking, trackingQueryKey } from './trackingApi';
import { useTrackingSocket } from './useTrackingSocket';

interface AuthenticatedTrackingPageProps {
  scope: 'buyer' | 'seller';
}

function colorForStatus(status: string) {
  return STATUS_VARIANT_COLOR[ORDER_STATUS_VARIANT[status as keyof typeof ORDER_STATUS_VARIANT]];
}

// SCR-B08 — live shipment visibility for the Buyer and the Seller (same tri-mode GET
// /tracking/:orderId; the top bar's back link covers navigation, so `scope` is kept for callers).
// Studio Light: a lilac status band with the parcel's product photo, the server's delivery-stage
// label and the journey tracker; then the map beside courier details and the live timeline, whose
// newest event slides in when the socket pushes it.
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

  // The parcel's photo: the order's first product (cached from Order detail when coming from there).
  const { data: order } = useQuery({ queryKey: orderQueryKey(id), queryFn: () => getOrder(id), enabled: !!id });
  const firstProductId = order?.items[0]?.productId;
  const { data: product } = useQuery({
    queryKey: productQueryKey(firstProductId ?? ''),
    queryFn: () => getProduct(firstProductId ?? ''),
    enabled: !!firstProductId,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const heroImage = product ? [...product.images].sort((a, b) => a.position - b.position)[0]?.url : undefined;

  if (isPending) {
    return (
      <div className="odPage">
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !tracking) {
    return (
      <div className="odPage">
        <Alert
          type="error"
          showIcon
          message={formatOrdersError(t, error)}
          action={
            <Button size="small" shape="round" onClick={() => refetch()}>
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
    <div className="odPage" data-scope={scope}>
      <header className="odHead">
        <div className="odTitleRow">
          <h1 className="odTitle">{t('tracking.trackButton')}</h1>
          <OrderStatusTag status={tracking.status} />
        </div>
        <Button shape="round" icon={<Copy size={16} aria-hidden="true" />} onClick={copyLink}>
          {t('tracking.copyLink')}
        </Button>
      </header>

      <section className="trBand">
        <span className="odHero" aria-hidden="true">
          {heroImage ? <img src={heroImage} alt="" /> : <span className="odHeroBlank" />}
        </span>
        <div className="trBandText" aria-live="polite">
          <p className="trStage" key={tracking.deliveryStageLabel}>
            {tracking.deliveryStageLabel}
          </p>
          <p className="trMessage">
            {t(`tracking.statusMessage.${tracking.status}`)}
            {tracking.simulated && <Tag className="trSim">{t('courier.simulatedBadge')}</Tag>}
          </p>
        </div>
        <div className="trBandJourney">
          <OrderJourney status={tracking.status} />
        </div>
      </section>

      {tracking.timeline.length === 0 && (
        <Alert type="info" showIcon message={t('tracking.preparingTitle')} description={t('tracking.preparingBody')} />
      )}

      <div className="odGrid">
        <section className="odCard trMap">
          <TrackingMap lastLocation={tracking.lastLocation} />
        </section>

        <aside className="odSide trSide">
          {tracking.courier && (
            <section className="odCard">
              <h2 className="odCardTitle">{t('tracking.courier')}</h2>
              <p className="odLine">
                <Truck size={15} aria-hidden="true" />
                <span className="odStrong">{t(`courierNames.${tracking.courier}`)}</span>
              </p>
              {tracking.trackingNo && (
                <p className="odLine">
                  <span>{t('tracking.trackingNo')}:</span>
                  <span dir="ltr" className="trNo">
                    {tracking.trackingNo}
                  </span>
                </p>
              )}
            </section>
          )}
          <section className="odCard">
            <h2 className="odCardTitle">{t('detail.timeline')}</h2>
            <TrackingTimeline timeline={tracking.timeline} colorForStatus={colorForStatus} />
          </section>
        </aside>
      </div>
    </div>
  );
}
