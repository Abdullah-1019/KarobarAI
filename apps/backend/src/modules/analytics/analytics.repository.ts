import { Prisma } from '@prisma/client';
import type { OrderStatus } from '@prisma/client';

import { prisma } from '../../core/prisma';
import { toLocalDateKey } from './analytics.dateRange';
import type { ResolvedRange } from './analytics.dateRange';

// Task 1.4/1.1 — plain functions, not a class hierarchy (the module doc's literal "AnalyticsRepository
// base class other analytics repos extend" framing is OOP-inheritance-flavored; this codebase has
// never used class-based repositories anywhere — every prior feature's repository is a set of
// exported functions, e.g. order.service.ts's queryOrders). Same practical reuse goal (shared
// helpers, no per-metric duplication), consistent shape with everything else in this codebase.

const REALIZED_STATUSES: OrderStatus[] = ['DELIVERED', 'COMPLETED'];

// ─────────────────────────────────────────────────────────────────────────────
// Task 2 — Revenue (settlements.net WHERE status=SETTLED — see the handoff doc's known
// limitation: this will sum to 0 until something creates Settlement rows).
// ─────────────────────────────────────────────────────────────────────────────

export async function sumSettledRevenue(sellerId: bigint, range: ResolvedRange): Promise<Prisma.Decimal> {
  const result = await prisma.settlement.aggregate({
    where: { sellerId, status: 'SETTLED', settledAt: { gte: range.from, lte: range.to } },
    _sum: { net: true },
  });
  return result._sum.net ?? new Prisma.Decimal(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 3 — Sales Analytics (daily trend + category breakdown), realized-sales basis
// (DELIVERED/COMPLETED, anchored on delivered_at per the module doc's own Engineering Decision).
// ─────────────────────────────────────────────────────────────────────────────

interface RealizedOrderRow {
  deliveredAt: Date | null;
  items: Array<{ unitPrice: Prisma.Decimal; quantity: number; product: { categoryId: bigint | null; category: { nameEn: string; nameUr: string } | null } }>;
}

async function findRealizedOrders(sellerId: bigint, range: ResolvedRange): Promise<RealizedOrderRow[]> {
  return prisma.order.findMany({
    where: { sellerId, status: { in: REALIZED_STATUSES }, deliveredAt: { gte: range.from, lte: range.to } },
    select: {
      deliveredAt: true,
      items: {
        select: {
          unitPrice: true,
          quantity: true,
          product: { select: { categoryId: true, category: { select: { nameEn: true, nameUr: true } } } },
        },
      },
    },
  });
}

export interface DailyBucket {
  date: string;
  revenue: Prisma.Decimal;
  orderCount: number;
}

export async function dailyRevenueSeries(sellerId: bigint, range: ResolvedRange): Promise<Map<string, DailyBucket>> {
  const orders = await findRealizedOrders(sellerId, range);
  const buckets = new Map<string, DailyBucket>();
  for (const order of orders) {
    if (!order.deliveredAt) continue;
    const date = toLocalDateKey(order.deliveredAt);
    const orderRevenue = order.items.reduce((sum, item) => sum.plus(item.unitPrice.times(item.quantity)), new Prisma.Decimal(0));
    const existing = buckets.get(date);
    if (existing) {
      existing.revenue = existing.revenue.plus(orderRevenue);
      existing.orderCount += 1;
    } else {
      buckets.set(date, { date, revenue: orderRevenue, orderCount: 1 });
    }
  }
  return buckets;
}

export interface CategoryBucket {
  categoryId: string | null;
  categoryNameEn: string;
  categoryNameUr: string;
  revenue: Prisma.Decimal;
}

// Task 3's own flagged gap (Unresolved Doc Gap #2): products.category_id may be NULL. Resolved
// here with a synthetic "Uncategorized" bucket rather than silent exclusion — silently dropping
// that revenue from the breakdown would make the percentages lie about the period's real total.
export async function categoryRevenue(sellerId: bigint, range: ResolvedRange): Promise<CategoryBucket[]> {
  const orders = await findRealizedOrders(sellerId, range);
  const buckets = new Map<string, CategoryBucket>();
  for (const order of orders) {
    for (const item of order.items) {
      const key = item.product.categoryId ? item.product.categoryId.toString() : 'uncategorized';
      const lineRevenue = item.unitPrice.times(item.quantity);
      const existing = buckets.get(key);
      if (existing) {
        existing.revenue = existing.revenue.plus(lineRevenue);
      } else {
        buckets.set(key, {
          categoryId: item.product.categoryId ? item.product.categoryId.toString() : null,
          categoryNameEn: item.product.category?.nameEn ?? 'Uncategorized',
          categoryNameUr: item.product.category?.nameUr ?? 'غیر درجہ بند',
          revenue: lineRevenue,
        });
      }
    }
  }
  return [...buckets.values()];
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 4 — Order Analytics, placed_at-anchored (all statuses, including CANCELLED/in-flight).
// ─────────────────────────────────────────────────────────────────────────────

export async function countByStatus(sellerId: bigint, range: ResolvedRange): Promise<Map<OrderStatus, number>> {
  const rows = await prisma.order.groupBy({
    by: ['status'],
    where: { sellerId, placedAt: { gte: range.from, lte: range.to } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.status, r._count._all]));
}

export async function avgOrderValue(sellerId: bigint, range: ResolvedRange): Promise<Prisma.Decimal> {
  const result = await prisma.order.aggregate({
    where: { sellerId, placedAt: { gte: range.from, lte: range.to }, status: { not: 'CANCELLED' } },
    _avg: { totalAmount: true },
  });
  return result._avg.totalAmount ?? new Prisma.Decimal(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 5 — Customer Analytics. New-vs-repeat classified against the buyer's lifetime order
// history with this seller (not range-bounded) — the module doc's own Engineering Decision.
// ─────────────────────────────────────────────────────────────────────────────

export async function uniqueBuyerIds(sellerId: bigint, range: ResolvedRange): Promise<bigint[]> {
  const rows = await prisma.order.findMany({
    where: { sellerId, placedAt: { gte: range.from, lte: range.to } },
    select: { buyerId: true },
    distinct: ['buyerId'],
  });
  return rows.map((r) => r.buyerId);
}

// For each buyer active in-range, their earliest-ever order with this seller (lifetime, not
// range-bounded) — the classification basis.
export async function firstOrderDates(sellerId: bigint, buyerIds: bigint[]): Promise<Map<string, Date>> {
  if (buyerIds.length === 0) return new Map();
  const rows = await prisma.order.groupBy({
    by: ['buyerId'],
    where: { sellerId, buyerId: { in: buyerIds } },
    _min: { placedAt: true },
  });
  return new Map(rows.filter((r) => r._min.placedAt).map((r) => [r.buyerId.toString(), r._min.placedAt as Date]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 6 — Top Products, realized-sales basis (same as Task 3), soft-deleted products excluded.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductRankRow {
  productId: bigint;
  publicId: string;
  titleEn: string;
  titleUr: string | null;
  thumbnailUrl: string | null;
  unitsSold: number;
  revenue: Prisma.Decimal;
}

export async function rankProductsByRevenue(sellerId: bigint, range: ResolvedRange, limit: number): Promise<ProductRankRow[]> {
  const items = await prisma.orderItem.findMany({
    where: {
      order: { sellerId, status: { in: REALIZED_STATUSES }, deliveredAt: { gte: range.from, lte: range.to } },
    },
    select: {
      productId: true,
      unitPrice: true,
      quantity: true,
      product: {
        select: {
          publicId: true,
          titleEn: true,
          titleUr: true,
          deletedAt: true,
          images: { where: { position: 0 }, select: { cdnUrl: true }, take: 1 },
        },
      },
    },
  });

  const byProduct = new Map<string, ProductRankRow>();
  for (const item of items) {
    if (item.product.deletedAt) continue; // Task 6's soft-delete exclusion
    const key = item.productId.toString();
    const lineRevenue = item.unitPrice.times(item.quantity);
    const existing = byProduct.get(key);
    if (existing) {
      existing.revenue = existing.revenue.plus(lineRevenue);
      existing.unitsSold += item.quantity;
    } else {
      byProduct.set(key, {
        productId: item.productId,
        publicId: item.product.publicId,
        titleEn: item.product.titleEn,
        titleUr: item.product.titleUr,
        thumbnailUrl: item.product.images[0]?.cdnUrl ?? null,
        unitsSold: item.quantity,
        revenue: lineRevenue,
      });
    }
  }

  return [...byProduct.values()].sort((a, b) => b.revenue.comparedTo(a.revenue)).slice(0, limit);
}
