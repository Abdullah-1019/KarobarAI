import { useState } from 'react';
import { Alert, Button, Empty, Segmented, Table, Typography } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { ProductStatus, SellerProductListItemDTO } from '@karobarai/shared';
import { SkeletonLoader } from '../../components';
import { listSellerProducts, sellerProductsQueryKey } from './catalogApi';
import { formatCatalogError } from './catalogErrors';
import { ProductStatusTag } from './ProductStatusTag';

type StatusFilter = ProductStatus | 'ALL';

// SCR-S01/S02's seller-facing product list — the seller's own /seller/products view, per
// F4-catalog-backend.md's GET /seller/products (cursor-paginated, status filter, ownership
// implicit from the auth token).
export function SellerProductsPage() {
  const { t } = useTranslation(['catalog', 'common']);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const backendStatus = statusFilter === 'ALL' ? undefined : statusFilter;

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: sellerProductsQueryKey(backendStatus),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => listSellerProducts(backendStatus, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const columns = [
    {
      title: '',
      dataIndex: 'primaryImageUrl',
      key: 'image',
      width: 56,
      render: (url: string | null) =>
        url ? (
          <img src={url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--bg-secondary, #f5f5f5)' }} />
        ),
    },
    {
      title: t('catalog:productsList.columnTitle'),
      dataIndex: 'titleEn',
      key: 'titleEn',
      render: (titleEn: string, record: SellerProductListItemDTO) => (
        <Link to={`/seller/products/${record.id}/edit`}>{titleEn}</Link>
      ),
    },
    {
      title: t('catalog:productsList.columnPrice'),
      dataIndex: 'price',
      key: 'price',
      render: (price: string) => `Rs. ${Number(price).toLocaleString()}`,
    },
    {
      title: t('catalog:productsList.columnStock'),
      dataIndex: 'stock',
      key: 'stock',
    },
    {
      title: t('catalog:productsList.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: ProductStatus) => <ProductStatusTag status={status} />,
    },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('catalog:productsList.title')}
        </Typography.Title>
        <Link to="/seller/products/new">
          <Button type="primary">{t('catalog:productsList.addProduct')}</Button>
        </Link>
      </div>

      <Segmented
        style={{ marginBottom: 16 }}
        value={statusFilter}
        onChange={(value) => setStatusFilter(value as StatusFilter)}
        options={[
          { label: t('catalog:productsList.statusAll'), value: 'ALL' },
          { label: t('catalog:status.DRAFT'), value: 'DRAFT' },
          { label: t('catalog:status.LIVE'), value: 'LIVE' },
          { label: t('catalog:status.OUT_OF_STOCK'), value: 'OUT_OF_STOCK' },
          { label: t('catalog:status.REMOVED'), value: 'REMOVED' },
        ]}
      />

      {isPending && <SkeletonLoader rows={4} />}

      {isError && <Alert type="error" showIcon message={formatCatalogError(t, error)} />}

      {!isPending && !isError && items.length === 0 && (
        <Empty description={t('catalog:productsList.empty')} />
      )}

      {!isPending && !isError && items.length > 0 && (
        <>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={items}
            pagination={false}
            size="middle"
          />
          {hasNextPage && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Button loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {t('catalog:productsList.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
