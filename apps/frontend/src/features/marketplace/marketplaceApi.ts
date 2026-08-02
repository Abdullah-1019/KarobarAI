import type { CategorySummaryDTO, HomeFeedDTO, ProductCondition, SearchResultDTO } from '@karobarai/shared';

import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';

// Feature 5 (Buyer Marketplace) — F5-marketplace-backend.md. Almost entirely a thin composition
// layer over Feature 4: only /marketplace/home and /categories/:slug are new here. Search,
// autocomplete, product detail, and the category tree are Feature 4's existing endpoints,
// reused as-is from ../catalog/catalogApi (getCategories, getProduct) — not duplicated.

export const HOME_FEED_QUERY_KEY = ['marketplace', 'home'] as const;

export function getHomeFeed(): Promise<HomeFeedDTO> {
  return unwrap(apiClient.get<ApiEnvelope<HomeFeedDTO>>('/marketplace/home'));
}

export function categoryBySlugQueryKey(slug: string) {
  return ['marketplace', 'category', slug] as const;
}

export function getCategoryBySlug(slug: string): Promise<CategorySummaryDTO> {
  return unwrap(apiClient.get<ApiEnvelope<CategorySummaryDTO>>(`/categories/${slug}`));
}

export type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'rating';

export interface SearchParams {
  q?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: ProductCondition;
  sort?: SortOption;
}

export function searchQueryKey(params: SearchParams) {
  return ['marketplace', 'search', params] as const;
}

// Powers both text search (q set) and category-browse mode (categoryId-only, no q) — same
// endpoint, per F5's "Search and Listing are one data-layer mechanism" module-doc assumption.
export function searchProducts(params: SearchParams, cursor?: string): Promise<SearchResultDTO> {
  return unwrap(
    apiClient.get<ApiEnvelope<SearchResultDTO>>('/products/search', { params: { ...params, cursor } }),
  );
}

export function autocompleteQueryKey(q: string) {
  return ['marketplace', 'autocomplete', q] as const;
}

// Backend requires q.length >= 2 — callers should not fire this below that length.
export function autocomplete(q: string): Promise<{ id: string; title: string }[]> {
  return unwrap(apiClient.get<ApiEnvelope<{ id: string; title: string }[]>>('/products/autocomplete', { params: { q } }));
}
