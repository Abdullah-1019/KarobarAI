import { useLayoutEffect, useRef, useState } from 'react';
import { Alert, Button } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Camera, ChevronRight, PackageCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ProductThumbnail, SkeletonLoader } from '../../components';
import { NewMarker, useSectionSeen } from '../notifications';
import { listSellerReturns, sellerReturnsQueryKey } from './returnsApi';
import { formatReturnsError } from './returnsErrors';
import { needsSeller, reasonLabel } from './returnFormat';
import { ReturnStatusTag } from './ReturnStatusTag';
import '../orders/orders.css';
import './returns.css';

type Tab = 'active' | 'history';
const TABS: Tab[] = ['active', 'history'];

// SCR-S07 — same useInfiniteQuery + "Load more" pattern as features/orders/OrderListPage.tsx, and
// the same look (pill tabs with a sliding ink, rows on the canvas). Active queue includes manual
// review and AI acceptances awaiting seller review; returns waiting on the seller float to the
// top of what's loaded and carry a peach edge.
export function SellerReturnsPage() {
  const { t } = useTranslation(['returns', 'common']);
  const [tab, setTab] = useState<Tab>('active');
  const history = tab === 'history';

  const { data, isPending, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: sellerReturnsQueryKey(history),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => listSellerReturns(history, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  // Opening the queue clears the Returns dot; returns that had news stay marked "New" for this visit.
  const fresh = useSectionSeen('returns', sellerReturnsQueryKey(history));

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const sorted = [...items].sort((a, b) => Number(needsSeller(b)) - Number(needsSeller(a)));
  const waiting = items.filter(needsSeller).length;

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
      <header className="rtListHead">
        <div>
          <h1 className="olTitle">{t('sellerList.title')}</h1>
          <p className="odSub">{t('sellerList.subtitle')}</p>
        </div>
        {!history && waiting > 0 && <span className="rtWaiting">{t(hasNextPage ? 'sellerList.waitingMore' : 'sellerList.waiting', { count: waiting })}</span>}
      </header>

      <div className="olTabs" ref={tabsRef} role="group" aria-label={t('sellerList.title')}>
        {indicator && <span className="olTabInk" style={{ left: indicator.left, width: indicator.width }} aria-hidden="true" />}
        {TABS.map((key) => (
          <button key={key} type="button" className="olTab" aria-pressed={tab === key} onClick={() => setTab(key)}>
            {t(key === 'active' ? 'sellerList.tabActive' : 'sellerList.tabHistory')}
          </button>
        ))}
      </div>

      {isPending && <SkeletonLoader rows={4} />}

      {isError && (
        <Alert
          type="error"
          showIcon
          message={formatReturnsError(t, error)}
          action={<Button onClick={() => void refetch()}>{t('common:actions.retry')}</Button>}
        />
      )}

      {!isPending && !isError && items.length === 0 && (
        <div className="olEmpty">
          <span className="olEmptyIcon" aria-hidden="true">
            <PackageCheck size={24} />
          </span>
          <p className="olEmptyTitle">{t(history ? 'sellerList.emptyHistory' : 'sellerList.emptyActive')}</p>
          <p className="rtEmptyBody">{t(history ? 'sellerList.emptyHistoryBody' : 'sellerList.emptyActiveBody')}</p>
        </div>
      )}

      {!isPending && !isError && items.length > 0 && (
        <>
          <ul className="olRows" key={tab}>
            {sorted.map((item, index) => {
              const attention = needsSeller(item);
              return (
                <li
                  key={item.id}
                  className="olRowWrap"
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                  data-attention={attention || undefined}
                >
                  <Link to={`/seller/returns/${item.id}`} className="rtRow">
                    <ProductThumbnail src={item.productImage ?? null} size={52} radius="md" />
                    <span className="olMain">
                      <span className="rtRowTitle">{item.productName ?? (item.orderNumber ? `#${item.orderNumber}` : item.orderId)}</span>
                      <span className="olMeta">
                        {item.orderNumber ? `#${item.orderNumber}` : item.orderId.slice(0, 8)} · {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                      <span className="rtReason">{reasonLabel(t, item.reason)}</span>
                    </span>
                    <span className="rtRowEnd">
                      <span className="olStatus">
                        {fresh.has(item.orderId) && <NewMarker />}
                        {attention && <span className="rtNeedsYou">{t('sellerList.needsYou')}</span>}
                        <ReturnStatusTag status={item.status} />
                      </span>
                      <span className="olCount">
                        <Camera size={13} aria-hidden="true" /> {t('sellerList.photosCount', { count: item.imageCount })}
                      </span>
                    </span>
                    <ChevronRight size={18} className="rtChevron" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
          {hasNextPage && (
            <div className="olMore">
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
