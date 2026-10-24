import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '../../lib/authStore';
import { listHumanConversations } from './humanChatApi';

// The messages badge: total unread across the buyer's or seller's conversations. Shares the
// Messages page's first-page query (['human-conversations', 1]), so the chat socket's
// invalidations and opening a thread update the badge too. No app-wide socket, so it polls like
// the notification bell. Counts the first page (most recent conversations), where unread ones sit.
const POLL_INTERVAL_MS = 30_000;

export function useUnreadMessages(): number {
  const role = useAuthStore((s) => s.user?.role);
  const { data } = useQuery({
    queryKey: ['human-conversations', 1],
    queryFn: () => listHumanConversations(1),
    enabled: role === 'BUYER' || role === 'SELLER',
    refetchInterval: POLL_INTERVAL_MS,
  });
  return data?.items.reduce((sum, conversation) => sum + (conversation.blocked ? 0 : conversation.unreadCount), 0) ?? 0;
}
