import { Alert, Avatar, Card, Table } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { TopProductItemDTO } from '@karobarai/shared';
import { PriceDisplay } from '../../components';
import { useLanguage } from '../../hooks';
import type { TopProductsParams } from './analyticsApi';
import { getTopProducts, topProductsQueryKey } from './analyticsApi';
import { formatAnalyticsError } from './analyticsErrors';

// REQ-F-Analytics-003 — ranked by realized revenue (Task 6), soft-deleted products excluded.
// App Flow's "click-through to product analytics" names a per-product analytics screen that was
// never built (F11-analytics-backend.md's own unresolved doc gap) — this links to the existing
// product-edit screen instead of a fabricated route, since that's the only per-product seller
// screen that actually exists today.
export function TopProductsTable({ rangeParams }: { rangeParams: TopProductsParams }) {
  const { t } = useTranslation(['analytics']);
  const { language } = useLanguage();
  const { data, isPending, isError, error } = useQuery({
    queryKey: topProductsQueryKey(rangeParams),
    queryFn: () => getTopProducts(rangeParams),
  });

  const columns = [
    {
      title: t('topProducts.columnProduct'),
      dataIndex: 'titleEn',
      key: 'product',
      render: (_: string, record: TopProductItemDTO) => {
        const title = language === 'UR' && record.titleUr ? record.titleUr : record.titleEn;
        return (
          <Link to={`/seller/products/${record.productId}/edit`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <Avatar shape="square" src={record.thumbnailUrl ?? undefined}>
              {!record.thumbnailUrl && title.charAt(0)}
            </Avatar>
            {title}
          </Link>
        );
      },
    },
    { title: t('topProducts.columnUnitsSold'), dataIndex: 'unitsSold', key: 'unitsSold' },
    {
      title: t('topProducts.columnRevenue'),
      dataIndex: 'revenue',
      key: 'revenue',
      render: (revenue: string) => <PriceDisplay amount={revenue} size="sm" />,
    },
  ];

  return (
    <Card title={t('topProducts.title')}>
      {isError && <Alert type="error" showIcon message={formatAnalyticsError(t, error)} />}
      {!isError && (
        <Table
          rowKey="productId"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isPending}
          pagination={false}
          size="middle"
          // Contained horizontal scroll (UIUX §31/§17) rather than letting the table push the
          // page itself wider than the viewport on a narrow phone — this table doesn't warrant a
          // full card-list rewrite (it's a secondary summary, not a primary seller workflow like
          // Products/Orders), but it still needed the "no horizontal overflow" floor.
          scroll={{ x: true }}
          locale={{ emptyText: t('topProducts.empty') }}
        />
      )}
    </Card>
  );
}
