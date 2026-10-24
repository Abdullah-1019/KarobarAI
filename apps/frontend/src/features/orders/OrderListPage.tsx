import { useLayoutEffect, useRef, useState } from 'react';
import { Alert, Button } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ClipboardList, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ORDER_STATUS_TABS, type OrderListItemDTO, type OrderStatusTab } from '@karobarai/shared';
import { PriceDisplay, SkeletonLoader, StatusTag } from '../../components';
import { NewMarker, useSectionSeen, useUnreadSummary } from '../notifications';
import { buyerOrdersQueryKey, listBuyerOrders, listSellerOrders, sellerOrdersQueryKey } from './ordersApi';
import { formatOrdersError } from './ordersErrors';
import { OrderJourney } from './OrderJourney';
import { OrderStatusTag } from './OrderStatusTag';
import './orders.css';

type TabFilter = OrderStatusTab | 'All';
const TABS: TabFilter[] = ['All', ...(Object.keys(ORDER_STATUS_TABS) as OrderStatusTab[])];

interface OrderListPageProps {
  scope: 'buyer' | 'seller';
}

// Orders that are waiting on the seller's hands (prepare / pack / hand over) get a soft highlight.
const NEEDS_SELLER = new Set<OrderListItemDTO['status']>(['PAYMENT_CONFIRMED', 'PROCESSING', 'PACKED', 'PENDING_MANUAL_LOGISTICS']);

// Generic list page backing SCR-B07 (My Orders) and SCR-S05 (Seller Order Management) — the same
// tab/cursor contract on both endpoints (ORDER_STATUS_TABS). Studio Light: pill tabs with a sliding
// ink indicator, then one row per order — avatar (product thumbnail once the API ships one; see
// BACKEND-NOTES), order number + person, a five-dot journey track, total and status. Rows collapse
// to cards on phones. Behaviour (tabs, paging, buyer return action) is unchanged.
export function OrderListPage({ scope }: OrderListPageProps) {
  const { t } = useTranslation(['orders', 'common']);
  const [tab, setTab] = useState<TabFilter>('All');

  const backendTab = tab === 'All' ? undefined : tab;
  const queryKey = scope === 'buyer' ? buyerOrdersQueryKey(backendTab) : sellerOrdersQueryKey(backendTab);
  const listFn = scope === 'buyer' ? listBuyerOrders : listSellerOrders;

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => listFn(backendTab, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  // Opening the list clears the Orders dot; orders that had news stay marked "New" for this visit.
  const fresh = useSectionSeen('orders', queryKey);
  const returnsUnread = useUnreadSummary()?.returns.count ?? 0;

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const detailBase = scope === 'buyer' ? '/orders' : '/seller/orders';

  // Sliding indicator: measured from the active tab so it works for any label length / language.
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const active = tabsRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
      if (active) setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [tab, t]);

  return (
    <div className="olPage">
      <header className="olHead">
        <h1 className="olTitle">{t(scope === 'buyer' ? 'list.titleBuyer' : 'list.titleSeller')}</h1>
        {scope === 'buyer' && (
          <Link
            to="/returns"
            className="olReturn"
            aria-label={returnsUnread > 0 ? t('common:nav.withUnread', { label: t('common:nav.myReturns'), count: returnsUnread }) : undefined}
          >
            <Undo2 size={15} aria-hidden="true" />
            {t('common:nav.myReturns')}
            {returnsUnread > 0 && <span className="olReturnCount">{returnsUnread > 9 ? '9+' : returnsUnread}</span>}
          </Link>
        )}
      </header>

      <div className="olTabs" ref={tabsRef} role="group" aria-label={t('list.columnStatus')}>
        {indicator && <span className="olTabInk" style={{ left: indicator.left, width: indicator.width }} aria-hidden="true" />}
        {TABS.map((key) => (
          <button key={key} type="button" className="olTab" aria-pressed={tab === key} onClick={() => setTab(key)}>
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      {isPending && <SkeletonLoader rows={5} />}

      {isError && (
        <Alert
          type="error"
          showIcon
          message={formatOrdersError(t, error)}
          action={
            <Button size="small" shape="round" onClick={() => refetch()}>
              {t('common:actions.retry')}
            </Button>
          }
        />
      )}

      {!isPending && !isError && items.length === 0 && (
        <div className="olEmpty">
          <span className="olEmptyIcon" aria-hidden="true">
            <ClipboardList size={24} />
          </span>
          <p className="olEmptyTitle">{t(scope === 'buyer' ? 'list.emptyBuyer' : 'list.emptySeller')}</p>
          {scope === 'buyer' && (
            <Link to="/" className="olEmptyLink">
              {t('common:nav.home')}
            </Link>
          )}
        </div>
      )}

      {!isPending && !isError && items.length > 0 && (
        <>
          <ul className="olRows" key={tab}>
            {items.map((item, index) => (
              <li
                key={item.id}
                className="olRowWrap"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                data-attention={(scope === 'seller' && NEEDS_SELLER.has(item.status)) || fresh.has(item.id) || undefined}
              >
                <Link to={`${detailBase}/${item.id}`} className="olRow">
                  <span className="olAvatar" aria-hidden="true">
                    {item.counterpartyName.trim().slice(0, 1).toUpperCase() || '#'}
                    {item.itemCount > 1 && <span className="olAvatarCount">+{item.itemCount - 1}</span>}
                  </span>

                  <span className="olMain">
                    <span className="olNumber">{item.orderNumber ? `#${item.orderNumber}` : item.id.slice(0, 8)}</span>
                    <span className="olMeta">
                      {item.counterpartyName} · {new Date(item.placedAt).toLocaleDateString()}
                    </span>
                  </span>

                  <span className="olJourney">
                    <OrderJourney status={item.status} variant="mini" />
                  </span>

                  <span className="olEnd">
                    <PriceDisplay amount={item.totalAmount} size="sm" />
                    <span className="olCount">{t('itemsCount', { count: item.itemCount })}</span>
                  </span>

                  <span className="olStatus">
                    {fresh.has(item.id) && <NewMarker />}
                    <OrderStatusTag status={item.status} />
                    {item.status === 'PENDING_MANUAL_LOGISTICS' && (
                      <StatusTag variant="warning" label={t('list.pendingLogistics')} />
                    )}
                  </span>
                </Link>

                {scope === 'buyer' && item.returnEligible && (
                  <div className="olFoot">
                    <span className="olFootNote">{t('list.returnHint')}</span>
                    <Link to={`/orders/${item.id}/return`} className="olReturn">
                      <Undo2 size={15} aria-hidden="true" />
                      {t('list.returnAction')}
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {hasNextPage && (
            <div className="olMore">
              <Button shape="round" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {t('list.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
