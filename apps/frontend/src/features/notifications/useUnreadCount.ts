import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '../../lib/authStore';
import { getUnreadCount, unreadCountQueryKey } from './notificationsApi';

// No Socket.IO channel exists for notifications (only Feature 8's /tracking namespace does), so
// the badge polls rather than pushing live — same tradeoff features/tracking/PublicTrackingPage.tsx
// made for the same reason. 30s keeps the badge reasonably fresh without a request storm.
const POLL_INTERVAL_MS = 30_000;

export function useUnreadCount(): number {
  const user = useAuthStore((s) => s.user);

  const { data } = useQuery({
    queryKey: unreadCountQueryKey,
    queryFn: getUnreadCount,
    enabled: !!user,
    refetchInterval: POLL_INTERVAL_MS,
  });

  return data?.count ?? 0;
}
