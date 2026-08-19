import { useState } from 'react';
import { Alert, Button, Card, Divider, Segmented, Table, Typography } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ORDER_STATUS_TABS, type OrderListItemDTO, type OrderStatusTab } from '@karobarai/shared';
import { EmptyState, PriceDisplay, SkeletonLoader, StatusTag } from '../../components';
import {
  buyerOrdersQueryKey,
  listBuyerOrders,
  listSellerOrders,
  sellerOrdersQueryKey,
} from './ordersApi';
import { formatOrdersError } from './ordersErrors';
import { OrderStatusTag } from './OrderStatusTag';

type TabFilter = OrderStatusTab | 'All';

interface OrderListPageProps {
  scope: 'buyer' | 'seller';
}

// Generic list page backing both SCR-B07 (My Orders) and SCR-S05 (Seller Order Management) —
// same tab/cursor contract on both endpoints (packages/shared's ORDER_STATUS_TABS), same
// useInfiniteQuery/load-more shape SellerProductsPage.tsx already established for Feature 4.
//
// E3: renders the same `items` two ways — a dense Table (desktop) and a stacked card list
// (mobile, karobarai-orders-cards) — CSS toggles which is visible per the app's existing
// pure-CSS breakpoint convention (global.css). Not a Buyer-specific redesign: this is a shared
// component, and a data table collapsing to cards on a narrow phone is a generic responsive
// improvement (UIUX §31) that benefits Seller's order list too, not new business logic or
// information architecture.
export function OrderListPage({ scope }: OrderListPageProps) {
  const { t } = useTranslation(['orders']);
  const [tab, setTab] = useState<TabFilter>('All');

  const backendTab = tab === 'All' ? undefined : tab;
  const queryKey = scope === 'buyer' ? buyerOrdersQueryKey(backendTab) : sellerOrdersQueryKey(backendTab);
  const listFn = scope === 'buyer' ? listBuyerOrders : listSellerOrders;

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => listFn(backendTab, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const detailBase = scope === 'buyer' ? '/orders' : '/seller/orders';

  const columns = [
    {
      title: t('list.columnId'),
      dataIndex: 'id',
      key: 'id',
      render: (id: string, record: OrderListItemDTO) => (
        <Link to={`${detailBase}/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          {id}
          {record.status === 'PENDING_MANUAL_LOGISTICS' && (
            <StatusTag variant="warning" label={t('list.pendingLogistics')} />
          )}
        </Link>
      ),
    },
    {
      title: t(scope === 'buyer' ? 'list.columnCounterparty' : 'list.columnCounterpartySeller'),
      dataIndex: 'counterpartyName',
      key: 'counterpartyName',
    },
    { title: t('list.columnItems'), dataIndex: 'itemCount', key: 'itemCount' },
    {
      title: t('list.columnTotal'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: string) => <PriceDisplay amount={amount} size="sm" />,
    },
    {
      title: t('list.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: OrderListItemDTO['status']) => <OrderStatusTag status={status} />,
    },
    {
      title: t('list.columnPlacedAt'),
      dataIndex: 'placedAt',
      key: 'placedAt',
      render: (placedAt: string) => new Date(placedAt).toLocaleDateString(),
    },
    // Buyer-only — returnEligible is a "Buyer-list-only gate check" (packages/shared's
    // OrderListItemDTO comment); it doesn't exist on OrderDetailDTO, so this list is the only
    // place a Return action can be shown without inventing an eligibility check.
    ...(scope === 'buyer'
      ? [
          {
            title: t('list.columnActions'),
            key: 'actions',
            render: (_: unknown, record: OrderListItemDTO) =>
              record.returnEligible ? (
                <Link to={`/orders/${record.id}/return`}>
                  <Button size="small">{t('list.returnAction')}</Button>
                </Link>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Typography.Title level={3} style={{ marginBottom: 'var(--sp-4)' }}>
        {t(scope === 'buyer' ? 'list.titleBuyer' : 'list.titleSeller')}
      </Typography.Title>

      <Segmented
        style={{ marginBottom: 'var(--sp-4)' }}
        value={tab}
        onChange={(value) => setTab(value as TabFilter)}
        options={['All', ...Object.keys(ORDER_STATUS_TABS)].map((key) => ({
          label: t(`tabs.${key}`),
          value: key,
        }))}
      />

      {isPending && <SkeletonLoader rows={4} />}

      {isError && <Alert type="error" showIcon message={formatOrdersError(t, error)} />}

      {!isPending && !isError && items.length === 0 && (
        <EmptyState title={t(scope === 'buyer' ? 'list.emptyBuyer' : 'list.emptySeller')} />
      )}

      {!isPending && !isError && items.length > 0 && (
        <>
          <div className="karobarai-orders-table">
            <Table rowKey="id" columns={columns} dataSource={items} pagination={false} size="middle" />
          </div>

          <div className="karobarai-orders-cards">
            {items.map((item) => (
              <Card key={item.id} size="small" style={{ marginBottom: 'var(--sp-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
                  <div>
                    <Link to={`${detailBase}/${item.id}`} style={{ fontWeight: 500 }}>
                      {item.id}
                    </Link>
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
                      {new Date(item.placedAt).toLocaleDateString()}
                    </Typography.Text>
                  </div>
                  <OrderStatusTag status={item.status} />
                </div>

                {item.status === 'PENDING_MANUAL_LOGISTICS' && (
                  <div style={{ marginTop: 'var(--sp-2)' }}>
                    <StatusTag variant="warning" label={t('list.pendingLogistics')} />
                  </div>
                )}

                <Divider style={{ margin: 'var(--sp-3) 0' }} />

                <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-sm)' }}>
                  {item.counterpartyName}
                </Typography.Text>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'var(--sp-1)' }}>
                  <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-xs)' }}>
                    {item.itemCount} {t('list.columnItems').toLowerCase()}
                  </Typography.Text>
                  <PriceDisplay amount={item.totalAmount} size="sm" />
                </div>

                <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
                  <Link to={`${detailBase}/${item.id}`} style={{ flex: 1 }}>
                    <Button block size="small">
                      {t('list.viewOrder')}
                    </Button>
                  </Link>
                  {scope === 'buyer' && item.returnEligible && (
                    <Link to={`/orders/${item.id}/return`} style={{ flex: 1 }}>
                      <Button block size="small">
                        {t('list.returnAction')}
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {hasNextPage && (
            <div style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
              <Button loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {t('list.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
