import {
  canTransition,
  isCancellable,
  PRE_SHIPMENT_STATUSES,
} from '../../src/core/state-machines/order.state-machine';

// Pure unit tests — no DB/Redis needed. This table is the single source of truth (TRD §3); every
// edge and every rejected non-edge is asserted explicitly so a future accidental edit is caught.

describe('order.state-machine canTransition (Task 6.1 — adversarial)', () => {
  it.each([
    ['PAYMENT_PENDING', 'PAYMENT_CONFIRMED'],
    ['PAYMENT_PENDING', 'CANCELLED'],
    ['PAYMENT_CONFIRMED', 'PROCESSING'],
    ['PAYMENT_CONFIRMED', 'PENDING_MANUAL_LOGISTICS'],
    ['PAYMENT_CONFIRMED', 'CANCELLED'],
    ['PENDING_MANUAL_LOGISTICS', 'PROCESSING'],
    ['PENDING_MANUAL_LOGISTICS', 'CANCELLED'],
    ['PROCESSING', 'PICKED_UP'],
    ['PROCESSING', 'CANCELLED'],
    ['PICKED_UP', 'IN_TRANSIT'],
    ['IN_TRANSIT', 'OUT_FOR_DELIVERY'],
    ['OUT_FOR_DELIVERY', 'DELIVERED'],
    ['DELIVERED', 'COMPLETED'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['PAYMENT_PENDING', 'PROCESSING'],
    ['PAYMENT_PENDING', 'DELIVERED'],
    ['PAYMENT_CONFIRMED', 'PAYMENT_PENDING'],
    ['PROCESSING', 'PAYMENT_CONFIRMED'],
    ['PROCESSING', 'IN_TRANSIT'], // must go through PICKED_UP
    ['PICKED_UP', 'CANCELLED'], // post-shipment — no longer cancellable
    ['PICKED_UP', 'OUT_FOR_DELIVERY'], // skipping IN_TRANSIT
    ['IN_TRANSIT', 'PICKED_UP'], // no backward transitions
    ['DELIVERED', 'CANCELLED'],
    ['DELIVERED', 'PROCESSING'],
    ['COMPLETED', 'PROCESSING'],
    ['CANCELLED', 'PAYMENT_PENDING'],
    ['COMPLETED', 'CANCELLED'],
  ] as const)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('terminal statuses (COMPLETED, CANCELLED) have zero outbound edges', () => {
    expect(canTransition('COMPLETED', 'COMPLETED')).toBe(false);
    expect(canTransition('CANCELLED', 'CANCELLED')).toBe(false);
  });
});

describe('order.state-machine isCancellable (Gap #3)', () => {
  it.each(PRE_SHIPMENT_STATUSES)('%s is cancellable', (status) => {
    expect(isCancellable(status)).toBe(true);
  });

  it.each(['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED'] as const)(
    '%s is not cancellable',
    (status) => {
      expect(isCancellable(status)).toBe(false);
    },
  );
});
