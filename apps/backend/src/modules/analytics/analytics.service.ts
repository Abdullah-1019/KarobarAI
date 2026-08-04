import type {
  CategoryBreakdownDTO,
  ChartDataDTO,
  CustomerAnalyticsDTO,
  DateRangeQueryInput,
  OrderAnalyticsDTO,
  RevenueSummaryDTO,
  SalesTrendDTO,
  TopProductsDTO,
} from '@karobarai/shared';
import type { OrderStatus } from '@prisma/client';

import { buildCacheKey, getOrCompute } from './analytics.cache';
import { enumerateDays, previousPeriod, resolveDateRange, yearToDateRange } from './analytics.dateRange';
import * as repo from './analytics.repository';

// Task 5.5 — ChartResponseFormatter: one shared shaping utility, reused by every chart-bearing
// endpoint (Tasks 3/4/5/6) rather than a one-off formatter per metric.
function toChart(labels: string[], series: number[]): ChartDataDTO {
  return { labels, series };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 2 — Revenue Aggregation
// ─────────────────────────────────────────────────────────────────────────────

export async function getRevenueSummary(sellerId: bigint, input: DateRangeQueryInput): Promise<RevenueSummaryDTO> {
  const range = resolveDateRange(input);
  const key = buildCacheKey(sellerId, 'revenue', range);
  return getOrCompute(key, async () => {
    const [current, previous, ytd] = await Promise.all([
      repo.sumSettledRevenue(sellerId, range),
      repo.sumSettledRevenue(sellerId, previousPeriod(range)),
      repo.sumSettledRevenue(sellerId, yearToDateRange()),
    ]);
    const pctChangeVsPrevious = previous.isZero() ? null : current.minus(previous).dividedBy(previous).times(100).toNumber();
    return {
      current: current.toFixed(2),
      previous: previous.toFixed(2),
      ytd: ytd.toFixed(2),
      pctChangeVsPrevious,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 3 — Sales Analytics
// ─────────────────────────────────────────────────────────────────────────────

export async function getSalesTrend(sellerId: bigint, input: DateRangeQueryInput): Promise<SalesTrendDTO> {
  const range = resolveDateRange(input);
  const key = buildCacheKey(sellerId, 'sales-trend', range);
  return getOrCompute(key, async () => {
    const buckets = await repo.dailyRevenueSeries(sellerId, range);
    const days = enumerateDays(range);
    const points = days.map((date) => {
      const bucket = buckets.get(date);
      return { date, revenue: (bucket?.revenue.toFixed(2) ?? '0.00'), orderCount: bucket?.orderCount ?? 0 };
    });
    return { points, chart: toChart(points.map((p) => p.date), points.map((p) => Number(p.revenue))) };
  });
}

export async function getCategoryBreakdown(sellerId: bigint, input: DateRangeQueryInput): Promise<CategoryBreakdownDTO> {
  const range = resolveDateRange(input);
  const key = buildCacheKey(sellerId, 'category-breakdown', range);
  return getOrCompute(key, async () => {
    const buckets = await repo.categoryRevenue(sellerId, range);
    const total = buckets.reduce((sum, b) => sum + b.revenue.toNumber(), 0);
    const items = buckets
      .map((b) => ({
        categoryId: b.categoryId,
        categoryNameEn: b.categoryNameEn,
        categoryNameUr: b.categoryNameUr,
        revenue: b.revenue.toFixed(2),
        pctOfTotal: total === 0 ? 0 : Number(((b.revenue.toNumber() / total) * 100).toFixed(2)),
      }))
      .sort((a, b) => Number(b.revenue) - Number(a.revenue));
    return { items, chart: toChart(items.map((i) => i.categoryNameEn), items.map((i) => Number(i.revenue))) };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 4 — Order Analytics
// ─────────────────────────────────────────────────────────────────────────────

const ALL_ORDER_STATUSES: OrderStatus[] = [
  'PAYMENT_PENDING',
  'PAYMENT_CONFIRMED',
  'PROCESSING',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'PENDING_MANUAL_LOGISTICS',
];

export async function getOrderAnalytics(sellerId: bigint, input: DateRangeQueryInput): Promise<OrderAnalyticsDTO> {
  const range = resolveDateRange(input);
  const key = buildCacheKey(sellerId, 'orders', range);
  return getOrCompute(key, async () => {
    const [statusCounts, avgValue] = await Promise.all([
      repo.countByStatus(sellerId, range),
      repo.avgOrderValue(sellerId, range),
    ]);
    const byStatus: Record<string, number> = {};
    for (const status of ALL_ORDER_STATUSES) byStatus[status] = statusCounts.get(status) ?? 0;
    const totalOrders = [...statusCounts.values()].reduce((sum, n) => sum + n, 0);
    const cancelledCount = statusCounts.get('CANCELLED') ?? 0;
    const cancelledRate = totalOrders === 0 ? 0 : Number(((cancelledCount / totalOrders) * 100).toFixed(2));
    return {
      totalOrders,
      byStatus,
      cancelledRate,
      avgOrderValue: avgValue.toFixed(2),
      chart: toChart(Object.keys(byStatus), Object.values(byStatus)),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 5 — Customer Analytics
// ─────────────────────────────────────────────────────────────────────────────

export async function getCustomerAnalytics(sellerId: bigint, input: DateRangeQueryInput): Promise<CustomerAnalyticsDTO> {
  const range = resolveDateRange(input);
  const key = buildCacheKey(sellerId, 'customers', range);
  return getOrCompute(key, async () => {
    const buyerIds = await repo.uniqueBuyerIds(sellerId, range);
    const firstOrders = await repo.firstOrderDates(sellerId, buyerIds);
    let newBuyers = 0;
    let repeatBuyers = 0;
    for (const buyerId of buyerIds) {
      const firstOrderDate = firstOrders.get(buyerId.toString());
      if (firstOrderDate && firstOrderDate >= range.from) {
        newBuyers += 1;
      } else {
        repeatBuyers += 1;
      }
    }
    const uniqueBuyers = buyerIds.length;
    const repeatRate = uniqueBuyers === 0 ? 0 : Number(((repeatBuyers / uniqueBuyers) * 100).toFixed(2));
    return { uniqueBuyers, newBuyers, repeatBuyers, repeatRate };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 6 — Top Products
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TOP_PRODUCTS_LIMIT = 10;

export async function getTopProducts(sellerId: bigint, input: DateRangeQueryInput): Promise<TopProductsDTO> {
  const range = resolveDateRange(input);
  const limit = input.limit ?? DEFAULT_TOP_PRODUCTS_LIMIT;
  const key = buildCacheKey(sellerId, 'top-products', { ...range, limit });
  return getOrCompute(key, async () => {
    const ranked = await repo.rankProductsByRevenue(sellerId, range, limit);
    const items = ranked.map((r) => ({
      productId: r.publicId,
      titleEn: r.titleEn,
      titleUr: r.titleUr,
      thumbnailUrl: r.thumbnailUrl,
      unitsSold: r.unitsSold,
      revenue: r.revenue.toFixed(2),
    }));
    return { items, chart: toChart(items.map((i) => i.titleEn), items.map((i) => Number(i.revenue))) };
  });
}
