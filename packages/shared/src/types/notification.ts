import type { Language } from '../enums/index';

// Feature 9 (Notifications) — Schema §4.19/4.20. Task 2.1's canonical event-type registry.
// `(string & {})` keeps this an OPEN union (any string is assignable) while still giving
// autocomplete for the known values — Task 2.1's explicit "addable without breaking existing
// consumers" requirement, so Feature 10 can add RETURN_DECISION/REFUND_ISSUED later without a
// closed-enum code change here.
export type NotificationEventType =
  | 'OTP_REQUESTED'
  | 'ORDER_PLACED'
  | 'ORDER_PAYMENT_CONFIRMED'
  | 'ORDER_CANCELLED'
  | 'ORDER_PICKED_UP'
  | 'ORDER_IN_TRANSIT'
  | 'ORDER_OUT_FOR_DELIVERY'
  | 'ORDER_DELIVERED'
  | 'COURIER_MANUAL_LOGISTICS'
  | 'TRACKING_POLL_FAILURE'
  | (string & {});

// Task 3.1 — a fixed business rule (not admin-configurable per any source doc), so a constant
// set, not a DB flag. RETURN_DECISION/REFUND_ISSUED are reserved for Feature 10 (not dispatched
// by anything yet) but already critical per the module doc's own listing.
export const CRITICAL_EVENT_TYPES = [
  'ORDER_PLACED',
  'ORDER_PAYMENT_CONFIRMED',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'COURIER_MANUAL_LOGISTICS',
  'OTP_REQUESTED',
  'RETURN_DECISION',
  'REFUND_ISSUED',
] as const;

export type NotificationChannel = 'SMS' | 'WHATSAPP' | 'IN_APP' | 'EMAIL';
export type NotificationStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';

export interface NotificationDTO {
  id: string; // notificationId, stringified — this table has no publicId column (Schema §4.19)
  orderId: string | null; // the order's publicId, if this notification relates to one
  channel: NotificationChannel;
  eventType: NotificationEventType;
  message: string;
  language: Language;
  status: NotificationStatus;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationListDTO {
  items: NotificationDTO[];
  nextCursor: string | null;
}

export interface UnreadCountDTO {
  count: number;
}
