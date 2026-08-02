import { useState } from 'react';
import { Alert, Button, Card, Divider, Timeline, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { Modal, SkeletonLoader, toast } from '../../components';
import { OrderStatusTag } from './OrderStatusTag';
import { cancelOrder, getOrder, orderQueryKey, viewInvoice } from './ordersApi';
import { formatOrdersError } from './ordersErrors';

interface OrderDetailPageProps {
  scope: 'buyer' | 'seller';
}

// Generic detail page backing SCR-B07's order detail (Buyer) and SCR-S06 minus the courier-
// booking portion (Feature 8, not built yet — courierStatus is always the backend's hardcoded
// "not_booked"). `commission` renders only when present, which the backend already gates to the
// order's own Seller — nothing to filter client-side for the Buyer view.
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
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <Alert type="error" showIcon message={formatOrdersError(t, error)} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('detail.title', { id: order.id })}
        </Typography.Title>
        <OrderStatusTag status={order.status} />
      </div>

      <Card title={t('detail.shipping')} style={{ marginTop: 16 }}>
        <Typography.Text strong>{order.shipping.recipientName}</Typography.Text>
        <div>
          {order.shipping.line1}
          {order.shipping.line2 ? `, ${order.shipping.line2}` : ''}, {order.shipping.city}, {order.shipping.province}
        </div>
        <div>{order.shipping.phone}</div>
      </Card>

      <Card title={t('detail.items')} style={{ marginTop: 16 }}>
        {order.items.map((item) => (
          <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span>
              {item.titleSnapshot} × {item.quantity}
            </span>
            <span>Rs. {(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
          </div>
        ))}
      </Card>

      <Card title={t('detail.payment')} style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('detail.subtotal')}</span>
          <span>Rs. {Number(order.subtotal).toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('detail.shippingFee')}</span>
          <span>Rs. {Number(order.shippingFee).toLocaleString()}</span>
        </div>
        {order.commission && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('detail.commission')}</span>
            <span>Rs. {Number(order.commission.amount).toLocaleString()}</span>
          </div>
        )}
        <Divider style={{ margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography.Text strong>{t('detail.totalAmount')}</Typography.Text>
          <Typography.Text strong>Rs. {Number(order.totalAmount).toLocaleString()}</Typography.Text>
        </div>
        <Typography.Text type="secondary">
          {t('detail.courier')}: {t('detail.courierNotBooked')}
        </Typography.Text>
      </Card>

      <Card title={t('detail.timeline')} style={{ marginTop: 16 }}>
        <Timeline
          items={order.timeline.map((event) => ({
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
      </Card>

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <Button onClick={() => viewInvoice(order.id)}>{t('detail.viewInvoice')}</Button>
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
