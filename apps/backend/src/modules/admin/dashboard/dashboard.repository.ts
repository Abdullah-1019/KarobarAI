import { Prisma } from '@prisma/client';

import { prisma } from '../../../core/prisma';
import type { ResolvedRange } from '../../analytics/analytics.dateRange';

// Task 2.1 — same SUM(net) query shape as Feature 11's sumSettledRevenue, deliberately not
// imported/reused directly: that function's signature is sellerId-scoped by design (Doc 5 §9's
// ownership rule for the seller-facing endpoint it serves); this one is the Admin/Support
// ownership-bypass version (Task 2's own Engineering Decision — same shape, no sellerId filter,
// so platform GMV and seller-level revenue are always computed from an identical source-of-truth
// definition). Conscious minimal duplication of a ~5-line query, same choice Feature 10's
// returns.service.ts already made for a comparably small predicate.
export async function platformGmv(range: ResolvedRange): Promise<Prisma.Decimal> {
  const result = await prisma.settlement.aggregate({
    where: { status: 'SETTLED', settledAt: { gte: range.from, lte: range.to } },
    _sum: { net: true },
  });
  return result._sum.net ?? new Prisma.Decimal(0);
}

// Task 2.2/Assumption #1 — no source document defines "active users" precisely; this counts
// distinct Buyer/Seller accounts (Admin/Support logins aren't a platform-activity signal) whose
// last_login_at falls in range. Flagged as an Assumption, not silently treated as settled fact.
export async function activeUsers(range: ResolvedRange): Promise<number> {
  return prisma.user.count({
    where: { role: { in: ['BUYER', 'SELLER'] }, lastLoginAt: { gte: range.from, lte: range.to } },
  });
}

const STUCK_PAYMENT_AGE_MS = 24 * 60 * 60 * 1000;

export interface AlertCounts {
  manualLogisticsOrders: number;
  stuckPayments: number;
  openDisputes: number;
  fraudFlaggedSellers: number;
}

// Task 2.4 — computed live from existing tables every request, never persisted redundantly
// (Common Errors' explicit warning against a new mutable "alerts" table).
export async function alertCounts(): Promise<AlertCounts> {
  const stuckCutoff = new Date(Date.now() - STUCK_PAYMENT_AGE_MS);
  const [manualLogisticsOrders, stuckPayments, openDisputes, fraudFlaggedSellers] = await Promise.all([
    prisma.order.count({ where: { status: 'PENDING_MANUAL_LOGISTICS' } }),
    prisma.payment.count({ where: { status: 'PENDING', createdAt: { lte: stuckCutoff } } }),
    prisma.return.count({ where: { status: { in: ['MANUAL_REVIEW', 'UNDER_DISPUTE'] } } }),
    // BR-006: 20% flag threshold — includes both the WARNING and AUTO_SUSPEND tiers (>=40% is
    // also >=20%), since this is a single "needs attention" count, not a tiered breakdown
    // (Task 5's seller-performance report is where the WARNING/AUTO_SUSPEND distinction surfaces).
    prisma.sellerProfile.count({ where: { fraudRate30d: { gte: new Prisma.Decimal(0.2) } } }),
  ]);
  return { manualLogisticsOrders, stuckPayments, openDisputes, fraudFlaggedSellers };
}
