import type { ReturnDetailDTO, ReturnListDTO } from '@karobarai/shared';

import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';

// Feature 10 (Returns & Refunds) — F10-returns-refunds-backend.md. Every mutation below returns
// the full updated ReturnDetailDTO (except escalate, which is audit-only), so callers can
// setQueryData directly rather than refetching.

export function returnQueryKey(id: string) {
  return ['returns', 'detail', id] as const;
}

export function createReturn(orderId: string, reason: string): Promise<ReturnDetailDTO> {
  return unwrap(apiClient.post<ApiEnvelope<ReturnDetailDTO>>('/returns', { orderId, reason }));
}

export const buyerReturnsQueryKey = ['returns', 'buyer'] as const;

export function listBuyerReturns(cursor?: string): Promise<ReturnListDTO> {
  return unwrap(apiClient.get<ApiEnvelope<ReturnListDTO>>('/returns', { params: { cursor } }));
}

export function getReturn(id: string): Promise<ReturnDetailDTO> {
  return unwrap(apiClient.get<ApiEnvelope<ReturnDetailDTO>>(`/returns/${id}`));
}

export function uploadReturnImages(id: string, files: File[]): Promise<ReturnDetailDTO> {
  const formData = new FormData();
  for (const file of files) formData.append('images', file);
  return unwrap(apiClient.post<ApiEnvelope<ReturnDetailDTO>>(`/returns/${id}/images`, formData));
}

export function removeReturnImage(id: string, imageId: string): Promise<ReturnDetailDTO> {
  return unwrap(apiClient.delete<ApiEnvelope<ReturnDetailDTO>>(`/returns/${id}/images/${imageId}`));
}

export function submitReturn(id: string): Promise<ReturnDetailDTO> {
  return unwrap(apiClient.post<ApiEnvelope<ReturnDetailDTO>>(`/returns/${id}/submit`));
}

export function appealReturn(id: string): Promise<ReturnDetailDTO> {
  return unwrap(apiClient.post<ApiEnvelope<ReturnDetailDTO>>(`/returns/${id}/appeal`));
}

// --- Seller ---

export function sellerReturnsQueryKey(history: boolean) {
  return ['returns', 'seller', history ? 'history' : 'active'] as const;
}

export function listSellerReturns(history: boolean, cursor?: string): Promise<ReturnListDTO> {
  return unwrap(
    apiClient.get<ApiEnvelope<ReturnListDTO>>('/seller/returns', { params: { cursor, history: history ? 'true' : undefined } }),
  );
}

export function getSellerReturn(id: string): Promise<ReturnDetailDTO> {
  return unwrap(apiClient.get<ApiEnvelope<ReturnDetailDTO>>(`/seller/returns/${id}`));
}

export function sellerDecideReturn(id: string, decision: 'APPROVED' | 'REJECTED', reason?: string): Promise<ReturnDetailDTO> {
  return unwrap(apiClient.post<ApiEnvelope<ReturnDetailDTO>>(`/seller/returns/${id}/decision`, { decision, reason }));
}

export function sellerEscalateReturn(id: string): Promise<{ escalated: true }> {
  return unwrap(apiClient.post<ApiEnvelope<{ escalated: true }>>(`/seller/returns/${id}/escalate`));
}
