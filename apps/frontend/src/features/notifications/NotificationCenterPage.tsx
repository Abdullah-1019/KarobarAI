import { useState } from 'react';
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
import { listNotifications, markAsRead, notificationsQueryKey, unreadCountQueryKey } from './notificationsApi';
import { formatNotificationsError } from './notificationsErrors';
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
// the notification is about an order, a "View order" cue. Unread rows carry a peach wash and a
// persimmon dot. There is no bulk read endpoint, so "Mark all" marks the loaded unread items.
export function NotificationCenterPage() {
  const { t } = useTranslation(['notifications', 'common']);
  const { language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<Filter>('all');

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
    void queryClient.invalidateQueries({ queryKey: unreadCountQueryKey });
  }

  const readMutation = useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onSuccess: (_, id) => markLocallyRead(new Set([id])),
  });

  const readAllMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => markAsRead(id)));
      return ids.filter((_, index) => results[index]?.status === 'fulfilled');
    },
    onSuccess: (doneIds) => markLocallyRead(new Set(doneIds)),
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const unreadItems = items.filter((item) => item.status !== 'READ');
  const visible = filter === 'unread' ? unreadItems : items;
  const grouped = GROUPS.map((key) => ({ key, items: visible.filter((item) => groupOf(item.createdAt) === key) })).filter(
    (group) => group.items.length > 0,
  );

  function orderHref(item: NotificationDTO): string | null {
    if (!item.orderId) return null;
    if (user?.role === 'BUYER') return `/orders/${item.orderId}`;
    if (user?.role === 'SELLER') return `/seller/orders/${item.orderId}`;
    return null;
  }

  function handleItemClick(item: NotificationDTO) {
    if (item.status !== 'READ') readMutation.mutate(item.id);
    const href = orderHref(item);
    if (href) navigate(href);
  }

  function renderItem(item: NotificationDTO, index: number) {
    const unread = item.status !== 'READ';
    const href = orderHref(item);
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
                  <span className="ncCue">{t('center.viewOrder')}</span>
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

  return (
    <div className="ncPage">
      <header className="ncHead">
        <div className="ncHeadText">
          <h1 className="ncTitle">
            {t('center.title')}
            {unreadItems.length > 0 && <span className="ncCount">{t('center.unreadCount', { count: unreadItems.length })}</span>}
          </h1>
          <p className="ncSub">{t('center.subtitle')}</p>
        </div>
        {unreadItems.length > 0 && (
          <button
            type="button"
            className="ncGhost"
            disabled={readAllMutation.isPending}
            onClick={() => readAllMutation.mutate(unreadItems.map((item) => item.id))}
          >
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
