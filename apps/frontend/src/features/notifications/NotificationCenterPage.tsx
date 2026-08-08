import { Alert, Button, Empty, List, Typography } from 'antd';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { NotificationDTO } from '@karobarai/shared';
import { SkeletonLoader } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { listNotifications, markAsRead, notificationsQueryKey, unreadCountQueryKey } from './notificationsApi';
import { formatNotificationsError } from './notificationsErrors';

// Personal, ownership-scoped list (no guest access, no role branching in the API) — same
// useInfiniteQuery + "Load more" pattern as features/orders/OrderListPage.tsx.
export function NotificationCenterPage() {
  const { t } = useTranslation(['notifications']);
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
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t('center.title')}</Typography.Title>

      {isPending && <SkeletonLoader rows={4} />}

      {isError && <Alert type="error" showIcon message={formatNotificationsError(t, error)} />}

      {!isPending && !isError && items.length === 0 && <Empty description={t('center.empty')} />}

      {!isPending && !isError && items.length > 0 && (
        <>
          <List
            dataSource={items}
            renderItem={(item) => (
              <List.Item
                onClick={() => handleItemClick(item)}
                style={{ cursor: 'pointer', padding: '12px 8px' }}
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
            <div style={{ textAlign: 'center', marginTop: 16 }}>
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
