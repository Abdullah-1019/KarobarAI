import { getCourierAdapter } from '../../adapters/courier';
import { getPaymentAdapter } from '../../adapters/payment';
import { createAuditLog } from '../../core/audit';
import { BusinessRuleError, NotFoundError } from '../../core/errors/AppError';
import { logger } from '../../core/logger';
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
export async function bookReturnPickupAndTriggerRefund(returnId: bigint): Promise<void> {
  const row = await repo.findReturnById(returnId);
  if (!row) return;

  try {
    await getCourierAdapter().book({
      courier: row.order.courier ?? 'TCS',
      orderId: row.order.publicId,
      destinationCity: row.order.shipCity,
    });
    await transitionReturnStatus(returnId, 'PICKUP_BOOKED');
  } catch (err) {
    logger.error(
      { err, returnId: returnId.toString() },
      '[returns] return-pickup booking failed — return stays APPROVED, needs manual attention',
    );
    return;
  }

  await triggerRefund(returnId);
}

// Task 6.2 — idempotent by construction: only ever proceeds from PICKUP_BOOKED, so a redelivered/
// duplicate call after the first success is a safe no-op (status is no longer PICKUP_BOOKED).
export async function triggerRefund(returnId: bigint): Promise<void> {
  const row = await repo.findReturnById(returnId);
  if (!row || row.status !== 'PICKUP_BOOKED') return;

  try {
    const result = await getPaymentAdapter().refund({
      orderPublicId: row.order.publicId,
      amount: Number(row.order.totalAmount),
      method: row.order.paymentMethod,
      idempotencyKey: `return-refund-${returnId}`,
    });
    if (result.status === 'CONFIRMED') {
      await transitionReturnStatus(returnId, 'REFUND_ISSUED', { refundedAt: new Date() });
      await enqueueNotification({
        userId: row.order.buyerId.toString(),
        type: 'REFUND_ISSUED',
        orderId: row.order.publicId,
        vars: { orderId: row.order.publicId },
      }).catch(() => undefined);
    }
  } catch (err) {
    // Task 6.5 — no new return_status value for failure; stays PICKUP_BOOKED, admin-filterable.
    logger.error(
      { err, returnId: returnId.toString() },
      '[returns] refund trigger failed — return stays PICKUP_BOOKED, visible to admin as stuck',
    );
  }
}

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
  if (row.status !== 'MANUAL_REVIEW' && row.status !== 'UNDER_DISPUTE') {
    throw new BusinessRuleError('Return is not awaiting a decision', { status: row.status }, 'RETURN_INVALID_STATE');
  }
  // Checked against the actual Dispute row, not row.status === 'UNDER_DISPUTE' — the status is
  // set alongside dispute creation by appealReturn() in real usage, but resolveDispute() itself
  // must not assume that pairing always holds; querying the real related record is the correct
  // and more robust check.
  const wasDisputed = row.dispute !== null;
  const isAdminDecision = actor.role !== 'SELLER';

  await prisma.$transaction(async (tx) => {
    await transitionReturnStatus(returnId, decision, { decision, decidedAt: new Date() }, tx);
    await createAuditLog(
      {
        actorId: actor.userId,
        action: auditAction,
        entity: 'returns',
        entityId: returnId,
        reason: reason ?? null,
        before: { status: row.status },
        after: { status: decision },
      },
      tx,
    );
    if (wasDisputed) {
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
    if (decision === 'REJECTED' && isAdminDecision) {
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

  if (decision === 'APPROVED') {
    await bookReturnPickupAndTriggerRefund(returnId);
  }
}
