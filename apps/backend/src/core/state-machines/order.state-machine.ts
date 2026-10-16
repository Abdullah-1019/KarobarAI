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
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['HANDED_OVER_TO_COURIER', 'CANCELLED'],
  HANDED_OVER_TO_COURIER: ['PICKED_UP', 'DELIVERED'],
  PICKED_UP: ['IN_TRANSIT', 'DELIVERED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

// Seller-reported simulated delivery may move directly from handover or an in-transit milestone
// to DELIVERED. The seller route checks the booked simulated shipment; buyer receipt remains a
// separate DELIVERED -> COMPLETED transition.
export const PRE_SHIPMENT_STATUSES: readonly OrderStatus[] = [
  'PAYMENT_PENDING',
  'PAYMENT_CONFIRMED',
  'PROCESSING',
  'PACKED',
  'PENDING_MANUAL_LOGISTICS',
];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isCancellable(status: OrderStatus): boolean {
  return PRE_SHIPMENT_STATUSES.includes(status);
}
