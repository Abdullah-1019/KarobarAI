import { useState } from 'react';
import { Alert, Button, Segmented, Table, Typography } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import type { ProductStatus, SellerProductListItemDTO } from '@karobarai/shared';
import { EmptyState, PriceDisplay, ProductThumbnail, SkeletonLoader } from '../../components';
import { listSellerProducts, sellerProductsQueryKey } from './catalogApi';
import { formatCatalogError } from './catalogErrors';
import { ProductStatusTag } from './ProductStatusTag';

type StatusFilter = ProductStatus | 'ALL';

// SCR-S01/S02's seller-facing product list — the seller's own /seller/products view, per
// F4-catalog-backend.md's GET /seller/products (cursor-paginated, status filter, ownership
// implicit from the auth token).
export function SellerProductsPage() {
  const { t } = useTranslation(['catalog', 'common']);
  const navigate = useNavigate();
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
      render: (url: string | null) => <ProductThumbnail src={url} size={40} />,
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
      render: (price: string) => <PriceDisplay amount={price} size="sm" />,
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
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: SellerProductListItemDTO) => (
        <Link to={`/seller/products/${record.id}/edit`}>
          <Button size="small">{t('common:actions.edit')}</Button>
        </Link>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('catalog:productsList.title')}
        </Typography.Title>
        <Link to="/seller/products/new">
          <Button type="primary">{t('catalog:productsList.addProduct')}</Button>
        </Link>
      </div>

      <Segmented
        style={{ marginBottom: 'var(--sp-4)' }}
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
        <EmptyState
          title={t('catalog:productsList.empty')}
          actionLabel={t('catalog:productsList.addProduct')}
          onAction={() => navigate('/seller/products/new')}
        />
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
            <div style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
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
