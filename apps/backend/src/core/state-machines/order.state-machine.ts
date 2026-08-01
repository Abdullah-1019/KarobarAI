import type { OrderStatus } from '@prisma/client';

// Feature 7 Task 1.3 — TRD §3's explicit call for "a single source of valid transitions (shared
// module)": both Seller-triggered transitions (cancel) and system/future-Feature-8-triggered
// transitions (payment confirmation, courier-driven shipment progress) import this same table.
// No second transition list is ever defined anywhere else — that's the whole point.
//
// Feature 7 itself only ever calls a subset of these edges (PAYMENT_PENDING/PAYMENT_CONFIRMED/
// PROCESSING -> CANCELLED, PAYMENT_PENDING -> PAYMENT_CONFIRMED, and DELIVERED for its own entry-
// action test coverage) — the shipment-progress edges (PROCESSING -> PICKED_UP -> ... ->
// DELIVERED) exist in this table for Feature 8's future courier-poll job to call, exactly the
// same "define the contract now, no caller yet" pattern as Feature 4's decrementStock/
// restoreStock before Feature 6 became their first real caller.

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PAYMENT_PENDING: ['PAYMENT_CONFIRMED', 'CANCELLED'],
  PAYMENT_CONFIRMED: ['PROCESSING', 'PENDING_MANUAL_LOGISTICS', 'CANCELLED'],
  PENDING_MANUAL_LOGISTICS: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

// Gap #3 — Sellers may manually trigger only cancellation (from any pre-shipment state) in this
// feature. PROCESSING is reached via courier booking (Feature 8's future trigger, not a manual
// seller button); shipment-progress states are exclusively system/poll-driven (Feature 8).
export const PRE_SHIPMENT_STATUSES: readonly OrderStatus[] = [
  'PAYMENT_PENDING',
  'PAYMENT_CONFIRMED',
  'PROCESSING',
  'PENDING_MANUAL_LOGISTICS',
];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isCancellable(status: OrderStatus): boolean {
  return PRE_SHIPMENT_STATUSES.includes(status);
}
