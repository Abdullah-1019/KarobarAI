import { useState } from 'react';
import { Alert, Button, Card, Divider, Segmented, Table, Typography } from 'antd';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart3, ClipboardList, PackagePlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import type { ProductStatus, SellerProductListItemDTO } from '@karobarai/shared';
import { EmptyState, MetricCard, PageHeader, PriceDisplay, ProductThumbnail, SkeletonLoader } from '../../components';
import { OrderStatusTag } from '../orders/OrderStatusTag';
import { listSellerOrders, sellerOrdersQueryKey } from '../orders/ordersApi';
import { PROFILE_QUERY_KEY, getProfile } from '../profile/profileApi';
import { listSellerProducts, sellerProductsQueryKey } from './catalogApi';
import { formatCatalogError } from './catalogErrors';
import { ProductStatusTag } from './ProductStatusTag';

type StatusFilter = ProductStatus | 'ALL';

// SCR-S01/S02's seller-facing product list — the seller's own /seller/products view, per
// F4-catalog-backend.md's GET /seller/products (cursor-paginated, status filter, ownership
// implicit from the auth token).
//
// E4: this is also the Seller's landing page — there is no separate /seller/dashboard route
// (SellerLayout.tsx's own comment documents this as a deliberate Phase C decision, not an
// oversight) — so the "at a glance" summary the E4 brief asks for lives here, above the product
// table, rather than inventing a new route. Deliberately has no revenue metric: RevenueCards'
// own code comment documents that revenue reads "Rs. 0" for every real seller until a settlement
// engine exists — surfacing it here would look like a bug, not a feature. Product counts and
// recent orders reuse data/endpoints already used elsewhere in the app (getProfile, the same
// listSellerOrders call SellerOrdersPage makes) — no new API surface.
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

  // Independent of `statusFilter` above (always the unfiltered set). Deliberately a *different*
  // query key from `sellerProductsQueryKey(undefined)` even though it hits the same endpoint with
  // the same params — that key is already used by the useInfiniteQuery above, and React Query
  // caches purely by key: a plain useQuery sharing an infinite query's key reads back that query's
  // `{pages, pageParams}` cache shape instead of the plain `{items, nextCursor}` this queryFn
  // actually returns, crashing on `.items` being undefined. Found via live browser testing, not
  // type-checking (TypeScript can't see a runtime cache-shape collision).
  const { data: allProducts } = useQuery({
    queryKey: [...sellerProductsQueryKey(undefined), 'summary'],
    queryFn: () => listSellerProducts(undefined, undefined),
  });
  const { data: profile } = useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: getProfile });
  // Distinct key for the same reason as `allProducts` above — sellerOrdersQueryKey(undefined) is
  // already used by OrderListPage's useInfiniteQuery (its "All" tab), and this is a genuinely
  // separate page (this crashed in production testing: navigating between /seller and
  // /seller/orders hit the exact same cache-shape collision as the products one, just across two
  // different files sharing one global query-key namespace instead of within one file).
  const { data: recentOrdersPage } = useQuery({
    queryKey: [...sellerOrdersQueryKey(undefined), 'summary'],
    queryFn: () => listSellerOrders(undefined, undefined),
  });

  const storeName = profile?.role === 'SELLER' ? profile.storeName : undefined;
  const recentOrders = recentOrdersPage?.items.slice(0, 3) ?? [];
  // Only shown once we know it's the *complete* catalog, not a partial first page — there's no
  // dedicated count endpoint, so a count next to "load more" would risk understating it.
  const countsComplete = !!allProducts && !allProducts.nextCursor;
  const liveCount = allProducts?.items.filter((p) => p.status === 'LIVE').length ?? 0;
  const outOfStockCount = allProducts?.items.filter((p) => p.status === 'OUT_OF_STOCK').length ?? 0;

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
      {storeName && (
        <Typography.Title level={4} style={{ marginBottom: 'var(--sp-4)' }}>
          {t('catalog:dashboard.welcomeBack', { storeName })}
        </Typography.Title>
      )}

      {countsComplete && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 'var(--sp-3)',
            marginBottom: 'var(--sp-4)',
          }}
        >
          <MetricCard label={t('catalog:dashboard.totalProducts')} value={allProducts?.items.length ?? 0} />
          <MetricCard label={t('catalog:dashboard.liveProducts')} value={liveCount} />
          <MetricCard
            label={t('catalog:dashboard.outOfStock')}
            value={outOfStockCount}
            tone={outOfStockCount > 0 ? 'warning' : 'neutral'}
          />
        </div>
      )}

      <Card style={{ marginBottom: 'var(--sp-6)' }}>
        <Typography.Text strong>{t('catalog:dashboard.recentOrders')}</Typography.Text>
        {recentOrders.length === 0 ? (
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 'var(--sp-2)' }}>
            {t('catalog:dashboard.noRecentOrders')}
          </Typography.Text>
        ) : (
          recentOrders.map((order, index) => (
            <div key={order.id}>
              {index > 0 && <Divider style={{ margin: 'var(--sp-2) 0' }} />}
              <Link
                to={`/seller/orders/${order.id}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--sp-3)',
                  color: 'inherit',
                  textDecoration: 'none',
                  paddingTop: 'var(--sp-2)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <Typography.Text ellipsis style={{ display: 'block', fontSize: 'var(--fs-sm)' }}>
                    {order.counterpartyName}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-xs)' }}>
                    {new Date(order.placedAt).toLocaleDateString()}
                  </Typography.Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexShrink: 0 }}>
                  <PriceDisplay amount={order.totalAmount} size="sm" />
                  <OrderStatusTag status={order.status} />
                </div>
              </Link>
            </div>
          ))
        )}
        <Link to="/seller/orders" style={{ display: 'block', marginTop: 'var(--sp-3)', fontSize: 'var(--fs-sm)' }}>
          {t('catalog:dashboard.viewAllOrders')}
        </Link>
      </Card>

      <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginBottom: 'var(--sp-6)' }}>
        <Link to="/seller/products/new">
          <Button icon={<PackagePlus size={16} aria-hidden="true" />}>{t('catalog:productsList.addProduct')}</Button>
        </Link>
        <Link to="/seller/orders">
          <Button icon={<ClipboardList size={16} aria-hidden="true" />}>{t('common:nav.orders')}</Button>
        </Link>
        <Link to="/seller/analytics">
          <Button icon={<BarChart3 size={16} aria-hidden="true" />}>{t('catalog:dashboard.viewAnalytics')}</Button>
        </Link>
      </div>

      <PageHeader
        title={t('catalog:productsList.title')}
        actions={
          <Link to="/seller/products/new">
            <Button type="primary">{t('catalog:productsList.addProduct')}</Button>
          </Link>
        }
      />

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
          <div className="karobarai-seller-products-table">
            <Table rowKey="id" columns={columns} dataSource={items} pagination={false} size="middle" />
          </div>

          <div className="karobarai-seller-products-cards">
            {items.map((product) => (
              <Link
                key={product.id}
                to={`/seller/products/${product.id}/edit`}
                style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
              >
                <Card size="small" style={{ marginBottom: 'var(--sp-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                    <ProductThumbnail src={product.primaryImageUrl} size={56} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Typography.Text ellipsis style={{ display: 'block' }}>
                        {product.titleEn}
                      </Typography.Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginTop: 'var(--sp-1)' }}>
                        <PriceDisplay amount={product.price} size="sm" />
                        <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-xs)' }}>
                          {t('catalog:productsList.columnStock')}: {product.stock}
                        </Typography.Text>
                      </div>
                    </div>
                    <ProductStatusTag status={product.status} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>

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
