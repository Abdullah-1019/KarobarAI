import type { OrderStatus } from '@karobarai/shared';
import { useTranslation } from 'react-i18next';

import { StatusTag, type StatusVariant } from '../../components';

// Exported so TrackingTimeline can color each timeline event by the same status→variant mapping
// this chip uses, rather than a second, possibly-inconsistent one.
export const ORDER_STATUS_VARIANT: Record<OrderStatus, StatusVariant> = {
  PAYMENT_PENDING: 'neutral',
  PAYMENT_CONFIRMED: 'info',
  PROCESSING: 'info',
  PICKED_UP: 'info',
  IN_TRANSIT: 'info',
  OUT_FOR_DELIVERY: 'warning',
  DELIVERED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'error',
  PENDING_MANUAL_LOGISTICS: 'warning',
};

interface OrderStatusTagProps {
  status: OrderStatus;
}

export function OrderStatusTag({ status }: OrderStatusTagProps) {
  const { t } = useTranslation(['orders']);
  return <StatusTag variant={ORDER_STATUS_VARIANT[status]} label={t(`orders:status.${status}`)} />;
}
