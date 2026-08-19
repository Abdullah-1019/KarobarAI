import { useState } from 'react';
import { Alert, Button, Card, Divider, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { Modal, PriceDisplay, STATUS_VARIANT_COLOR, SkeletonLoader, StatusTag, toast } from '../../components';
import type { StatusVariant } from '../../components';
import { CourierRecommendationCard, TrackingTimeline } from '../tracking';
import { getAuthenticatedTracking, trackingQueryKey } from '../tracking/trackingApi';
import { ORDER_STATUS_VARIANT, OrderStatusTag } from './OrderStatusTag';
import { cancelOrder, getOrder, orderQueryKey, viewInvoice } from './ordersApi';
import { formatOrdersError } from './ordersErrors';

interface OrderDetailPageProps {
  scope: 'buyer' | 'seller';
}

// paymentStatus on OrderDetailDTO is typed as plain `string` (not the narrower PaymentStatus
// union) at the API layer — defensively falls back to 'neutral' for anything unrecognized rather
// than throwing on an unmapped value.
const PAYMENT_STATUS_VARIANT: Record<string, StatusVariant> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  FAILED: 'error',
  REFUNDED: 'info',
  CANCELLED: 'neutral',
};

// Generic detail page backing SCR-B07's order detail (Buyer) and SCR-S06 (Seller) — the courier
// card/booking (Feature 8) lives in features/tracking, consumed here. `commission` renders only
// when present, which the backend already gates to the order's own Seller — nothing to filter
// client-side for the Buyer view.
export function OrderDetailPage({ scope }: OrderDetailPageProps) {
  const { t } = useTranslation(['orders']);
  const { id = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const { data: order, isPending, isError, error } = useQuery({
    queryKey: orderQueryKey(id),
    queryFn: () => getOrder(id),
    enabled: !!id,
  });

  // Real courier/tracking data never lives on OrderDetailDTO (courierStatus there is permanently
  // "not_booked" — Feature 7's field, Feature 8 never touches it) — fetched separately here. Works
  // for any order regardless of booking state (nulls pre-booking), so it's safe to always fetch.
  const { data: tracking } = useQuery({
    queryKey: trackingQueryKey(id),
    queryFn: () => getAuthenticatedTracking(id),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(orderQueryKey(id), updated);
      toast.success(t('detail.cancelled'));
      setCancelModalOpen(false);
    },
    onError: (err) => toast.error(formatOrdersError(t, err)),
  });

  if (isPending) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Alert type="error" showIcon message={formatOrdersError(t, error)} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('detail.title', { id: order.id })}
        </Typography.Title>
        <OrderStatusTag status={order.status} />
      </div>
      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 'var(--sp-1)' }}>
        {t('detail.placedOn', { date: new Date(order.placedAt).toLocaleDateString() })} ·{' '}
        {t('detail.itemCount', { count: order.items.length })}
      </Typography.Text>

      <Card title={t('detail.items')} style={{ marginTop: 'var(--sp-4)' }}>
        {order.items.map((item) => (
          <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: 'var(--sp-2) 0' }}>
            <span>
              {item.titleSnapshot} × {item.quantity}
            </span>
            <PriceDisplay amount={Number(item.unitPrice) * item.quantity} size="sm" />
          </div>
        ))}
      </Card>

      <Card title={t('detail.payment')} style={{ marginTop: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography.Text type="secondary">{t('detail.subtotal')}</Typography.Text>
          <PriceDisplay amount={order.subtotal} size="sm" muted />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'var(--sp-1)' }}>
          <Typography.Text type="secondary">{t('detail.shippingFee')}</Typography.Text>
          <PriceDisplay amount={order.shippingFee} size="sm" muted />
        </div>
        {order.commission && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'var(--sp-1)' }}>
            <Typography.Text type="secondary">{t('detail.commission')}</Typography.Text>
            <PriceDisplay amount={order.commission.amount} size="sm" muted />
          </div>
        )}
        <Divider style={{ margin: 'var(--sp-2) 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography.Text strong>{t('detail.totalAmount')}</Typography.Text>
          <PriceDisplay amount={order.totalAmount} size="lg" />
        </div>
        <Divider style={{ margin: 'var(--sp-3) 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography.Text type="secondary">{t('detail.paymentMethodLabel')}</Typography.Text>
          <Typography.Text>{t(`paymentMethods.${order.paymentMethod}`)}</Typography.Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-1)' }}>
          <Typography.Text type="secondary">{t('detail.paymentStatusLabel')}</Typography.Text>
          <StatusTag
            variant={PAYMENT_STATUS_VARIANT[order.paymentStatus] ?? 'neutral'}
            label={t(`paymentStatus.${order.paymentStatus}`, { defaultValue: order.paymentStatus })}
          />
        </div>
      </Card>

      <Card title={t('detail.shipping')} style={{ marginTop: 'var(--sp-4)' }}>
        <Typography.Text strong>{order.shipping.recipientName}</Typography.Text>
        <div>
          {order.shipping.line1}
          {order.shipping.line2 ? `, ${order.shipping.line2}` : ''}, {order.shipping.city}, {order.shipping.province}
        </div>
        <Typography.Text type="secondary">{order.shipping.phone}</Typography.Text>
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 'var(--sp-2)' }}>
          {t('detail.courier')}:{' '}
          {tracking?.courier
            ? `${t(`courierNames.${tracking.courier}`)}${tracking.trackingNo ? ` (${tracking.trackingNo})` : ''}`
            : t('detail.courierNotBooked')}
        </Typography.Text>
      </Card>

      {scope === 'seller' && order.status === 'PAYMENT_CONFIRMED' && !tracking?.courier && (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <CourierRecommendationCard orderId={id} />
        </div>
      )}

      <Card title={t('detail.timeline')} style={{ marginTop: 'var(--sp-4)' }}>
        <TrackingTimeline
          timeline={order.timeline}
          colorForStatus={(status) => STATUS_VARIANT_COLOR[ORDER_STATUS_VARIANT[status as keyof typeof ORDER_STATUS_VARIANT]]}
        />
      </Card>

      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-6)' }}>
        <Button onClick={() => viewInvoice(order.id)}>{t('detail.viewInvoice')}</Button>
        {tracking?.courier && (
          <Link to={scope === 'buyer' ? `/orders/${id}/track` : `/seller/orders/${id}/track`}>
            <Button>{t('tracking.trackButton')}</Button>
          </Link>
        )}
        {scope === 'seller' && order.cancellable && (
          <Button danger onClick={() => setCancelModalOpen(true)}>
            {t('detail.cancel')}
          </Button>
        )}
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
    </div>
  );
}
