import { OrderStatus } from '@prisma/client';
import type { DateRangeQueryInput } from '@karobarai/shared';
import { z } from 'zod';

import { prisma } from '../../core/prisma';
import { getRevenueSummary, getTopProducts } from '../analytics/analytics.service';
import { getOrderAnalytics } from '../analytics/analytics.service';
import type { SellerAssistantContext } from './seller-context-builder.service';
import type { ChatToolDefinition, ToolCall } from './slm-client';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const periodBase = z.object({
  period: z.enum(['today', '7d', '30d', 'custom']).default('30d'),
  dateFrom: date.optional(),
  dateTo: date.optional(),
}).strict();

function validatePeriod(value: z.infer<typeof periodBase>, ctx: z.RefinementCtx) {
  if (value.period === 'custom') {
    if (!value.dateFrom || !value.dateTo) ctx.addIssue({ code: 'custom', message: 'Custom range requires dateFrom and dateTo' });
    else {
      const from = Date.parse(`${value.dateFrom}T00:00:00Z`);
      const to = Date.parse(`${value.dateTo}T00:00:00Z`);
      const validDate = (input: string) => {
        const parsed = new Date(`${input}T00:00:00Z`);
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === input;
      };
      if (!validDate(value.dateFrom) || !validDate(value.dateTo) || from > to) {
        ctx.addIssue({ code: 'custom', message: 'Invalid custom date range' });
      } else if ((to - from) / 86_400_000 > 89) {
        ctx.addIssue({ code: 'custom', message: 'Custom range cannot exceed 90 days' });
      }
    }
  } else if (value.dateFrom || value.dateTo) {
    ctx.addIssue({ code: 'custom', message: 'Dates are accepted only with period=custom' });
  }
}
const period = periodBase.superRefine(validatePeriod);

function dateRange(value: z.infer<typeof period>): DateRangeQueryInput {
  if (value.period === 'today') {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return { range: 'custom', startDate: `${key}T12:00:00`, endDate: `${key}T12:00:00` };
  }
  if (value.period === 'custom') return { range: 'custom', startDate: `${value.dateFrom}T12:00:00`, endDate: `${value.dateTo}T12:00:00` };
  return { range: value.period };
}

const orderStatusSchema = z.nativeEnum(OrderStatus);
const orderStatusArgs = z.object({ orderId: z.string().uuid().optional(), statusFilter: orderStatusSchema.optional() }).strict();
const topArgs = periodBase.extend({ limit: z.number().int().min(1).max(10).default(5) }).strict().superRefine(validatePeriod);
const inventoryArgs = z.object({ lowStockOnly: z.boolean().default(false) }).strict();
const limitArgs = z.object({ limit: z.number().int().min(1).max(10).default(5) }).strict();
const reviewArgs = z.object({ sortBy: z.enum(['most_reviewed', 'lowest_rated']) }).strict();
const noArgs = z.object({}).strict();

export const sellerTools: ChatToolDefinition[] = [
  { name: 'get_sales_summary', description: 'Get settled seller revenue and order metrics for a period.', parameters: { period: 'today|7d|30d|custom', dateFrom: 'YYYY-MM-DD?', dateTo: 'YYYY-MM-DD?' } },
  { name: 'get_order_status', description: 'Count or inspect a seller-owned order using its public ID and status.', parameters: { orderId: 'UUID?', statusFilter: 'OrderStatus?' } },
  { name: 'get_top_products', description: 'Get products ranked by realized revenue.', parameters: { period: 'today|7d|30d|custom', dateFrom: 'YYYY-MM-DD?', dateTo: 'YYYY-MM-DD?', limit: '1..10' } },
  { name: 'get_inventory_status', description: 'Read seller inventory. lowStockOnly=true returns products with zero available stock because no configurable low-stock threshold exists.', parameters: { lowStockOnly: 'boolean' } },
  { name: 'get_returns_summary', description: 'Count seller returns by status for a period.', parameters: { period: 'today|7d|30d|custom', dateFrom: 'YYYY-MM-DD?', dateTo: 'YYYY-MM-DD?' } },
  { name: 'get_high_return_products', description: 'Rank products by returned units as a share of delivered units.', parameters: { limit: '1..10' } },
  { name: 'get_review_summary', description: 'Summarize seller product review counts and ratings.', parameters: { sortBy: 'most_reviewed|lowest_rated' } },
  { name: 'get_delivery_stats', description: 'Count completed deliveries for a period.', parameters: { period: 'today|7d|30d|custom', dateFrom: 'YYYY-MM-DD?', dateTo: 'YYYY-MM-DD?' } },
  { name: 'generate_recommendations', description: 'Gather real seller performance, return, and stock data for recommendations.', parameters: {} },
];

function invalid() { return { ok: false, error: 'Invalid request. No data was accessed.' }; }

async function getReturnSummary(sellerId: bigint, rangeInput: DateRangeQueryInput) {
  const { resolveDateRange } = await import('../analytics/analytics.dateRange');
  const range = resolveDateRange(rangeInput);
  const rows = await prisma.return.groupBy({
    by: ['status'],
    where: { sellerId, createdAt: { gte: range.from, lte: range.to } },
    _count: { _all: true },
  });
  return { total: rows.reduce((sum, row) => sum + row._count._all, 0), byStatus: Object.fromEntries(rows.map((row) => [row.status, row._count._all])) };
}

async function getHighReturnProducts(sellerId: bigint, limit: number) {
  const [returned, delivered] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { sellerId, status: { in: ['DELIVERED', 'COMPLETED'] } },
        returnCases: { some: { sellerId } } },
      _sum: { quantity: true },
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { sellerId, status: { in: ['DELIVERED', 'COMPLETED'] } } },
      _sum: { quantity: true },
    }),
  ]);
  const denominators = new Map(delivered.map((row) => [row.productId.toString(), row._sum.quantity ?? 0]));
  const ranked = returned.map((row) => ({ productId: row.productId, returnedUnits: row._sum.quantity ?? 0, deliveredUnits: denominators.get(row.productId.toString()) ?? 0 }))
    .filter((row) => row.deliveredUnits > 0)
    .sort((a, b) => b.returnedUnits / b.deliveredUnits - a.returnedUnits / a.deliveredUnits)
    .slice(0, limit);
  if (!ranked.length) return [];
  const products = await prisma.product.findMany({
    where: { sellerId, productId: { in: ranked.map((row) => row.productId) }, deletedAt: null },
    select: { productId: true, titleEn: true, titleUr: true, publicId: true },
  });
  const byId = new Map(products.map((product) => [product.productId.toString(), product]));
  return ranked.flatMap((row) => {
    const product = byId.get(row.productId.toString());
    return product ? [{ productId: product.publicId, titleEn: product.titleEn, titleUr: product.titleUr, returnedUnits: row.returnedUnits, deliveredUnits: row.deliveredUnits, returnRatePercent: Number((100 * row.returnedUnits / row.deliveredUnits).toFixed(2)) }] : [];
  });
}

async function getReviewSummary(sellerId: bigint, sortBy: 'most_reviewed' | 'lowest_rated') {
  const rows = await prisma.review.groupBy({
    by: ['productId'],
    where: { deletedAt: null, product: { sellerId, deletedAt: null } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const ranked = rows.sort((a, b) => sortBy === 'most_reviewed'
    ? b._count._all - a._count._all
    : (a._avg.rating ?? 0) - (b._avg.rating ?? 0)).slice(0, 10);
  if (!ranked.length) return { totalReviews: 0, averageRating: null, products: [] };
  const products = await prisma.product.findMany({ where: { sellerId, productId: { in: ranked.map((row) => row.productId) }, deletedAt: null }, select: { productId: true, publicId: true, titleEn: true, titleUr: true } });
  const productMap = new Map(products.map((product) => [product.productId.toString(), product]));
  return {
    totalReviews: rows.reduce((sum, row) => sum + row._count._all, 0),
    averageRating: Number((rows.reduce((sum, row) => sum + (row._avg.rating ?? 0) * row._count._all, 0) / rows.reduce((sum, row) => sum + row._count._all, 0)).toFixed(2)),
    products: ranked.flatMap((row) => { const product = productMap.get(row.productId.toString()); return product ? [{ productId: product.publicId, titleEn: product.titleEn, titleUr: product.titleUr, reviewCount: row._count._all, averageRating: row._avg.rating === null ? null : Number(row._avg.rating.toFixed(2)) }] : []; }),
  };
}

export async function executeSellerTool(context: SellerAssistantContext, toolCall: ToolCall): Promise<unknown> {
  const sellerId = context.sellerId;
  try {
    switch (toolCall.type) {
      case 'get_sales_summary': {
        const parsed = period.safeParse(toolCall.payload); if (!parsed.success) return invalid();
        const range = dateRange(parsed.data);
        const [revenue, orders] = await Promise.all([getRevenueSummary(sellerId, range), getOrderAnalytics(sellerId, range)]);
        return { settledRevenue: revenue.current, currency: 'PKR', orders: orders.totalOrders, orderStatuses: orders.byStatus, revenueNote: 'Revenue includes settled seller settlements only.' };
      }
      case 'get_order_status': {
        const parsed = orderStatusArgs.safeParse(toolCall.payload); if (!parsed.success) return invalid();
        const where = { sellerId, ...(parsed.data.orderId ? { publicId: parsed.data.orderId } : {}), ...(parsed.data.statusFilter ? { status: parsed.data.statusFilter } : {}) };
        if (parsed.data.orderId) {
          const order = await prisma.order.findFirst({ where, select: { publicId: true, status: true, placedAt: true, deliveredAt: true } });
          return order ? { count: 1, orders: [order] } : { count: 0, orders: [] };
        }
        const [count, groups] = await Promise.all([prisma.order.count({ where }), prisma.order.groupBy({ by: ['status'], where, _count: { _all: true } })]);
        return { count, byStatus: Object.fromEntries(groups.map((row) => [row.status, row._count._all])) };
      }
      case 'get_top_products': {
        const parsed = topArgs.safeParse(toolCall.payload); if (!parsed.success) return invalid();
        return getTopProducts(sellerId, { ...dateRange(parsed.data), limit: parsed.data.limit } as DateRangeQueryInput);
      }
      case 'get_inventory_status': {
        const parsed = inventoryArgs.safeParse(toolCall.payload); if (!parsed.success) return invalid();
        const baseWhere = { sellerId, deletedAt: null };
        const where = { ...baseWhere, ...(parsed.data.lowStockOnly ? { stock: 0 } : {}) };
        const [totalProducts, inStockProducts, outOfStockProducts, products] = await Promise.all([
          prisma.product.count({ where }),
          prisma.product.count({ where: { ...baseWhere, stock: { gt: 0 } } }),
          prisma.product.count({ where: { ...baseWhere, stock: 0 } }),
          prisma.product.findMany({ where, orderBy: [{ stock: 'asc' }, { productId: 'asc' }], take: 50, select: { publicId: true, titleEn: true, titleUr: true, stock: true, status: true } }),
        ]);
        return {
          items: products,
          totalProducts,
          returnedProducts: products.length,
          hasMore: totalProducts > products.length,
          inventorySummary: { inStockProducts, outOfStockProducts },
          lowStockOnlyMeans: parsed.data.lowStockOnly ? 'zero available stock' : undefined,
        };
      }
      case 'get_returns_summary': {
        const parsed = period.safeParse(toolCall.payload); if (!parsed.success) return invalid();
        return getReturnSummary(sellerId, dateRange(parsed.data));
      }
      case 'get_high_return_products': {
        const parsed = limitArgs.safeParse(toolCall.payload); if (!parsed.success) return invalid();
        return getHighReturnProducts(sellerId, parsed.data.limit);
      }
      case 'get_review_summary': {
        const parsed = reviewArgs.safeParse(toolCall.payload); if (!parsed.success) return invalid();
        return getReviewSummary(sellerId, parsed.data.sortBy);
      }
      case 'get_delivery_stats': {
        const parsed = period.safeParse(toolCall.payload); if (!parsed.success) return invalid();
        const { resolveDateRange } = await import('../analytics/analytics.dateRange');
        const range = resolveDateRange(dateRange(parsed.data));
        const [delivered, statuses] = await Promise.all([
          prisma.order.count({ where: { sellerId, deliveredAt: { gte: range.from, lte: range.to } } }),
          prisma.order.groupBy({ by: ['status'], where: { sellerId, deliveredAt: { gte: range.from, lte: range.to } }, _count: { _all: true } }),
        ]);
        return { completedDeliveries: delivered, byCurrentStatus: Object.fromEntries(statuses.map((row) => [row.status, row._count._all])) };
      }
      case 'generate_recommendations': {
        if (!noArgs.safeParse(toolCall.payload).success) return invalid();
        const [sales, topProducts, returns, inventory] = await Promise.all([
          executeSellerTool(context, { type: 'get_sales_summary', payload: { period: '30d' } }),
          executeSellerTool(context, { type: 'get_top_products', payload: { period: '30d', limit: 5 } }),
          executeSellerTool(context, { type: 'get_high_return_products', payload: { limit: 5 } }),
          executeSellerTool(context, { type: 'get_inventory_status', payload: { lowStockOnly: true } }),
        ]);
        return { sales, topProducts, returns, inventory };
      }
      default:
        return { ok: false, error: 'Unsupported read-only tool. No action was performed.' };
    }
  } catch {
    return { ok: false, error: 'Seller data is temporarily unavailable. No changes were made.' };
  }
}
