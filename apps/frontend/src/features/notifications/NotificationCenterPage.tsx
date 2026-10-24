import { useEffect, useRef, useState } from 'react';
import { Alert, Button } from 'antd';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/ur';
import relativeTime from 'dayjs/plugin/relativeTime';
import { BellRing, CheckCheck, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import type { NotificationDTO } from '@karobarai/shared';
import { useLanguage } from '../../hooks';
import { useAuthStore } from '../../lib/authStore';
import { NotificationIcon } from './NotificationIcon';
import { listNotifications, markAsRead, markManyAsRead, notificationsQueryKey, unreadSummaryQueryKey } from './notificationsApi';
import { formatNotificationsError } from './notificationsErrors';
import { useUnreadSummary } from './useUnreadCount';
import './notifications.css';

dayjs.extend(relativeTime);

const ROLE_HOME: Record<string, string> = { SELLER: '/seller', ADMIN: '/admin', SUPPORT: '/admin' };

type Filter = 'all' | 'unread';
type GroupKey = 'today' | 'yesterday' | 'thisWeek' | 'earlier';
const GROUPS: GroupKey[] = ['today', 'yesterday', 'thisWeek', 'earlier'];

function groupOf(createdAt: string): GroupKey {
  const at = dayjs(createdAt);
  const today = dayjs().startOf('day');
  if (!at.isBefore(today)) return 'today';
  if (!at.isBefore(today.subtract(1, 'day'))) return 'yesterday';
  if (!at.isBefore(today.subtract(6, 'day'))) return 'thisWeek';
  return 'earlier';
}

// Notification Center, Studio Light. Rendered inside the signed-in role's own layout (RoleShell).
// A title with the unread count and "Mark all as read", All / Unread pills, then the list grouped
// by day as white cards: a toned event icon, the server-written message, relative time and, when
// the notification is about an order or a return, a "View order" / "View return" cue that opens
// it. Unread rows carry a peach wash and a persimmon dot. "Mark all" clears every unread one.
const isReturnEvent = (eventType: string) => eventType.startsWith('RETURN_') || eventType.startsWith('REFUND_');

export function NotificationCenterPage() {
  const { t } = useTranslation(['notifications', 'common']);
  const { language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<Filter>('all');
  const unreadTotal = useUnreadSummary()?.count;

  dayjs.locale(language.toLowerCase() === 'ur' ? 'ur' : 'en');

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey: notificationsQueryKey,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => listNotifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  function markLocallyRead(ids: Set<string>) {
    queryClient.setQueryData(notificationsQueryKey, (old: typeof data) =>
      old
        ? {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => (ids.has(item.id) ? { ...item, status: 'READ' as const } : item)),
            })),
          }
        : old,
    );
    void queryClient.invalidateQueries({ queryKey: unreadSummaryQueryKey });
  }

  // A new notification arriving while the page is open (the shared summary polls) shows up here
  // without a manual refresh.
  const lastTotal = useRef(unreadTotal);
  useEffect(() => {
    if (unreadTotal !== undefined && lastTotal.current !== undefined && unreadTotal > lastTotal.current) {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    }
    lastTotal.current = unreadTotal;
  }, [unreadTotal, queryClient]);

  const readMutation = useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onSuccess: (_, id) => markLocallyRead(new Set([id])),
  });

  const readAllMutation = useMutation({
    mutationFn: () => markManyAsRead(),
    onSuccess: () => markLocallyRead(new Set(unreadItems.map((item) => item.id))),
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const unreadItems = items.filter((item) => item.status !== 'READ');
  const visible = filter === 'unread' ? unreadItems : items;
  const grouped = GROUPS.map((key) => ({ key, items: visible.filter((item) => groupOf(item.createdAt) === key) })).filter(
    (group) => group.items.length > 0,
  );

  // Where a notification leads: return/refund events open that return, everything else about an
  // order opens the order — each on the signed-in role's own page.
  function targetHref(item: NotificationDTO): string | null {
    if (!item.orderId) return null;
    const role = user?.role;
    if (isReturnEvent(item.eventType)) {
      if (role === 'BUYER') {
        return item.returnId ? `/orders/${item.orderId}/return/${item.returnId}/status` : `/orders/${item.orderId}/return/status`;
      }
      if (role === 'SELLER') return item.returnId ? `/seller/returns/${item.returnId}` : '/seller/returns';
      if (role === 'ADMIN' || role === 'SUPPORT') return item.returnId ? `/admin/returns/${item.returnId}` : '/admin/returns';
      return null;
    }
    if (role === 'BUYER') return `/orders/${item.orderId}`;
    if (role === 'SELLER') return `/seller/orders/${item.orderId}`;
    return null;
  }

  function handleItemClick(item: NotificationDTO) {
    if (item.status !== 'READ') readMutation.mutate(item.id);
    const href = targetHref(item);
    if (href) navigate(href);
  }

  function renderItem(item: NotificationDTO, index: number) {
    const unread = item.status !== 'READ';
    const href = targetHref(item);
    return (
      <li key={item.id} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
        <button type="button" className="ncItem" data-unread={unread || undefined} onClick={() => handleItemClick(item)}>
          <NotificationIcon eventType={item.eventType} size={40} />
          <span className="ncBody">
            <span className="ncMessage" dir="auto">
              {item.message}
            </span>
            <span className="ncMeta">
              <time dateTime={item.createdAt} title={dayjs(item.createdAt).format('D MMM YYYY, h:mm A')}>
                {dayjs(item.createdAt).fromNow()}
              </time>
              {href && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="ncCue">{t(isReturnEvent(item.eventType) ? 'center.viewReturn' : 'center.viewOrder')}</span>
                </>
              )}
            </span>
          </span>
          {unread && (
            <span className="ncDot">
              <span className="sr-only">{t('center.unreadLabel')}</span>
            </span>
          )}
          {href && <ChevronRight size={18} className="ncChevron" aria-hidden="true" />}
        </button>
      </li>
    );
  }

  const homeHref = user ? (ROLE_HOME[user.role] ?? '/') : '/';
  const showEmpty = !isPending && !isError && visible.length === 0;
  // The server's count covers pages not loaded yet; the loaded list is the fallback.
  const unreadShown = Math.max(unreadTotal ?? 0, unreadItems.length);

  return (
    <div className="ncPage">
      <header className="ncHead">
        <div className="ncHeadText">
          <h1 className="ncTitle">
            {t('center.title')}
            {unreadShown > 0 && <span className="ncCount">{t('center.unreadCount', { count: unreadShown })}</span>}
          </h1>
          <p className="ncSub">{t('center.subtitle')}</p>
        </div>
        {unreadShown > 0 && (
          <button type="button" className="ncGhost" disabled={readAllMutation.isPending} onClick={() => readAllMutation.mutate()}>
            <CheckCheck size={16} aria-hidden="true" />
            {t('center.markAllRead')}
          </button>
        )}
      </header>

      <div className="ncTabs" role="group" aria-label={t('center.title')}>
        {(['all', 'unread'] as const).map((key) => (
          <button key={key} type="button" className="ncTab" aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {t(key === 'all' ? 'center.tabAll' : 'center.tabUnread')}
            {key === 'unread' && unreadItems.length > 0 && <span className="ncTabCount">{unreadItems.length}</span>}
          </button>
        ))}
      </div>

      {isPending && (
        <ul className="ncList" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="ncSkeleton">
              <span className="ncSkelIcon" />
              <span className="ncSkelLines">
                <span style={{ width: '72%' }} />
                <span style={{ width: '30%' }} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {isError && (
        <Alert
          type="error"
          showIcon
          message={formatNotificationsError(t, error)}
          action={
            <Button size="small" shape="round" onClick={() => void refetch()}>
              {t('common:actions.retry')}
            </Button>
          }
        />
      )}

      {showEmpty && (
        <div className="ncEmpty">
          <span className="ncEmptyArt" aria-hidden="true">
            <BellRing size={28} />
          </span>
          <p className="ncEmptyTitle">{t(filter === 'unread' ? 'center.emptyUnread' : 'center.empty')}</p>
          <p className="ncEmptyBody">{t(filter === 'unread' ? 'center.emptyUnreadBody' : 'center.emptyBody')}</p>
          <Link to={homeHref} className="ncEmptyLink">
            {t('center.goHome')}
          </Link>
        </div>
      )}

      {!isPending && !isError && grouped.length > 0 && (
        <>
          {grouped.map((group) => (
            <section key={group.key} className="ncGroup" aria-labelledby={`nc-${group.key}`}>
              <h2 id={`nc-${group.key}`} className="ncGroupTitle">
                {t(`center.${group.key}`)}
              </h2>
              <ul className="ncList">{group.items.map(renderItem)}</ul>
            </section>
          ))}
        </>
      )}

      {!isPending && !isError && hasNextPage && (
        <div className="ncMore">
          <Button shape="round" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
            {t('center.loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
