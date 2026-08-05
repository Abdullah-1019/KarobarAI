import type { AdminGmvTrendDTO, AdminReportsQueryInput, OrderReturnTrendDTO, SellerFraudFlag, SellerPerformanceDTO } from '@karobarai/shared';

import { enumerateDays, resolveDateRange } from '../../analytics/analytics.dateRange';
import * as repo from './reports.repository';

const CATEGORY_BASIS_NOTE =
  'groupBy=category is computed from realized order-item revenue (Feature 11 Task 3 basis), not settlement net — Settlement has no per-item breakdown, so these figures will not sum to the platform GMV total. See the handoff doc.';

const DEFAULT_SELLER_LIMIT = 10;

export async function gmvTrend(input: AdminReportsQueryInput): Promise<AdminGmvTrendDTO> {
  const range = resolveDateRange(input);
  const buckets = input.groupBy === 'seller' ? await repo.gmvBySeller(range) : input.groupBy === 'category' ? await repo.gmvByCategory(range) : await repo.gmvByDate(range);

  const points = buckets.map((b) => ({ key: b.key, gmv: b.gmv.toFixed(2) })).sort((a, b) => a.key.localeCompare(b.key));
  return {
    points,
    chart: { labels: points.map((p) => p.key), series: points.map((p) => Number(p.gmv)) },
    ...(input.groupBy === 'category' && { basisNote: CATEGORY_BASIS_NOTE }),
  };
}

export async function orderReturnTrend(input: AdminReportsQueryInput): Promise<OrderReturnTrendDTO> {
  const range = resolveDateRange(input);
  const buckets = await repo.orderAndReturnCountsByDate(range);
  const byDate = new Map(buckets.map((b) => [b.date, b]));

  const points = enumerateDays(range).map((date) => {
    const bucket = byDate.get(date);
    const orderCount = bucket?.orderCount ?? 0;
    const returnCount = bucket?.returnCount ?? 0;
    const returnRate = orderCount === 0 ? 0 : Number(((returnCount / orderCount) * 100).toFixed(2));
    return { date, orderCount, returnCount, returnRate };
  });
  return { points };
}

// BR-006: fraud flag at 20%, auto-suspend at 40% return-fraud rate (rolling 30 days). This
// feature only surfaces the flag for visibility (Task 5's own scope) — it does not implement
// automatic seller suspension when a seller crosses the 40% threshold; that enforcement action,
// if wanted, is a distinct Admin write action outside Task 5's read-only Reports scope.
function fraudFlag(rate: number): SellerFraudFlag {
  if (rate >= 0.4) return 'AUTO_SUSPEND';
  if (rate >= 0.2) return 'WARNING';
  return 'NONE';
}

export async function sellerPerformance(input: AdminReportsQueryInput): Promise<SellerPerformanceDTO> {
  const range = resolveDateRange(input);
  const limit = input.limit ?? DEFAULT_SELLER_LIMIT;
  const rows = await repo.sellerPerformance(range, limit);

  const items = rows.map((r) => {
    const denom = r.deliveredCount + r.cancelledCount;
    const rate = r.fraudRate30d.toNumber();
    return {
      sellerId: r.publicId,
      storeName: r.storeName,
      gmv: r.gmv.toFixed(2),
      fraudRate30d: rate,
      fraudFlag: fraudFlag(rate),
      fulfilmentRate: denom === 0 ? 0 : Number(((r.deliveredCount / denom) * 100).toFixed(2)),
    };
  });
  return { items };
}
