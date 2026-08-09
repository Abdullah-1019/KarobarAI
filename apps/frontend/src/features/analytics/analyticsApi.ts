import type {
  CategoryBreakdownDTO,
  CustomerAnalyticsDTO,
  OrderAnalyticsDTO,
  RevenueSummaryDTO,
  SalesTrendDTO,
  TopProductsDTO,
} from '@karobarai/shared';

import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';

// Feature 11 (Analytics Dashboard) — F11-analytics-backend.md. All 6 endpoints share the same
// DateRangeQueryInput shape (packages/shared's dateRangeQuerySchema), so one params type/query-key
// builder covers every call instead of six near-identical ones.
export interface AnalyticsRangeParams {
  range?: '7d' | '30d' | '3m' | 'custom';
  startDate?: string;
  endDate?: string;
}

export interface TopProductsParams extends AnalyticsRangeParams {
  limit?: number;
}

function rangeKeyParts(params: AnalyticsRangeParams) {
  return [params.range ?? '7d', params.startDate ?? null, params.endDate ?? null] as const;
}

export const revenueQueryKey = (params: AnalyticsRangeParams) => ['analytics', 'revenue', ...rangeKeyParts(params)] as const;
export function getRevenue(params: AnalyticsRangeParams): Promise<RevenueSummaryDTO> {
  return unwrap(apiClient.get<ApiEnvelope<RevenueSummaryDTO>>('/seller/analytics/revenue', { params }));
}

export const salesTrendQueryKey = (params: AnalyticsRangeParams) => ['analytics', 'sales-trend', ...rangeKeyParts(params)] as const;
export function getSalesTrend(params: AnalyticsRangeParams): Promise<SalesTrendDTO> {
  return unwrap(apiClient.get<ApiEnvelope<SalesTrendDTO>>('/seller/analytics/sales-trend', { params }));
}

export const categoryBreakdownQueryKey = (params: AnalyticsRangeParams) =>
  ['analytics', 'category-breakdown', ...rangeKeyParts(params)] as const;
export function getCategoryBreakdown(params: AnalyticsRangeParams): Promise<CategoryBreakdownDTO> {
  return unwrap(apiClient.get<ApiEnvelope<CategoryBreakdownDTO>>('/seller/analytics/category-breakdown', { params }));
}

export const orderAnalyticsQueryKey = (params: AnalyticsRangeParams) => ['analytics', 'orders', ...rangeKeyParts(params)] as const;
export function getOrderAnalytics(params: AnalyticsRangeParams): Promise<OrderAnalyticsDTO> {
  return unwrap(apiClient.get<ApiEnvelope<OrderAnalyticsDTO>>('/seller/analytics/orders', { params }));
}

export const customerAnalyticsQueryKey = (params: AnalyticsRangeParams) => ['analytics', 'customers', ...rangeKeyParts(params)] as const;
export function getCustomerAnalytics(params: AnalyticsRangeParams): Promise<CustomerAnalyticsDTO> {
  return unwrap(apiClient.get<ApiEnvelope<CustomerAnalyticsDTO>>('/seller/analytics/customers', { params }));
}

export const topProductsQueryKey = (params: TopProductsParams) =>
  ['analytics', 'top-products', ...rangeKeyParts(params), params.limit ?? 10] as const;
export function getTopProducts(params: TopProductsParams): Promise<TopProductsDTO> {
  return unwrap(apiClient.get<ApiEnvelope<TopProductsDTO>>('/seller/analytics/top-products', { params }));
}
