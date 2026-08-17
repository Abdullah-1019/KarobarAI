import type { ReturnStatus } from '@karobarai/shared';
import { useTranslation } from 'react-i18next';

import { StatusTag, type StatusVariant } from '../../components';

const STATUS_VARIANT: Record<ReturnStatus, StatusVariant> = {
  INITIATED: 'neutral',
  IMAGES_SUBMITTED: 'info',
  UNDER_AI_REVIEW: 'info',
  MANUAL_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  PICKUP_BOOKED: 'info',
  REFUND_ISSUED: 'success',
  UNDER_DISPUTE: 'warning',
  CLOSED: 'neutral',
};

interface ReturnStatusTagProps {
  status: ReturnStatus;
}

export function ReturnStatusTag({ status }: ReturnStatusTagProps) {
  const { t } = useTranslation(['returns']);
  return <StatusTag variant={STATUS_VARIANT[status]} label={t(`status.${status}`)} />;
}
