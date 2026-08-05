import { Prisma } from '@prisma/client';
import type { OrderStatus } from '@prisma/client';

import { prisma } from '../../../core/prisma';
import { toLocalDateKey } from '../../analytics/analytics.dateRange';
import type { ResolvedRange } from '../../analytics/analytics.dateRange';

// ─────────────────────────────────────────────────────────────────────────────
// Task 5.1 — GMV trend, three shapes. Default (by date) and groupBy=seller both extend Task 2.1's
// SUM(net) OVER settlements query shape with an added GROUP BY dimension — same basis, sums
// consistently to the platform GMV total. groupBy=category does NOT: Settlement has no per-item
// breakdown (one row per order, not per order_item), so a category split of settled net revenue
// isn't representable in the current schema. Implemented instead on the same realized-order-item
// revenue basis Feature 11 Task 3 already uses for its own category breakdown — a genuinely
// different number from settlement-based GMV (see the handoff doc's known-limitation section;
// this is a real gap in the module doc itself, which asks for one groupBy param across two
// incompatible revenue bases without acknowledging the mismatch).
// ─────────────────────────────────────────────────────────────────────────────

export interface DateBucket {
  key: string;
  gmv: Prisma.Decimal;
}

export async function gmvByDate(range: ResolvedRange): Promise<DateBucket[]> {
  const rows = await prisma.settlement.findMany({
    where: { status: 'SETTLED', settledAt: { gte: range.from, lte: range.to } },
    select: { net: true, settledAt: true },
  });
  const buckets = new Map<string, Prisma.Decimal>();
  for (const row of rows) {
    if (!row.settledAt) continue;
    const key = toLocalDateKey(row.settledAt);
    buckets.set(key, (buckets.get(key) ?? new Prisma.Decimal(0)).plus(row.net));
  }
  return [...buckets.entries()].map(([key, gmv]) => ({ key, gmv }));
}

export async function gmvBySeller(range: ResolvedRange): Promise<DateBucket[]> {
  const rows = await prisma.settlement.groupBy({
    by: ['sellerId'],
    where: { status: 'SETTLED', settledAt: { gte: range.from, lte: range.to } },
    _sum: { net: true },
  });
  if (rows.length === 0) return [];
  const sellers = await prisma.sellerProfile.findMany({
    where: { userId: { in: rows.map((r) => r.sellerId) } },
    select: { userId: true, storeName: true },
  });
  const storeNameById = new Map(sellers.map((s) => [s.userId.toString(), s.storeName]));
  return rows.map((r) => ({
    key: storeNameById.get(r.sellerId.toString()) ?? r.sellerId.toString(),
    gmv: r._sum.net ?? new Prisma.Decimal(0),
  }));
}

// Realized-order-item basis (Feature 11 Task 3's pattern, platform-wide — no sellerId filter).
export async function gmvByCategory(range: ResolvedRange): Promise<DateBucket[]> {
  const orders = await prisma.order.findMany({
    where: { status: { in: ['DELIVERED', 'COMPLETED'] }, deliveredAt: { gte: range.from, lte: range.to } },
    select: { items: { select: { unitPrice: true, quantity: true, product: { select: { category: { select: { nameEn: true } } } } } } },
  });
  const buckets = new Map<string, Prisma.Decimal>();
  for (const order of orders) {
    for (const item of order.items) {
      const key = item.product.category?.nameEn ?? 'Uncategorized';
      const lineRevenue = item.unitPrice.times(item.quantity);
      buckets.set(key, (buckets.get(key) ?? new Prisma.Decimal(0)).plus(lineRevenue));
    }
  }
  return [...buckets.entries()].map(([key, gmv]) => ({ key, gmv }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 5.2 — order/return volume trend, zero-guarded return rate per bucket.
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderReturnBucket {
  date: string;
  orderCount: number;
  returnCount: number;
}

export async function orderAndReturnCountsByDate(range: ResolvedRange): Promise<OrderReturnBucket[]> {
  const [orders, returns] = await Promise.all([
    prisma.order.findMany({ where: { placedAt: { gte: range.from, lte: range.to } }, select: { placedAt: true } }),
    prisma.return.findMany({ where: { createdAt: { gte: range.from, lte: range.to } }, select: { createdAt: true } }),
  ]);
  const orderBuckets = new Map<string, number>();
  for (const o of orders) orderBuckets.set(toLocalDateKey(o.placedAt), (orderBuckets.get(toLocalDateKey(o.placedAt)) ?? 0) + 1);
  const returnBuckets = new Map<string, number>();
  for (const r of returns) returnBuckets.set(toLocalDateKey(r.createdAt), (returnBuckets.get(toLocalDateKey(r.createdAt)) ?? 0) + 1);

  const allDates = new Set([...orderBuckets.keys(), ...returnBuckets.keys()]);
  return [...allDates].map((date) => ({
    date,
    orderCount: orderBuckets.get(date) ?? 0,
    returnCount: returnBuckets.get(date) ?? 0,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 5.3 — ranked seller performance: GMV (5.1's per-seller grouping), fraud rate (read
// directly from seller_profiles.fraud_rate_30d, never recomputed here per this task's own
// Engineering Decision), fulfilment rate (% orders DELIVERED/COMPLETED vs CANCELLED in range).
// ─────────────────────────────────────────────────────────────────────────────

export interface SellerPerformanceRow {
  sellerId: bigint;
  publicId: string;
  storeName: string;
  fraudRate30d: Prisma.Decimal;
  gmv: Prisma.Decimal;
  deliveredCount: number;
  cancelledCount: number;
}

export async function sellerPerformance(range: ResolvedRange, limit: number): Promise<SellerPerformanceRow[]> {
  const gmvRows = await prisma.settlement.groupBy({
    by: ['sellerId'],
    where: { status: 'SETTLED', settledAt: { gte: range.from, lte: range.to } },
    _sum: { net: true },
    orderBy: { _sum: { net: 'desc' } },
    take: limit,
  });
  if (gmvRows.length === 0) return [];

  const sellerIds = gmvRows.map((r) => r.sellerId);
  const [sellers, statusCounts] = await Promise.all([
    prisma.sellerProfile.findMany({
      where: { userId: { in: sellerIds } },
      select: { userId: true, storeName: true, fraudRate30d: true, user: { select: { publicId: true } } },
    }),
    prisma.order.groupBy({
      by: ['sellerId', 'status'],
      where: { sellerId: { in: sellerIds }, placedAt: { gte: range.from, lte: range.to }, status: { in: ['DELIVERED', 'COMPLETED', 'CANCELLED'] as OrderStatus[] } },
      _count: { _all: true },
    }),
  ]);

  const sellerById = new Map(sellers.map((s) => [s.userId.toString(), s]));
  const deliveredBySeller = new Map<string, number>();
  const cancelledBySeller = new Map<string, number>();
  for (const row of statusCounts) {
    const key = row.sellerId.toString();
    if (row.status === 'CANCELLED') cancelledBySeller.set(key, (cancelledBySeller.get(key) ?? 0) + row._count._all);
    else deliveredBySeller.set(key, (deliveredBySeller.get(key) ?? 0) + row._count._all);
  }

  return gmvRows
    .map((r) => {
      const seller = sellerById.get(r.sellerId.toString());
      if (!seller) return null;
      return {
        sellerId: r.sellerId,
        publicId: seller.user.publicId,
        storeName: seller.storeName,
        fraudRate30d: seller.fraudRate30d,
        gmv: r._sum.net ?? new Prisma.Decimal(0),
        deliveredCount: deliveredBySeller.get(r.sellerId.toString()) ?? 0,
        cancelledCount: cancelledBySeller.get(r.sellerId.toString()) ?? 0,
      };
    })
    .filter((row): row is SellerPerformanceRow => row !== null);
}
