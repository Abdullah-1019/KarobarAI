// Feature 12 (Admin Panel) DTOs. Every endpoint here is Admin/Support-only (role IN (ADMIN,
// SUPPORT)), platform-wide (ownership bypassed per Doc 5 §9) — distinct from Feature 11's
// seller-scoped analytics.
import type { ChartDataDTO } from './analytics';

export interface AdminKpiDTO {
  gmv: string;
  activeUsers: number;
  // Instantaneous Postgres+Redis reachability snapshot (0/50/100), NOT a true rolling uptime
  // percentage — no adapter/dependency call-counter infrastructure exists anywhere in this
  // codebase to compute one (see the handoff doc's known-limitation section).
  adapterUptime: number;
  pctChangeVsPrevious: number | null;
}

export interface AdminAlertFeedDTO {
  manualLogisticsOrders: number;
  stuckPayments: number;
  openDisputes: number;
  fraudFlaggedSellers: number;
}

export interface AdminUserListItemDTO {
  id: string; // publicId
  role: string;
  status: string;
  email: string | null;
  phone: string | null;
  storeName: string | null; // SELLER only
  fraudRate30d: number | null; // SELLER only
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminUserListDTO {
  items: AdminUserListItemDTO[];
  nextCursor: string | null;
}

export interface AdminUserDetailDTO extends AdminUserListItemDTO {
  onboardingCompletedAt: string | null; // SELLER only
  commissionRate: string | null; // SELLER only
  addressCount: number | null; // BUYER only
}

export interface AdminSuspendBanResultDTO {
  id: string;
  status: string;
  openOrdersCount?: number; // only present when banning a seller with open (non-terminal) orders
}

export interface AdminProductListItemDTO {
  id: string; // publicId
  titleEn: string;
  status: string;
  sellerId: string; // seller's publicId
  storeName: string;
  createdAt: string;
}

export interface AdminProductListDTO {
  items: AdminProductListItemDTO[];
  nextCursor: string | null;
}

export interface AdminProductDetailDTO extends AdminProductListItemDTO {
  titleUr: string | null;
  descriptionEn: string | null;
  price: string;
  stock: number;
}

export interface AdminModerationResultDTO {
  id: string;
  status: string;
}

export interface AdminGmvTrendPointDTO {
  key: string; // date (YYYY-MM-DD), sellerId, or categoryId depending on groupBy
  gmv: string;
}

export interface AdminGmvTrendDTO {
  points: AdminGmvTrendPointDTO[];
  chart: ChartDataDTO;
  // Only present when groupBy=category — see the handoff doc's known-limitation section: this
  // basis is realized order-item revenue, not settlement net, so it will not sum to `gmv` above.
  basisNote?: string;
}

export interface OrderReturnTrendPointDTO {
  date: string;
  orderCount: number;
  returnCount: number;
  returnRate: number;
}

export interface OrderReturnTrendDTO {
  points: OrderReturnTrendPointDTO[];
}

export type SellerFraudFlag = 'NONE' | 'WARNING' | 'AUTO_SUSPEND';

export interface SellerPerformanceItemDTO {
  sellerId: string; // publicId
  storeName: string;
  gmv: string;
  fraudRate30d: number;
  fraudFlag: SellerFraudFlag;
  fulfilmentRate: number; // % of orders reaching DELIVERED/COMPLETED vs. CANCELLED
}

export interface SellerPerformanceDTO {
  items: SellerPerformanceItemDTO[];
}

export interface AdminConfigEntryDTO {
  key: string;
  value: unknown;
  description: string | null;
  writable: boolean;
  updatedAt: string;
}

export interface AdminConfigListDTO {
  items: AdminConfigEntryDTO[];
}
