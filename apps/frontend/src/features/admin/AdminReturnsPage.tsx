import { useState } from 'react';
import { Alert, Button, Segmented, Table, Typography } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { ReturnListItemDTO } from '@karobarai/shared';
import { EmptyState, SkeletonLoader } from '../../components';
import { ReturnStatusTag } from '../returns/ReturnStatusTag';
import { adminReturnsQueryKey, listAdminReturns } from './adminApi';
import { formatAdminError } from './adminErrors';

// SCR-AD04's queue view (Returns Management, Task 5) — the module doc scopes this feature's own
// deliverable to "surfaces/links to what Feature 10 already exposes," not a rebuild: same
// GET /admin/returns list Feature 10's backend already built, same shape as
// features/returns/SellerReturnsPage.tsx's active/history toggle, just platform-wide instead of
// one seller's queue.
export function AdminReturnsPage() {
  const { t } = useTranslation(['admin', 'returns']);
  const [history, setHistory] = useState(false);

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: adminReturnsQueryKey(history),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => listAdminReturns(history, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const columns = [
    {
      title: t('returnsQueue.columnOrder'),
      dataIndex: 'id',
      key: 'id',
      render: (id: string, record: ReturnListItemDTO) => <Link to={`/admin/returns/${id}`}>{record.orderId}</Link>,
    },
    { title: t('returnsQueue.columnReason'), dataIndex: 'reason', key: 'reason' },
    { title: t('returnsQueue.columnImages'), dataIndex: 'imageCount', key: 'imageCount' },
    {
      title: t('returnsQueue.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: ReturnListItemDTO['status']) => <ReturnStatusTag status={status} />,
    },
    {
      title: t('returnsQueue.columnCreatedAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => new Date(createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Typography.Title level={3} style={{ marginBottom: 'var(--sp-4)' }}>
        {t('returnsQueue.title')}
      </Typography.Title>

      <Segmented
        style={{ marginBottom: 'var(--sp-4)' }}
        value={history ? 'history' : 'active'}
        onChange={(value) => setHistory(value === 'history')}
        options={[
          { label: t('returnsQueue.tabActive'), value: 'active' },
          { label: t('returnsQueue.tabHistory'), value: 'history' },
        ]}
      />

      {isPending && <SkeletonLoader rows={4} />}

      {isError && <Alert type="error" showIcon message={formatAdminError(t, error)} />}

      {!isPending && !isError && items.length === 0 && <EmptyState title={t('returnsQueue.empty')} />}

      {!isPending && !isError && items.length > 0 && (
        <>
          <Table rowKey="id" columns={columns} dataSource={items} pagination={false} size="middle" />
          {hasNextPage && (
            <div style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
              <Button loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {t('returnsQueue.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
