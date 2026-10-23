import type { ComponentType } from 'react';
import type { ReturnDetailDTO } from '@karobarai/shared';
import { CheckCircle2, Package, PackageSearch, Truck, Wallet, XCircle, type LucideProps } from 'lucide-react';

export type StepState = 'done' | 'current' | 'upcoming';

export interface ReturnStep {
  key: string;
  labelKey: string;
  icon: ComponentType<LucideProps>;
  state: StepState;
  timestamp: string | null;
}

// E6 — mirrors TrackingTimeline's completed/current/upcoming visual language on purpose (brief:
// "the user should immediately understand the relationship between Order Tracking and Return
// Tracking"), but derives its steps from ReturnDetailDTO's real status + timestamp fields
// (createdAt/decidedAt/refundedAt), not a second copy of the order lifecycle. A rejected return
// never shows pickup/refund steps — there's nothing further to expect (same principle as
// TrackingTimeline showing no upcoming steps after CANCELLED).
export function buildSteps(ret: ReturnDetailDTO): ReturnStep[] {
  const reachedReview = ret.status !== 'INITIATED' && ret.status !== 'IMAGES_SUBMITTED';
  const decided = ret.decision !== null;
  const rejected = ret.decision === 'REJECTED';
  const approved = ret.decision === 'APPROVED';
  const returnLeg = ret.shipments?.find((shipment) => shipment.leg === 'RETURN');
  const replacementLeg = ret.shipments?.find((shipment) => shipment.leg === 'REPLACEMENT');

  const steps: ReturnStep[] = [
    {
      key: 'requested',
      labelKey: 'progress.requested',
      icon: PackageSearch,
      state: 'done',
      timestamp: ret.createdAt,
    },
    {
      key: 'review',
      labelKey: 'progress.review',
      icon: Package,
      state: decided ? 'done' : reachedReview ? 'current' : 'upcoming',
      timestamp: reachedReview ? ret.createdAt : null,
    },
    {
      key: 'decision',
      labelKey: rejected ? 'progress.rejected' : 'progress.approved',
      icon: rejected ? XCircle : CheckCircle2,
      state: decided ? 'done' : reachedReview ? 'current' : 'upcoming',
      timestamp: ret.decidedAt,
    },
  ];

  if (ret.dispute) {
    steps.push({ key: 'appeal', labelKey: ret.dispute.status === 'OPEN'
      ? 'progress.appealPending' : 'progress.appealResolved', icon: PackageSearch,
    state: ret.dispute.status === 'OPEN' ? 'current' : 'done',
    timestamp: ret.dispute.resolvedAt ?? null });
  }

  if (!decided || approved) {
    steps.push({
      key: 'pickup',
      labelKey: 'progress.pickup',
      icon: Truck,
      state: returnLeg ? 'done' : decided ? 'current' : 'upcoming',
      timestamp: returnLeg?.bookedAt ?? null,
    });
    steps.push({
      key: 'received', labelKey: 'progress.receivedBySeller', icon: Package,
      state: ret.fulfillment?.receiptConfirmedAt ? 'done' : returnLeg?.status === 'DELIVERED' ? 'current' : 'upcoming',
      timestamp: ret.fulfillment?.receiptConfirmedAt ?? null,
    });
    if (ret.fulfillment?.refundProposalStatus !== 'NONE' && ret.fulfillment?.refundProposalStatus) {
      steps.push({ key: 'refundProposal', labelKey: 'progress.refundProposal', icon: Wallet,
        state: ret.fulfillment.refundProposalStatus === 'PENDING_BUYER' ? 'current' : 'done',
        timestamp: ret.fulfillment.refundProposedAt });
      if (ret.refundStatus === 'ISSUED') steps.push({ key: 'refund', labelKey: 'progress.refunded',
        icon: Wallet, state: 'done', timestamp: ret.refundedAt });
    }
    if (!ret.fulfillment?.refundProposalStatus || ['NONE', 'DECLINED'].includes(ret.fulfillment.refundProposalStatus)) {
      steps.push({ key: 'replacementPacked', labelKey: 'progress.replacementPacked', icon: Package,
        state: ret.fulfillment?.replacementPackedAt ? 'done'
          : ret.fulfillment?.receiptConfirmedAt ? 'current' : 'upcoming',
        timestamp: ret.fulfillment?.replacementPackedAt ?? null });
      steps.push({ key: 'replacement', labelKey: 'progress.replacementDispatched', icon: Truck,
        state: replacementLeg ? 'done' : ret.fulfillment?.receiptConfirmedAt ? 'current' : 'upcoming',
        timestamp: replacementLeg?.bookedAt ?? null });
      steps.push({ key: 'exchange', labelKey: 'progress.exchangeCompleted', icon: CheckCircle2,
        state: ret.fulfillment?.status === 'EXCHANGE_COMPLETED' ? 'done'
          : replacementLeg ? 'current' : 'upcoming',
        timestamp: ret.fulfillment?.replacementBuyerConfirmedAt ?? null });
    }
  }

  // Fix up: only one step should ever be "current" — the first non-done step in a state machine
  // that otherwise only moves forward.
  let currentSeen = false;
  for (const step of steps) {
    if (step.state === 'done') continue;
    if (currentSeen) {
      step.state = 'upcoming';
    } else {
      step.state = 'current';
      currentSeen = true;
    }
  }

  return steps;
}
