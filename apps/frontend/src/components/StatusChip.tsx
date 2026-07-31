import type { UserStatus } from '@karobarai/shared';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';

const STATUS_COLOR: Record<UserStatus, string> = {
  PENDING_VERIFICATION: 'gold',
  ACTIVE: 'green',
  SUSPENDED: 'red',
  BANNED: 'volcano',
  DEACTIVATED: 'default',
};

interface StatusChipProps {
  status: UserStatus;
}

// Single source of truth for enum -> color/label — the backend deliberately returns the raw
// user_status value so wording changes never require a backend deploy (F3-store-management-
// backend.md). Keep both the color map and the i18n label here so nothing else has to re-derive
// either.
export function StatusChip({ status }: StatusChipProps) {
  const { t } = useTranslation(['profile']);
  return <Tag color={STATUS_COLOR[status]}>{t(`profile:status.${status}`)}</Tag>;
}
