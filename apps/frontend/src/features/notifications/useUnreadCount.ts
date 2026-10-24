import { useQuery } from '@tanstack/react-query';

import type { UnreadSummaryDTO } from '@karobarai/shared';
import { useAuthStore } from '../../lib/authStore';
import { getUnreadSummary, unreadSummaryQueryKey } from './notificationsApi';

// No Socket.IO channel exists for notifications (only Feature 8's /tracking namespace does), so
// the badges poll rather than pushing live — same tradeoff features/tracking/PublicTrackingPage.tsx
// made for the same reason. 30s keeps them reasonably fresh without a request storm. The bell and
// every section dot share this one query, so they always agree with each other.
const POLL_INTERVAL_MS = 30_000;

export function useUnreadSummary(): UnreadSummaryDTO | undefined {
  const user = useAuthStore((s) => s.user);

  const { data } = useQuery({
    queryKey: unreadSummaryQueryKey,
    queryFn: getUnreadSummary,
    enabled: !!user,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  return user ? data : undefined;
}

export function useUnreadCount(): number {
  return useUnreadSummary()?.count ?? 0;
}
