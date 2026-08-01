import type { OrderStatus, PaymentMethod } from '../enums/index';

// Feature 7 (Order Management) DTOs — Schema §4.10/4.11/4.21 (orders/order_items/tracking_events).

// Task 2.2's shared canonical-status -> friendly-tab mapping (App Flow SCR-S05). Both Buyer
// Orders and Seller Orders import this same constant — never redefined per role.
export const ORDER_STATUS_TABS = {
  Pending: ['PAYMENT_PENDING', 'PENDING_MANUAL_LOGISTICS'],
  ConfirmedProcessing: ['PAYMENT_CONFIRMED', 'PROCESSING'],
  Shipped: ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'],
  Delivered: ['DELIVERED', 'COMPLETED'],
  Cancelled: ['CANCELLED'],
} as const satisfies Record<string, readonly OrderStatus[]>;

export type OrderStatusTab = keyof typeof ORDER_STATUS_TABS;

export interface OrderListItemDTO {
  id: string; // order publicId
  // Buyer's list shows the seller's storeName; Seller's list shows the order's snapshotted
  // recipient name (Task 4.3's "buyer, masked/summary" — full shipping PII stays Order-Detail-only).
  counterpartyName: string;
  itemCount: number;
  totalAmount: string;
  status: OrderStatus;
  placedAt: string;
  // Task 3.4 — Buyer-list-only gate check (not present on the Seller's list). Read-only: this
  // feature never creates a return, only tells the UI whether the button should be enabled.
  returnEligible?: boolean;
}

export interface OrderListDTO {
  items: OrderListItemDTO[];
  nextCursor: string | null;
}

export interface OrderItemDetailDTO {
  productId: string;
  titleSnapshot: string;
  unitPrice: string;
  quantity: number;
}

export interface TrackingEventDTO {
  status: OrderStatus;
  description: string | null;
  eventTime: string;
}

export interface OrderShippingDTO {
  recipientName: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string;
  postalCode: string | null;
  phone: string;
}

export interface OrderDetailDTO {
  id: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  subtotal: string;
  shippingFee: string;
  totalAmount: string;
  // Present only when the requester is this order's own Seller (Task 5.1) — never sent to the
  // Buyer, at the API layer, not just hidden client-side.
  commission: { rate: string; amount: string } | null;
  items: OrderItemDetailDTO[];
  shipping: OrderShippingDTO;
  // Feature 7's Task 7 patch: courier assignment is entirely Feature 8's scope. This is always
  // "not_booked" here — never populated with real courier data by this feature.
  courierStatus: 'not_booked';
  timeline: TrackingEventDTO[];
  cancellable: boolean;
  placedAt: string;
  deliveredAt: string | null;
}
