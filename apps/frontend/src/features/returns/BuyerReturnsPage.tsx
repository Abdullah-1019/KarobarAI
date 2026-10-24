import { Alert, Button } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRight, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { BackLink, ProductThumbnail, SkeletonLoader } from '../../components';
import { buyerReturnsQueryKey, listBuyerReturns } from './returnsApi';
import { formatReturnsError } from './returnsErrors';
import { reasonLabel } from './returnFormat';
import { ReturnStatusTag } from './ReturnStatusTag';
import '../orders/orders.css';
import './returns.css';

// Buyer-facing return history (E6 "Return History"), on the same Studio Light rows as the
// seller's returns queue and the buyer's own orders list: product photo, product + order, the
// reason as a chip, status, and a chevron — the whole row opens that return's status page.
export function BuyerReturnsPage() {
  const { t } = useTranslation(['returns', 'orders', 'common']);

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey: buyerReturnsQueryKey,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => listBuyerReturns(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="olPage">
      <BackLink to="/orders" label={t('orders:list.titleBuyer')} />
      <h1 className="olTitle">{t('buyerList.title')}</h1>

      {isPending && <SkeletonLoader rows={4} />}

      {isError && (
        <Alert
          type="error"
          showIcon
          message={formatReturnsError(t, error)}
          action={
            <Button size="small" shape="round" onClick={() => void refetch()}>
              {t('common:actions.retry')}
            </Button>
          }
        />
      )}

      {!isPending && !isError && items.length === 0 && (
        <div className="olEmpty">
          <span className="olEmptyIcon" aria-hidden="true">
            <Undo2 size={24} />
          </span>
          <p className="olEmptyTitle">{t('buyerList.empty')}</p>
          <p className="rtEmptyBody">{t('buyerList.emptyBody')}</p>
          <Link to="/orders" className="olEmptyLink">
            {t('buyerList.browseOrders')}
          </Link>
        </div>
      )}

      {!isPending && !isError && items.length > 0 && (
        <>
          <ul className="olRows">
            {items.map((item, index) => (
              <li key={item.id} className="olRowWrap" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
                <Link to={`/orders/${item.orderId}/return/${item.id}/status`} className="rtRow" aria-label={t('buyerList.viewReturn')}>
                  <ProductThumbnail src={item.productImage ?? null} size={52} radius="md" />
                  <span className="olMain">
                    <span className="rtRowTitle">{item.productName ?? (item.orderNumber ? `#${item.orderNumber}` : item.orderId)}</span>
                    <span className="olMeta">
                      {item.orderNumber ? `#${item.orderNumber}` : t('buyerList.orderLabel', { id: item.orderId.slice(0, 8) })} ·{' '}
                      {t('buyerList.requested', { date: new Date(item.createdAt).toLocaleDateString() })}
                    </span>
                    <span className="rtReason">{reasonLabel(t, item.reason)}</span>
                  </span>
                  <span className="rtRowEnd">
                    <ReturnStatusTag status={item.status} />
                    <span className="rtViewCue">{t('buyerList.viewReturn')}</span>
                  </span>
                  <ChevronRight size={18} className="rtChevron" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {hasNextPage && (
            <div className="olMore">
              <Button shape="round" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {t('buyerList.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
