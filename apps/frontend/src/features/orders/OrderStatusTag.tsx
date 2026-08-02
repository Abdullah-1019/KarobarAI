import type { OrderStatus } from '@karobarai/shared';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';

// Mirrors features/catalog/ProductStatusTag.tsx exactly.
const STATUS_COLOR: Record<OrderStatus, string> = {
  PAYMENT_PENDING: 'default',
  PAYMENT_CONFIRMED: 'blue',
  PROCESSING: 'blue',
  PICKED_UP: 'geekblue',
  IN_TRANSIT: 'geekblue',
  OUT_FOR_DELIVERY: 'gold',
  DELIVERED: 'green',
  COMPLETED: 'green',
  CANCELLED: 'red',
  PENDING_MANUAL_LOGISTICS: 'orange',
};

interface OrderStatusTagProps {
  status: OrderStatus;
}

export function OrderStatusTag({ status }: OrderStatusTagProps) {
  const { t } = useTranslation(['orders']);
  return <Tag color={STATUS_COLOR[status]}>{t(`orders:status.${status}`)}</Tag>;
}
