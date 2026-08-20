import { Alert, Button } from 'antd';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/ur';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { NotificationDTO } from '@karobarai/shared';
import { EmptyState, PageHeader } from '../../components';
import { useLanguage } from '../../hooks';
import { useAuthStore } from '../../lib/authStore';
import { NotificationIcon } from './NotificationIcon';
import { listNotifications, markAsRead, notificationsQueryKey, unreadCountQueryKey } from './notificationsApi';
import { formatNotificationsError } from './notificationsErrors';

dayjs.extend(relativeTime);

const ROLE_HOME: Record<string, string> = { SELLER: '/seller', ADMIN: '/admin', SUPPORT: '/admin' };

function ListSkeletonRow() {
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-2)' }} aria-hidden="true">
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-sunken)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', justifyContent: 'center' }}>
        <div style={{ width: '70%', height: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-sunken)' }} />
        <div style={{ width: '35%', height: 10, borderRadius: 'var(--radius-sm)', background: 'var(--bg-sunken)' }} />
      </div>
    </div>
  );
}

function groupByRecency(items: NotificationDTO[]) {
  const today: NotificationDTO[] = [];
  const earlier: NotificationDTO[] = [];
  const startOfToday = dayjs().startOf('day');
  for (const item of items) {
    (dayjs(item.createdAt).isBefore(startOfToday) ? earlier : today).push(item);
  }
  return { today, earlier };
}

// Personal, ownership-scoped list (no guest access, no role branching in the API) — same
// useInfiniteQuery + "Load more" pattern as features/orders/OrderListPage.tsx. Not nested under
// any of the three role AppShells (Phase C) — reachable by any authenticated role from the bell
// icon, so there's no single natural shell to put it in. That's a Phase C-level navigation
// question, out of scope here; PageHeader's back-link is the minimum fix so this page isn't a dead
// end with literally no way back except the browser's own back button.
export function NotificationCenterPage() {
  const { t } = useTranslation(['notifications', 'common']);
  const { language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  dayjs.locale(language.toLowerCase() === 'ur' ? 'ur' : 'en');

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: notificationsQueryKey,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => listNotifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData(notificationsQueryKey, (old: typeof data) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((item) => (item.id === id ? { ...item, status: 'READ' as const } : item)),
              })),
            }
          : old,
      );
      queryClient.invalidateQueries({ queryKey: unreadCountQueryKey });
    },
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const { today, earlier } = groupByRecency(items);

  function handleItemClick(item: NotificationDTO) {
    if (item.status !== 'READ') {
      readMutation.mutate(item.id);
    }
    // Admin's order-detail screens don't exist yet (Feature 12 frontend not built) — nothing
    // sensible to navigate to there, so only Buyer/Seller click-through.
    if (item.orderId && user?.role === 'BUYER') {
      navigate(`/orders/${item.orderId}`);
    } else if (item.orderId && user?.role === 'SELLER') {
      navigate(`/seller/orders/${item.orderId}`);
    }
  }

  function renderItem(item: NotificationDTO) {
    const unread = item.status !== 'READ';
    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        onClick={() => handleItemClick(item)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleItemClick(item);
        }}
        style={{
          display: 'flex',
          gap: 'var(--sp-3)',
          padding: 'var(--sp-3) var(--sp-2)',
          borderRadius: 'var(--radius-md)',
          background: unread ? 'var(--bg-sunken)' : 'transparent',
          cursor: 'pointer',
        }}
      >
        <NotificationIcon eventType={item.eventType} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            {unread && (
              <span
                aria-hidden="true"
                style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-primary)', flexShrink: 0 }}
              />
            )}
            <span style={{ fontWeight: unread ? 600 : 400, color: 'var(--text-primary)' }}>{item.message}</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', marginTop: 'var(--sp-1)' }}>
            {dayjs(item.createdAt).fromNow()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-6)' }}>
      <PageHeader title={t('center.title')} backTo={user ? (ROLE_HOME[user.role] ?? '/') : '/'} backLabel={t('common:nav.home')} />

      {isPending && (
        <div>
          {Array.from({ length: 4 }).map((_, i) => (
            <ListSkeletonRow key={i} />
          ))}
        </div>
      )}

      {isError && <Alert type="error" showIcon message={formatNotificationsError(t, error)} />}

      {!isPending && !isError && items.length === 0 && (
        <EmptyState title={t('center.empty')} description={t('center.emptyBody')} />
      )}

      {!isPending && !isError && items.length > 0 && (
        <>
          {today.length > 0 && (
            <div style={{ marginBottom: 'var(--sp-4)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: 'var(--sp-1)' }}>
                {t('center.today')}
              </div>
              {today.map(renderItem)}
            </div>
          )}
          {earlier.length > 0 && (
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: 'var(--sp-1)' }}>
                {t('center.earlier')}
              </div>
              {earlier.map(renderItem)}
            </div>
          )}
          {hasNextPage && (
            <div style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
              <Button loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {t('center.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
