import { useState } from 'react';
import { Alert, Button, Empty, Segmented, Table, Tag, Typography } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ORDER_STATUS_TABS, type OrderListItemDTO, type OrderStatusTab } from '@karobarai/shared';
import { SkeletonLoader } from '../../components';
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
        <Link to={`${detailBase}/${id}`}>
          {id}
          {record.status === 'PENDING_MANUAL_LOGISTICS' && (
            <Tag color="orange" style={{ marginLeft: 8 }}>
              {t('list.pendingLogistics')}
            </Tag>
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
      render: (amount: string) => `Rs. ${Number(amount).toLocaleString()}`,
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
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t(scope === 'buyer' ? 'list.titleBuyer' : 'list.titleSeller')}</Typography.Title>

      <Segmented
        style={{ marginBottom: 16 }}
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
        <Empty description={t(scope === 'buyer' ? 'list.emptyBuyer' : 'list.emptySeller')} />
      )}

      {!isPending && !isError && items.length > 0 && (
        <>
          <Table rowKey="id" columns={columns} dataSource={items} pagination={false} size="middle" />
          {hasNextPage && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
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
