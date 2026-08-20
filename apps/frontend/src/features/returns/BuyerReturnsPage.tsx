import { Alert, Button, Card, Typography } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { EmptyState, PageHeader, SkeletonLoader } from '../../components';
import { buyerReturnsQueryKey, listBuyerReturns } from './returnsApi';
import { formatReturnsError } from './returnsErrors';
import { ReturnStatusTag } from './ReturnStatusTag';

// Buyer-facing return history — the E6 brief's "Return History" screen. No dedicated route
// existed for this before (only a per-order /orders/:id/return/status), but listBuyerReturns()
// itself already existed and was already called (ReturnStatusPage used it internally to look up
// one match by orderId) — this surfaces the same, already-working endpoint as its own screen
// rather than adding new backend/API surface. Card layout (not a table) — this is a small,
// personal list, not a management queue like SellerReturnsPage's.
export function BuyerReturnsPage() {
  const { t } = useTranslation(['returns', 'orders']);
  const navigate = useNavigate();

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: buyerReturnsQueryKey,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => listBuyerReturns(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <PageHeader title={t('buyerList.title')} backTo="/orders" backLabel={t('orders:list.titleBuyer')} />

      {isPending && <SkeletonLoader rows={4} />}

      {isError && <Alert type="error" showIcon message={formatReturnsError(t, error)} />}

      {!isPending && !isError && items.length === 0 && (
        <EmptyState
          title={t('buyerList.empty')}
          description={t('buyerList.emptyBody')}
          actionLabel={t('buyerList.browseOrders')}
          onAction={() => navigate('/orders')}
        />
      )}

      {!isPending && !isError && items.length > 0 && (
        <>
          {items.map((item) => (
            <Card key={item.id} style={{ marginBottom: 'var(--sp-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-xs)' }}>
                    {t('buyerList.orderLabel', { id: item.orderId })}
                  </Typography.Text>
                  <div style={{ marginTop: 'var(--sp-1)' }}>{item.reason}</div>
                  <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-xs)' }}>
                    {t('buyerList.requested', { date: new Date(item.createdAt).toLocaleDateString() })}
                  </Typography.Text>
                </div>
                <ReturnStatusTag status={item.status} />
              </div>
              <div style={{ marginTop: 'var(--sp-3)', textAlign: 'end' }}>
                <Link to={`/orders/${item.orderId}/return/status`}>
                  <Button size="small">{t('buyerList.viewReturn')}</Button>
                </Link>
              </div>
            </Card>
          ))}
          {hasNextPage && (
            <div style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
              <Button loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {t('buyerList.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
