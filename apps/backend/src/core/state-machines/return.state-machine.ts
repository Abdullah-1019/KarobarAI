import type { ReturnStatus } from '@prisma/client';

// Feature 10 Task 1.3 — mirrors order.state-machine.ts's exact shape (single canonical
// transition table, TRD §3). Only trusted service code calls transitionReturnStatus directly
// (never exposed generically to end users), so the table below models every theoretically legal
// edge; each caller only ever invokes the specific transitions its own workflow step needs.
const TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  INITIATED: ['IMAGES_SUBMITTED'],
  IMAGES_SUBMITTED: ['UNDER_AI_REVIEW', 'MANUAL_REVIEW'],
  // Reserved for R1.1 (Task 3.6's AiReviewDispatcher stub) — modeled so a later feature can enter
  // this state without a migration, but no MVP code path ever calls this transition.
  UNDER_AI_REVIEW: ['MANUAL_REVIEW'],
  MANUAL_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['PICKUP_BOOKED'],
  PICKUP_BOOKED: ['REFUND_ISSUED'],
  // REJECTED -> UNDER_DISPUTE: the buyer's appeal (Task 5's dependency on an appeal path that no
  // task explicitly builds — added as a natural extension of Task 2's buyer-facing surface, see
  // the handoff doc). REJECTED -> CLOSED: only ever invoked by the admin dispute-resolution
  // service, immediately chained after UNDER_DISPUTE -> REJECTED (Task 5.5's literal "-> REJECTED
  // -> CLOSED" wording) — never reachable from a plain seller rejection with no dispute.
  REJECTED: ['UNDER_DISPUTE', 'CLOSED'],
  // Admin's decision on a disputed case (BR-008: final, no further appeal). APPROVED here
  // re-enters the normal APPROVED -> PICKUP_BOOKED -> REFUND_ISSUED path.
  UNDER_DISPUTE: ['APPROVED', 'REJECTED'],
  REFUND_ISSUED: [],
  CLOSED: [],
};

export function canTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
