import { useLayoutEffect, useRef, useState } from 'react';
import { Alert, Button } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Camera, ChevronRight, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { ReturnListItemDTO } from '@karobarai/shared';
import { ProductThumbnail, SkeletonLoader } from '../../components';
import { reasonLabel } from '../returns/returnFormat';
import { ReturnStatusTag } from '../returns/ReturnStatusTag';
import { adminReturnsQueryKey, listAdminReturns } from './adminApi';
import { formatAdminError } from './adminErrors';
import '../orders/orders.css';
import '../returns/returns.css';

type Tab = 'active' | 'history';
const TABS: Tab[] = ['active', 'history'];

/** Cases an admin can decide: sent for review, or appealed by the buyer. */
const needsDecision = (item: Pick<ReturnListItemDTO, 'status'>) =>
  item.status === 'MANUAL_REVIEW' || item.status === 'UNDER_DISPUTE';

// SCR-AD04's queue view — the same GET /admin/returns Feature 10 built, platform-wide, on the
// seller queue's Studio rows (product photo, product + order, reason chip, status, photo count)
// with the sliding pill tabs. Cases waiting on an admin decision sort first and carry a tag.
export function AdminReturnsPage() {
  const { t } = useTranslation(['admin', 'returns', 'common']);
  const [tab, setTab] = useState<Tab>('active');
  const history = tab === 'history';

  const { data, isPending, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: adminReturnsQueryKey(history),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => listAdminReturns(history, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const sorted = [...items].sort((a, b) => Number(needsDecision(b)) - Number(needsDecision(a)));
  const waiting = items.filter(needsDecision).length;

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
    <div className="olPage adReturns">
      <header className="rtListHead">
        <div>
          <h1 className="adTitle">{t('returnsQueue.title')}</h1>
          <p className="adSub">{t('returnsQueue.subtitle')}</p>
        </div>
        {!history && waiting > 0 && <span className="rtWaiting">{t('returnsQueue.waiting', { count: waiting })}</span>}
      </header>

      <div className="olTabs" ref={tabsRef} role="group" aria-label={t('returnsQueue.title')}>
        {indicator && <span className="olTabInk" style={{ left: indicator.left, width: indicator.width }} aria-hidden="true" />}
        {TABS.map((key) => (
          <button key={key} type="button" className="olTab" aria-pressed={tab === key} onClick={() => setTab(key)}>
            {t(key === 'active' ? 'returnsQueue.tabActive' : 'returnsQueue.tabHistory')}
          </button>
        ))}
      </div>

      {isPending && <SkeletonLoader rows={4} />}

      {isError && (
        <Alert type="error" showIcon message={formatAdminError(t, error)}
          action={<Button size="small" shape="round" onClick={() => void refetch()}>{t('common:actions.retry')}</Button>} />
      )}

      {!isPending && !isError && items.length === 0 && (
        <div className="olEmpty">
          <span className="olEmptyIcon" aria-hidden="true">
            <Scale size={24} />
          </span>
          <p className="olEmptyTitle">{t(history ? 'returnsQueue.emptyHistory' : 'returnsQueue.empty')}</p>
          <p className="rtEmptyBody">{t(history ? 'returnsQueue.emptyHistoryBody' : 'returnsQueue.emptyActiveBody')}</p>
        </div>
      )}

      {!isPending && !isError && items.length > 0 && (
        <>
          <ul className="olRows" key={tab}>
            {sorted.map((item, index) => {
              const attention = needsDecision(item);
              return (
                <li key={item.id} className="olRowWrap" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                  data-attention={attention || undefined}>
                  <Link to={`/admin/returns/${item.id}`} className="rtRow">
                    <ProductThumbnail src={item.productImage ?? null} size={52} radius="md" />
                    <span className="olMain">
                      <span className="rtRowTitle">{item.productName ?? (item.orderNumber ? `#${item.orderNumber}` : t('returns:status.' + item.status))}</span>
                      <span className="olMeta">
                        {item.orderNumber && <>#{item.orderNumber} · </>}
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                      <span className="rtReason">{reasonLabel(t, item.reason)}</span>
                    </span>
                    <span className="rtRowEnd">
                      <span className="olStatus">
                        {attention && <span className="rtNeedsYou">{t('returnsQueue.needsDecision')}</span>}
                        <ReturnStatusTag status={item.status} />
                      </span>
                      <span className="olCount">
                        <Camera size={13} aria-hidden="true" /> {t('returnsQueue.photos', { count: item.imageCount })}
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
              <Button shape="round" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {t('returnsQueue.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
