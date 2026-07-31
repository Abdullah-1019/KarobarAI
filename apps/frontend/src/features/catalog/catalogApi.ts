import type {
  CategoryDTO,
  CreateProductInput,
  ProductDetailDTO,
  SellerProductListDTO,
  UpdateProductInput,
} from '@karobarai/shared';

import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';

// Feature 4 (Product Management) — F4-catalog-backend.md. `:productId` in every seller route
// below is actually matched against the product's `publicId` (ProductDetailDTO.id) on the
// backend, never the internal sequential product_id — so every call here takes `product.id`.

export const CATEGORIES_QUERY_KEY = ['catalog', 'categories'] as const;

export function getCategories(): Promise<CategoryDTO[]> {
  return unwrap(apiClient.get<ApiEnvelope<CategoryDTO[]>>('/categories'));
}

export function sellerProductsQueryKey(status?: string) {
  return ['catalog', 'seller-products', status ?? 'all'] as const;
}

export function listSellerProducts(status?: string, cursor?: string): Promise<SellerProductListDTO> {
  return unwrap(
    apiClient.get<ApiEnvelope<SellerProductListDTO>>('/seller/products', { params: { status, cursor } }),
  );
}

export function productQueryKey(id: string) {
  return ['catalog', 'product', id] as const;
}

// Public detail endpoint — also used for the seller's own edit/preview screen (the owning Seller
// may preview their own Draft here per F4-catalog-backend.md's "owner-preview exception").
export function getProduct(id: string): Promise<ProductDetailDTO> {
  return unwrap(apiClient.get<ApiEnvelope<ProductDetailDTO>>(`/products/${id}`));
}

export function createProduct(input: CreateProductInput): Promise<ProductDetailDTO> {
  return unwrap(apiClient.post<ApiEnvelope<ProductDetailDTO>>('/seller/products', input));
}

export function updateProduct(id: string, input: UpdateProductInput): Promise<ProductDetailDTO> {
  return unwrap(apiClient.patch<ApiEnvelope<ProductDetailDTO>>(`/seller/products/${id}`, input));
}

export function deleteProduct(id: string): Promise<{ deleted: true }> {
  return unwrap(apiClient.delete<ApiEnvelope<{ deleted: true }>>(`/seller/products/${id}`));
}

export function publishProduct(id: string): Promise<ProductDetailDTO> {
  return unwrap(apiClient.post<ApiEnvelope<ProductDetailDTO>>(`/seller/products/${id}/publish`));
}

export function unpublishProduct(id: string): Promise<ProductDetailDTO> {
  return unwrap(apiClient.post<ApiEnvelope<ProductDetailDTO>>(`/seller/products/${id}/unpublish`));
}

// Mock stub server-side (F4-catalog-backend.md) — always succeeds with a fixed listing unless
// ai-service itself is unreachable. Requires the product to already have >=1 image.
export function generateListing(id: string, hint?: string): Promise<ProductDetailDTO> {
  return unwrap(apiClient.post<ApiEnvelope<ProductDetailDTO>>(`/seller/products/${id}/generate-listing`, { hint }));
}

export function uploadProductImages(id: string, files: File[]): Promise<ProductDetailDTO> {
  const formData = new FormData();
  for (const file of files) formData.append('images', file);
  return unwrap(apiClient.post<ApiEnvelope<ProductDetailDTO>>(`/seller/products/${id}/images`, formData));
}

export function removeProductImage(id: string, imageId: string): Promise<ProductDetailDTO> {
  return unwrap(apiClient.delete<ApiEnvelope<ProductDetailDTO>>(`/seller/products/${id}/images/${imageId}`));
}

export function reorderProductImages(id: string, imageIds: string[]): Promise<ProductDetailDTO> {
  return unwrap(
    apiClient.patch<ApiEnvelope<ProductDetailDTO>>(`/seller/products/${id}/images/reorder`, { imageIds }),
  );
}
