import { useState } from 'react';
import { Alert, Button, Segmented, Table, Typography } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { ReturnListItemDTO } from '@karobarai/shared';
import { EmptyState, SkeletonLoader } from '../../components';
import { listSellerReturns, sellerReturnsQueryKey } from './returnsApi';
import { formatReturnsError } from './returnsErrors';
import { ReturnStatusTag } from './ReturnStatusTag';

// SCR-S07 — same useInfiniteQuery + "Load more" pattern as features/orders/OrderListPage.tsx.
// Active queue (MANUAL_REVIEW) by default; ?history=true widens to every status on the backend.
export function SellerReturnsPage() {
  const { t } = useTranslation(['returns']);
  const [history, setHistory] = useState(false);

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: sellerReturnsQueryKey(history),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => listSellerReturns(history, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const columns = [
    {
      title: t('sellerList.columnOrder'),
      dataIndex: 'id',
      key: 'id',
      render: (id: string, record: ReturnListItemDTO) => <Link to={`/seller/returns/${id}`}>{record.orderId}</Link>,
    },
    { title: t('sellerList.columnReason'), dataIndex: 'reason', key: 'reason' },
    {
      title: t('sellerList.columnImages'),
      dataIndex: 'imageCount',
      key: 'imageCount',
    },
    {
      title: t('sellerList.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: ReturnListItemDTO['status']) => <ReturnStatusTag status={status} />,
    },
    {
      title: t('sellerList.columnCreatedAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => new Date(createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Typography.Title level={3} style={{ marginBottom: 'var(--sp-4)' }}>
        {t('sellerList.title')}
      </Typography.Title>

      <Segmented
        style={{ marginBottom: 'var(--sp-4)' }}
        value={history ? 'history' : 'active'}
        onChange={(value) => setHistory(value === 'history')}
        options={[
          { label: t('sellerList.tabActive'), value: 'active' },
          { label: t('sellerList.tabHistory'), value: 'history' },
        ]}
      />

      {isPending && <SkeletonLoader rows={4} />}

      {isError && <Alert type="error" showIcon message={formatReturnsError(t, error)} />}

      {!isPending && !isError && items.length === 0 && <EmptyState title={t('sellerList.empty')} />}

      {!isPending && !isError && items.length > 0 && (
        <>
          <Table rowKey="id" columns={columns} dataSource={items} pagination={false} size="middle" />
          {hasNextPage && (
            <div style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
              <Button loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {t('sellerList.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
