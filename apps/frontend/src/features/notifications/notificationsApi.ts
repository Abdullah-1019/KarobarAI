import type { NotificationCategory, NotificationListDTO, UnreadSummaryDTO } from '@karobarai/shared';

import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';

// Feature 9 (Notifications) — the consumer/read side. Dispatch (SMS/WhatsApp/Email/In-App) is
// entirely backend-owned; this file only covers the personal, ownership-scoped read/write
// endpoints the Notification Center, the bell and the section dots need.

// One stable key for the whole paginated set — cursor is a useInfiniteQuery pageParam, not part
// of the key (same convention as features/orders/ordersApi.ts's buyerOrdersQueryKey).
export const notificationsQueryKey = ['notifications', 'list'] as const;

export function listNotifications(cursor?: string): Promise<NotificationListDTO> {
  return unwrap(apiClient.get<ApiEnvelope<NotificationListDTO>>('/notifications', { params: { cursor } }));
}

// The bell count plus the per-section (Orders / Returns) counts behind the nav dots.
export const unreadSummaryQueryKey = ['notifications', 'unread-summary'] as const;

export function getUnreadSummary(): Promise<UnreadSummaryDTO> {
  return unwrap(apiClient.get<ApiEnvelope<UnreadSummaryDTO>>('/notifications/unread-summary'));
}

export function markAsRead(id: string): Promise<{ read: true }> {
  return unwrap(apiClient.patch<ApiEnvelope<{ read: true }>>(`/notifications/${id}/read`));
}

/** Bulk read: everything (no filter), one section's notifications, and/or one order's. */
export function markManyAsRead(filter: { category?: NotificationCategory; orderId?: string } = {}): Promise<{ updated: number }> {
  return unwrap(apiClient.patch<ApiEnvelope<{ updated: number }>>('/notifications/read', filter));
}
