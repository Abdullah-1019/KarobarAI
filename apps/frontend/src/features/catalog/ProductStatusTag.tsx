import type { ProductStatus } from '@karobarai/shared';
import { useTranslation } from 'react-i18next';

import { StatusTag, type StatusVariant } from '../../components';

const STATUS_VARIANT: Record<ProductStatus, StatusVariant> = {
  DRAFT: 'neutral',
  LIVE: 'success',
  OUT_OF_STOCK: 'warning',
  REMOVED: 'error',
};

interface ProductStatusTagProps {
  status: ProductStatus;
}

export function ProductStatusTag({ status }: ProductStatusTagProps) {
  const { t } = useTranslation(['catalog']);
  return <StatusTag variant={STATUS_VARIANT[status]} label={t(`catalog:status.${status}`)} />;
}
