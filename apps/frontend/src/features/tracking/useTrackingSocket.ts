import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

import { apiRootUrl } from '../../api';
import { orderQueryKey } from '../orders/ordersApi';
import { trackingQueryKey } from './trackingApi';

// SCR-B08's live-update requirement (REQ-F-Track002). Subscribes to the /tracking namespace's
// order:<orderId> room (core/socket/index.ts) using the order's own public id — the same value
// this hook's caller already has from its own route param. Only usable by the authenticated
// tracking page: the public page (SCR-B09) has no order id to subscribe with, since TrackingDTO
// deliberately carries none (Task 5.2's no-PII-beyond-necessary DTO) — it polls instead.
export function useTrackingSocket(orderId: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!orderId) return undefined;

    const socket = io(`${apiRootUrl}/tracking`, { withCredentials: true });

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: trackingQueryKey(orderId) });
      queryClient.invalidateQueries({ queryKey: orderQueryKey(orderId) });
    };

    socket.on('connect', () => socket.emit('subscribe', orderId));
    socket.on('order_status_update', invalidate);
    socket.on('tracking_location_update', invalidate);

    return () => {
      socket.disconnect();
    };
  }, [orderId, queryClient]);
}
