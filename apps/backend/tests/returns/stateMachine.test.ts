import { canTransition } from '../../src/core/state-machines/return.state-machine';

describe('return.state-machine canTransition (Task 1.3 — adversarial)', () => {
  it.each([
    ['INITIATED', 'IMAGES_SUBMITTED'],
    ['IMAGES_SUBMITTED', 'MANUAL_REVIEW'],
    ['IMAGES_SUBMITTED', 'UNDER_AI_REVIEW'],
    ['UNDER_AI_REVIEW', 'MANUAL_REVIEW'],
    ['MANUAL_REVIEW', 'APPROVED'],
    ['MANUAL_REVIEW', 'REJECTED'],
    ['APPROVED', 'PICKUP_BOOKED'],
    ['PICKUP_BOOKED', 'REFUND_ISSUED'],
    ['REJECTED', 'UNDER_DISPUTE'],
    ['REJECTED', 'CLOSED'],
    ['UNDER_DISPUTE', 'APPROVED'],
    ['UNDER_DISPUTE', 'REJECTED'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['INITIATED', 'REFUND_ISSUED'],
    ['INITIATED', 'MANUAL_REVIEW'],
    ['MANUAL_REVIEW', 'PICKUP_BOOKED'],
    ['MANUAL_REVIEW', 'CLOSED'],
    ['APPROVED', 'REFUND_ISSUED'],
    ['APPROVED', 'REJECTED'],
    ['PICKUP_BOOKED', 'CLOSED'],
    ['UNDER_DISPUTE', 'CLOSED'], // must go through REJECTED first
    ['CLOSED', 'MANUAL_REVIEW'],
    ['REFUND_ISSUED', 'CLOSED'],
  ] as const)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('terminal statuses (REFUND_ISSUED, CLOSED) have zero outbound edges', () => {
    expect(canTransition('REFUND_ISSUED', 'REFUND_ISSUED')).toBe(false);
    expect(canTransition('CLOSED', 'CLOSED')).toBe(false);
  });
});
