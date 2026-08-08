import type { NotificationListDTO, UnreadCountDTO } from '@karobarai/shared';

import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';

// Feature 9 (Notifications) — the consumer/read side. Dispatch (SMS/WhatsApp/Email/In-App) is
// entirely backend-owned; this file only covers the 3 personal, ownership-scoped read/write
// endpoints the Notification Center and bell icon need.

// One stable key for the whole paginated set — cursor is a useInfiniteQuery pageParam, not part
// of the key (same convention as features/orders/ordersApi.ts's buyerOrdersQueryKey).
export const notificationsQueryKey = ['notifications', 'list'] as const;

export function listNotifications(cursor?: string): Promise<NotificationListDTO> {
  return unwrap(apiClient.get<ApiEnvelope<NotificationListDTO>>('/notifications', { params: { cursor } }));
}

export const unreadCountQueryKey = ['notifications', 'unread-count'] as const;

export function getUnreadCount(): Promise<UnreadCountDTO> {
  return unwrap(apiClient.get<ApiEnvelope<UnreadCountDTO>>('/notifications/unread-count'));
}

export function markAsRead(id: string): Promise<{ read: true }> {
  return unwrap(apiClient.patch<ApiEnvelope<{ read: true }>>(`/notifications/${id}/read`));
}
