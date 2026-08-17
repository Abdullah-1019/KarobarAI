import { Alert, Button, List, Typography } from 'antd';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { NotificationDTO } from '@karobarai/shared';
import { BackLink, EmptyState, SkeletonLoader } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { listNotifications, markAsRead, notificationsQueryKey, unreadCountQueryKey } from './notificationsApi';
import { formatNotificationsError } from './notificationsErrors';

const ROLE_HOME: Record<string, string> = { SELLER: '/seller', ADMIN: '/admin', SUPPORT: '/admin' };

// Personal, ownership-scoped list (no guest access, no role branching in the API) — same
// useInfiniteQuery + "Load more" pattern as features/orders/OrderListPage.tsx. Not nested under
// any of the three role AppShells (Phase C) — reachable by any authenticated role from the bell
// icon, so there's no single natural shell to put it in. That's a Phase C-level navigation
// question, out of scope here; the BackLink below is the minimum fix so this page isn't a dead
// end with literally no way back except the browser's own back button.
export function NotificationCenterPage() {
  const { t } = useTranslation(['notifications', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

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

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-6)' }}>
      <BackLink to={user ? (ROLE_HOME[user.role] ?? '/') : '/'} label={t('common:nav.home')} />
      <Typography.Title level={3} style={{ marginTop: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
        {t('center.title')}
      </Typography.Title>

      {isPending && <SkeletonLoader rows={4} />}

      {isError && <Alert type="error" showIcon message={formatNotificationsError(t, error)} />}

      {!isPending && !isError && items.length === 0 && <EmptyState title={t('center.empty')} />}

      {!isPending && !isError && items.length > 0 && (
        <>
          <List
            dataSource={items}
            renderItem={(item) => (
              <List.Item
                onClick={() => handleItemClick(item)}
                style={{ cursor: 'pointer', padding: 'var(--sp-3) var(--sp-2)' }}
              >
                <List.Item.Meta
                  title={
                    <Typography.Text strong={item.status !== 'READ'}>{item.message}</Typography.Text>
                  }
                  description={new Date(item.createdAt).toLocaleString()}
                />
              </List.Item>
            )}
          />
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
