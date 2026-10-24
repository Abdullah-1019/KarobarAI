import { useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

import type { NotificationCategory } from '@karobarai/shared';
import { markManyAsRead } from './notificationsApi';
import { useUnreadSummary } from './useUnreadCount';

// Opening a section (Orders / Returns) counts as seeing its notifications, like most apps: the
// section's nav dot and the bell drop as soon as the page is open. The orders those notifications
// were about are remembered for this visit, so the list can still mark them "New". If another one
// arrives while the page is open, it is marked seen too and `refreshKey` (the list) is refetched.
export function useSectionSeen(category: NotificationCategory, refreshKey?: QueryKey): Set<string> {
  const queryClient = useQueryClient();
  const section = useUnreadSummary()?.[category];
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const inFlight = useRef(false);
  const seenOnce = useRef(false);

  const count = section?.count ?? 0;
  const orderIds = section?.orderIds.join(',') ?? '';

  useEffect(() => {
    if (count === 0 || inFlight.current) return;
    inFlight.current = true;
    const ids = orderIds ? orderIds.split(',') : [];
    setFresh((current) => new Set([...current, ...ids]));
    if (seenOnce.current && refreshKey) void queryClient.invalidateQueries({ queryKey: refreshKey });
    seenOnce.current = true;
    markManyAsRead({ category })
      .catch(() => undefined) // the dot simply stays until the next visit
      .finally(() => {
        inFlight.current = false;
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      });
    // refreshKey is a fresh array each render; the list it names is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, count, orderIds, queryClient]);

  return fresh;
}

// A detail page (one order, one return) clears just that order's notifications in its section.
export function useOrderSeen(category: NotificationCategory, orderId: string | undefined): void {
  const queryClient = useQueryClient();
  const pending = useUnreadSummary()?.[category].orderIds.includes(orderId ?? '') ?? false;

  useEffect(() => {
    if (!pending || !orderId) return;
    markManyAsRead({ category, orderId })
      .catch(() => undefined)
      .finally(() => void queryClient.invalidateQueries({ queryKey: ['notifications'] }));
  }, [category, orderId, pending, queryClient]);
}
