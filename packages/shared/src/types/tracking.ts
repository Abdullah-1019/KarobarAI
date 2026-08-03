import type { CourierCode, OrderStatus } from '../enums/index';
import type { TrackingEventDTO } from './order';

// Feature 8 (Courier & Tracking) DTOs — Schema §4.21/4.22 (tracking_events/courier_quotes).

export interface CourierQuoteDTO {
  courier: CourierCode;
  cost: string;
  etaHours: number;
  score: string;
  selected: boolean;
}

export interface CourierQuotesDTO {
  quotes: CourierQuoteDTO[];
}

// Deliberately minimal — Task 5.2's explicit no-PII requirement. Used for BOTH the public
// (/t/:publicToken) and authenticated (/tracking/:orderId) reads: even the authenticated version
// never includes full shipping address/phone (Schema §4.10's ship_* fields stay Order-Detail-only,
// per Feature 7), so there is no meaningful "extra" data to add for the authenticated case.
export interface TrackingDTO {
  status: OrderStatus;
  courier: CourierCode | null;
  trackingNo: string | null;
  deliveryStageLabel: string;
  lastLocation: { lat: string; lng: string } | null;
  timeline: TrackingEventDTO[];
}
