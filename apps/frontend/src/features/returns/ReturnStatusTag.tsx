import type { ReturnStatus } from '@karobarai/shared';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';

// Mirrors features/orders/OrderStatusTag.tsx's color-map pattern.
const STATUS_COLOR: Record<ReturnStatus, string> = {
  INITIATED: 'default',
  IMAGES_SUBMITTED: 'blue',
  UNDER_AI_REVIEW: 'purple',
  MANUAL_REVIEW: 'gold',
  APPROVED: 'green',
  REJECTED: 'red',
  PICKUP_BOOKED: 'geekblue',
  REFUND_ISSUED: 'green',
  UNDER_DISPUTE: 'orange',
  CLOSED: 'default',
};

interface ReturnStatusTagProps {
  status: ReturnStatus;
}

export function ReturnStatusTag({ status }: ReturnStatusTagProps) {
  const { t } = useTranslation(['returns']);
  return <Tag color={STATUS_COLOR[status]}>{t(`status.${status}`)}</Tag>;
}
