import type { CourierCode, CourierQuotesDTO, OrderDetailDTO, TrackingDTO } from '@karobarai/shared';

import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';

// Feature 8 (Courier & Tracking) — F8-courier-tracking-backend.md. Courier selection/booking is
// mounted under Feature 7's own /orders/:id/* routes on the backend, but lives in its own
// tracking/ module there (and here) since it's a distinct concern from order CRUD.

export function courierQuotesQueryKey(orderId: string) {
  return ['tracking', 'courier-quotes', orderId] as const;
}

export function getCourierQuotes(orderId: string): Promise<CourierQuotesDTO> {
  return unwrap(apiClient.get<ApiEnvelope<CourierQuotesDTO>>(`/orders/${orderId}/courier-quotes`));
}

export function refreshCourierRates(orderId: string): Promise<CourierQuotesDTO> {
  return unwrap(apiClient.post<ApiEnvelope<CourierQuotesDTO>>(`/orders/${orderId}/refresh-rates`));
}

// Blocks synchronously on the backend for up to ~3 couriers x 3 retries x 30s while it retries
// and falls back across candidates (F8-courier-tracking-backend.md) — no axios timeout is set
// globally (apps/frontend/src/api/client.ts), so this call is left to run to completion rather
// than being cut off client-side. Callers must show a patient loading state, not a normal spinner.
export function bookCourier(orderId: string, courierCode: CourierCode): Promise<OrderDetailDTO> {
  return unwrap(apiClient.post<ApiEnvelope<OrderDetailDTO>>(`/orders/${orderId}/book-courier`, { courierCode }));
}

export function trackingQueryKey(orderId: string) {
  return ['tracking', 'authenticated', orderId] as const;
}

// Works for any order regardless of booking state — returns nulls for courier/trackingNo/
// lastLocation pre-booking, with deliveryStageLabel always populated (tracking.service.ts).
export function getAuthenticatedTracking(orderId: string): Promise<TrackingDTO> {
  return unwrap(apiClient.get<ApiEnvelope<TrackingDTO>>(`/tracking/${orderId}`));
}

export function publicTrackingQueryKey(token: string) {
  return ['tracking', 'public', token] as const;
}

// No Authorization header needed/sent — SCR-B09 is explicitly login-free.
export function getPublicTracking(token: string): Promise<TrackingDTO> {
  return unwrap(apiClient.get<ApiEnvelope<TrackingDTO>>(`/t/${token}`));
}
