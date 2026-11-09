import type { ReactNode } from 'react';
import { Alert, Button, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, PackageSearch, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '../../api';
import { BrandLogo, LanguageToggle, STATUS_VARIANT_COLOR, SkeletonLoader } from '../../components';
import { OrderJourney } from '../orders/OrderJourney';
import { ORDER_STATUS_VARIANT, OrderStatusTag } from '../orders/OrderStatusTag';
import { formatOrdersError } from '../orders/ordersErrors';
import '../orders/orders.css';
import './publicTracking.css';
import { TrackingMap } from './TrackingMap';
import { TrackingTimeline } from './TrackingTimeline';
import { getPublicTracking, publicTrackingQueryKey } from './trackingApi';

const POLL_INTERVAL_MS = 15_000;

function colorForStatus(status: string) {
  return STATUS_VARIANT_COLOR[ORDER_STATUS_VARIANT[status as keyof typeof ORDER_STATUS_VARIANT]];
}

// SCR-B09 — read-only, login-free tracking (REQ-F-Track005). TrackingDTO carries no order
// identifier or product (Task 5.2's deliberately minimal, no-PII shape), so this page polls on an
// interval instead of joining a socket room, and the band shows a parcel mark, not a product photo.
// Standalone route (no StorefrontLayout): its own slim top bar (logo + language) and one footer link.
export function PublicTrackingPage() {
  const { t } = useTranslation(['orders', 'common']);
  const { publicToken = '' } = useParams<{ publicToken: string }>();

  const { data: tracking, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: publicTrackingQueryKey(publicToken),
    queryFn: () => getPublicTracking(publicToken),
    enabled: !!publicToken,
    retry: false,
    refetchInterval: (query) => (query.state.error ? false : POLL_INTERVAL_MS),
  });

  let content: ReactNode;
  if (isPending) {
    content = <SkeletonLoader rows={6} />;
  } else if (isError || !tracking) {
    const notFound = !publicToken || (error instanceof ApiError && error.code === 'TRACKING_TOKEN_INVALID');
    content = notFound ? (
      <section className="ptMissing">
        <span className="ptMissingIcon" aria-hidden="true">
          <PackageSearch size={28} />
        </span>
        <h1 className="ptMissingTitle">{t('tracking.notFoundTitle')}</h1>
        <p className="ptMissingBody">{t('tracking.notFoundBody')}</p>
        <p className="ptMissingHint">{t('tracking.notFoundHint')}</p>
      </section>
    ) : (
      <Alert
        type="error"
        showIcon
        message={formatOrdersError(t, error)}
        action={
          <Button size="small" shape="round" loading={isFetching} onClick={() => void refetch()}>
            {t('common:actions.retry')}
          </Button>
        }
      />
    );
  } else {
    content = (
      <>
        <header className="odHead">
          <div>
            <div className="odTitleRow">
              <h1 className="odTitle">{t('tracking.publicTitle')}</h1>
              <OrderStatusTag status={tracking.status} />
            </div>
            <p className="ptLive">
              <span className="ptLiveDot" aria-hidden="true" />
              {t('tracking.autoUpdate')}
            </p>
          </div>
        </header>

        <section className="trBand">
          <span className="odHero ptParcel" aria-hidden="true">
            <Truck size={30} />
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
      </>
    );
  }

  return (
    <div className="ptShell">
      <header className="ptTop">
        <BrandLogo />
        <LanguageToggle />
      </header>
      <main className="odPage ptMain">{content}</main>
      <footer className="ptFoot">
        <Link to="/" className="odGhostLink">
          {t('tracking.shopOn')} <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </footer>
    </div>
  );
}
