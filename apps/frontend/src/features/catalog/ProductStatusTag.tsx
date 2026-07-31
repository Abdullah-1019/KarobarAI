import type { ProductStatus } from '@karobarai/shared';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';

const STATUS_COLOR: Record<ProductStatus, string> = {
  DRAFT: 'default',
  LIVE: 'green',
  OUT_OF_STOCK: 'orange',
  REMOVED: 'red',
};

interface ProductStatusTagProps {
  status: ProductStatus;
}

export function ProductStatusTag({ status }: ProductStatusTagProps) {
  const { t } = useTranslation(['catalog']);
  return <Tag color={STATUS_COLOR[status]}>{t(`catalog:status.${status}`)}</Tag>;
}
