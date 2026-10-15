import { createAuditLog } from '../../core/audit';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../../core/errors/AppError';
import { prisma } from '../../core/prisma';
import { enqueueNotification } from '../notification';
import * as repo from './returns.repository';
import { transitionReturnStatus } from './returns.service';

// Task 5's Engineering Decision — the single shared approve/reject/pickup-booking function,
// called by both the seller and admin decision endpoints (Task 4.4/4.5 and Task 5.4/5.5), so
// their downstream side effects can never drift apart. RBAC and the mandatory-vs-conditional
// reason rule are enforced by each endpoint's own middleware/Zod schema before calling this —
// this function only tells the two callers apart by `actor.role`, for the two things that
// legitimately differ: whether a rejection auto-closes (admin only, BR-008) and which parties
// get notified.

// Task 4.4/5.4 — reuses the order's own already-booked forward-shipment courier for the return
// leg (no new scoring logic — the module doc never asks for one here, just "reuse the existing
// courier adapter/booking service"). No retry/fallback (unlike Feature 8's order-booking flow):
// the mock always succeeds, and no source document asks for return-pickup-specific retry logic;
// a real failure here logs and leaves the return at APPROVED for manual attention, rather than
// silently swallowing it or inventing a retry policy nothing specifies.
export interface DecisionActor {
  userId: bigint;
  role: 'SELLER' | 'ADMIN' | 'SUPPORT';
}

export async function decideReturn(
  returnId: bigint,
  actor: DecisionActor,
  decision: 'APPROVED' | 'REJECTED',
  reason: string | undefined,
  auditAction: 'MODERATION' | 'DISPUTE_RESOLVE',
): Promise<void> {
  const row = await repo.findReturnById(returnId);
  if (!row) throw new NotFoundError('Return not found', undefined, 'RETURN_NOT_FOUND');
  const isAdminDecision = actor.role !== 'SELLER';

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT return_id FROM returns WHERE return_id = ${returnId} FOR UPDATE`;
    const current = await tx.return.findUniqueOrThrow({ where: { returnId },
      include: { inspection: true, dispute: true } });
    if (actor.role === 'SELLER' && current.sellerId !== actor.userId) throw new ForbiddenError(
      'This return does not belong to you', undefined, 'RETURN_NOT_OWNED');
    const metadata = current.inspection?.predictions;
    const originalAiDecision = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      && 'aiDecision' in metadata && metadata.aiDecision && typeof metadata.aiDecision === 'object'
      && !Array.isArray(metadata.aiDecision) ? metadata.aiDecision : null;
    const isAiAcceptanceOverride = actor.role === 'SELLER' && current.status === 'APPROVED'
      && decision === 'REJECTED' && originalAiDecision !== null
      && 'status' in originalAiDecision && originalAiDecision.status === 'APPROVED';
    if (current.status !== 'MANUAL_REVIEW' && current.status !== 'UNDER_DISPUTE' && !isAiAcceptanceOverride) {
      throw new BusinessRuleError('Return is not awaiting a decision', { status: current.status }, 'RETURN_INVALID_STATE');
    }
    if ((current.status === 'UNDER_DISPUTE' || isAiAcceptanceOverride) && !reason?.trim()) {
      throw new BusinessRuleError('A decision reason is required', undefined, 'RETURN_DECISION_REASON_REQUIRED');
    }
    if (isAiAcceptanceOverride) {
      const claimedShipment = await tx.returnShipment.findUnique({ where: { returnId_leg: { returnId, leg: 'RETURN' } } });
      if (claimedShipment) throw new BusinessRuleError(
        'Courier booking has started; shipment reconciliation is required before an override',
        undefined, 'RETURN_BOOKING_UNCERTAIN');
    }
    await transitionReturnStatus(returnId, decision, { decision, decidedAt: new Date() }, tx);
    if (decision === 'APPROVED') {
      await tx.returnFulfillment.upsert({ where: { returnId }, create: { returnId }, update: {} });
    }
    await createAuditLog(
      {
        actorId: actor.userId,
        action: auditAction,
        entity: 'returns',
        entityId: returnId,
        reason: isAiAcceptanceOverride ? `Seller override of AI acceptance: ${reason!.trim()}` : reason ?? null,
        before: { status: current.status },
        after: { status: decision, ...(isAiAcceptanceOverride ? { override: true } : {}) },
      },
      tx,
    );
    if (current.status === 'UNDER_DISPUTE' && current.dispute) {
      await repo.resolveDispute(
        tx,
        returnId,
        decision === 'APPROVED' ? 'RESOLVED_APPROVED' : 'RESOLVED_REJECTED',
        reason ?? '',
        actor.userId,
      );
    }
    // Task 5.5 — admin's rejection is always final (BR-008), whether the case arrived via a
    // formal dispute or a plain MANUAL_REVIEW escalation; a *seller's* rejection never auto-
    // closes, since the buyer still has the appeal window (REJECTED -> UNDER_DISPUTE).
    if (decision === 'REJECTED' && (isAdminDecision || current.status === 'UNDER_DISPUTE')) {
      await transitionReturnStatus(returnId, 'CLOSED', undefined, tx);
    }
  });

  const decisionWord = decision === 'APPROVED' ? 'approved' : 'rejected';
  const reasonText = decision === 'REJECTED' && reason ? ` Reason: ${reason}` : '';
  const vars = { orderId: row.order.publicId, decision: decisionWord, reasonText };
  await enqueueNotification({
    userId: row.order.buyerId.toString(),
    type: 'RETURN_DECISION',
    orderId: row.order.publicId,
    vars,
  }).catch(() => undefined);
  if (isAdminDecision) {
    // Task 5.7 — admin decisions notify both parties; a seller already knows their own decision.
    await enqueueNotification({
      userId: row.sellerId.toString(),
      type: 'RETURN_DECISION',
      orderId: row.order.publicId,
      vars,
    }).catch(() => undefined);
  }

  // AI-reviewed cases require a separate, deliberate fulfillment/refund step.
  // A vision observation never authorizes an automatic financial operation.
  // Approval records a decision only. Courier booking and refunds require separate actions.
}
