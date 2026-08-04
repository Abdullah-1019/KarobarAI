// Feature 11 (Analytics Dashboard) DTOs. Seller-scoped only (SCR-S08) — Admin's platform-wide
// KPIs live at the existing, separate SCR-AD01 and are not duplicated here.

export interface ChartDataDTO {
  labels: string[];
  series: number[];
}

export interface RevenueSummaryDTO {
  // Sourced from settlements.net WHERE status=SETTLED (Task 2's Engineering Decision) — will be
  // "0.00" for every seller until something creates Settlement rows (see the handoff doc's known
  // limitation; no code anywhere in this codebase does yet).
  current: string;
  previous: string;
  ytd: string;
  pctChangeVsPrevious: number | null; // null when the previous period has zero revenue (divide-by-zero guard)
}

export interface DailyTrendPointDTO {
  date: string; // YYYY-MM-DD
  revenue: string;
  orderCount: number;
}

export interface SalesTrendDTO {
  points: DailyTrendPointDTO[]; // zero-filled, continuous across the full range
  chart: ChartDataDTO;
}

export interface CategoryBreakdownItemDTO {
  categoryId: string | null; // null = the synthetic "Uncategorized" bucket (Task 3's own flagged gap, resolved here)
  categoryNameEn: string;
  categoryNameUr: string;
  revenue: string;
  pctOfTotal: number;
}

export interface CategoryBreakdownDTO {
  items: CategoryBreakdownItemDTO[];
  chart: ChartDataDTO;
}

export interface OrderAnalyticsDTO {
  totalOrders: number;
  byStatus: Record<string, number>;
  cancelledRate: number; // 0 when totalOrders is 0
  avgOrderValue: string;
  chart: ChartDataDTO;
}

export interface CustomerAnalyticsDTO {
  uniqueBuyers: number;
  newBuyers: number;
  repeatBuyers: number;
  repeatRate: number; // 0 when uniqueBuyers is 0
}

export interface TopProductItemDTO {
  productId: string; // publicId
  titleEn: string;
  titleUr: string | null;
  thumbnailUrl: string | null;
  unitsSold: number;
  revenue: string;
}

export interface TopProductsDTO {
  items: TopProductItemDTO[];
  chart: ChartDataDTO;
}
