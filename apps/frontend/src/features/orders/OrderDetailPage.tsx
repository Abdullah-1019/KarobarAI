import { useState } from 'react';
import { Alert, Button } from 'antd';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, MapPin, Phone, Truck, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { Modal, PriceDisplay, STATUS_VARIANT_COLOR, SkeletonLoader, StatusTag, toast } from '../../components';
import type { StatusVariant } from '../../components';
import { useOrderSeen } from '../notifications';
import { getProduct, productQueryKey } from '../catalog/catalogApi';
import { CourierRecommendationCard, TrackingTimeline } from '../tracking';
import { getAuthenticatedTracking, trackingQueryKey } from '../tracking/trackingApi';
import { ReturnStatusTag } from '../returns/ReturnStatusTag';
import { OrderJourney } from './OrderJourney';
import { journeyIndex } from './journeyStages';
import { ORDER_STATUS_VARIANT, OrderStatusTag } from './OrderStatusTag';
import { advanceSellerFulfillment, cancelOrder, confirmOrderReceipt, getOrder, orderQueryKey, viewInvoice } from './ordersApi';
import { formatOrdersError } from './ordersErrors';
import './orders.css';

interface OrderDetailPageProps {
  scope: 'buyer' | 'seller';
}

// paymentStatus on OrderDetailDTO is typed as plain `string` — unknown values fall back to neutral.
const PAYMENT_STATUS_VARIANT: Record<string, StatusVariant> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  FAILED: 'error',
  REFUNDED: 'info',
  CANCELLED: 'neutral',
};

// Generic detail page backing SCR-B07's order detail (Buyer) and SCR-S06 (Seller); the courier
// card/booking (Feature 8) lives in features/tracking. `commission` renders only when present —
// the backend gates it to the order's own Seller.
//
// Studio Light: the journey tracker leads (with the order's first product photo), then a two-column
// layout — items with photos, payment and delivery on one side; on the other the seller's single
// "next step" card (only the action that applies now, plus courier booking) or, for buyers, a
// calm status card. Order items carry no image URL yet, so photos come from each product's own
// detail (cached; a removed product falls back to a tinted tile). Actions/mutations are unchanged.
export function OrderDetailPage({ scope }: OrderDetailPageProps) {
  const { t } = useTranslation(['orders']);
  const { id = '' } = useParams<{ id: string }>();
  useOrderSeen('orders', id);
  const queryClient = useQueryClient();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);

  const { data: order, isPending, isError, error, refetch } = useQuery({
    queryKey: orderQueryKey(id),
    queryFn: () => getOrder(id),
    enabled: !!id,
  });

  // Courier/tracking data never lives on OrderDetailDTO — fetched separately (nulls pre-booking).
  const { data: tracking } = useQuery({
    queryKey: trackingQueryKey(id),
    queryFn: () => getAuthenticatedTracking(id),
    enabled: !!id,
  });

  const productQueries = useQueries({
    queries: (order?.items ?? []).map((item) => ({
      queryKey: productQueryKey(item.productId),
      queryFn: () => getProduct(item.productId),
      retry: false,
      staleTime: 5 * 60_000,
    })),
  });
  const imageFor = (index: number) => {
    const images = productQueries[index]?.data?.images ?? [];
    return [...images].sort((a, b) => a.position - b.position)[0]?.url;
  };

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(orderQueryKey(id), updated);
      toast.success(t('detail.cancelled'));
      setCancelModalOpen(false);
    },
    onError: (err) => toast.error(formatOrdersError(t, err)),
  });
  const receiptMutation = useMutation({
    mutationFn: () => confirmOrderReceipt(id),
    onSuccess: (updated) => queryClient.setQueryData(orderQueryKey(id), updated),
    onError: (err) => toast.error(formatOrdersError(t, err)),
  });
  const fulfillmentMutation = useMutation({
    mutationFn: (stage: 'PROCESSING' | 'PACKED' | 'HANDED_OVER_TO_COURIER' | 'DELIVERED') =>
      advanceSellerFulfillment(id, stage),
    onSuccess: (updated) => {
      queryClient.setQueryData(orderQueryKey(id), updated);
      void queryClient.invalidateQueries({ queryKey: trackingQueryKey(id) });
      setDeliveryModalOpen(false);
    },
    onError: (err) => toast.error(formatOrdersError(t, err)),
  });

  if (isPending) {
    return (
      <div className="odPage">
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !order) {
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

  const stage = journeyIndex(order.status);
  const shipped = stage >= 2 && stage < 4;
  const busy = fulfillmentMutation.isPending;
  const trackHref = scope === 'buyer' ? `/orders/${id}/track` : `/seller/orders/${id}/track`;
  const heroImage = imageFor(0);

  // The single next step for a seller, derived from status (+ whether a courier is booked).
  const sellerNext = (() => {
    switch (order.status) {
      case 'PAYMENT_PENDING':
        return { text: t('next.PAYMENT_PENDING') };
      case 'PAYMENT_CONFIRMED':
        return { text: t('next.PAYMENT_CONFIRMED'), action: 'PROCESSING' as const, label: t('detail.startProcessing') };
      case 'PROCESSING':
        return { text: t('next.PROCESSING'), action: 'PACKED' as const, label: t('detail.markPacked') };
      case 'PACKED':
        return tracking?.courier
          ? { text: t('next.PACKED_HANDOVER'), action: 'HANDED_OVER_TO_COURIER' as const, label: t('detail.handoverCourier') }
          : { text: t('next.PACKED_BOOK') };
      case 'PENDING_MANUAL_LOGISTICS':
        return { text: t('next.PENDING_MANUAL_LOGISTICS') };
      case 'CANCELLED':
        return { text: t('next.CANCELLED') };
      case 'DELIVERED':
      case 'COMPLETED':
        return { text: t('next.DONE') };
      default:
        return { text: t('next.SHIPPED') };
    }
  })();
  const canRequestReturn = order.items.some((item) => item.returnEligible);
  const canSimulateDelivery =
    tracking?.simulated === true &&
    !!tracking.courier &&
    ['HANDED_OVER_TO_COURIER', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(order.status);

  return (
    <div className="odPage">
      <header className="odHead">
        <div>
          <div className="odTitleRow">
            <h1 className="odTitle">{order.orderNumber ? `#${order.orderNumber}` : t('detail.title', { id: order.id })}</h1>
            <OrderStatusTag status={order.status} />
          </div>
          <p className="odSub">
            {t('detail.placedOn', { date: new Date(order.placedAt).toLocaleDateString() })} ·{' '}
            {t('detail.itemCount', { count: order.items.length })}
          </p>
        </div>
        <div className="odHeadActions">
          <Button shape="round" icon={<FileText size={16} aria-hidden="true" />} onClick={() => viewInvoice(order.id)}>
            {t('detail.viewInvoice')}
          </Button>
          {tracking?.courier && (
            <Link to={trackHref} className="odGhostLink">
              <Truck size={16} aria-hidden="true" />
              {t('tracking.trackButton')}
            </Link>
          )}
        </div>
      </header>

      <section className="odJourneyCard">
        <span className="odHero" aria-hidden="true">
          {heroImage ? <img src={heroImage} alt="" /> : <span className="odHeroBlank" />}
        </span>
        <OrderJourney status={order.status} />
      </section>

      <div className="odGrid">
        <div className="odMain">
          <section className="odCard">
            <h2 className="odCardTitle">{t('detail.items')}</h2>
            <ul className="odItems">
              {order.items.map((item, index) => {
                const img = imageFor(index);
                return (
                  <li key={`${item.productId}-${index}`} className="odItem">
                    <span className="odItemImg" aria-hidden="true">
                      {img && <img src={img} alt="" />}
                    </span>
                    <span className="odItemMain">
                      <span className="odItemTitle">{item.titleSnapshot}</span>
                      <span className="odItemMeta">
                        {item.variantLabel && <span className="odItemVariant" dir="auto">{item.variantLabel}</span>}
                        <PriceDisplay amount={item.unitPrice} size="sm" muted /> × {item.quantity}
                        {item.resolution && item.resolution !== 'PURCHASED' && (
                          <StatusTag variant="info" label={t(`detail.itemResolution.${item.resolution}`)} />
                        )}
                      </span>
                    </span>
                    <PriceDisplay amount={Number(item.unitPrice) * item.quantity} size="sm" />
                  </li>
                );
              })}
            </ul>

            <dl className="odTotals">
              <div>
                <dt>{t('detail.subtotal')}</dt>
                <dd>
                  <PriceDisplay amount={order.subtotal} size="sm" muted />
                </dd>
              </div>
              <div>
                <dt>{t('detail.shippingFee')}</dt>
                <dd>
                  <PriceDisplay amount={order.shippingFee} size="sm" muted />
                </dd>
              </div>
              {order.commission && (
                <div>
                  <dt>{t('detail.commission')}</dt>
                  <dd>
                    <PriceDisplay amount={order.commission.amount} size="sm" muted />
                  </dd>
                </div>
              )}
              <div className="odTotal">
                <dt>{t('detail.totalAmount')}</dt>
                <dd>
                  <PriceDisplay amount={order.totalAmount} size="lg" />
                </dd>
              </div>
            </dl>
          </section>

          {scope === 'seller' && order.returnCases.length > 0 && (
            <section className="odCard">
              <h2 className="odCardTitle">{t('detail.returnCases')}</h2>
              {order.returnCases.map((returnCase) => (
                <div key={returnCase.id} className="odReturnRow">
                  <span>
                    {returnCase.productName ?? t('detail.returnCaseFallback')} <ReturnStatusTag status={returnCase.status} />
                  </span>
                  <Link to={`/seller/returns/${returnCase.id}`}>
                    <Button shape="round" type={returnCase.status === 'UNDER_DISPUTE' ? 'primary' : 'default'}>
                      {returnCase.status === 'UNDER_DISPUTE' ? t('detail.reviewAppeal') : t('detail.viewReturn')}
                    </Button>
                  </Link>
                </div>
              ))}
            </section>
          )}

          <div className="odPair">
            <section className="odCard">
              <h2 className="odCardTitle">{t('detail.shipping')}</h2>
              <p className="odStrong">{order.shipping.recipientName}</p>
              <p className="odLine">
                <MapPin size={15} aria-hidden="true" />
                <span>
                  {order.shipping.line1}
                  {order.shipping.line2 ? `, ${order.shipping.line2}` : ''}, {order.shipping.city}, {order.shipping.province}
                </span>
              </p>
              <p className="odLine" dir="ltr">
                <Phone size={15} aria-hidden="true" />
                <span>{order.shipping.phone}</span>
              </p>
              <p className="odLine">
                <Truck size={15} aria-hidden="true" />
                <span>
                  {tracking?.courier
                    ? `${t(`courierNames.${tracking.courier}`)}${tracking.trackingNo ? ` (${tracking.trackingNo})` : ''}`
                    : t('detail.courierNotBooked')}
                </span>
              </p>
            </section>

            <section className="odCard">
              <h2 className="odCardTitle">{t('detail.payment')}</h2>
              <p className="odStrong">{t(`paymentMethods.${order.paymentMethod}`)}</p>
              <StatusTag
                variant={PAYMENT_STATUS_VARIANT[order.paymentStatus] ?? 'neutral'}
                label={t(`paymentStatus.${order.paymentStatus}`, { defaultValue: order.paymentStatus })}
              />
            </section>
          </div>

          <section className="odCard">
            <h2 className="odCardTitle">{t('detail.timeline')}</h2>
            <TrackingTimeline
              timeline={order.timeline}
              colorForStatus={(status) => STATUS_VARIANT_COLOR[ORDER_STATUS_VARIANT[status as keyof typeof ORDER_STATUS_VARIANT]]}
            />
          </section>
        </div>

        <aside className="odSide">
          {scope === 'seller' ? (
            <section className="odNext" key={order.status} data-done={stage === 4 || undefined} data-cancelled={stage < 0 || undefined}>
              <span className="odNextLabel">{t('next.title')}</span>
              <p className="odNextText">{sellerNext.text}</p>
              {'action' in sellerNext && sellerNext.action && (
                <Button type="primary" shape="round" block loading={busy} onClick={() => fulfillmentMutation.mutate(sellerNext.action)}>
                  {sellerNext.label}
                </Button>
              )}
              {canSimulateDelivery && (
                <Button type="primary" shape="round" block loading={busy} onClick={() => setDeliveryModalOpen(true)}>
                  {t('detail.markSimulatedDelivered')}
                </Button>
              )}
              {shipped && tracking?.courier && (
                <Link to={trackHref} className="odGhostLink odGhostLink--block">
                  <Truck size={16} aria-hidden="true" />
                  {t('tracking.trackButton')}
                </Link>
              )}
              {(order.status === 'PACKED' || Boolean(tracking?.courier)) && (
                <div className="odCourier">
                  <CourierRecommendationCard orderId={id} eligible={order.status === 'PACKED' && !tracking?.courier} />
                </div>
              )}
            </section>
          ) : (
            <section className="odNext" key={order.status} data-done={stage === 4 || undefined} data-cancelled={stage < 0 || undefined}>
              <p className="odNextText">
                {stage < 0
                  ? t('next.CANCELLED')
                  : stage === 4
                    ? t('next.DONE')
                    : shipped
                      ? t('next.buyerShipped')
                      : t('next.buyerWaiting')}
              </p>
              {order.status === 'DELIVERED' && (
                <Button type="primary" shape="round" block loading={receiptMutation.isPending} onClick={() => receiptMutation.mutate()}>
                  {t('detail.confirmReceipt')}
                </Button>
              )}
              {tracking?.courier && (
                <Link to={trackHref} className="odGhostLink odGhostLink--block">
                  <Truck size={16} aria-hidden="true" />
                  {t('tracking.trackButton')}
                </Link>
              )}
            </section>
          )}

          {scope === 'buyer' && (canRequestReturn || order.returnCases.length > 0) && (
            <section className="odCard odReturnCard">
              {canRequestReturn && (
                <>
                  <p className="odReturnNote">{t('detail.returnWindowNote')}</p>
                  <Link to={`/orders/${order.id}/return`} className="odGhostLink odGhostLink--block">
                    <Undo2 size={16} aria-hidden="true" />
                    {t('detail.requestReturn')}
                  </Link>
                </>
              )}
              {order.returnCases.length > 0 && (
                <>
                  <h2 className="odCardTitle">{t('detail.yourReturns')}</h2>
                  {order.returnCases.map((returnCase) => (
                    <Link
                      key={returnCase.id}
                      to={`/orders/${order.id}/return/${returnCase.id}/status`}
                      className="odReturnLink"
                    >
                      <span className="odReturnLinkName">{returnCase.productName ?? t('detail.returnCaseFallback')}</span>
                      <ReturnStatusTag status={returnCase.status} />
                      <span className="odReturnLinkGo">{t('detail.viewReturnStatus')}</span>
                    </Link>
                  ))}
                </>
              )}
            </section>
          )}

          {scope === 'seller' && order.cancellable && (
            <Button type="text" danger className="odCancel" onClick={() => setCancelModalOpen(true)}>
              {t('detail.cancel')}
            </Button>
          )}
        </aside>
      </div>

      <Modal
        open={cancelModalOpen}
        title={t('detail.cancelConfirmTitle')}
        onCancel={() => setCancelModalOpen(false)}
        onOk={() => cancelMutation.mutate()}
        confirmLoading={cancelMutation.isPending}
        okButtonProps={{ danger: true }}
      >
        {t('detail.cancelConfirmContent')}
      </Modal>
      <Modal
        open={deliveryModalOpen}
        title={t('detail.deliveryConfirmTitle')}
        onCancel={() => setDeliveryModalOpen(false)}
        onOk={() => fulfillmentMutation.mutate('DELIVERED')}
        confirmLoading={fulfillmentMutation.isPending}
      >
        {t('detail.deliveryConfirmContent')}
      </Modal>
    </div>
  );
}
