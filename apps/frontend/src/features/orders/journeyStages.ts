import type { OrderStatus } from '@karobarai/shared';

export const JOURNEY_STAGES = ['placed', 'packing', 'shipped', 'onTheWay', 'delivered'] as const;

// Where an order sits on the five-stage journey (0–4), or -1 when it was cancelled.
export function journeyIndex(status: OrderStatus): number {
  switch (status) {
    case 'PAYMENT_PENDING':
    case 'PAYMENT_CONFIRMED':
      return 0;
    case 'PROCESSING':
    case 'PACKED':
    case 'PENDING_MANUAL_LOGISTICS':
      return 1;
    case 'HANDED_OVER_TO_COURIER':
    case 'PICKED_UP':
      return 2;
    case 'IN_TRANSIT':
    case 'OUT_FOR_DELIVERY':
      return 3;
    case 'DELIVERED':
    case 'COMPLETED':
      return 4;
    case 'CANCELLED':
      return -1;
  }
}
