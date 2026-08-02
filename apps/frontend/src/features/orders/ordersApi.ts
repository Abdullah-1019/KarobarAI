import type { OrderDetailDTO, OrderListDTO, OrderStatusTab } from '@karobarai/shared';

import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';

// Feature 7 (Order Management) — F7-orders-backend.md. Buyer and seller list/detail share this
// one API file since both DTOs and the tab contract (packages/shared's ORDER_STATUS_TABS) are
// identical, modulo `commission` which the backend already strips for buyers.

export function buyerOrdersQueryKey(tab?: OrderStatusTab) {
  return ['orders', 'buyer', tab ?? 'all'] as const;
}

export function listBuyerOrders(tab?: OrderStatusTab, cursor?: string): Promise<OrderListDTO> {
  return unwrap(apiClient.get<ApiEnvelope<OrderListDTO>>('/orders', { params: { tab, cursor } }));
}

export function sellerOrdersQueryKey(tab?: OrderStatusTab) {
  return ['orders', 'seller', tab ?? 'all'] as const;
}

export function listSellerOrders(tab?: OrderStatusTab, cursor?: string): Promise<OrderListDTO> {
  return unwrap(apiClient.get<ApiEnvelope<OrderListDTO>>('/seller/orders', { params: { tab, cursor } }));
}

export function orderQueryKey(id: string) {
  return ['orders', 'detail', id] as const;
}

export function getOrder(id: string): Promise<OrderDetailDTO> {
  return unwrap(apiClient.get<ApiEnvelope<OrderDetailDTO>>(`/orders/${id}`));
}

// Seller-only per F7-orders-backend.md's Assumption #1 — not Buyer-triggerable in this feature.
export function cancelOrder(id: string): Promise<OrderDetailDTO> {
  return unwrap(apiClient.post<ApiEnvelope<OrderDetailDTO>>(`/orders/${id}/cancel`));
}

// Auth is a Bearer token held in memory (apps/frontend/src/api/client.ts), not a cookie — a
// plain window.open(url) would send no Authorization header and 401. Fetch as a blob through
// apiClient instead, then open the resulting blob URL.
export async function viewInvoice(id: string): Promise<void> {
  const response = await apiClient.get(`/orders/${id}/invoice`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data as Blob);
  window.open(url, '_blank');
}
