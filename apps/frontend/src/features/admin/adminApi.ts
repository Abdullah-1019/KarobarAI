import type {
  AdminAlertFeedDTO,
  AdminConfigListDTO,
  AdminConfigEntryDTO,
  AdminGmvTrendDTO,
  AdminKpiDTO,
  AdminModerationResultDTO,
  AdminProductDetailDTO,
  AdminProductListDTO,
  AdminSuspendBanResultDTO,
  AdminUserDetailDTO,
  AdminUserListDTO,
  OrderReturnTrendDTO,
  ReturnDetailDTO,
  ReturnListDTO,
  SellerPerformanceDTO,
} from '@karobarai/shared';

import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';

// Feature 12 (Admin Panel) — F12-admin-panel-backend.md. Platform-wide, ADMIN/SUPPORT-only
// (ownership bypassed, distinct from Feature 11's seller-scoped analytics module).

// --- Dashboard ---

export interface AdminRangeParams {
  range?: '7d' | '30d' | '3m' | 'custom';
  startDate?: string;
  endDate?: string;
}

export const adminKpisQueryKey = (params: AdminRangeParams) =>
  ['admin', 'kpis', params.range ?? '7d', params.startDate ?? null, params.endDate ?? null] as const;
export function getAdminKpis(params: AdminRangeParams): Promise<AdminKpiDTO> {
  return unwrap(apiClient.get<ApiEnvelope<AdminKpiDTO>>('/admin/dashboard/kpis', { params }));
}

export const adminAlertsQueryKey = ['admin', 'alerts'] as const;
export function getAdminAlerts(): Promise<AdminAlertFeedDTO> {
  return unwrap(apiClient.get<ApiEnvelope<AdminAlertFeedDTO>>('/admin/dashboard/alerts'));
}

// --- User Management ---

export interface AdminUserSearchParams {
  role?: 'BUYER' | 'SELLER' | 'ADMIN' | 'SUPPORT';
  status?: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DEACTIVATED';
  search?: string;
}

export const adminUsersQueryKey = (params: AdminUserSearchParams) =>
  ['admin', 'users', params.role ?? null, params.status ?? null, params.search ?? null] as const;
export function listAdminUsers(params: AdminUserSearchParams, cursor?: string): Promise<AdminUserListDTO> {
  return unwrap(apiClient.get<ApiEnvelope<AdminUserListDTO>>('/admin/users', { params: { ...params, cursor } }));
}

export const adminUserDetailQueryKey = (id: string) => ['admin', 'users', 'detail', id] as const;
export function getAdminUserDetail(id: string): Promise<AdminUserDetailDTO> {
  return unwrap(apiClient.get<ApiEnvelope<AdminUserDetailDTO>>(`/admin/users/${id}`));
}

export function suspendUser(id: string, reason: string): Promise<AdminSuspendBanResultDTO> {
  return unwrap(apiClient.post<ApiEnvelope<AdminSuspendBanResultDTO>>(`/admin/users/${id}/suspend`, { reason }));
}

export function banUser(id: string, reason: string): Promise<AdminSuspendBanResultDTO> {
  return unwrap(apiClient.post<ApiEnvelope<AdminSuspendBanResultDTO>>(`/admin/users/${id}/ban`, { reason }));
}

export function reactivateUser(id: string, reason?: string): Promise<AdminSuspendBanResultDTO> {
  return unwrap(apiClient.post<ApiEnvelope<AdminSuspendBanResultDTO>>(`/admin/users/${id}/reactivate`, { reason }));
}

// --- Product Moderation ---

export interface AdminModerationParams {
  status?: 'DRAFT' | 'LIVE' | 'OUT_OF_STOCK' | 'REMOVED';
}

export const adminModerationQueryKey = (params: AdminModerationParams) => ['admin', 'moderation', params.status ?? null] as const;
export function listModerationQueue(params: AdminModerationParams, cursor?: string): Promise<AdminProductListDTO> {
  return unwrap(apiClient.get<ApiEnvelope<AdminProductListDTO>>('/admin/moderation/products', { params: { ...params, cursor } }));
}

export const adminProductDetailQueryKey = (id: string) => ['admin', 'moderation', 'detail', id] as const;
export function getAdminProductDetail(id: string): Promise<AdminProductDetailDTO> {
  return unwrap(apiClient.get<ApiEnvelope<AdminProductDetailDTO>>(`/admin/moderation/products/${id}`));
}

export function takedownProduct(id: string, reason: string): Promise<AdminModerationResultDTO> {
  return unwrap(apiClient.post<ApiEnvelope<AdminModerationResultDTO>>(`/admin/moderation/products/${id}/takedown`, { reason }));
}

export function restoreProduct(id: string, reason: string): Promise<AdminModerationResultDTO> {
  return unwrap(apiClient.post<ApiEnvelope<AdminModerationResultDTO>>(`/admin/moderation/products/${id}/restore`, { reason }));
}

// --- Reports ---

export interface AdminReportsParams extends AdminRangeParams {
  groupBy?: 'seller' | 'category';
  limit?: number;
}

export const gmvTrendQueryKey = (params: AdminReportsParams) =>
  ['admin', 'reports', 'gmv-trend', params.range ?? '7d', params.groupBy ?? null] as const;
export function getGmvTrend(params: AdminReportsParams): Promise<AdminGmvTrendDTO> {
  return unwrap(apiClient.get<ApiEnvelope<AdminGmvTrendDTO>>('/admin/reports/gmv-trend', { params }));
}

export const orderReturnTrendQueryKey = (params: AdminRangeParams) =>
  ['admin', 'reports', 'order-return-trend', params.range ?? '7d'] as const;
export function getOrderReturnTrend(params: AdminRangeParams): Promise<OrderReturnTrendDTO> {
  return unwrap(apiClient.get<ApiEnvelope<OrderReturnTrendDTO>>('/admin/reports/order-return-trend', { params }));
}

export const sellerPerformanceQueryKey = (params: AdminRangeParams) =>
  ['admin', 'reports', 'seller-performance', params.range ?? '7d'] as const;
export function getSellerPerformance(params: AdminRangeParams): Promise<SellerPerformanceDTO> {
  return unwrap(apiClient.get<ApiEnvelope<SellerPerformanceDTO>>('/admin/reports/seller-performance', { params }));
}

// --- Platform Settings (Config) ---

export const adminConfigQueryKey = ['admin', 'config'] as const;
export function listAdminConfig(): Promise<AdminConfigListDTO> {
  return unwrap(apiClient.get<ApiEnvelope<AdminConfigListDTO>>('/admin/config'));
}

export function patchAdminConfig(key: string, value: unknown, reason: string): Promise<AdminConfigEntryDTO> {
  return unwrap(apiClient.patch<ApiEnvelope<AdminConfigEntryDTO>>(`/admin/config/${key}`, { value, reason }));
}

// --- Returns Management (links to Feature 10's existing admin review backend — no new logic) ---

export const adminReturnsQueryKey = (history: boolean) => ['admin', 'returns', history ? 'history' : 'active'] as const;
export function listAdminReturns(history: boolean, cursor?: string): Promise<ReturnListDTO> {
  return unwrap(
    apiClient.get<ApiEnvelope<ReturnListDTO>>('/admin/returns', { params: { cursor, history: history ? 'true' : undefined } }),
  );
}

export const adminReturnDetailQueryKey = (id: string) => ['admin', 'returns', 'detail', id] as const;
export function getAdminReturnDetail(id: string): Promise<ReturnDetailDTO> {
  return unwrap(apiClient.get<ApiEnvelope<ReturnDetailDTO>>(`/admin/returns/${id}`));
}

export function adminDecideReturn(id: string, decision: 'APPROVED' | 'REJECTED', reason: string): Promise<ReturnDetailDTO> {
  return unwrap(apiClient.post<ApiEnvelope<ReturnDetailDTO>>(`/admin/returns/${id}/decision`, { decision, reason }));
}
