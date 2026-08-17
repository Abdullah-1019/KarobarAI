import type { UserStatus } from '@karobarai/shared';
import { useTranslation } from 'react-i18next';

import { StatusTag, type StatusVariant } from './StatusTag';

const STATUS_VARIANT: Record<UserStatus, StatusVariant> = {
  PENDING_VERIFICATION: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'error',
  BANNED: 'error',
  DEACTIVATED: 'neutral',
};

interface StatusChipProps {
  status: UserStatus;
}

// Single source of truth for enum -> variant/label — the backend deliberately returns the raw
// user_status value so wording changes never require a backend deploy (F3-store-management-
// backend.md). Rendering itself now lives in the shared StatusTag primitive.
export function StatusChip({ status }: StatusChipProps) {
  const { t } = useTranslation(['profile']);
  return <StatusTag variant={STATUS_VARIANT[status]} label={t(`profile:status.${status}`)} />;
}
